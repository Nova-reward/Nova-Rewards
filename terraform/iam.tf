# IAM Role for EC2 instances
resource "aws_iam_role" "ec2_role" {
  name_prefix = "${var.app_name}-ec2-role-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "ec2_profile" {
  name_prefix = "${var.app_name}-ec2-profile-"
  role        = aws_iam_role.ec2_role.name
}

# Policy for S3 bucket access (least privilege)
resource "aws_iam_role_policy" "s3_access" {
  name_prefix = "${var.app_name}-s3-access-"
  role        = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3BucketAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.s3_bucket_name}",
          "arn:aws:s3:::${var.s3_bucket_name}/*"
        ]
      }
    ]
  })
}

# Policy for Secrets Manager access (least privilege)
resource "aws_iam_role_policy" "secrets_manager_access" {
  name_prefix = "${var.app_name}-secrets-access-"
  role        = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SecretsManagerAccess"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.secrets_manager_path}"
      }
    ]
  })
}

# Policy for CloudWatch Logs
resource "aws_iam_role_policy" "cloudwatch_logs" {
  name_prefix = "${var.app_name}-cloudwatch-logs-"
  role        = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/nova-rewards/*"
      }
    ]
  })
}

# Policy for CloudWatch Metrics
resource "aws_iam_role_policy" "cloudwatch_metrics" {
  name_prefix = "${var.app_name}-cloudwatch-metrics-"
  role        = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchMetrics"
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "NovaRewards"
          }
        }
      }
    ]
  })
}

# Data sources for current AWS account and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
