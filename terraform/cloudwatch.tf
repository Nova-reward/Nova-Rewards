# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "app" {
  name              = "/nova-rewards/${var.environment}/app"
  retention_in_days = var.environment == "prod" ? 30 : 7

  tags = merge(
    var.tags,
    {
      Name = "${var.app_name}-logs"
    }
  )
}

# CloudWatch Alarm - Memory High (via custom metric)
resource "aws_cloudwatch_metric_alarm" "memory_high" {
  alarm_name          = "${var.app_name}-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "NovaRewards"
  period              = "300"
  statistic           = "Average"
  threshold           = var.memory_threshold
  alarm_description   = "Alarm when memory exceeds ${var.memory_threshold}%"
  alarm_actions       = [aws_autoscaling_policy.scale_up.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app.name
  }

  treat_missing_data = "notBreaching"
}

# CloudWatch Alarm - 5xx Error Rate High
resource "aws_cloudwatch_metric_alarm" "error_rate_high" {
  alarm_name          = "${var.app_name}-5xx-error-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = var.error_rate_threshold * 100 # Approximate threshold
  alarm_description   = "Alarm when 5xx error rate exceeds ${var.error_rate_threshold}%"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }

  treat_missing_data = "notBreaching"
}

# CloudWatch Alarm - Target Group Unhealthy Hosts
resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  alarm_name          = "${var.app_name}-unhealthy-hosts"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "2"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "Alarm when there are unhealthy hosts"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.app.arn_suffix
  }

  treat_missing_data = "notBreaching"
}

# CloudWatch Alarm - ALB Response Time
resource "aws_cloudwatch_metric_alarm" "response_time_high" {
  alarm_name          = "${var.app_name}-response-time-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "1" # 1 second
  alarm_description   = "Alarm when response time exceeds 1 second"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  treat_missing_data = "notBreaching"
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.app_name}-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/EC2", "CPUUtilization", { stat = "Average" }],
            ["NovaRewards", "MemoryUtilization", { stat = "Average" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", { stat = "Sum" }],
            ["AWS/ApplicationELB", "TargetResponseTime", { stat = "Average" }],
            ["AWS/ApplicationELB", "HealthyHostCount", { stat = "Average" }],
            ["AWS/ApplicationELB", "UnHealthyHostCount", { stat = "Average" }]
          ]
          period = 300
          stat   = "Average"
          region = data.aws_region.current.name
          title  = "Nova Rewards Application Metrics"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", { stat = "Sum" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_2XX_Count", { stat = "Sum" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", { stat = "Sum" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", { stat = "Sum" }]
          ]
          period = 300
          stat   = "Sum"
          region = data.aws_region.current.name
          title  = "ALB Request Metrics"
        }
      }
    ]
  })
}
