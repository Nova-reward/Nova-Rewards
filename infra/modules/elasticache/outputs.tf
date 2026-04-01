output "endpoint" {
  value     = aws_elasticache_replication_group.this.primary_endpoint_address
  sensitive = true
}
output "sg_id" { value = aws_security_group.redis.id }
