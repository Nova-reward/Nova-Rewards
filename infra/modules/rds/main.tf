resource "aws_db_subnet_group" "this" {
  name_prefix = "${var.app_name}-"
  subnet_ids  = var.subnet_ids
}

resource "aws_db_parameter_group" "this" {
  name_prefix = "${var.app_name}-pg15-"
  family      = "postgres15"

  parameter {
    name  = "log_connections"
    value = "1"
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "${var.app_name}-rds-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.ec2_sg_id]
    description     = "PostgreSQL from EC2"
  }
}

resource "aws_db_instance" "this" {
  identifier_prefix      = "${var.app_name}-"
  engine                 = "postgres"
  engine_version         = "15"
  instance_class         = var.db_instance_class
  db_name                = var.db_name
  username               = var.db_username
  password               = var.db_password
  db_subnet_group_name   = aws_db_subnet_group.this.name
  parameter_group_name   = aws_db_parameter_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  storage_encrypted      = true
  skip_final_snapshot    = var.environment != "prod"
  deletion_protection    = var.environment == "prod"
  multi_az               = var.environment == "prod"
  backup_retention_period = var.environment == "prod" ? 7 : 1

  lifecycle {
    ignore_changes = [password]
  }
}
