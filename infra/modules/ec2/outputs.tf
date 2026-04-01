output "alb_dns_name" { value = aws_lb.this.dns_name }
output "ec2_sg_id" { value = aws_security_group.ec2.id }
output "asg_name" { value = aws_autoscaling_group.this.name }
