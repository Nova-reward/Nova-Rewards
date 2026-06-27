variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "nova-rewards"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "min_size" {
  description = "Minimum number of instances in ASG"
  type        = number
  default     = 2
}

variable "max_size" {
  description = "Maximum number of instances in ASG"
  type        = number
  default     = 6
}

variable "desired_capacity" {
  description = "Desired number of instances in ASG"
  type        = number
  default     = 2
}

variable "health_check_path" {
  description = "Health check endpoint path"
  type        = string
  default     = "/health"
}

variable "app_port" {
  description = "Application port"
  type        = number
  default     = 4000
}

variable "vpc_id" {
  description = "VPC ID where resources will be deployed"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for EC2 instances"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs for ALB"
  type        = list(string)
}

variable "rds_endpoint" {
  description = "RDS database endpoint"
  type        = string
}

variable "rds_port" {
  description = "RDS database port"
  type        = number
  default     = 5432
}

variable "redis_endpoint" {
  description = "Redis endpoint"
  type        = string
}

variable "redis_port" {
  description = "Redis port"
  type        = number
  default     = 6379
}

variable "s3_bucket_name" {
  description = "S3 bucket name for application access"
  type        = string
}

variable "secrets_manager_path" {
  description = "Secrets Manager path prefix for application secrets"
  type        = string
  default     = "nova-rewards/*"
}

variable "cpu_threshold" {
  description = "CPU threshold for CloudWatch alarm (%)"
  type        = number
  default     = 70
}

variable "memory_threshold" {
  description = "Memory threshold for CloudWatch alarm (%)"
  type        = number
  default     = 80
}

variable "error_rate_threshold" {
  description = "5xx error rate threshold for CloudWatch alarm (%)"
  type        = number
  default     = 1
}

variable "ami_id" {
  description = "AMI ID for EC2 instances (Amazon Linux 2 with Docker)"
  type        = string
  # Default to Amazon Linux 2 AMI - update based on your region
  default     = ""
}

variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = true
}

variable "certificate_arn" {
  description = "ARN of the SSL certificate in ACM for HTTPS listener"
  type        = string
}

variable "tags" {
  description = "Additional tags to apply to resources"
  type        = map(string)
  default     = {}
}
