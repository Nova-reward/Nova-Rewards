# Monitoring Stack Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- Access to Nova Rewards backend
- Slack workspace (for notifications)
- PagerDuty account (optional, for critical alerts)

## Deployment Steps

### 1. Initial Setup

```bash
cd monitoring

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

Configure the following in `.env`:
- `GRAFANA_ADMIN_PASSWORD`: Strong password for Grafana admin
- `SLACK_WEBHOOK_URL`: Your Slack incoming webhook URL
- `PAGERDUTY_SERVICE_KEY`: Your PagerDuty integration key
- `POSTGRES_PASSWORD`: Your PostgreSQL password

### 2. Deploy Monitoring Stack

```bash
# Run setup script
./scripts/setup.sh

# Or manually:
docker network create nova-rewards_monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

### 3. Verify Deployment

```bash
# Check all services are running
docker-compose -f docker-compose.monitoring.yml ps

# Check logs
docker-compose -f docker-compose.monitoring.yml logs -f
```

### 4. Configure Grafana

1. Access Grafana at http://localhost:3000
2. Login with admin/[your-password]
3. Change admin password (if using default)
4. Verify Prometheus datasource is connected
5. Import dashboards from `grafana/dashboards/`

### 5. Test Alerting

```bash
# Send test alert
./scripts/test-alerts.sh

# Verify alert appears in:
# - Alertmanager UI: http://localhost:9093
# - Slack channel
# - PagerDuty (if configured)
```

## Integration with Existing Services

### Connect Backend to Monitoring

Update your main `docker-compose.yml`:

```yaml
services:
  backend:
    networks:
      - default
      - monitoring

networks:
  monitoring:
    external: true
    name: nova-rewards_monitoring
```

### Update Nginx for Metrics

Add to `nginx.conf`:

```nginx
location /nginx_status {
    stub_status on;
    access_log off;
    allow 127.0.0.1;
    deny all;
}
```

## AWS Deployment

### Using EC2

1. SSH into your EC2 instance
2. Clone monitoring configuration
3. Run setup script
4. Configure security groups to allow:
   - Port 3000 (Grafana) - restricted to your IP
   - Port 9090 (Prometheus) - internal only
   - Port 9093 (Alertmanager) - internal only

### Using ECS/Fargate

See `terraform/monitoring.tf` for infrastructure as code.

## Maintenance

### Backup Prometheus Data

```bash
docker run --rm \
  -v nova-rewards_prometheus_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/prometheus-$(date +%Y%m%d).tar.gz /data
```

### Update Alert Rules

```bash
# Edit rules
vim prometheus/rules/alerts.yml

# Reload Prometheus
curl -X POST http://localhost:9090/-/reload
```

### Scale Prometheus Storage

```bash
# Increase retention
docker-compose -f docker-compose.monitoring.yml down
# Edit prometheus command: --storage.tsdb.retention.time=60d
docker-compose -f docker-compose.monitoring.yml up -d
```

## Troubleshooting

### Prometheus Not Scraping

```bash
# Check targets
curl http://localhost:9090/api/v1/targets | jq

# Test connectivity
docker exec -it nova-prometheus wget -O- http://backend:4000/metrics
```

### Grafana Shows No Data

```bash
# Verify datasource
curl http://localhost:3000/api/datasources

# Test Prometheus query
curl -G 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=up'
```

### Alerts Not Firing

```bash
# Check alert rules
curl http://localhost:9090/api/v1/rules | jq

# Check Alertmanager
docker logs nova-alertmanager
```

## Security Considerations

1. Change default Grafana password immediately
2. Restrict Prometheus/Alertmanager to internal network
3. Use HTTPS for Grafana in production
4. Rotate credentials regularly
5. Enable Grafana authentication
6. Use secrets management for sensitive data

## Monitoring the Monitoring

Set up meta-monitoring:
- Monitor Prometheus disk usage
- Alert on Prometheus scrape failures
- Monitor Grafana availability
- Track Alertmanager notification failures
