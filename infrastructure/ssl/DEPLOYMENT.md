# SSL/TLS Deployment Guide for Nova Rewards

This guide provides step-by-step instructions for deploying SSL/TLS certificate management to production EC2 instances.

## Deployment Methods

### Method 1: Automated Terraform Deployment (Recommended)

#### Prerequisites
- Terraform >= 1.0 installed locally
- AWS CLI configured with credentials
- Domain DNS pointing to Route53 or external DNS

#### Steps

1. **Initialize Terraform**
```bash
cd infrastructure/ssl
terraform init
```

2. **Create terraform.tfvars**
```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
nano terraform.tfvars
```

3. **Plan Deployment**
```bash
terraform plan -out=tfplan
# Review the plan carefully
```

4. **Apply Configuration**
```bash
terraform apply tfplan
```

5. **Verify Deployment**
```bash
# Get instance IP
INSTANCE_IP=$(terraform output -raw public_ip)

# SSH into instance
ssh -i your-key.pem ubuntu@$INSTANCE_IP

# Check certificate
sudo openssl x509 -in /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem -noout -text

# Check NGINX
sudo systemctl status nginx

# Check renewal timer
sudo systemctl status certbot-renewal.timer
```

### Method 2: Manual EC2 Deployment

#### Prerequisites
- EC2 instance running Ubuntu 22.04 LTS
- Security group with ports 80, 443, 22 open
- Domain DNS pointing to instance public IP
- SSH access to instance

#### Steps

1. **SSH into EC2 Instance**
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

2. **Download Setup Script**
```bash
# Clone repository or download script
git clone https://github.com/your-org/Nova-Rewards.git
cd Nova-Rewards/infrastructure/ssl
```

3. **Run Setup Script**
```bash
# Set environment variables
export OPS_EMAIL="ops@nova-rewards.xyz"
export DOMAIN="api.nova-rewards.xyz"

# Run setup
sudo bash certbot-setup.sh
```

4. **Configure NGINX**
```bash
# Copy NGINX configuration
sudo cp nginx.conf /etc/nginx/conf.d/default.conf

# Test configuration
sudo nginx -t

# Reload NGINX
sudo systemctl reload nginx
```

5. **Set Up Renewal**
```bash
# Copy systemd files
sudo cp certbot-renewal.service /etc/systemd/system/
sudo cp certbot-renewal.timer /etc/systemd/system/
sudo cp notify-renewal-failure.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/notify-renewal-failure.sh

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable certbot-renewal.timer
sudo systemctl start certbot-renewal.timer
```

6. **Verify Installation**
```bash
sudo bash ssl-verification.sh api.nova-rewards.xyz
```

### Method 3: Docker Compose Deployment

#### Prerequisites
- Docker and Docker Compose installed
- Domain DNS pointing to host
- Ports 80, 443 available

#### Steps

1. **Prepare Environment**
```bash
cd novaRewards
cp .env.example .env
# Edit .env with your configuration
```

2. **Deploy with SSL**
```bash
# Start services with SSL support
docker-compose -f docker-compose.yml -f infrastructure/ssl/docker-compose-ssl.yml up -d
```

3. **Verify Deployment**
```bash
# Check NGINX container
docker-compose logs nginx

# Test HTTPS
curl -v https://api.nova-rewards.xyz/health

# Check certificate
docker-compose exec nginx openssl x509 -in /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem -noout -text
```

## Post-Deployment Verification

### 1. Certificate Verification
```bash
# Check certificate details
sudo openssl x509 -in /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem -noout -text

# Check certificate chain
sudo openssl crl2pkcs7 -nocrl -certfile /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem | openssl pkcs7 -print_certs -text -noout

# Check private key
sudo openssl rsa -in /etc/letsencrypt/live/api.nova-rewards.xyz/privkey.pem -check
```

### 2. HTTPS Connectivity
```bash
# Test HTTPS endpoint
curl -v https://api.nova-rewards.xyz/health

# Expected response:
# HTTP/2 200
# strict-transport-security: max-age=31536000; includeSubDomains
# {"success":true,"data":{"status":"ok"}}
```

### 3. HTTP Redirect
```bash
# Test HTTP to HTTPS redirect
curl -v http://api.nova-rewards.xyz/health

# Expected: 301 redirect to https://api.nova-rewards.xyz/health
```

### 4. HSTS Header
```bash
# Check HSTS header
curl -I https://api.nova-rewards.xyz/health | grep -i strict-transport-security

# Expected: strict-transport-security: max-age=31536000; includeSubDomains
```

### 5. TLS Configuration
```bash
# Check TLS version
openssl s_client -connect api.nova-rewards.xyz:443 -tls1_2 < /dev/null

# Check cipher suites
openssl s_client -connect api.nova-rewards.xyz:443 -cipher HIGH < /dev/null
```

### 6. SSL Labs Rating
Visit: https://www.ssllabs.com/ssltest/analyze.html?d=api.nova-rewards.xyz

