output "redis_primary_endpoint" {
  description = "Primary endpoint for the ElastiCache Redis cluster (TLS, port 6379)"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "redis_url_template" {
  description = "REDIS_URL template — substitute <AUTH_TOKEN> with the value from Secrets Manager"
  value       = "rediss://:<AUTH_TOKEN>@${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
  sensitive   = true
}

output "redis_auth_token_secret_arn" {
  description = "ARN of the Secrets Manager secret holding the Redis AUTH token"
  value       = aws_secretsmanager_secret.redis_auth_token.arn
}

output "redis_security_group_id" {
  description = "Security group ID attached to the Redis cluster"
  value       = aws_security_group.redis.id
}
