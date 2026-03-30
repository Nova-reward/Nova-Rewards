variable "app_name" { type = string }
variable "environment" { type = string }
variable "subnet_ids" { type = list(string) }
variable "vpc_id" { type = string }
variable "node_type" { type = string }
variable "auth_token" { type = string, sensitive = true }
variable "ec2_sg_id" { type = string }
