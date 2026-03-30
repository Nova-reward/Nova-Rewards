# ── RDS subnet group (private subnets only) ───────────────────────────────────
resource "aws_db_subnet_group" "nova" {
  name       = "nova-rewards-${var.environment}"
  subnet_ids = var.private_subnet_ids

  tags = {
    Environment = var.environment
    Project     = "nova-rewards"
  }
}

# ── Security group: RDS accepts connections only from EC2 SG ─────────────────
resource "aws_security_group" "rds" {
  name        = "nova-rewards-rds-${var.environment}"
  description = "Allow PostgreSQL from EC2 backend instances only"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from backend EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.ec2_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Environment = var.environment
    Project     = "nova-rewards"
  }
}

# ── RDS PostgreSQL 16 — db.t3.medium, private, encrypted ─────────────────────
resource "aws_db_instance" "nova" {
  identifier        = "nova-rewards-${var.environment}"
  engine            = "postgres"
  engine_version    = "16"
  instance_class    = "db.t3.medium"
  db_name           = var.db_name
  username          = var.db_master_username
  password          = random_password.rds_master.result

  # Storage
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"
  storage_encrypted     = true

  # Network — private subnets, no public access
  db_subnet_group_name   = aws_db_subnet_group.nova.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = true

  # Backups & PITR
  backup_retention_period   = 7
  backup_window             = "03:00-04:00"
  maintenance_window        = "Mon:04:00-Mon:05:00"
  delete_automated_backups  = false

  # Point-in-time recovery is enabled automatically when backup_retention_period > 0
  # (no separate flag needed for RDS)

  # Misc
  auto_minor_version_upgrade = true
  deletion_protection        = true
  skip_final_snapshot        = false
  final_snapshot_identifier  = "nova-rewards-${var.environment}-final"

  tags = {
    Environment = var.environment
    Project     = "nova-rewards"
  }

  depends_on = [aws_secretsmanager_secret_version.rds_master]
}
