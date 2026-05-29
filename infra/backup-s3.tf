# ── KMS key for backup encryption ────────────────────────────────────────────
resource "aws_kms_key" "backup" {
  description             = "nova-rewards-${var.environment} database backup encryption"
  deletion_window_in_days = 14
  enable_key_rotation     = true

  tags = {
    Environment = var.environment
    Project     = "nova-rewards"
  }
}

resource "aws_kms_alias" "backup" {
  name          = "alias/nova-rewards-${var.environment}-backup"
  target_key_id = aws_kms_key.backup.key_id
}

# ── S3 backup bucket ──────────────────────────────────────────────────────────
resource "aws_s3_bucket" "backup" {
  bucket        = "nova-rewards-${var.environment}-db-backups"
  force_destroy = false

  tags = {
    Environment = var.environment
    Project     = "nova-rewards"
  }
}

resource "aws_s3_bucket_versioning" "backup" {
  bucket = aws_s3_bucket.backup.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backup" {
  bucket = aws_s3_bucket.backup.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.backup.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "backup" {
  bucket                  = aws_s3_bucket.backup.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "backup" {
  bucket = aws_s3_bucket.backup.id

  rule {
    id     = "expire-backups-30d"
    status = "Enabled"

    filter { prefix = "postgres/" }

    transition {
      days          = 7
      storage_class = "STANDARD_IA"
    }

    expiration {
      days = 30
    }

    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

# ── SNS topic for backup failure alerts ──────────────────────────────────────
resource "aws_sns_topic" "backup_alerts" {
  name              = "nova-rewards-${var.environment}-backup-alerts"
  kms_master_key_id = aws_kms_key.backup.id

  tags = {
    Environment = var.environment
    Project     = "nova-rewards"
  }
}

# ── IAM role for the backup job (GitHub Actions OIDC or EC2 instance profile) ─
resource "aws_iam_role" "backup" {
  name = "nova-rewards-${var.environment}-backup"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "ec2.amazonaws.com" }
        Action    = "sts:AssumeRole"
      },
      # Allow GitHub Actions via OIDC (token sub must match your repo)
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:*:ref:refs/heads/*"
          }
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
    Project     = "nova-rewards"
  }
}

resource "aws_iam_role_policy" "backup" {
  name = "nova-rewards-${var.environment}-backup-policy"
  role = aws_iam_role.backup.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "S3BackupWrite"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          aws_s3_bucket.backup.arn,
          "${aws_s3_bucket.backup.arn}/*"
        ]
      },
      {
        Sid    = "KMSBackupEncrypt"
        Effect = "Allow"
        Action = [
          "kms:GenerateDataKey",
          "kms:Decrypt"
        ]
        Resource = aws_kms_key.backup.arn
      },
      {
        Sid      = "SNSPublishFailure"
        Effect   = "Allow"
        Action   = "sns:Publish"
        Resource = aws_sns_topic.backup_alerts.arn
      }
    ]
  })
}

data "aws_caller_identity" "current" {}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "backup_bucket_name" {
  value       = aws_s3_bucket.backup.bucket
  description = "S3 bucket for database backups"
}

output "backup_kms_key_arn" {
  value       = aws_kms_key.backup.arn
  description = "KMS key ARN used to encrypt backups"
}

output "backup_sns_topic_arn" {
  value       = aws_sns_topic.backup_alerts.arn
  description = "SNS topic ARN for backup failure notifications"
}

output "backup_iam_role_arn" {
  value       = aws_iam_role.backup.arn
  description = "IAM role ARN for the backup job"
}
