variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "vpc_id" {
  description = "ID of the VPC where the app and Redis reside"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for the ElastiCache subnet group"
  type        = list(string)
}

variable "app_security_group_id" {
  description = "Security group ID of the application (EC2 / ECS) instances"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. production, staging)"
  type        = string
  default     = "production"
}

variable "alarm_actions" {
  description = "List of ARNs to notify when a CloudWatch alarm fires (e.g. SNS topic)"
  type        = list(string)
  default     = []
}
