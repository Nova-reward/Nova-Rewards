variable "app_name" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "private_subnet_ids" { type = list(string) }
variable "instance_type" { type = string }
variable "asg_min" { type = number }
variable "asg_max" { type = number }
variable "asg_desired" { type = number }
variable "app_port" { type = number }
variable "certificate_arn" { type = string }
variable "instance_profile" { type = string }
variable "rds_endpoint" { type = string, sensitive = true }
variable "redis_endpoint" { type = string, sensitive = true }
variable "app_secret_name" { type = string }
