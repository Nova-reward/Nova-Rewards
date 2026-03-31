# Nova Rewards Monitoring & Alerting

Complete observability stack for Nova Rewards platform with Prometheus, Grafana, and comprehensive alerting.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Backend   │────▶│  Prometheus  │────▶│   Grafana   │
│  (Metrics)  │     │  (Scraping)  │     │ (Dashboards)│
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Alertmanager │
                    │  (Routing)   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐  ┌─────────┐  ┌──────────┐
         │ Slack  │  │PagerDuty│  │  Email   │
         └────────┘  └─────────┘  └──────────┘
```

## Components

### Prometheus
- **Port**: 9090
- **Purpose**: Metrics collection and storage
- **Retention**: 30 days
- **Scrape Interval**: 15 seconds

### Grafana
- **Port**: 3000
- **Purpose**: Visualization and dashboards
- **Default Credentials**: admin/admin (change on first login)

### Alertmanager
- **Port**: 9093
- **Purpose**: Alert routing and notification
- **Integrations**: Slack, PagerDuty, Email

### Exporters
- **Node Exporter** (9100): System metrics (CPU, memory, disk)
- **PostgreSQL Exporter** (9187): Database metrics
- **Redis Exporter** (9121): Cache metrics
- **Nginx Exporter** (9113): Web server metrics
- **Blackbox Exporter** (9115): Endpoint health checks

## Quick Start

### 1. Setup Environment
```bash
cd monitoring
cp .env.example .env
# Edit .env with your configuration
```

### 2. Start Monitoring Stack
```bash
# Start all monitoring services
docker-compose -f docker-compose.monitoring.yml up -d

# Verify services are running
docker-compose -f docker-compose.monitoring.yml ps
```

### 3. Access Dashboards
- **Grafana**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

### 4. Configure Alerts
Edit `alertmanager/alertmanager.yml` with your notification channels:
- Slack webhook URL
- PagerDuty integration key
- Email SMTP settings

## Metrics Collected

### Application Metrics
- HTTP request duration (histogram)
- Request rate by endpoint
- Error rate by status code
- Active requests

### System Metrics
- CPU usage
- Memory usage
- Disk space
- Network I/O

### Database Metrics
- Connection count
- Query duration
- Transaction rate
- Cache hit ratio
- Database size

### Cache Metrics
- Redis memory usage
- Cache hit/miss rate
- Eviction rate
- Connection count

## Alerts Configured

### Critical Alerts
- **HighErrorRate**: 5xx errors > 5% for 5 minutes
- **ServiceDown**: Service unreachable for 2 minutes
- **PostgreSQLDown**: Database unreachable for 2 minutes
- **RedisDown**: Cache unreachable for 2 minutes
- **EndpointDown**: Health check failing for 5 minutes

### Warning Alerts
- **HighLatency**: 95th percentile > 1 second for 10 minutes
- **HighCPUUsage**: CPU > 80% for 10 minutes
- **HighMemoryUsage**: Memory > 85% for 10 minutes
- **HighDatabaseConnections**: Connections > 80% of max
- **HighRedisMemory**: Redis memory > 90%
- **DiskSpaceLow**: Disk space < 15%
- **SSLCertificateExpiringSoon**: Certificate expires in < 7 days

## Runbooks

Detailed incident response procedures are available in the `runbooks/` directory:

- [High Error Rate](./runbooks/high-error-rate.md)
- [Service Down](./runbooks/service-down.md)
- [High Latency](./runbooks/high-latency.md)
- [PostgreSQL Down](./runbooks/postgres-down.md)
- [Redis Down](./runbooks/redis-down.md)

## Grafana Dashboards

### Nova Rewards Overview
- Request rate and latency
- Error rate trends
- System resource usage
- Database and cache metrics

### System Metrics
- CPU, memory, disk usage
- Network I/O
- Process metrics

### Database Performance
- Query performance
- Connection pool status
- Slow queries
- Database size trends

### Cache Performance
- Redis memory usage
- Hit/miss ratio
- Eviction rate
- Command statistics

## Integration with Existing Infrastructure

### AWS CloudWatch
The monitoring stack complements existing CloudWatch monitoring:
- CloudWatch: Infrastructure-level metrics (ALB, EC2, RDS)
- Prometheus: Application-level metrics (API, business logic)

### Docker Compose Integration
```yaml
# In your main docker-compose.yml, add monitoring network
networks:
  monitoring:
    external: true
    name: nova-rewards_monitoring

# Connect backend to monitoring network
services:
  backend:
    networks:
      - default
      - monitoring
```

### Kubernetes Integration (if applicable)
```yaml
# ServiceMonitor for Prometheus Operator
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: nova-backend
spec:
  selector:
    matchLabels:
      app: nova-backend
  endpoints:
  - port: metrics
    path: /metrics
```

## Maintenance

### Backup Prometheus Data
```bash
# Backup Prometheus data
docker run --rm -v nova-rewards_prometheus_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/prometheus-backup-$(date +%Y%m%d).tar.gz /data
```

### Update Alert Rules
```bash
# Edit alert rules
vim prometheus/rules/alerts.yml

# Reload Prometheus configuration
curl -X POST http://localhost:9090/-/reload
```

### Test Alerts
```bash
# Trigger test alert
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {"alertname": "TestAlert", "severity": "warning"},
    "annotations": {"summary": "Test alert"}
  }]'
```

## Troubleshooting

### Prometheus Not Scraping Targets
```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check network connectivity
docker exec -it nova-prometheus wget -O- http://backend:4000/metrics
```

### Grafana Not Showing Data
```bash
# Verify Prometheus datasource
curl http://localhost:3000/api/datasources

# Test Prometheus query
curl -G 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=up'
```

### Alerts Not Firing
```bash
# Check alert rules
curl http://localhost:9090/api/v1/rules

# Check Alertmanager status
curl http://localhost:9093/api/v1/status

# View Alertmanager logs
docker logs nova-alertmanager
```

## Best Practices

### 1. Alert Fatigue Prevention
- Set appropriate thresholds
- Use inhibition rules
- Group related alerts
- Set proper evaluation periods

### 2. Dashboard Organization
- Create role-specific dashboards
- Use consistent naming conventions
- Add documentation panels
- Set appropriate time ranges

### 3. Metric Naming
- Follow Prometheus naming conventions
- Use consistent labels
- Document custom metrics
- Avoid high-cardinality labels

### 4. Performance
- Limit scrape frequency for expensive metrics
- Use recording rules for complex queries
- Set appropriate retention periods
- Monitor Prometheus resource usage

## Security

### 1. Access Control
```yaml
# Enable Grafana authentication
GF_AUTH_ANONYMOUS_ENABLED=false
GF_AUTH_BASIC_ENABLED=true
```

### 2. Network Security
```yaml
# Restrict Prometheus access
- "127.0.0.1:9090:9090"  # Only localhost

# Use reverse proxy with authentication
```

### 3. Secrets Management
```bash
# Use environment variables for sensitive data
# Never commit credentials to git
# Rotate credentials regularly
```

## Support

For issues or questions:
- Check runbooks in `runbooks/` directory
- Review Prometheus logs: `docker logs nova-prometheus`
- Review Grafana logs: `docker logs nova-grafana`
- Contact DevOps team: [Contact info]

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Node Exporter](https://github.com/prometheus/node_exporter)
- [PostgreSQL Exporter](https://github.com/prometheus-community/postgres_exporter)
- [Redis Exporter](https://github.com/oliver006/redis_exporter)
