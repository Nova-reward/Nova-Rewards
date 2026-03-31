variable "app_name" { type = string }
variable "environment" { type = string }
variable "subnet_ids" { type = list(string) }
variable "vpc_id" { type = string }
variable "db_name" { type = string }
variable "db_instance_class" { type = string }
variable "db_username" { type = string, sensitive = true }
variable "db_password" { type = string, sensitive = true }
variable "ec2_sg_id" { type = string }
