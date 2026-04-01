# ─── Redis Auth Token ────────────────────────────────────────────────────────

resource "random_password" "redis_auth_token" {
  length  = 32
  special = false # ElastiCache auth tokens must be printable ASCII, no spaces
}

resource "aws_secretsmanager_secret" "redis_auth_token" {
  name                    = "nova-rewards/${var.environment}/redis-auth-token"
  description             = "Redis AUTH token for Nova Rewards ElastiCache cluster"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = jsonencode({
    auth_token = random_password.redis_auth_token.result
  })
}

# ─── Security Group ──────────────────────────────────────────────────────────

resource "aws_security_group" "redis" {
  name        = "nova-rewards-${var.environment}-redis"
  description = "Allow inbound Redis traffic from the application security group only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from app instances"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.app_security_group_id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "nova-rewards-${var.environment}-redis"
    Environment = var.environment
  }
}

# ─── ElastiCache Subnet Group ────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "redis" {
  name       = "nova-rewards-${var.environment}-redis"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "nova-rewards-${var.environment}-redis"
    Environment = var.environment
  }
}

# ─── ElastiCache Redis Cluster ───────────────────────────────────────────────

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "nova-rewards-${var.environment}"
  description          = "Nova Rewards Redis cache — ${var.environment}"

  node_type            = "cache.t3.micro"
  num_cache_clusters   = 1
  engine               = "redis"
  engine_version       = "7.1"
  port                 = 6379

  # Encryption
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  transit_encryption_mode     = "required"
  auth_token                  = random_password.redis_auth_token.result

  # Network — private subnets only, no public access
  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  # Maintenance & backups
  maintenance_window       = "sun:05:00-sun:06:00"
  snapshot_retention_limit = 1
  snapshot_window          = "04:00-05:00"

  apply_immediately = false

  tags = {
    Name        = "nova-rewards-${var.environment}-redis"
    Environment = var.environment
  }
}

# ─── CloudWatch Alarms ───────────────────────────────────────────────────────

locals {
  cluster_id = aws_elasticache_replication_group.redis.id
}

resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "nova-rewards-${var.environment}-redis-cpu-high"
  alarm_description   = "Redis EngineCPUUtilization exceeded 80%"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "EngineCPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Average"
  threshold           = 80

  dimensions = {
    ReplicationGroupId = local.cluster_id
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Environment = var.environment
  }
}

# CacheHitRate = CacheHits / (CacheHits + CacheMisses)
# CloudWatch metric math: if rate < 0.5 → alarm
resource "aws_cloudwatch_metric_alarm" "redis_hit_rate" {
  alarm_name          = "nova-rewards-${var.environment}-redis-low-hit-rate"
  alarm_description   = "Redis cache hit rate dropped below 50%"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  threshold           = 0.5

  metric_query {
    id          = "hit_rate"
    expression  = "hits / (hits + misses)"
    label       = "CacheHitRate"
    return_data = true
  }

  metric_query {
    id = "hits"
    metric {
      metric_name = "CacheHits"
      namespace   = "AWS/ElastiCache"
      period      = 60
      stat        = "Sum"
      dimensions = {
        ReplicationGroupId = local.cluster_id
      }
    }
  }

  metric_query {
    id = "misses"
    metric {
      metric_name = "CacheMisses"
      namespace   = "AWS/ElastiCache"
      period      = 60
      stat        = "Sum"
      dimensions = {
        ReplicationGroupId = local.cluster_id
      }
    }
  }

  alarm_actions = var.alarm_actions
  ok_actions    = var.alarm_actions

  tags = {
    Environment = var.environment
  }
}
