# SSL/TLS Certificate Management for Nova Rewards

This directory contains production-grade SSL/TLS certificate management configuration using Let's Encrypt and Certbot for the Nova Rewards API.

## Overview

This setup provides:
- **Automatic certificate provisioning** via Let's Encrypt
- **Automatic certificate renewal** with systemd timers (twice daily)
- **HTTPS-only traffic** with HTTP→HTTPS 301 redirects
- **HSTS enforcement** (Strict-Transport-Security header)
- **Renewal failure notifications** sent to ops email
- **NGINX reverse proxy** with modern TLS configuration
- **A+ SSL Labs rating** through proper TLS configuration

## Architecture

```
Internet
   ↓
NGINX (Port 80/443)
   ├─ HTTP (80) → HTTPS (443) redirect
   └─ HTTPS (443) → Backend (4000)
        ↓
   Express Backend
        ↓
   PostgreSQL + Redis
```

## Files

| File | Purpose |
|------|---------|
| `nginx.conf` | NGINX reverse proxy configuration with SSL/TLS |
| `certbot-setup.sh` | Initial Certbot installation and certificate provisioning |
| `certbot-renewal.service` | Systemd service for certificate renewal |
| `certbot-renewal.timer` | Systemd timer (runs renewal twice daily) |
| `certbot-renewal-failure@.service` | Failure notification service |
| `notify-renewal-failure.sh` | Email notification script |
| `docker-compose-ssl.yml` | Docker Compose extension with NGINX |
| `ssl-verification.sh` | Comprehensive SSL/TLS verification script |

## Prerequisites

- EC2 instance running Ubuntu 20.04+ or Debian 11+
- NGINX installed and running
- Domain `api.nova-rewards.xyz` pointing to EC2 instance
- Port 80 and 443 open in security groups
- Email address for Let's Encrypt notifications (set via `OPS_EMAIL` env var)

## Installation

### Step 1: Prepare EC2 Instance

```bash
# SSH into EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install NGINX (if not already installed)
sudo apt-get install -y nginx

# Start NGINX
sudo systemctl start nginx
sudo systemctl enable nginx
```

### Step 2: Configure Environment

```bash
# Set ops email for renewal notifications
export OPS_EMAIL="ops@nova-rewards.xyz"

# Verify domain DNS is pointing to EC2 instance
nslookup api.nova-rewards.xyz
```

### Step 3: Run Certbot Setup

```bash
# Download and run setup script
sudo bash certbot-setup.sh

# The script will:
# 1. Install Certbot and NGINX plugin
# 2. Obtain initial SSL certificate
# 3. Verify certificate installation
# 4. Test renewal process (dry-run)
```

### Step 4: Configure NGINX

```bash
# Copy NGINX configuration
sudo cp infrastructure/ssl/nginx.conf /etc/nginx/conf.d/default.conf

# Test NGINX configuration
sudo nginx -t

# Reload NGINX
sudo systemctl reload nginx
```

### Step 5: Set Up Automatic Renewal

```bash
# Copy systemd service and timer files
sudo cp infrastructure/ssl/certbot-renewal.service /etc/systemd/system/
sudo cp infrastructure/ssl/certbot-renewal.timer /etc/systemd/system/
sudo cp infrastructure/ssl/certbot-renewal-failure@.service /etc/systemd/system/
sudo cp infrastructure/ssl/notify-renewal-failure.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/notify-renewal-failure.sh

# Enable and start the timer
sudo systemctl daemon-reload
sudo systemctl enable certbot-renewal.timer
sudo systemctl start certbot-renewal.timer

# Verify timer is active
sudo systemctl status certbot-renewal.timer
```

### Step 6: Configure Email Notifications

```bash
# Install mail utilities (if not present)
sudo apt-get install -y mailutils

# Configure postfix for sending emails
sudo dpkg-reconfigure postfix
# Select: Internet Site
# System mail name: your-domain.com
# Root and postmaster mail recipient: ops@nova-rewards.xyz

# Test email sending
echo "Test" | mail -s "Test Email" ops@nova-rewards.xyz
```

### Step 7: Verify Installation

```bash
# Run comprehensive verification
sudo bash infrastructure/ssl/ssl-verification.sh api.nova-rewards.xyz

# Expected output:
# ✓ Certificate files found
# ✓ Certificate validity confirmed
# ✓ Certificate chain verified
# ✓ HTTPS endpoint responding
# ✓ HTTP redirect working
# ✓ HSTS header present
# ✓ TLS version: TLSv1.2/TLSv1.3
# ✓ Renewal test completed
# ✓ NGINX configuration valid
# ✓ Certbot renewal timer is active
```

## Testing

### Test HTTPS Connectivity

```bash
# Test HTTPS endpoint
curl -v https://api.nova-rewards.xyz/health

# Expected response:
# HTTP/2 200
# strict-transport-security: max-age=31536000; includeSubDomains
# {"success":true,"data":{"status":"ok"}}
```

