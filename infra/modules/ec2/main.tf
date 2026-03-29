data "aws_ami" "al2" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# ── Security Groups ──────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name_prefix = "${var.app_name}-alb-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ec2" {
  name_prefix = "${var.app_name}-ec2-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── ALB ─────────────────────────────────────────────────────────────────────

resource "aws_lb" "this" {
  name_prefix        = "nr-"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.environment == "prod"
}

resource "aws_lb_target_group" "this" {
  name_prefix = "nr-"
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }

  deregistration_delay = 30
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

# ── Launch Template ──────────────────────────────────────────────────────────

resource "aws_launch_template" "this" {
  name_prefix   = "${var.app_name}-"
  image_id      = data.aws_ami.al2.id
  instance_type = var.instance_type

  iam_instance_profile { name = var.instance_profile }
  vpc_security_group_ids = [aws_security_group.ec2.id]

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_type           = "gp3"
      volume_size           = 30
      encrypted             = true
      delete_on_termination = true
    }
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    yum update -y
    amazon-linux-extras install docker -y
    systemctl enable --now docker
    SECRET=$(aws secretsmanager get-secret-value \
      --secret-id ${var.app_secret_name} \
      --query SecretString --output text)
    echo "$SECRET" > /etc/nova-rewards.env
  EOF
  )

  lifecycle { create_before_destroy = true }
}

# ── ASG ──────────────────────────────────────────────────────────────────────

resource "aws_autoscaling_group" "this" {
  name                = "${var.app_name}-${var.environment}"
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = [aws_lb_target_group.this.arn]
  health_check_type   = "ELB"
  health_check_grace_period = 300
  min_size            = var.asg_min
  max_size            = var.asg_max
  desired_capacity    = var.asg_desired

  launch_template {
    id      = aws_launch_template.this.id
    version = "$Latest"
  }

  instance_refresh {
    strategy = "Rolling"
    preferences { min_healthy_percentage = 50 }
  }

  tag {
    key                 = "Name"
    value               = "${var.app_name}-${var.environment}"
    propagate_at_launch = true
  }

  lifecycle { create_before_destroy = true }
}

resource "aws_autoscaling_policy" "cpu_tracking" {
  name                   = "${var.app_name}-cpu-tracking"
  autoscaling_group_name = aws_autoscaling_group.this.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = 60.0
  }
}
