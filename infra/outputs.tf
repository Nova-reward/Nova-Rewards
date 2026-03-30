output "rds_endpoint" {
  description = "RDS instance endpoint (host:port)"
  value       = "${aws_db_instance.nova.address}:${aws_db_instance.nova.port}"
}

output "rds_secret_arn" {
  description = "ARN of the Secrets Manager secret holding RDS master credentials"
  value       = aws_secretsmanager_secret.rds_master.arn
}

output "pgbouncer_port" {
  description = "PgBouncer listens on this port on each EC2 instance"
  value       = 5432
}
