# Terraform Configuration for Nova Rewards SSL/TLS Infrastructure
# This configuration manages EC2 instances, security groups, and SSL certificate setup
# on AWS for the Nova Rewards API.

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Variables
variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Domain name for SSL certificate"
  type        = string
  default     = "api.nova-rewards.xyz"
}

variable "ops_email" {
  description = "Email for SSL renewal notifications"
  type        = string
  default     = "ops@nova-rewards.xyz"
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

# Security Group for NGINX/API
resource "aws_security_group" "nova_api" {
  name        = "nova-rewards-api-sg"
  description = "Security group for Nova Rewards API with SSL/TLS"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP for Let's Encrypt ACME challenges"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS traffic"
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH access (restrict in production)"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "nova-rewards-api-sg"
    Environment = var.environment
  }
}

# IAM Role for EC2 instance
resource "aws_iam_role" "nova_api_role" {
  name = "nova-rewards-api-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Environment = var.environment
  }
}

# IAM Policy for CloudWatch Logs
resource "aws_iam_role_policy" "nova_cloudwatch_logs" {
  name = "nova-rewards-cloudwatch-logs"
  role = aws_iam_role.nova_api_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${var.aws_region}:*:*"
      }
    ]
  })
}

# IAM Policy for Secrets Manager (for environment variables)
resource "aws_iam_role_policy" "nova_secrets_manager" {
  name = "nova-rewards-secrets-manager"
  role = aws_iam_role.nova_api_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:*:secret:nova-rewards/*"
      }
    ]
  })
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "nova_api_profile" {
  name = "nova-rewards-api-profile"
  role = aws_iam_role.nova_api_role.id
}

# User data script for EC2 initialization
locals {
  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    domain   = var.domain_name
    ops_email = var.ops_email
  }))
}

# EC2 Instance
resource "aws_instance" "nova_api" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  iam_instance_profile   = aws_iam_instance_profile.nova_api_profile.name
  vpc_security_group_ids = [aws_security_group.nova_api.id]
  user_data              = local.user_data

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 50
    delete_on_termination = true
    encrypted             = true

    tags = {
      Name = "nova-rewards-api-root"
    }
  }

  monitoring = true

  tags = {
    Name        = "nova-rewards-api"
    Environment = var.environment
  }

  depends_on = [aws_security_group.nova_api]
}

# Elastic IP for consistent public IP
resource "aws_eip" "nova_api" {
  instance = aws_instance.nova_api.id
  domain   = "vpc"

  tags = {
    Name        = "nova-rewards-api-eip"
    Environment = var.environment
  }

  depends_on = [aws_instance.nova_api]
}

# CloudWatch Log Group for NGINX
resource "aws_cloudwatch_log_group" "nginx" {
  name              = "/aws/ec2/nova-rewards/nginx"
  retention_in_days = 30

  tags = {
    Environment = var.environment
  }
}

# CloudWatch Log Group for Certbot
resource "aws_cloudwatch_log_group" "certbot" {
  name              = "/aws/ec2/nova-rewards/certbot"
  retention_in_days = 90

  tags = {
    Environment = var.environment
  }
}

# CloudWatch Alarm for certificate expiry
resource "aws_cloudwatch_metric_alarm" "cert_expiry" {
  alarm_name          = "nova-rewards-cert-expiry"
  comparison_operator = "LessThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "CertificateDaysToExpiry"
  namespace           = "NovaRewards"
  period              = "86400"
  statistic           = "Minimum"
  threshold           = "30"
  alarm_description   = "Alert when SSL certificate is within 30 days of expiry"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = {
    Environment = var.environment
  }
}

# SNS Topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "nova-rewards-alerts"

  tags = {
    Environment = var.environment
  }
}

# SNS Topic Subscription for ops email
resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.ops_email
}

# Data source for Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Outputs
output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.nova_api.id
}

output "public_ip" {
  description = "Public IP address of the instance"
  value       = aws_eip.nova_api.public_ip
}

output "security_group_id" {
  description = "Security group ID"
  value       = aws_security_group.nova_api.id
}

output "cloudwatch_log_groups" {
  description = "CloudWatch log groups"
  value = {
    nginx  = aws_cloudwatch_log_group.nginx.name
    certbot = aws_cloudwatch_log_group.certbot.name
  }
}

output "sns_topic_arn" {
  description = "SNS topic ARN for alerts"
  value       = aws_sns_topic.alerts.arn
}
