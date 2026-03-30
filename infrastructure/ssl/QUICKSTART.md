# SSL/TLS Quick Start Guide

Get Nova Rewards SSL/TLS up and running in 5-30 minutes.

## Choose Your Deployment Method

### ⚡ Fastest: Terraform (5 minutes)
Best for: AWS deployments, automated infrastructure

```bash
# 1. Navigate to SSL directory
cd Nova-Rewards/infrastructure/ssl

# 2. Initialize Terraform
terraform init

# 3. Create variables file
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 4. Plan deployment
terraform plan -out=tfplan

# 5. Apply configuration
terraform apply tfplan

# 6. Get outputs
terraform output
```

**What happens**:
- EC2 instance created
- Security groups configured
- Certificates provisioned
- NGINX configured
- Renewal timer active

**Next**: Skip to [Verification](#verification)

---

### 🔧 Flexible: Manual Setup (15 minutes)
Best for: Custom environments, existing EC2 instances

```bash
# 1. SSH into EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# 2. Set environment variables
export OPS_EMAIL="ops@nova-rewards.xyz"
export DOMAIN="api.nova-rewards.xyz"

# 3. Download setup script
git clone https://github.com/your-org/Nova-Rewards.git
cd Nova-Rewards/infrastructure/ssl

# 4. Run Certbot setup
sudo bash certbot-setup.sh

# 5. Configure NGINX
sudo cp nginx.conf /etc/nginx/conf.d/default.conf
sudo nginx -t
sudo systemctl reload nginx

# 6. Setup renewal
sudo cp certbot-renewal.service /etc/systemd/system/
sudo cp certbot-renewal.timer /etc/systemd/system/
sudo cp certbot-renewal-failure@.service /etc/systemd/system/
sudo cp notify-renewal-failure.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/notify-renewal-failure.sh

# 7. Enable renewal timer
sudo systemctl daemon-reload
sudo systemctl enable certbot-renewal.timer
sudo systemctl start certbot-renewal.timer
```

**What happens**:
- Certbot installed
- Certificates provisioned
- NGINX configured
- Renewal timer active

**Next**: Skip to [Verification](#verification)

---

### 🐳 Containerized: Docker Compose (3 minutes)
Best for: Development, containerized deployments

```bash
# 1. Navigate to project
cd Nova-Rewards/novaRewards

# 2. Ensure certificates exist on host
# (Run manual setup first if needed)

# 3. Start services with SSL
docker-compose -f docker-compose.yml \
  -f ../infrastructure/ssl/docker-compose-ssl.yml up -d

# 4. Verify
docker-compose logs nginx
```

**What happens**:
- NGINX container started
- Backend container started
- Certificates mounted
- HTTPS enabled

**Next**: Skip to [Verification](#verification)

---

## Verification

### Quick Test (1 minute)

```bash
# Test HTTPS
curl https://api.nova-rewards.xyz/health

# Expected output:
# {"success":true,"data":{"status":"ok"}}
```

### Full Verification (5 minutes)

```bash
# Run comprehensive verification
sudo bash ssl-verification.sh api.nova-rewards.xyz

# Expected: All 10 checks pass ✓
```

### SSL Labs Rating (2 minutes)

Visit: https://www.ssllabs.com/ssltest/analyze.html?d=api.nova-rewards.xyz

Expected rating: **A+**

---

## Common Tasks

### Check Certificate Expiry
```bash
sudo certbot certificates
```

### View Renewal Status
```bash
sudo systemctl status certbot-renewal.timer
```

### View Recent Logs
```bash
sudo journalctl -u certbot-renewal.service -n 20
```

### Test Renewal (Dry-Run)
```bash
sudo certbot renew --dry-run --verbose
```

### Force Renewal
```bash
sudo certbot renew --force-renewal
```

---

## Troubleshooting

### HTTPS Not Working
```bash
# Check certificate
sudo certbot certificates

# Check NGINX
sudo nginx -t
sudo systemctl status nginx

# Check logs
sudo tail -f /var/log/nginx/error.log
```

### Renewal Failed
```bash
# Check renewal logs
sudo journalctl -u certbot-renewal.service -n 50

# Run manual renewal
sudo certbot renew --verbose

# Check DNS
nslookup api.nova-rewards.xyz
```

### HSTS Header Missing
```bash
# Verify NGINX config
sudo grep -n "Strict-Transport-Security" /etc/nginx/conf.d/default.conf

# Reload NGINX
sudo systemctl reload nginx

# Test header
curl -I https://api.nova-rewards.xyz/health | grep -i strict
```

---

## Next Steps

1. **Read Full Documentation**
   - [README.md](README.md) - Complete guide
   - [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Common commands

2. **Set Up Monitoring**
   - Configure CloudWatch (if AWS)
   - Set up email notifications
   - Create monitoring dashboard

3. **Train Team**
   - Review procedures
   - Practice troubleshooting
   - Establish on-call rotation

4. **Document Procedures**
   - Create runbooks
   - Document customizations
   - Update team wiki

---

## Support

### Quick Help
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Fast lookup
- [README.md](README.md#troubleshooting) - Troubleshooting

### Detailed Help
- [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment procedures
- [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) - Verification

### Emergency
- Contact: ops@nova-rewards.xyz
- Include: Logs + verification output

---

## Verification Checklist

- [ ] HTTPS endpoint responding
- [ ] HTTP redirects to HTTPS
- [ ] HSTS header present
- [ ] Certificate valid
- [ ] Renewal timer active
- [ ] SSL Labs rating A+
- [ ] Monitoring configured
- [ ] Team trained

---

**Time to Production**: 5-30 minutes
**Automation Level**: 50-100%
**Difficulty**: Easy to Moderate

**Ready?** Choose your deployment method above and get started!
