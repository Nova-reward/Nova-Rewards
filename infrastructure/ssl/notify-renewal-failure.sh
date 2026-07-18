#!/bin/bash
# Notification script for Certbot renewal failures
# Sends email alert to ops team when certificate renewal fails

OPS_EMAIL="${OPS_EMAIL:-ops@nova-rewards.xyz}"
HOSTNAME=$(hostname)
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
DOMAIN="api.nova-rewards.xyz"

# Email subject and body
SUBJECT="[ALERT] SSL Certificate Renewal Failed on $HOSTNAME"
BODY="
SSL Certificate Renewal Failure Alert

Domain: $DOMAIN
Server: $HOSTNAME
Time: $TIMESTAMP
Service: $FAILED_SERVICE

The automatic SSL certificate renewal has failed. Please investigate immediately.

Recent Certbot logs:
$(journalctl -u certbot-renewal.service -n 20 --no-pager)

Action Required:
1. SSH into $HOSTNAME
2. Check Certbot logs: sudo journalctl -u certbot-renewal.service -n 50
3. Run manual renewal: sudo certbot renew --verbose
4. If renewal succeeds, verify NGINX: sudo systemctl reload nginx
5. Test HTTPS: curl https://$DOMAIN/health

For more information, see: /var/log/certbot/renewal.log
"

# Send email using mail command (requires postfix/sendmail)
echo "$BODY" | mail -s "$SUBJECT" "$OPS_EMAIL"

# Also log to syslog
logger -t certbot-renewal-failure "Certificate renewal failed for $DOMAIN. Alert sent to $OPS_EMAIL"

exit 0
