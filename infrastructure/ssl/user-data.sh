#!/bin/bash
# EC2 User Data Script for Nova Rewards SSL/TLS Setup
# This script runs on EC2 instance startup to configure SSL/TLS

set -e

# Configuration
DOMAIN="${domain}"
OPS_EMAIL="${ops_email}"
CERTBOT_DIR="/etc/letsencrypt"
RENEWAL_LOG="/var/log/certbot-renewal.log"

# Logging
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "=== Nova Rewards SSL/TLS Setup Starting ==="
echo "Domain: $DOMAIN"
echo "Email: $OPS_EMAIL"
echo "Time: $(date)"

# Update system
echo "[1/8] Updating system packages..."
apt-get update
apt-get upgrade -y

# Install required packages
echo "[2/8] Installing required packages..."
apt-get install -y \
    nginx \
    certbot \
    python3-certbot-nginx \
    curl \
    wget \
    git \
    jq \
    mailutils \
    awscli

# Create certificate directories
echo "[3/8] Creating certificate directories..."
mkdir -p /var/www/certbot
mkdir -p /var/log/certbot
chmod 755 /var/www/certbot

# Start NGINX
echo "[4/8] Starting NGINX..."
systemctl start nginx
systemctl enable nginx

# Wait for DNS to resolve
echo "[5/8] Waiting for DNS resolution..."
for i in {1..30}; do
    if nslookup "$DOMAIN" > /dev/null 2>&1; then
        echo "DNS resolved successfully"
        break
    fi
    echo "Waiting for DNS... ($i/30)"
    sleep 2
done

# Obtain SSL certificate
echo "[6/8] Obtaining SSL certificate from Let's Encrypt..."
certbot certonly \
    --nginx \
    -d "$DOMAIN" \
    --email "$OPS_EMAIL" \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http \
    --webroot-path /var/www/certbot \
    --rsa-key-size 4096 \
    --quiet

if [ $? -eq 0 ]; then
    echo "Certificate obtained successfully"
else
    echo "Certificate acquisition failed"
    exit 1
fi

# Configure NGINX with SSL
echo "[7/8] Configuring NGINX with SSL..."
cat > /etc/nginx/conf.d/default.conf << 'NGINX_CONFIG'
upstream nova_backend {
    server 127.0.0.1:4000;
    keepalive 32;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate ${CERTBOT_DIR}/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key ${CERTBOT_DIR}/live/${DOMAIN}/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    access_log /var/log/nginx/nova_access.log;
    error_log /var/log/nginx/nova_error.log;

    location /health {
        proxy_pass http://nova_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        access_log off;
    }

    location /api/ {
        proxy_pass http://nova_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_request_buffering off;
    }

    location / {
        proxy_pass http://nova_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONFIG

# Replace placeholders
sed -i "s|\${DOMAIN}|$DOMAIN|g" /etc/nginx/conf.d/default.conf
sed -i "s|\${CERTBOT_DIR}|$CERTBOT_DIR|g" /etc/nginx/conf.d/default.conf

# Test NGINX configuration
nginx -t

# Reload NGINX
systemctl reload nginx

# Set up automatic renewal
echo "[8/8] Setting up automatic certificate renewal..."

# Create renewal service
cat > /etc/systemd/system/certbot-renewal.service << 'RENEWAL_SERVICE'
[Unit]
Description=Certbot SSL Certificate Renewal for Nova Rewards
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet
ExecStartPost=/bin/systemctl reload nginx
StandardOutput=journal
StandardError=journal
SyslogIdentifier=certbot-renewal
RENEWAL_SERVICE

# Create renewal timer
cat > /etc/systemd/system/certbot-renewal.timer << 'RENEWAL_TIMER'
[Unit]
Description=Certbot SSL Certificate Renewal Timer for Nova Rewards
Requires=certbot-renewal.service

[Timer]
OnCalendar=*-*-* 02:00:00
OnCalendar=*-*-* 14:00:00
Persistent=true
RandomizedDelaySec=1h

[Install]
WantedBy=timers.target
RENEWAL_TIMER

# Enable and start renewal timer
systemctl daemon-reload
systemctl enable certbot-renewal.timer
systemctl start certbot-renewal.timer

# Test renewal
certbot renew --dry-run --quiet

echo ""
echo "=== Setup Complete ==="
echo "Domain: $DOMAIN"
echo "Certificate: $CERTBOT_DIR/live/$DOMAIN/fullchain.pem"
echo "Renewal Timer: Active (runs at 02:00 and 14:00 UTC)"
echo "NGINX: Running on ports 80/443"
echo ""
echo "Verification:"
echo "  curl https://$DOMAIN/health"
echo "  curl -I https://$DOMAIN/health"
echo ""
echo "SSL Labs: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
