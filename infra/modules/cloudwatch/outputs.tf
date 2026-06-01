output "log_group_names" {
  description = "Map of service name to CloudWatch log group name"
  value       = { for k, v in aws_cloudwatch_log_group.service : k => v.name }
}

output "log_group_arns" {
  description = "Map of service name to CloudWatch log group ARN"
  value       = { for k, v in aws_cloudwatch_log_group.service : k => v.arn }
}

output "error_alarm_arn" {
  description = "ARN of the backend error rate alarm"
  value       = aws_cloudwatch_metric_alarm.backend_error_rate.arn
}
