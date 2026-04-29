# ── Random master password ────────────────────────────────────────────────────
resource "random_password" "rds_master" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# ── Secrets Manager secret (stores master credentials) ───────────────────────
resource "aws_secretsmanager_secret" "rds_master" {
  name                    = "nova-rewards/${var.environment}/rds-master"
  description             = "Nova Rewards RDS master credentials"
  recovery_window_in_days = 7

  tags = {
    Environment = var.environment
    Project     = "nova-rewards"
  }
}

resource "aws_secretsmanager_secret_version" "rds_master" {
  secret_id = aws_secretsmanager_secret.rds_master.id
  secret_string = jsonencode({
    username = var.db_master_username
    password = random_password.rds_master.result
    host     = aws_db_instance.nova.address
    port     = 5432
    dbname   = var.db_name
  })

  # Replaced by rotation after first apply; ignore drift
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ── Automatic 90-day rotation ─────────────────────────────────────────────────
resource "aws_secretsmanager_secret_rotation" "rds_master" {
  secret_id           = aws_secretsmanager_secret.rds_master.id
  rotation_lambda_arn = aws_lambda_function.secret_rotation.arn

  rotation_rules {
    automatically_after_days = 90
  }
}

# ── Rotation Lambda (uses AWS-managed SecretsManager rotation for RDS PG) ────
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "rotation_lambda" {
  name               = "nova-rewards-secret-rotation-${var.environment}"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "rotation_lambda_basic" {
  role       = aws_iam_role.rotation_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "rotation_lambda_vpc" {
  role       = aws_iam_role.rotation_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

data "aws_iam_policy_document" "rotation_lambda_secrets" {
  statement {
    actions   = ["secretsmanager:*", "rds-db:connect"]
    resources = [aws_secretsmanager_secret.rds_master.arn]
  }
}

resource "aws_iam_role_policy" "rotation_lambda_secrets" {
  name   = "allow-secret-rotation"
  role   = aws_iam_role.rotation_lambda.id
  policy = data.aws_iam_policy_document.rotation_lambda_secrets.json
}

# Deploy the AWS-provided Serverless Application for RDS PostgreSQL rotation
resource "aws_serverlessapplicationrepository_cloudformation_stack" "rotation" {
  name           = "nova-rewards-rds-rotation-${var.environment}"
  application_id = "arn:aws:serverlessrepo:us-east-1:297356227824:applications/SecretsManagerRDSPostgreSQLRotationSingleUser"
  # Use latest semantic version — pin in production
  semantic_version = "1.1.367"

  parameters = {
    functionName = "nova-rewards-rds-rotation-${var.environment}"
    endpoint     = "https://secretsmanager.${var.aws_region}.amazonaws.com"
  }

  capabilities = ["CAPABILITY_IAM", "CAPABILITY_RESOURCE_POLICY"]
}

locals {
  rotation_lambda_arn = aws_serverlessapplicationrepository_cloudformation_stack.rotation.outputs["RotationLambdaARN"]
}

# Override the placeholder used above with the real ARN from SAR
resource "aws_lambda_function" "secret_rotation" {
  # This is a data-only reference; the actual function is managed by SAR above.
  # We create a minimal shim so the rotation resource has a valid ARN to reference
  # before SAR output is available. In practice, reference locals.rotation_lambda_arn.
  function_name = "nova-rewards-rds-rotation-${var.environment}"
  role          = aws_iam_role.rotation_lambda.arn
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.11"
  filename      = "${path.module}/rotation_placeholder.zip"

  lifecycle {
    # SAR manages the actual code; ignore all changes after initial creation
    ignore_changes = all
  }
}
