variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (dev | staging | prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Must be dev, staging, or prod."
  }
}

variable "app_name" {
  description = "Application name prefix"
  type        = string
  default     = "nova-rewards"
}

# VPC
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of AZs to use"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

# EC2 / ASG
variable "instance_type" {
  type    = string
  default = "t3.medium"
}

variable "asg_min" {
  type    = number
  default = 2
}

variable "asg_max" {
  type    = number
  default = 6
}

variable "asg_desired" {
  type    = number
  default = 2
}

variable "app_port" {
  type    = number
  default = 4000
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

# RDS
variable "db_instance_class" {
  type    = string
  default = "db.t3.medium"
}

variable "db_name" {
  type    = string
  default = "nova_rewards"
}

# ElastiCache
variable "redis_node_type" {
  type    = string
  default = "cache.t3.micro"
}

# Secrets Manager secret name that holds sensitive tfvars
variable "app_secret_name" {
  description = "Secrets Manager secret name for app credentials"
  type        = string
  default     = "nova-rewards/app"
}