### Test HTTP Redirect

```bash
# Test HTTP to HTTPS redirect
curl -v http://api.nova-rewards.xyz/health

# Expected: 301 redirect to https://api.nova-rewards.xyz/health
```

### Test Certificate Renewal (Dry-Run)

```bash
# Perform dry-run renewal (no actual renewal)
sudo certbot renew --dry-run --verbose

# Expected output:
# Cert not yet due for renewal
# (or "Cert due for renewal, would renew now" if close to expiry)
```

### Test SSL Labs Rating

Visit: https://www.ssllabs.com/ssltest/analyze.html?d=api.nova-rewards.xyz

Expected rating: **A+**

## Monitoring

### Check Certificate Expiry

```bash
# View certificate expiry date
sudo openssl x509 -in /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem -noout -enddate

# Check days until expiry
sudo certbot certificates
```

### Monitor Renewal Timer

```bash
# Check timer status
sudo systemctl status certbot-renewal.timer

# View timer schedule
sudo systemctl list-timers certbot-renewal.timer

# View recent renewal attempts
sudo journalctl -u certbot-renewal.service -n 50 --no-pager

# View renewal logs
sudo tail -f /var/log/certbot/renewal.log
```

### Check NGINX Logs

```bash
# View NGINX access logs
sudo tail -f /var/log/nginx/nova_access.log

# View NGINX error logs
sudo tail -f /var/log/nginx/nova_error.log
```

## Troubleshooting

### Certificate Renewal Failed

```bash
# Check renewal logs
sudo journalctl -u certbot-renewal.service -n 50

# Run manual renewal with verbose output
sudo certbot renew --verbose

# Common issues:
# - Port 80 blocked: Check security groups
# - DNS not resolving: Verify domain DNS configuration
# - Rate limiting: Wait 1 hour before retrying
```

### NGINX Not Starting

```bash
# Test NGINX configuration
sudo nginx -t

# View NGINX error logs
sudo tail -f /var/log/nginx/error.log

# Restart NGINX
sudo systemctl restart nginx
```

### HSTS Header Not Present

```bash
# Verify NGINX configuration includes HSTS header
sudo grep -n "Strict-Transport-Security" /etc/nginx/conf.d/default.conf

# Reload NGINX if missing
sudo systemctl reload nginx
```

### Email Notifications Not Sending

```bash
# Check postfix status
sudo systemctl status postfix

# View mail logs
sudo tail -f /var/log/mail.log

# Test email sending
echo "Test" | mail -s "Test" ops@nova-rewards.xyz

# Verify OPS_EMAIL environment variable
echo $OPS_EMAIL
```

## Maintenance

### Manual Certificate Renewal

```bash
# Force renewal (useful if certificate is compromised)
sudo certbot renew --force-renewal

# Renew specific domain
sudo certbot renew --cert-name api.nova-rewards.xyz
```

### Update NGINX Configuration

```bash
# Edit NGINX config
sudo nano /etc/nginx/conf.d/default.conf

# Test changes
sudo nginx -t

# Reload NGINX
sudo systemctl reload nginx
```

### Rotate Certificates

```bash
# Revoke current certificate
sudo certbot revoke --cert-path /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem

# Obtain new certificate
sudo certbot certonly --nginx -d api.nova-rewards.xyz
```

## Security Best Practices

1. **Keep Certbot Updated**: Run `sudo apt-get upgrade certbot` regularly
2. **Monitor Certificate Expiry**: Set calendar reminders for 30 days before expiry
3. **Review NGINX Logs**: Check for suspicious activity regularly
4. **Backup Certificates**: Store `/etc/letsencrypt` in secure backup
5. **Rotate Secrets**: Update JWT_SECRET and other credentials regularly
6. **Enable Firewall**: Use UFW or security groups to restrict access
7. **Monitor Renewal**: Check renewal logs weekly for failures

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPS_EMAIL` | `ops@nova-rewards.xyz` | Email for renewal notifications |
| `DOMAIN` | `api.nova-rewards.xyz` | Domain to provision certificate for |
| `CERTBOT_DIR` | `/etc/letsencrypt` | Certbot certificate directory |
| `RENEWAL_LOG` | `/var/log/certbot-renewal.log` | Renewal log file path |

## References

- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot Documentation](https://certbot.eff.org/docs/)
- [NGINX SSL Configuration](https://nginx.org/en/docs/http/ngx_http_ssl_module.html)
- [HSTS Specification](https://tools.ietf.org/html/rfc6797)
- [SSL Labs Best Practices](https://github.com/ssllabs/research/wiki/SSL-and-TLS-Deployment-Best-Practices)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review Certbot logs: `sudo journalctl -u certbot-renewal.service`
3. Review NGINX logs: `sudo tail -f /var/log/nginx/error.log`
4. Contact ops team: ops@nova-rewards.xyz
