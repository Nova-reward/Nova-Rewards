# Auto Scaling Group
resource "aws_autoscaling_group" "app" {
  name                = "${var.app_name}-asg-${aws_launch_template.app.latest_version_number}"
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = [aws_lb_target_group.app.arn]
  health_check_type   = "ELB"
  health_check_grace_period = 300

  min_size         = var.min_size
  max_size         = var.max_size
  desired_capacity = var.desired_capacity

  launch_template {
    id      = aws_launch_template.app.id
    version = "$Latest"
  }

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 50
      instance_warmup_seconds = 300
    }
  }

  tag {
    key                 = "Name"
    value               = "${var.app_name}-asg-instance"
    propagate_at_launch = true
  }

  tag {
    key                 = "Environment"
    value               = var.environment
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

# Scaling Policy - Scale Up
resource "aws_autoscaling_policy" "scale_up" {
  name                   = "${var.app_name}-scale-up"
  scaling_adjustment     = 1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.app.name
}

# Scaling Policy - Scale Down
resource "aws_autoscaling_policy" "scale_down" {
  name                   = "${var.app_name}-scale-down"
  scaling_adjustment     = -1
  adjustment_type        = "ChangeInCapacity"
  cooldown               = 300
  autoscaling_group_name = aws_autoscaling_group.app.name
}

# CloudWatch Alarm - CPU High
resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  alarm_name          = "${var.app_name}-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = var.cpu_threshold
  alarm_description   = "Alarm when CPU exceeds ${var.cpu_threshold}%"
  alarm_actions       = [aws_autoscaling_policy.scale_up.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app.name
  }
}

# CloudWatch Alarm - CPU Low
resource "aws_cloudwatch_metric_alarm" "cpu_low" {
  alarm_name          = "${var.app_name}-cpu-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = var.cpu_threshold * 0.5
  alarm_description   = "Alarm when CPU is below ${var.cpu_threshold * 0.5}%"
  alarm_actions       = [aws_autoscaling_policy.scale_down.arn]

  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.app.name
  }
}
