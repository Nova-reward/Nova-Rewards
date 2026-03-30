resource "aws_elasticache_subnet_group" "this" {
  name       = "${var.app_name}-${var.environment}-redis"
  subnet_ids = var.subnet_ids
}

resource "aws_security_group" "redis" {
  name_prefix = "${var.app_name}-redis-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.ec2_sg_id]
    description     = "Redis from EC2"
  }
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = "${var.app_name}-${var.environment}"
  description          = "Nova Rewards Redis"
  node_type            = var.node_type
  num_cache_clusters   = var.environment == "prod" ? 2 : 1
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token           = var.auth_token

  lifecycle {
    ignore_changes = [auth_token]
  }
}
