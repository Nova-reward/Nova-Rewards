# CloudWatch Log Groups for Nova Rewards backend
# Retention: 30 days for info-level logs, 90 days for error/warn logs

resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/nova-rewards/backend"
  retention_in_days = 30

  tags = {
    Name        = "nova-rewards-backend-logs"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_cloudwatch_log_group" "error_logs" {
  name              = "/nova-rewards/backend/errors"
  retention_in_days = 90

  tags = {
    Name        = "nova-rewards-backend-error-logs"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Metric filter to count errors for alerting
resource "aws_cloudwatch_log_metric_filter" "error_count" {
  name           = "nova-rewards-error-count"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  pattern        = "{ $.level = \"error\" }"

  metric_transformation {
    name      = "ErrorCount"
    namespace = "NovaRewards/Backend"
    value     = "1"
  }
}

output "cloudwatch_log_group_name" {
  value       = aws_cloudwatch_log_group.app_logs.name
  description = "CloudWatch log group name for the backend (set as CLOUDWATCH_LOG_GROUP env var)"
}

output "cloudwatch_error_log_group_name" {
  value       = aws_cloudwatch_log_group.error_logs.name
  description = "CloudWatch log group for error/warn logs (90-day retention)"
}
