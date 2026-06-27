variable "environment" {
  description = "Deployment environment (e.g. production, staging)"
  type        = string
}

variable "error_rate_threshold" {
  description = "Number of ERROR log lines in a 5-minute window that triggers the alarm"
  type        = number
  default     = 10
}

variable "alarm_sns_topic_arn" {
  description = "SNS topic ARN for alarm notifications. Leave empty to create the alarm without actions."
  type        = string
  default     = ""
}
