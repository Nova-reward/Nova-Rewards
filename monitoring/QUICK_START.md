# Quick Start Guide - Nova Rewards Monitoring

Get your monitoring stack up and running in 5 minutes!

## Prerequisites

- Docker and Docker Compose installed
- Nova Rewards backend running
- 5 minutes of your time ⏱️

## Step 1: Setup (2 minutes)

```bash
cd monitoring

# Copy environment file
cp .env.example .env

# Edit with your settings (optional for local testing)
nano .env
```

Minimum required configuration:
```bash
GRAFANA_ADMIN_PASSWORD=your-secure-password
POSTGRES_PASSWORD=your-postgres-password
```

## Step 2: Deploy (2 minutes)

```bash
# Create network
docker network create nova-rewards_monitoring

# Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to start
sleep 30
```

## Step 3: Verify (1 minute)

```bash
# Check all services are running
docker-compose -f docker-compose.monitoring.yml ps

# Should see all services as "Up"
```

## Access Your Dashboards

Open in your browser:

- **Grafana**: http://localhost:3000
  - Username: `admin`
  - Password: (what you set in .env)

- **Prometheus**: http://localhost:9090

- **Alertmanager**: http://localhost:9093

## What's Included?

✅ Prometheus - Metrics collection
✅ Grafana - Visualization dashboards
✅ Alertmanager - Alert routing
✅ Node Exporter - System metrics
✅ PostgreSQL Exporter - Database metrics
✅ Redis Exporter - Cache metrics
✅ Blackbox Exporter - Endpoint monitoring

## Quick Health Check

```bash
# Test Prometheus is scraping
curl http://localhost:9090/api/v1/targets

# Test metrics endpoint
curl http://localhost:4000/metrics

# Test alert system
./scripts/test-alerts.sh
```

## Next Steps

1. **Configure Alerts**
   - Edit `alertmanager/alertmanager.yml`
   - Add your Slack webhook URL
   - Add PagerDuty integration key

2. **Import Dashboards**
   - Login to Grafana
   - Import dashboards from `grafana/dashboards/`

3. **Review Runbooks**
   - Check `runbooks/` directory
   - Familiarize with incident response procedures

## Troubleshooting

### Services won't start?
```bash
# Check logs
docker-compose -f docker-compose.monitoring.yml logs

# Restart
docker-compose -f docker-compose.monitoring.yml restart
```

### Can't access Grafana?
```bash
# Check if port 3000 is available
netstat -tulpn | grep 3000

# Check Grafana logs
docker logs nova-grafana
```

### No metrics showing?
```bash
# Verify backend is exposing metrics
curl http://localhost:4000/metrics

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets
```

## Stop Monitoring

```bash
# Stop all services
docker-compose -f docker-compose.monitoring.yml down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose -f docker-compose.monitoring.yml down -v
```

## Need Help?

- 📚 Full documentation: [README.md](./README.md)
- 🚀 Deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- 📖 Runbooks: [runbooks/](./runbooks/)

## Production Deployment

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Security hardening
- SSL/TLS configuration
- Backup procedures
- High availability setup
