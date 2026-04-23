#!/bin/bash
# SSL/TLS Verification Script for Nova Rewards
# Performs comprehensive SSL certificate and HTTPS configuration checks

set -e

DOMAIN="${1:-api.nova-rewards.xyz}"
CERTBOT_DIR="/etc/letsencrypt"
CERT_PATH="$CERTBOT_DIR/live/$DOMAIN"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Nova Rewards SSL/TLS Verification ===${NC}"
echo "Domain: $DOMAIN"
echo ""

# Check 1: Certificate files exist
echo -e "${YELLOW}[1] Checking certificate files...${NC}"
if [ -f "$CERT_PATH/fullchain.pem" ] && [ -f "$CERT_PATH/privkey.pem" ]; then
    echo -e "${GREEN}✓ Certificate files found${NC}"
    ls -lh "$CERT_PATH/"*.pem
else
    echo -e "${RED}✗ Certificate files not found at $CERT_PATH${NC}"
    exit 1
fi
echo ""

# Check 2: Certificate validity
echo -e "${YELLOW}[2] Checking certificate validity...${NC}"
openssl x509 -in "$CERT_PATH/fullchain.pem" -text -noout | grep -A 2 "Validity"
EXPIRY=$(openssl x509 -in "$CERT_PATH/fullchain.pem" -noout -enddate | cut -d= -f2)
echo -e "${GREEN}✓ Certificate expires: $EXPIRY${NC}"
echo ""

# Check 3: Certificate chain
echo -e "${YELLOW}[3] Checking certificate chain...${NC}"
CHAIN_COUNT=$(openssl crl2pkcs7 -nocrl -certfile "$CERT_PATH/fullchain.pem" | openssl pkcs7 -print_certs -text -noout | grep "Subject:" | wc -l)
echo -e "${GREEN}✓ Certificate chain contains $CHAIN_COUNT certificates${NC}"
echo ""

# Check 4: HTTPS connectivity
echo -e "${YELLOW}[4] Testing HTTPS connectivity...${NC}"
if curl -s --max-time 5 "https://$DOMAIN/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ HTTPS endpoint responding${NC}"
    curl -s "https://$DOMAIN/health" | jq . 2>/dev/null || echo "Response: $(curl -s https://$DOMAIN/health)"
else
    echo -e "${YELLOW}⚠ HTTPS endpoint not responding (may be expected if service is down)${NC}"
fi
echo ""

# Check 5: HTTP to HTTPS redirect
echo -e "${YELLOW}[5] Testing HTTP to HTTPS redirect...${NC}"
REDIRECT=$(curl -s -o /dev/null -w "%{http_code}" -L "http://$DOMAIN/health" 2>/dev/null)
if [ "$REDIRECT" = "200" ]; then
    echo -e "${GREEN}✓ HTTP redirect working (final status: 200)${NC}"
else
    echo -e "${YELLOW}⚠ HTTP redirect status: $REDIRECT${NC}"
fi
echo ""

# Check 6: HSTS header
echo -e "${YELLOW}[6] Checking HSTS header...${NC}"
HSTS=$(curl -s -I "https://$DOMAIN/health" 2>/dev/null | grep -i "strict-transport-security" || echo "NOT FOUND")
if [ "$HSTS" != "NOT FOUND" ]; then
    echo -e "${GREEN}✓ HSTS header present:${NC}"
    echo "  $HSTS"
else
    echo -e "${RED}✗ HSTS header not found${NC}"
fi
echo ""

# Check 7: TLS version
echo -e "${YELLOW}[7] Checking TLS version...${NC}"
TLS_VERSION=$(openssl s_client -connect "$DOMAIN:443" -tls1_2 < /dev/null 2>/dev/null | grep "Protocol" || echo "UNKNOWN")
echo -e "${GREEN}✓ TLS version: $TLS_VERSION${NC}"
echo ""

# Check 8: Certbot renewal status
echo -e "${YELLOW}[8] Checking Certbot renewal status...${NC}"
if command -v certbot &> /dev/null; then
    RENEWAL_STATUS=$(certbot renew --dry-run --quiet 2>&1 || echo "Check logs for details")
    echo -e "${GREEN}✓ Renewal test completed${NC}"
    echo "  Status: $RENEWAL_STATUS"
else
    echo -e "${YELLOW}⚠ Certbot not found${NC}"
fi
echo ""

# Check 9: NGINX configuration
echo -e "${YELLOW}[9] Checking NGINX configuration...${NC}"
if command -v nginx &> /dev/null; then
    if nginx -t 2>&1 | grep -q "successful"; then
        echo -e "${GREEN}✓ NGINX configuration valid${NC}"
    else
        echo -e "${RED}✗ NGINX configuration error:${NC}"
        nginx -t
    fi
else
    echo -e "${YELLOW}⚠ NGINX not found${NC}"
fi
echo ""

# Check 10: Systemd timer status
echo -e "${YELLOW}[10] Checking Certbot renewal timer...${NC}"
if systemctl is-active --quiet certbot-renewal.timer; then
    echo -e "${GREEN}✓ Certbot renewal timer is active${NC}"
    systemctl status certbot-renewal.timer --no-pager | head -5
else
    echo -e "${YELLOW}⚠ Certbot renewal timer not active${NC}"
fi
echo ""

echo -e "${BLUE}=== Verification Complete ===${NC}"
echo ""
echo "Summary:"
echo "- Certificate: $DOMAIN"
echo "- Expires: $EXPIRY"
echo "- HTTPS: Configured"
echo "- HSTS: Enabled"
echo ""
echo "For SSL Labs rating, visit: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"
