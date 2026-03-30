#!/usr/bin/env bash
# EC2 user-data: installs and configures PgBouncer as a sidecar connection pooler.
# Expects these instance tags / SSM parameters to be resolved at launch:
#   RDS_HOST  — RDS endpoint hostname
#   DB_NAME   — database name (nova_rewards)
#   SECRET_ARN — Secrets Manager ARN for master credentials (used only to
#                fetch app/migrate passwords stored as separate secrets)
#
# The two application secrets must already exist in Secrets Manager:
#   nova-rewards/<env>/db-app-password
#   nova-rewards/<env>/db-migrate-password

set -euo pipefail

REGION=$(curl -sf http://169.254.169.254/latest/meta-data/placement/region)
ENV_TAG=$(aws ec2 describe-tags \
  --filters "Name=resource-id,Values=$(curl -sf http://169.254.169.254/latest/meta-data/instance-id)" \
            "Name=key,Values=Environment" \
  --query "Tags[0].Value" --output text --region "$REGION")

fetch_secret() {
  aws secretsmanager get-secret-value \
    --secret-id "$1" --query SecretString --output text --region "$REGION"
}

RDS_HOST=$(fetch_secret "nova-rewards/${ENV_TAG}/rds-master" | python3 -c "import sys,json; print(json.load(sys.stdin)['host'])")
DB_NAME=$(fetch_secret  "nova-rewards/${ENV_TAG}/rds-master" | python3 -c "import sys,json; print(json.load(sys.stdin)['dbname'])")
APP_PASS=$(fetch_secret "nova-rewards/${ENV_TAG}/db-app-password")
MIG_PASS=$(fetch_secret "nova-rewards/${ENV_TAG}/db-migrate-password")

# ── Install PgBouncer ─────────────────────────────────────────────────────────
apt-get update -y
apt-get install -y pgbouncer

# ── pgbouncer.ini ─────────────────────────────────────────────────────────────
cat > /etc/pgbouncer/pgbouncer.ini <<EOF
[databases]
${DB_NAME} = host=${RDS_HOST} port=5432 dbname=${DB_NAME}

[pgbouncer]
listen_addr         = 127.0.0.1
listen_port         = 5432
auth_type           = md5
auth_file           = /etc/pgbouncer/userlist.txt
pool_mode           = transaction
max_client_conn     = 200
default_pool_size   = 20
reserve_pool_size   = 5
reserve_pool_timeout = 3
server_tls_sslmode  = require
log_connections     = 1
log_disconnections  = 1
logfile             = /var/log/pgbouncer/pgbouncer.log
pidfile             = /var/run/pgbouncer/pgbouncer.pid
EOF

# ── userlist.txt (md5 hashes) ─────────────────────────────────────────────────
md5hash() {
  # PgBouncer md5 format: md5 + md5(password + username)
  echo -n "md5$(echo -n "${1}${2}" | md5sum | awk '{print $1}')"
}

cat > /etc/pgbouncer/userlist.txt <<EOF
"nova_app"     "$(md5hash "$APP_PASS" "nova_app")"
"nova_migrate" "$(md5hash "$MIG_PASS" "nova_migrate")"
EOF

chmod 640 /etc/pgbouncer/userlist.txt
chown pgbouncer:pgbouncer /etc/pgbouncer/userlist.txt /etc/pgbouncer/pgbouncer.ini

mkdir -p /var/log/pgbouncer /var/run/pgbouncer
chown pgbouncer:pgbouncer /var/log/pgbouncer /var/run/pgbouncer

systemctl enable pgbouncer
systemctl restart pgbouncer
