# CloudWatch log groups — one per service, 90-day retention
locals {
  services = ["backend", "frontend", "gateway", "postgres", "redis", "stellar"]
}

resource "aws_cloudwatch_log_group" "service" {
  for_each = toset(local.services)

  name              = "/nova-rewards/${var.environment}/${each.key}"
  retention_in_days = 90

  tags = {
    Environment = var.environment
    Service     = each.key
    ManagedBy   = "terraform"
  }
}

# Metric filter: count ERROR-level log lines in the backend log group
resource "aws_cloudwatch_log_metric_filter" "backend_errors" {
  name           = "nova-rewards-${var.environment}-backend-errors"
  log_group_name = aws_cloudwatch_log_group.service["backend"].name
  pattern        = "ERROR"

  metric_transformation {
    name          = "BackendErrorCount"
    namespace     = "NovaRewards/${var.environment}"
    value         = "1"
    default_value = "0"
    unit          = "Count"
  }
}

# Alarm: fire when error rate exceeds threshold over a 5-minute window
resource "aws_cloudwatch_metric_alarm" "backend_error_rate" {
  alarm_name          = "nova-rewards-${var.environment}-backend-error-rate"
  alarm_description   = "Backend error rate exceeded ${var.error_rate_threshold} errors in 5 minutes"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "BackendErrorCount"
  namespace           = "NovaRewards/${var.environment}"
  period              = 300
  statistic           = "Sum"
  threshold           = var.error_rate_threshold
  treat_missing_data  = "notBreaching"

  alarm_actions = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []
  ok_actions    = var.alarm_sns_topic_arn != "" ? [var.alarm_sns_topic_arn] : []

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
