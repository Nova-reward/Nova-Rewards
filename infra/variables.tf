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
