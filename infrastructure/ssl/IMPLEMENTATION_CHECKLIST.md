# SSL/TLS Implementation Checklist for Nova Rewards

This checklist ensures proper implementation of Let's Encrypt and Certbot for automatic SSL certificate provisioning and renewal.

## Pre-Deployment Phase

### Infrastructure Preparation
- [ ] AWS account with appropriate permissions
- [ ] EC2 instance running Ubuntu 22.04 LTS (t3.medium or larger)
- [ ] Security group created with ports 80, 443, 22 open
- [ ] Domain `api.nova-rewards.xyz` registered
- [ ] Domain DNS pointing to EC2 instance public IP
- [ ] SSH key pair created and stored securely
- [ ] Backup of existing NGINX configuration (if any)

### Team Preparation
- [ ] Ops email address configured: ops@nova-rewards.xyz
- [ ] Email server (postfix/sendmail) configured for notifications
- [ ] Team trained on SSL/TLS concepts and renewal process
- [ ] Escalation procedures documented
- [ ] On-call rotation established for certificate renewal failures

### Documentation Review
- [ ] README.md reviewed and understood
- [ ] DEPLOYMENT.md reviewed and understood
- [ ] Troubleshooting section reviewed
- [ ] Architecture diagram reviewed

## Deployment Phase

### Step 1: Certbot Installation
- [ ] SSH access to EC2 instance verified
- [ ] System packages updated: `sudo apt-get update && apt-get upgrade -y`
- [ ] Certbot installed: `sudo apt-get install -y certbot python3-certbot-nginx`
- [ ] NGINX installed: `sudo apt-get install -y nginx`
- [ ] NGINX started: `sudo systemctl start nginx && systemctl enable nginx`
- [ ] Certificate directory created: `sudo mkdir -p /var/www/certbot`

### Step 2: Initial Certificate Provisioning
- [ ] DNS resolution verified: `nslookup api.nova-rewards.xyz`
- [ ] Port 80 accessible: `curl -v http://api.nova-rewards.xyz`
- [ ] Certbot setup script executed: `sudo bash certbot-setup.sh`
- [ ] Certificate obtained successfully
- [ ] Certificate files verified:
  - [ ] `/etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem` exists
  - [ ] `/etc/letsencrypt/live/api.nova-rewards.xyz/privkey.pem` exists
- [ ] Certificate validity checked: `sudo certbot certificates`

### Step 3: NGINX Configuration
- [ ] NGINX config copied: `sudo cp nginx.conf /etc/nginx/conf.d/default.conf`
- [ ] NGINX config tested: `sudo nginx -t` (output: "successful")
- [ ] NGINX reloaded: `sudo systemctl reload nginx`
- [ ] HTTP to HTTPS redirect working: `curl -v http://api.nova-rewards.xyz/health`
- [ ] HTTPS endpoint responding: `curl -v https://api.nova-rewards.xyz/health`
- [ ] HSTS header present: `curl -I https://api.nova-rewards.xyz/health | grep -i strict`

### Step 4: Automatic Renewal Setup
- [ ] Renewal service file copied: `sudo cp certbot-renewal.service /etc/systemd/system/`
- [ ] Renewal timer file copied: `sudo cp certbot-renewal.timer /etc/systemd/system/`
- [ ] Failure notification service copied: `sudo cp certbot-renewal-failure@.service /etc/systemd/system/`
- [ ] Notification script copied: `sudo cp notify-renewal-failure.sh /usr/local/bin/`
- [ ] Notification script made executable: `sudo chmod +x /usr/local/bin/notify-renewal-failure.sh`
- [ ] Systemd daemon reloaded: `sudo systemctl daemon-reload`
- [ ] Renewal timer enabled: `sudo systemctl enable certbot-renewal.timer`
- [ ] Renewal timer started: `sudo systemctl start certbot-renewal.timer`
- [ ] Timer status verified: `sudo systemctl status certbot-renewal.timer`

### Step 5: Email Notifications
- [ ] Postfix installed: `sudo apt-get install -y mailutils`
- [ ] Postfix configured for sending emails
- [ ] Test email sent: `echo "Test" | mail -s "Test" ops@nova-rewards.xyz`
- [ ] Email received successfully
- [ ] OPS_EMAIL environment variable set: `export OPS_EMAIL="ops@nova-rewards.xyz"`

