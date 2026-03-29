output "alb_dns_name" {
  description = "ALB DNS name"
  value       = module.ec2.alb_dns_name
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache endpoint"
  value       = module.elasticache.endpoint
  sensitive   = true
}

output "vpc_id" {
  value = module.vpc.vpc_id
}
