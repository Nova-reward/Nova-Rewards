# SSL/TLS Quick Reference Guide

Fast lookup for common SSL/TLS operations and commands.

## Certificate Management

### View Certificate Details
```bash
# View certificate expiry
sudo certbot certificates

# View full certificate details
sudo openssl x509 -in /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem -noout -text

# View certificate chain
sudo openssl crl2pkcs7 -nocrl -certfile /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem | openssl pkcs7 -print_certs -text -noout

# View private key details
sudo openssl rsa -in /etc/letsencrypt/live/api.nova-rewards.xyz/privkey.pem -check

# Days until expiry
sudo openssl x509 -in /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem -noout -enddate | cut -d= -f2
```

### Renew Certificates
```bash
# Manual renewal
sudo certbot renew

# Force renewal
sudo certbot renew --force-renewal

# Renewal with verbose output
sudo certbot renew --verbose

# Dry-run renewal (test without making changes)
sudo certbot renew --dry-run

# Renew specific domain
sudo certbot renew --cert-name api.nova-rewards.xyz
```

### Revoke Certificates
```bash
# Revoke certificate
sudo certbot revoke --cert-path /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem

# Revoke and delete
sudo certbot revoke --cert-path /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem --delete-after-revoke
```

## NGINX Management

### Configuration
```bash
# Test NGINX configuration
sudo nginx -t

# View NGINX configuration
sudo cat /etc/nginx/conf.d/default.conf

# Edit NGINX configuration
sudo nano /etc/nginx/conf.d/default.conf

# Reload NGINX (graceful)
sudo systemctl reload nginx

# Restart NGINX (full restart)
sudo systemctl restart nginx

# Stop NGINX
sudo systemctl stop nginx

# Start NGINX
sudo systemctl start nginx
```

### Logs
```bash
# View access logs (last 50 lines)
sudo tail -f /var/log/nginx/nova_access.log

# View error logs (last 50 lines)
sudo tail -f /var/log/nginx/nova_error.log

# View all access logs
sudo cat /var/log/nginx/nova_access.log

# Search logs for errors
sudo grep "error" /var/log/nginx/nova_error.log

# Count requests by status code
sudo awk '{print $9}' /var/log/nginx/nova_access.log | sort | uniq -c
```

### Status
```bash
# Check NGINX status
sudo systemctl status nginx

# Check if NGINX is running
sudo systemctl is-active nginx

# Check NGINX process
sudo ps aux | grep nginx

# Check listening ports
sudo netstat -tlnp | grep nginx
```

## Renewal Timer Management

### Timer Status
```bash
# Check timer status
sudo systemctl status certbot-renewal.timer

# List all timers
sudo systemctl list-timers

# View timer schedule
sudo systemctl list-timers certbot-renewal.timer

# Check if timer is enabled
sudo systemctl is-enabled certbot-renewal.timer

# Check if timer is active
sudo systemctl is-active certbot-renewal.timer
```

### Timer Control
```bash
# Enable timer
sudo systemctl enable certbot-renewal.timer

# Start timer
sudo systemctl start certbot-renewal.timer

# Stop timer
sudo systemctl stop certbot-renewal.timer

# Disable timer
sudo systemctl disable certbot-renewal.timer

# Reload systemd configuration
sudo systemctl daemon-reload
```

### Timer Logs
```bash
# View recent renewal attempts
sudo journalctl -u certbot-renewal.service -n 50 --no-pager

# View renewal logs with timestamps
sudo journalctl -u certbot-renewal.service --since "1 hour ago"

# View renewal logs with full details
sudo journalctl -u certbot-renewal.service -o verbose

# Follow renewal logs in real-time
sudo journalctl -u certbot-renewal.service -f
```

## Testing & Verification

### HTTPS Connectivity
```bash
# Test HTTPS endpoint
curl https://api.nova-rewards.xyz/health

# Test HTTPS with verbose output
curl -v https://api.nova-rewards.xyz/health

# Test HTTPS with headers
curl -I https://api.nova-rewards.xyz/health

# Test HTTPS with certificate details
curl -v --insecure https://api.nova-rewards.xyz/health

# Test HTTPS response time
curl -w "Time: %{time_total}s\n" https://api.nova-rewards.xyz/health
```

### HTTP Redirect
```bash
# Test HTTP redirect
curl -v http://api.nova-rewards.xyz/health

# Test HTTP redirect (follow)
curl -L http://api.nova-rewards.xyz/health

# Test HTTP redirect status code
curl -o /dev/null -w "%{http_code}" http://api.nova-rewards.xyz/health
```