### Step 6: Renewal Testing
- [ ] Dry-run renewal executed: `sudo certbot renew --dry-run --verbose`
- [ ] Dry-run completed successfully (no errors)
- [ ] Renewal logs reviewed: `sudo journalctl -u certbot-renewal.service`
- [ ] NGINX still running after test: `sudo systemctl status nginx`

## Post-Deployment Verification

### Certificate Verification
- [ ] Certificate details reviewed: `sudo openssl x509 -in /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem -noout -text`
- [ ] Certificate chain verified: `sudo openssl crl2pkcs7 -nocrl -certfile /etc/letsencrypt/live/api.nova-rewards.xyz/fullchain.pem | openssl pkcs7 -print_certs -text -noout`
- [ ] Private key verified: `sudo openssl rsa -in /etc/letsencrypt/live/api.nova-rewards.xyz/privkey.pem -check`
- [ ] Certificate expiry date noted and documented
- [ ] Certificate issuer verified as "Let's Encrypt"

### HTTPS Connectivity
- [ ] HTTPS endpoint responding: `curl https://api.nova-rewards.xyz/health`
- [ ] Response is valid JSON: `curl https://api.nova-rewards.xyz/health | jq .`
- [ ] HTTP status code is 200: `curl -o /dev/null -w "%{http_code}" https://api.nova-rewards.xyz/health`
- [ ] Response time acceptable (< 1 second)

### Security Headers
- [ ] HSTS header present: `curl -I https://api.nova-rewards.xyz/health | grep -i strict-transport-security`
- [ ] HSTS max-age is 31536000 (1 year)
- [ ] HSTS includeSubDomains present
- [ ] X-Frame-Options header present: `curl -I https://api.nova-rewards.xyz/health | grep -i x-frame-options`
- [ ] X-Content-Type-Options header present: `curl -I https://api.nova-rewards.xyz/health | grep -i x-content-type-options`
- [ ] X-XSS-Protection header present: `curl -I https://api.nova-rewards.xyz/health | grep -i x-xss-protection`

### TLS Configuration
- [ ] TLS 1.2 supported: `openssl s_client -connect api.nova-rewards.xyz:443 -tls1_2 < /dev/null`
- [ ] TLS 1.3 supported: `openssl s_client -connect api.nova-rewards.xyz:443 -tls1_3 < /dev/null`
- [ ] SSL 3.0 not supported: `openssl s_client -connect api.nova-rewards.xyz:443 -ssl3 < /dev/null` (should fail)
- [ ] Strong ciphers configured: `openssl s_client -connect api.nova-rewards.xyz:443 -cipher HIGH < /dev/null`

### HTTP Redirect
- [ ] HTTP requests redirect to HTTPS: `curl -v http://api.nova-rewards.xyz/health 2>&1 | grep -i "301\|location"`
- [ ] Redirect is permanent (301): `curl -o /dev/null -w "%{http_code}" http://api.nova-rewards.xyz/health`
- [ ] Final destination is HTTPS: `curl -L http://api.nova-rewards.xyz/health | jq .`

### SSL Labs Rating
- [ ] Visit: https://www.ssllabs.com/ssltest/analyze.html?d=api.nova-rewards.xyz
- [ ] Rating is A+ (or A minimum)
- [ ] No critical issues reported
- [ ] Certificate chain complete
- [ ] Protocol support correct
- [ ] Key exchange strong
- [ ] Cipher strength strong

### Comprehensive Verification
- [ ] Run verification script: `sudo bash ssl-verification.sh api.nova-rewards.xyz`
- [ ] All checks pass (10/10 green checkmarks)
- [ ] Verification output saved: `sudo bash ssl-verification.sh api.nova-rewards.xyz > verification-report.txt`

## Monitoring Setup

### CloudWatch Monitoring (AWS)
- [ ] CloudWatch agent installed on EC2 instance
- [ ] CloudWatch agent configured for NGINX logs
- [ ] CloudWatch agent configured for Certbot logs
- [ ] Custom metric for certificate expiry created
- [ ] CloudWatch alarm for certificate expiry (< 30 days) created
- [ ] SNS topic created for alerts
- [ ] Email subscription to SNS topic confirmed

