# Monitoring Integration Guide

This guide shows how to integrate the monitoring stack with your existing Nova Rewards infrastructure.

## Option 1: Standalone Monitoring (Recommended for Development)

Run monitoring stack separately from your application:

```bash
# Terminal 1: Start application
cd novaRewards
docker-compose up -d

# Terminal 2: Start monitoring
cd ../monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

## Option 2: Integrated Setup (Recommended for Production)

### Step 1: Create Monitoring Network

```bash
docker network create nova-rewards_monitoring
```

### Step 2: Update Main docker-compose.yml

Add monitoring network to your backend service:

```yaml
# novaRewards/docker-compose.yml
version: "3.9"

services:
  postgres:
    # ... existing config ...
    networks:
      - default
      - monitoring

  backend:
    # ... existing config ...
    networks:
      - default
      - monitoring

  gateway:
    # ... existing config ...
    networks:
      - default
      - monitoring

networks:
  monitoring:
    external: true
    name: nova-rewards_monitoring
```

### Step 3: Start Services

```bash
# Start application
cd novaRewards
docker-compose up -d

# Start monitoring
cd ../monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

## Option 3: Combined docker-compose

Create a combined setup for local development:

```bash
# Create combined compose file
cd novaRewards
```

Create `docker-compose.with-monitoring.yml`:

```yaml
version: "3.9"

services:
  # Application services
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    env_file: .env
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-nova_rewards}
      POSTGRES_USER: ${POSTGRES_USER:-nova}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-nova}"]
      interval: 5s
      timeout: 5s
      retries: 10
    ports:
      - "5432:5432"
    networks:
      - default
      - monitoring

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env
    environment:
      PORT: 4000
      NODE_ENV: ${NODE_ENV:-development}
      DATABASE_URL: postgresql://${POSTGRES_USER:-nova}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-nova_rewards}
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - default
      - monitoring

  # Monitoring services
  prometheus:
    image: prom/prometheus:v2.48.0
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
    volumes:
      - ../monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - ../monitoring/prometheus/rules:/etc/prometheus/rules:ro
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:10.2.2
    restart: unless-stopped
    volumes:
      - grafana_data:/var/lib/grafana
      - ../monitoring/grafana/provisioning:/etc/grafana/provisioning:ro
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin}
    networks:
      - monitoring
    depends_on:
      - prometheus

  node-exporter:
    image: prom/node-exporter:v1.7.0
    restart: unless-stopped
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--path.rootfs=/rootfs'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    ports:
      - "9100:9100"
    networks:
      - monitoring

volumes:
  postgres_data:
  prometheus_data:
  grafana_data:

networks:
  monitoring:
    driver: bridge
```

Start everything:
```bash
docker-compose -f docker-compose.with-monitoring.yml up -d
```

## AWS Integration

### CloudWatch + Prometheus

Keep both systems for comprehensive monitoring:

**CloudWatch** (Infrastructure):
- ALB metrics
- EC2 metrics
- Auto Scaling events
- RDS metrics (if using RDS)

**Prometheus** (Application):
- API metrics
- Business metrics
- Custom application metrics

### Export Prometheus to CloudWatch (Optional)

Use CloudWatch exporter to send Prometheus metrics to CloudWatch:

```yaml
# Add to docker-compose.monitoring.yml
cloudwatch-exporter:
  image: prom/cloudwatch-exporter:latest
  ports:
    - "9106:9106"
  volumes:
    - ./cloudwatch-exporter.yml:/config/config.yml
  environment:
    - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
    - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
    - AWS_REGION=${AWS_REGION}
```

## Kubernetes Integration

If deploying to Kubernetes:

### 1. Install Prometheus Operator

```bash
kubectl create namespace monitoring
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring
```

### 2. Create ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: nova-backend
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: nova-backend
  endpoints:
  - port: metrics
    path: /metrics
    interval: 15s
```

### 3. Deploy Application with Metrics

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nova-backend
  labels:
    app: nova-backend
spec:
  ports:
  - name: http
    port: 4000
  - name: metrics
    port: 4000
  selector:
    app: nova-backend
```

## Verifying Integration

### 1. Check Metrics Endpoint

```bash
# Test backend metrics
curl http://localhost:4000/metrics

# Should see Prometheus format metrics
```

### 2. Check Prometheus Targets

```bash
# Open Prometheus UI
open http://localhost:9090/targets

# All targets should show "UP" status
```

### 3. Check Grafana Datasource

```bash
# Login to Grafana
open http://localhost:3000

# Go to Configuration > Data Sources
# Prometheus should be connected and working
```

### 4. Test Query

```bash
# Query Prometheus
curl -G 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=up{job="nova-backend"}'

# Should return result with value 1
```

## Troubleshooting Integration

### Backend Metrics Not Showing

```bash
# Check if backend is exposing metrics
curl http://localhost:4000/metrics

# Check Prometheus logs
docker logs nova-prometheus

# Check network connectivity
docker exec -it nova-prometheus wget -O- http://backend:4000/metrics
```

### Prometheus Can't Scrape Targets

```bash
# Check if services are on same network
docker network inspect nova-rewards_monitoring

# Verify service names in prometheus.yml match container names
# Update prometheus.yml if needed
```

### Grafana Shows No Data

```bash
# Test Prometheus datasource
curl http://localhost:3000/api/datasources

# Test query directly
curl -G 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=up'

# Check Grafana logs
docker logs nova-grafana
```

## Network Architecture

```
┌─────────────────────────────────────────────────┐
│              Docker Network: default             │
│                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │PostgreSQL│◄───│ Backend  │◄───│  Gateway │ │
│  └──────────┘    └────┬─────┘    └──────────┘ │
│                       │                         │
└───────────────────────┼─────────────────────────┘
                        │
                        │ :4000/metrics
                        │
┌───────────────────────┼─────────────────────────┐
│         Docker Network: monitoring              │
│                       │                         │
│                       ▼                         │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Prometheus  │◄─│Exporters │  │ Grafana  │ │
│  │  (Scraper)   │  │          │  │(Dashboards)│
│  └──────┬───────┘  └──────────┘  └──────────┘ │
│         │                                       │
│         ▼                                       │
│  ┌──────────────┐                              │
│  │Alertmanager  │                              │
│  └──────────────┘                              │
└─────────────────────────────────────────────────┘
```

## Best Practices

1. **Use External Networks**: Keep monitoring separate from application
2. **Secure Metrics Endpoint**: Add authentication in production
3. **Limit Scrape Frequency**: Balance between freshness and load
4. **Set Retention Policies**: Don't store metrics forever
5. **Monitor the Monitors**: Set up meta-monitoring
6. **Use Service Discovery**: For dynamic environments
7. **Implement Backups**: Backup Prometheus data regularly

## Production Checklist

- [ ] Monitoring network created
- [ ] Backend connected to monitoring network
- [ ] Metrics endpoint accessible
- [ ] Prometheus scraping successfully
- [ ] Grafana dashboards working
- [ ] Alerts configured and tested
- [ ] Notification channels configured
- [ ] Runbooks reviewed by team
- [ ] Backup procedures in place
- [ ] SSL/TLS configured for Grafana
- [ ] Access controls implemented
- [ ] Documentation updated