### Security Headers
```bash
# Check all security headers
curl -I https://api.nova-rewards.xyz/health

# Check HSTS header
curl -I https://api.nova-rewards.xyz/health | grep -i strict-transport-security

# Check X-Frame-Options header
curl -I https://api.nova-rewards.xyz/health | grep -i x-frame-options

# Check X-Content-Type-Options header
curl -I https://api.nova-rewards.xyz/health | grep -i x-content-type-options

# Check X-XSS-Protection header
curl -I https://api.nova-rewards.xyz/health | grep -i x-xss-protection
```

### TLS Configuration
```bash
# Check TLS 1.2 support
openssl s_client -connect api.nova-rewards.xyz:443 -tls1_2 < /dev/null

# Check TLS 1.3 support
openssl s_client -connect api.nova-rewards.xyz:443 -tls1_3 < /dev/null

# Check SSL 3.0 (should fail)
openssl s_client -connect api.nova-rewards.xyz:443 -ssl3 < /dev/null

# Check cipher suites
openssl s_client -connect api.nova-rewards.xyz:443 -cipher HIGH < /dev/null

# Check certificate chain
openssl s_client -connect api.nova-rewards.xyz:443 -showcerts < /dev/null
```

### Comprehensive Verification
```bash
# Run full verification script
sudo bash ssl-verification.sh api.nova-rewards.xyz

# Save verification output
sudo bash ssl-verification.sh api.nova-rewards.xyz > verification-report.txt

# Check SSL Labs rating
# Visit: https://www.ssllabs.com/ssltest/analyze.html?d=api.nova-rewards.xyz
```

## Troubleshooting

### Certificate Issues
```bash
# Check certificate validity
sudo openssl x509 -in /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem -noout -dates

# Check certificate chain completeness
sudo openssl crl2pkcs7 -nocrl -certfile /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem | openssl pkcs7 -print_certs -text -noout | grep "Subject:"

# Verify certificate matches private key
sudo openssl x509 -noout -modulus -in /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem | openssl md5
sudo openssl rsa -noout -modulus -in /etc/letsencrypt/live/api.nova-rewards.xyz/privkey.pem | openssl md5
# (Both should output the same MD5 hash)
```

### Renewal Issues
```bash
# Check renewal logs
sudo journalctl -u certbot-renewal.service -n 50

# Run manual renewal with verbose output
sudo certbot renew --verbose

# Check DNS resolution
nslookup api.nova-rewards.xyz

# Check port 80 accessibility
sudo netstat -tlnp | grep :80

# Check Certbot logs
sudo tail -f /var/log/certbot/renewal.log
```

### NGINX Issues
```bash
# Test NGINX configuration
sudo nginx -t

# View NGINX error logs
sudo tail -f /var/log/nginx/error.log

# Check NGINX process
sudo ps aux | grep nginx

# Check listening ports
sudo netstat -tlnp | grep nginx

# Restart NGINX
sudo systemctl restart nginx
```

### Email Notification Issues
```bash
# Check postfix status
sudo systemctl status postfix

# View mail logs
sudo tail -f /var/log/mail.log

# Test email sending
echo "Test" | mail -s "Test Email" ops@nova-rewards.xyz

# Check mail queue
sudo mailq

# Flush mail queue
sudo postfix flush
```

## Performance Monitoring

### Request Metrics
```bash
# Count total requests
sudo wc -l /var/log/nginx/nova_access.log

# Requests per second (last hour)
sudo tail -c 1000000 /var/log/nginx/nova_access.log | grep "$(date -d '1 hour ago' '+%d/%b/%Y:%H')" | wc -l

# Top 10 requested paths
sudo awk '{print $7}' /var/log/nginx/nova_access.log | sort | uniq -c | sort -rn | head -10

# Top 10 client IPs
sudo awk '{print $1}' /var/log/nginx/nova_access.log | sort | uniq -c | sort -rn | head -10

# Response time statistics
sudo awk '{print $NF}' /var/log/nginx/nova_access.log | sort -n | tail -10
```

### Error Monitoring
```bash
# Count errors by status code
sudo awk '{print $9}' /var/log/nginx/nova_access.log | sort | uniq -c

# Count 5xx errors
sudo awk '$9 >= 500 {print}' /var/log/nginx/nova_access.log | wc -l

# Count 4xx errors
sudo awk '$9 >= 400 && $9 < 500 {print}' /var/log/nginx/nova_access.log | wc -l

# View recent errors
sudo tail -50 /var/log/nginx/nova_error.log
```