Expected rating: **A+**

## Monitoring Setup

### CloudWatch Monitoring (AWS)

1. **Enable CloudWatch Agent**
```bash
# Download CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb

# Install
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Configure
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard

# Start agent
sudo systemctl start amazon-cloudwatch-agent
sudo systemctl enable amazon-cloudwatch-agent
```

2. **Create Custom Metrics**
```bash
# Script to check certificate expiry and send metric
cat > /usr/local/bin/check-cert-expiry.sh << 'EOF'
#!/bin/bash
EXPIRY=$(openssl x509 -in /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem -noout -enddate | cut -d= -f2)
DAYS_TO_EXPIRY=$(( ($(date -d "$EXPIRY" +%s) - $(date +%s)) / 86400 ))

aws cloudwatch put-metric-data \
    --metric-name CertificateDaysToExpiry \
    --namespace NovaRewards \
    --value $DAYS_TO_EXPIRY \
    --region us-east-1
EOF

chmod +x /usr/local/bin/check-cert-expiry.sh

# Add to crontab
(crontab -l 2>/dev/null; echo "0 * * * * /usr/local/bin/check-cert-expiry.sh") | crontab -
```

### Local Monitoring

1. **Check Renewal Status**
```bash
# View renewal timer
sudo systemctl status certbot-renewal.timer

# View renewal logs
sudo journalctl -u certbot-renewal.service -n 50 --no-pager

# View NGINX logs
sudo tail -f /var/log/nginx/nova_access.log
```

2. **Set Up Log Rotation**
```bash
# Create logrotate config
sudo cat > /etc/logrotate.d/nova-rewards << 'EOF'
/var/log/nginx/nova_*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}

/var/log/certbot/*.log {
    weekly
    rotate 12
    compress
    delaycompress
    notifempty
    create 0640 root root
}
EOF
```

## Rollback Procedures

### Rollback Terraform Deployment
```bash
# Destroy infrastructure
cd infrastructure/ssl
terraform destroy

# Confirm destruction
# Type 'yes' when prompted
```

### Rollback Manual Deployment
```bash
# Stop NGINX
sudo systemctl stop nginx

# Disable renewal timer
sudo systemctl disable certbot-renewal.timer
sudo systemctl stop certbot-renewal.timer

# Remove certificates (optional)
sudo rm -rf /etc/letsencrypt/live/api.nova-rewards.xyz

# Restore previous NGINX config (if backed up)
sudo cp /etc/nginx/conf.d/default.conf.bak /etc/nginx/conf.d/default.conf
sudo systemctl start nginx
```

## Troubleshooting

### Certificate Renewal Failed
```bash
# Check renewal logs
sudo journalctl -u certbot-renewal.service -n 50

# Run manual renewal with verbose output
sudo certbot renew --verbose

# Check DNS resolution
nslookup api.nova-rewards.xyz

# Check port 80 accessibility
sudo netstat -tlnp | grep :80
```

### NGINX Not Starting
```bash
# Test configuration
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log

# Check certificate paths
sudo ls -la /etc/letsencrypt/live/api.nova-rewards.xyz/
```

### HSTS Header Not Present
```bash
# Verify NGINX config
sudo grep -n "Strict-Transport-Security" /etc/nginx/conf.d/default.conf

# Reload NGINX
sudo systemctl reload nginx

# Test header
curl -I https://api.nova-rewards.xyz/health | grep -i strict
```

## Maintenance Schedule

| Task | Frequency | Command |
|------|-----------|---------|
| Check certificate expiry | Weekly | `sudo certbot certificates` |
| Review renewal logs | Weekly | `sudo journalctl -u certbot-renewal.service` |
| Update system packages | Monthly | `sudo apt-get update && apt-get upgrade` |
| Rotate NGINX logs | Daily | Automatic via logrotate |
| Test SSL configuration | Monthly | `sudo bash ssl-verification.sh` |
| Review security headers | Quarterly | `curl -I https://api.nova-rewards.xyz/health` |
| SSL Labs rating check | Quarterly | Visit SSL Labs website |

## Support & Escalation

### Level 1: Self-Service
1. Check troubleshooting section above
2. Review logs: `sudo journalctl -u certbot-renewal.service`
3. Run verification: `sudo bash ssl-verification.sh`

### Level 2: Team Support
1. Contact ops team: ops@nova-rewards.xyz
2. Provide logs and verification output
3. Include error messages and timestamps

### Level 3: Emergency
1. For certificate expiry < 7 days: Immediate manual renewal
2. For HTTPS outage: Rollback to HTTP (temporary)
3. For security breach: Revoke and reissue certificate

## References

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://certbot.eff.org/docs/)
- [NGINX SSL Configuration](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [SSL Labs Best Practices](https://github.com/ssllabs/research/wiki/SSL-and-TLS-Deployment-Best-Practices)