### Local Monitoring
- [ ] Log rotation configured: `/etc/logrotate.d/nova-rewards`
- [ ] Cron job for certificate expiry check created
- [ ] Cron job for renewal status check created
- [ ] Monitoring dashboard created (optional)

### Alerting
- [ ] Email alerts configured for renewal failures
- [ ] Email alerts configured for certificate expiry warnings
- [ ] Slack integration configured (optional)
- [ ] PagerDuty integration configured (optional)

## Documentation

### Internal Documentation
- [ ] Deployment procedure documented
- [ ] Troubleshooting guide created
- [ ] Runbook for certificate renewal created
- [ ] Runbook for emergency certificate revocation created
- [ ] Runbook for certificate rotation created
- [ ] Team trained on procedures

### External Documentation
- [ ] README.md updated with SSL/TLS information
- [ ] API documentation updated with HTTPS requirement
- [ ] Client integration guide updated
- [ ] Security policy updated

## Maintenance Schedule

### Daily
- [ ] [ ] Monitor NGINX logs for errors: `sudo tail -f /var/log/nginx/error.log`
- [ ] [ ] Check renewal timer status: `sudo systemctl status certbot-renewal.timer`

### Weekly
- [ ] [ ] Check certificate expiry: `sudo certbot certificates`
- [ ] [ ] Review renewal logs: `sudo journalctl -u certbot-renewal.service -n 50`
- [ ] [ ] Verify HTTPS connectivity: `curl https://api.nova-rewards.xyz/health`

### Monthly
- [ ] [ ] Update system packages: `sudo apt-get update && apt-get upgrade`
- [ ] [ ] Run verification script: `sudo bash ssl-verification.sh`
- [ ] [ ] Review security headers: `curl -I https://api.nova-rewards.xyz/health`
- [ ] [ ] Check SSL Labs rating: https://www.ssllabs.com/ssltest/analyze.html?d=api.nova-rewards.xyz

### Quarterly
- [ ] [ ] Review and update NGINX configuration
- [ ] [ ] Review and update Certbot configuration
- [ ] [ ] Audit certificate chain
- [ ] [ ] Review security policies and procedures
- [ ] [ ] Conduct security training

### Annually
- [ ] [ ] Review and update SSL/TLS strategy
- [ ] [ ] Audit all certificates and renewals
- [ ] [ ] Review and update disaster recovery procedures
- [ ] [ ] Conduct security audit

## Rollback Plan

### If Deployment Fails
- [ ] Restore previous NGINX configuration: `sudo cp /etc/nginx/conf.d/default.conf.bak /etc/nginx/conf.d/default.conf`
- [ ] Reload NGINX: `sudo systemctl reload nginx`
- [ ] Verify HTTP connectivity: `curl http://api.nova-rewards.xyz/health`
- [ ] Investigate failure: `sudo journalctl -u certbot-renewal.service`
- [ ] Document issue and resolution

### If Certificate Renewal Fails
- [ ] Check DNS resolution: `nslookup api.nova-rewards.xyz`
- [ ] Check port 80 accessibility: `sudo netstat -tlnp | grep :80`
- [ ] Run manual renewal: `sudo certbot renew --verbose`
- [ ] If still failing, contact Let's Encrypt support
- [ ] Temporary workaround: Extend certificate TTL (if possible)

### If HTTPS Outage Occurs
- [ ] Check NGINX status: `sudo systemctl status nginx`
- [ ] Check certificate validity: `sudo certbot certificates`
- [ ] Check NGINX logs: `sudo tail -f /var/log/nginx/error.log`
- [ ] Restart NGINX: `sudo systemctl restart nginx`
- [ ] If still failing, rollback to HTTP (temporary)
- [ ] Investigate root cause

## Sign-Off

- [ ] Deployment completed successfully
- [ ] All verification checks passed
- [ ] Monitoring configured and tested
- [ ] Team trained on procedures
- [ ] Documentation complete and reviewed
- [ ] Rollback procedures tested
- [ ] Deployment approved by: _________________ (Name/Date)
- [ ] Deployment verified by: _________________ (Name/Date)

## Notes

Use this section to document any deviations, issues, or special configurations:

```
[Add notes here]
```

---

**Last Updated**: [Date]
**Updated By**: [Name]
**Next Review**: [Date]