## Maintenance Tasks

### Backup
```bash
# Backup certificates
sudo tar -czf /backup/letsencrypt-backup-$(date +%Y%m%d).tar.gz /etc/letsencrypt/

# Backup NGINX configuration
sudo cp /etc/nginx/conf.d/default.conf /backup/nginx-backup-$(date +%Y%m%d).conf

# Backup systemd files
sudo tar -czf /backup/systemd-backup-$(date +%Y%m%d).tar.gz /etc/systemd/system/certbot-*
```

### Cleanup
```bash
# Remove old NGINX logs
sudo find /var/log/nginx -name "*.log.*" -mtime +30 -delete

# Remove old Certbot logs
sudo find /var/log/certbot -name "*.log.*" -mtime +90 -delete

# Clean package cache
sudo apt-get clean

# Remove unused packages
sudo apt-get autoremove
```

### Updates
```bash
# Update system packages
sudo apt-get update && apt-get upgrade -y

# Update Certbot
sudo apt-get install --only-upgrade certbot python3-certbot-nginx

# Update NGINX
sudo apt-get install --only-upgrade nginx
```

## Emergency Procedures

### Certificate Expiry (< 7 days)
```bash
# Force immediate renewal
sudo certbot renew --force-renewal

# Verify renewal
sudo certbot certificates

# Reload NGINX
sudo systemctl reload nginx

# Verify HTTPS
curl https://api.nova-rewards.xyz/health
```

### HTTPS Outage
```bash
# Check NGINX status
sudo systemctl status nginx

# Check certificate validity
sudo certbot certificates

# Check NGINX logs
sudo tail -f /var/log/nginx/error.log

# Restart NGINX
sudo systemctl restart nginx

# Verify HTTPS
curl https://api.nova-rewards.xyz/health

# If still failing, temporary rollback to HTTP
sudo systemctl stop nginx
# Restore previous HTTP-only config
sudo systemctl start nginx
```

### Certificate Compromise
```bash
# Revoke compromised certificate
sudo certbot revoke --cert-path /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem

# Obtain new certificate
sudo certbot certonly --nginx -d api.nova-rewards.xyz

# Reload NGINX
sudo systemctl reload nginx

# Verify new certificate
curl https://api.nova-rewards.xyz/health
```

## Useful Aliases

Add these to `~/.bashrc` for quick access:

```bash
alias cert-check='sudo certbot certificates'
alias cert-renew='sudo certbot renew --verbose'
alias cert-dry-run='sudo certbot renew --dry-run --verbose'
alias nginx-test='sudo nginx -t'
alias nginx-reload='sudo systemctl reload nginx'
alias nginx-restart='sudo systemctl restart nginx'
alias nginx-logs='sudo tail -f /var/log/nginx/nova_error.log'
alias renewal-logs='sudo journalctl -u certbot-renewal.service -n 50 --no-pager'
alias renewal-status='sudo systemctl status certbot-renewal.timer'
alias https-test='curl -v https://api.nova-rewards.xyz/health'
alias http-test='curl -v http://api.nova-rewards.xyz/health'
alias ssl-verify='sudo bash /path/to/ssl-verification.sh api.nova-rewards.xyz'
```

## Common Issues & Solutions

| Issue | Command | Solution |
|-------|---------|----------|
| Certificate expired | `sudo certbot certificates` | `sudo certbot renew --force-renewal` |
| NGINX not starting | `sudo nginx -t` | Fix config errors, then `sudo systemctl restart nginx` |
| HSTS header missing | `curl -I https://api.nova-rewards.xyz/health` | Verify NGINX config includes HSTS header |
| HTTP redirect not working | `curl -v http://api.nova-rewards.xyz/health` | Check NGINX config for redirect rule |
| Renewal failed | `sudo journalctl -u certbot-renewal.service` | Check DNS, port 80, and Certbot logs |
| Email not sending | `sudo tail -f /var/log/mail.log` | Check postfix status and configuration |
| Port 80 in use | `sudo netstat -tlnp \| grep :80` | Stop conflicting service or change port |
| Certificate chain incomplete | `openssl s_client -connect api.nova-rewards.xyz:443 -showcerts` | Verify fullchain.pem is being used |

---

**Last Updated**: [Date]
**Version**: 1.0
