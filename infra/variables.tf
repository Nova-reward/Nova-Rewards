variable "app_name" {
  description = "Application name"
  type        = string
  default     = "nova-rewards"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "vpc_id" {
  description = "VPC ID where RDS and EC2 reside"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for the RDS subnet group"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs"
  type        = list(string)
  default     = []
}

variable "ec2_security_group_id" {
  description = "Security group ID of the EC2 instances running the backend"
  type        = string
}

variable "db_name" {
  description = "Initial database name"
  type        = string
  default     = "nova_rewards"
}

variable "db_master_username" {
  description = "RDS master username"
  type        = string
  default     = "nova_master"
}

variable "environment" {
  description = "Deployment environment (e.g. production, staging)"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "redis_node_type" {
  description = "Redis node type"
  type        = string
  default     = "cache.t3.medium"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "asg_min" {
  description = "ASG minimum instances"
  type        = number
  default     = 1
}

variable "asg_max" {
  description = "ASG maximum instances"
  type        = number
  default     = 3
}

variable "asg_desired" {
  description = "ASG desired instances"
  type        = number
  default     = 1
}

variable "app_port" {
  description = "Application port"
  type        = number
  default     = 3000
}

variable "certificate_arn" {
  description = "ACM certificate ARN"
  type        = string
  default     = ""
}

variable "app_secret_name" {
  description = "Secrets Manager secret name"
  type        = string
  default     = "nova-rewards/production/app-secrets"
}
variable "cloudwatch_error_threshold" {
  description = "Number of ERROR log lines in 5 minutes that triggers the alarm"
  type        = number
  default     = 10
}

variable "cloudwatch_alarm_sns_arn" {
  description = "SNS topic ARN for CloudWatch alarm notifications (leave empty to skip)"
  type        = string
  default     = ""
}
