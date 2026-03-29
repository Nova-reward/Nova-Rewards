# Security Group for ALB
resource "aws_security_group" "alb_sg" {
  name_prefix = "${var.app_name}-alb-"
  description = "Security group for ALB"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS from anywhere"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP from anywhere (for redirect to HTTPS)"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.app_name}-alb-sg"
    }
  )
}

# Security Group for EC2 instances
resource "aws_security_group" "ec2_sg" {
  name_prefix = "${var.app_name}-ec2-"
  description = "Security group for EC2 instances"
  vpc_id      = var.vpc_id

  # Inbound from ALB only
  ingress {
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
    description     = "Application port from ALB"
  }

  # Outbound to RDS
  egress {
    from_port   = var.rds_port
    to_port     = var.rds_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "RDS database access"
  }

  # Outbound to Redis
  egress {
    from_port   = var.redis_port
    to_port     = var.redis_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Redis cache access"
  }

  # Outbound for DNS (required for service discovery)
  egress {
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "DNS queries"
  }

  # Outbound for HTTPS (for external APIs, package downloads, etc.)
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound"
  }

  # Outbound for HTTP (for external APIs, package downloads, etc.)
  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP outbound"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.app_name}-ec2-sg"
    }
  )
}
