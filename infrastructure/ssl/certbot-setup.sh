#!/bin/bash
# Certbot Setup Script for Nova Rewards
# This script installs and configures Certbot with NGINX plugin
# for automatic SSL certificate provisioning and renewal.
#
# Usage: sudo bash certbot-setup.sh
# Prerequisites: NGINX must be installed and running

set -e

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="api.nova-rewards.xyz"
EMAIL="${OPS_EMAIL:-ops@nova-rewards.xyz}"
CERTBOT_DIR="/etc/letsencrypt"
RENEWAL_LOG="/var/log/certbot-renewal.log"

echo -e "${YELLOW}=== Nova Rewards SSL/TLS Setup ===${NC}"
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Step 1: Update system packages
echo -e "${YELLOW}[1/5] Updating system packages...${NC}"
apt-get update
apt-get upgrade -y

# Step 2: Install Certbot and NGINX plugin
echo -e "${YELLOW}[2/5] Installing Certbot and NGINX plugin...${NC}"
apt-get install -y certbot python3-certbot-nginx

# Step 3: Create certificate directory structure
echo -e "${YELLOW}[3/5] Creating certificate directories...${NC}"
mkdir -p /var/www/certbot
mkdir -p /var/log/certbot

# Step 4: Obtain initial certificate
echo -e "${YELLOW}[4/5] Obtaining SSL certificate from Let's Encrypt...${NC}"
certbot certonly \
    --nginx \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http \
    --webroot-path /var/www/certbot

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Certificate obtained successfully${NC}"
else
    echo -e "${RED}✗ Certificate acquisition failed${NC}"
    exit 1
fi

# Step 5: Verify certificate installation
echo -e "${YELLOW}[5/5] Verifying certificate installation...${NC}"
if [ -f "$CERTBOT_DIR/live/$DOMAIN/fullchain.pem" ] && [ -f "$CERTBOT_DIR/live/$DOMAIN/privkey.pem" ]; then
    echo -e "${GREEN}✓ Certificates verified at:${NC}"
    echo "  - Full chain: $CERTBOT_DIR/live/$DOMAIN/fullchain.pem"
    echo "  - Private key: $CERTBOT_DIR/live/$DOMAIN/privkey.pem"
else
    echo -e "${RED}✗ Certificate files not found${NC}"
    exit 1
fi

# Step 6: Test dry-run renewal
echo -e "${YELLOW}[6/6] Testing certificate renewal (dry-run)...${NC}"
certbot renew --dry-run --quiet

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Renewal test passed${NC}"
else
    echo -e "${RED}✗ Renewal test failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Next steps:"
echo "1. Update NGINX configuration with SSL paths"
echo "2. Reload NGINX: sudo systemctl reload nginx"
echo "3. Set up renewal timer: sudo systemctl enable certbot-renewal.timer"
echo "4. Verify HTTPS: curl https://$DOMAIN/health"
echo ""
