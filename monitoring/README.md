# Nova Rewards — Monitoring Stack

Prometheus + Grafana + Alertmanager observability for the Nova Rewards platform.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Backend   │────▶│  Prometheus  │────▶│   Grafana   │
│  :4000      │     │  :9090       │     │  :3000      │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Alertmanager │
                    │  :9093       │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         ┌────────┐  ┌─────────┐  ┌──────────┐
         │ Slack  │  │PagerDuty│  │  Email   │
         └────────┘  └─────────┘  └──────────┘
```

---

## Starting the Monitoring Stack

### 1. Configure environment

```bash
cd monitoring
cp .env.example .env
```

Edit `.env` and fill in the required values:

| Variable | Description |
|----------|-------------|
| `SLACK_WEBHOOK_URL` | Incoming webhook URL for Slack notifications |
| `PAGERDUTY_SERVICE_KEY` | PagerDuty Events API v2 integration key |
| `GRAFANA_ADMIN_USER` | Grafana admin username (default: `admin`) |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password (default: `admin` — **change this**) |
| `POSTGRES_USER` | PostgreSQL user for the postgres-exporter |
| `POSTGRES_PASSWORD` | PostgreSQL password for the postgres-exporter |
| `POSTGRES_DB` | Database name (default: `nova_rewards`) |
| `REDIS_PASSWORD` | Redis password (leave blank if none) |
| `ENVIRONMENT` | Label applied to all metrics (`production`, `staging`, etc.) |

### 2. Start all monitoring services

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

Verify every container is healthy:

```bash
docker compose -f docker-compose.monitoring.yml ps
```

Expected output — all services should show `Up`:

| Container | Port | Purpose |
|-----------|------|---------|
| `nova-prometheus` | 9090 | Metrics collection & storage |
| `nova-grafana` | 3000 | Dashboards & visualisation |
| `nova-alertmanager` | 9093 | Alert routing & notifications |
| `nova-node-exporter` | 9100 | Host CPU / memory / disk |
| `nova-postgres-exporter` | 9187 | PostgreSQL metrics |
| `nova-redis-exporter` | 9121 | Redis metrics |
| `nova-nginx-exporter` | 9113 | Nginx metrics |
| `nova-blackbox-exporter` | 9115 | Endpoint health probes |

### 3. Open the UIs

| Service | URL | Default credentials |
|---------|-----|---------------------|
| Grafana | http://localhost:3000 | `admin` / `admin` (change on first login) |
| Prometheus | http://localhost:9090 | — |
| Alertmanager | http://localhost:9093 | — |

### 4. Stop the stack

```bash
# Stop containers, keep volumes
docker compose -f docker-compose.monitoring.yml down

# Stop and wipe all data
docker compose -f docker-compose.monitoring.yml down -v
```

---

## Grafana Dashboards

Dashboards are provisioned automatically from `grafana/dashboards/`. No manual import is needed.

### Nova Rewards — Overview (`nova-overview.json`)

The primary operational dashboard. Panels:

| Panel | Query | What it shows |
|-------|-------|---------------|
| Request Rate | `sum(rate(http_request_duration_seconds_count[5m])) by (route)` | Requests/sec broken down by API route |
| Error Rate | `sum(rate(…{status_code=~"5.."}[5m])) / sum(rate(…[5m]))` | Percentage of 5xx responses |
| p95 Latency | `histogram_quantile(0.95, sum(rate(…_bucket[5m])) by (le, route))` | 95th-percentile response time per route |
| Active Requests | `sum(http_requests_in_flight)` | Requests currently being processed |
| CPU Usage | `100 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100` | Host CPU % |
| Memory Usage | `(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100` | Host memory % |
| DB Connections | `pg_stat_database_numbackends / pg_settings_max_connections * 100` | Connection pool % |
| Redis Memory | `redis_memory_used_bytes / redis_memory_max_bytes * 100` | Redis memory % |

**Access:** http://localhost:3000 → Dashboards → Nova Rewards — Overview

> **Screenshots:** The Grafana UI renders live data. To capture reference screenshots, open the dashboard, set the time range to *Last 1 hour*, and use the camera icon (top-right) to export a PNG.

### Importing additional dashboards

1. Download a community dashboard JSON from [grafana.com/grafana/dashboards](https://grafana.com/grafana/dashboards).
2. Place the `.json` file in `grafana/dashboards/`.
3. Restart Grafana: `docker compose -f docker-compose.monitoring.yml restart grafana`

The provisioning config in `grafana/provisioning/dashboards/dashboard.yml` picks up all JSON files in that directory automatically.

---

## Prometheus Scrape Targets & Metrics

Configuration file: `prometheus/prometheus.yml`  
Scrape interval: **15 s** | Retention: **30 days**

### Scrape targets

| Job | Target | Key metrics |
|-----|--------|-------------|
| `prometheus` | `localhost:9090` | `prometheus_*` (self-monitoring) |
| `nova-backend` | `backend:4000/metrics` | `http_request_duration_seconds`, `http_requests_in_flight`, `reward_*` |
| `node-exporter` | `node-exporter:9100` | `node_cpu_seconds_total`, `node_memory_*`, `node_filesystem_*`, `node_network_*` |
| `postgres` | `postgres-exporter:9187` | `pg_up`, `pg_stat_database_*`, `pg_settings_max_connections` |
| `redis` | `redis-exporter:9121` | `redis_up`, `redis_memory_used_bytes`, `redis_keyspace_hits_total`, `redis_keyspace_misses_total` |
| `nginx` | `nginx-exporter:9113` | `nginx_connections_*`, `nginx_http_requests_total` |
| `blackbox` | `blackbox-exporter:9115` | `probe_success`, `probe_duration_seconds`, `probe_ssl_earliest_cert_expiry` |
| `blackbox-uptime` | `blackbox-exporter:9115` | Same as above — probes public-facing URLs for SLA tracking |

### Application metrics exposed by the backend (`/metrics`)

| Metric | Type | Description |
|--------|------|-------------|
| `http_request_duration_seconds` | Histogram | Request latency, labelled by `route`, `method`, `status_code` |
| `http_requests_in_flight` | Gauge | Concurrent requests being handled |
| `http_requests_total` | Counter | Total requests, labelled by `route`, `method`, `status_code` |
| `reward_issuances_total` | Counter | Reward issuance attempts, labelled by `status` (`success`/`failed`) |
| `reward_queue_depth` | Gauge | Pending jobs in the reward issuance queue |
| `nova_backup_last_success_timestamp_seconds` | Gauge | Unix timestamp of the last successful DB backup |
| `nova_backup_last_exit_code` | Gauge | Exit code of the last backup job (`0` = success) |
| `nova_backup_duration_seconds` | Gauge | Duration of the last backup job |

Verify targets are being scraped:

```bash
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'
```

---

## Alertmanager Configuration & Notification Channels

Configuration file: `alertmanager/alertmanager.yml`

### Routing

| Condition | Receiver | Channel |
|-----------|----------|---------|
| `severity=critical` | `pagerduty-critical` + `slack-critical` | PagerDuty page **and** `#nova-critical` |
| `severity=warning` | `slack-warnings` | `#nova-alerts` |
| `component=database` | `slack-database` | `#nova-database` |
| `component=infrastructure` | `slack-infrastructure` | `#nova-infrastructure` |
| (default) | `default` | `#nova-alerts` |

Alerts are grouped by `alertname`, `cluster`, and `service`. Resolved notifications are sent for all Slack receivers.

### Inhibition rules

- A `critical` alert suppresses the matching `warning` alert on the same `instance`.
- A `ServiceDown` alert suppresses all other alerts on the same `instance` to prevent noise.

### Configuring Slack

1. Create an [Incoming Webhook](https://api.slack.com/messaging/webhooks) in your Slack workspace.
2. Set `SLACK_WEBHOOK_URL` in `monitoring/.env`.
3. Reload Alertmanager:
   ```bash
   curl -X POST http://localhost:9093/-/reload
   ```

### Configuring PagerDuty

1. In PagerDuty, create a service with **Events API v2** integration.
2. Copy the integration key and set `PAGERDUTY_SERVICE_KEY` in `monitoring/.env`.
3. Reload Alertmanager (same command as above).

### Configuring Email

Add an `email_configs` block to the relevant receiver in `alertmanager/alertmanager.yml`:

```yaml
receivers:
  - name: 'slack-critical'
    slack_configs: [...]          # existing
    email_configs:
      - to: 'oncall@example.com'
        from: 'alerts@example.com'
        smarthost: 'smtp.example.com:587'
        auth_username: 'alerts@example.com'
        auth_password: '${SMTP_PASSWORD}'
        require_tls: true
```

### Testing alerts

Send a synthetic alert to Alertmanager to verify routing:

```bash
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {"alertname": "TestAlert", "severity": "warning"},
    "annotations": {"summary": "Test alert — routing check"}
  }]'
```

Use the helper script for a more complete test:

```bash
bash monitoring/scripts/test-alerts.sh
```

---

## Adding New Metrics and Alerts

### 1. Expose a metric from the backend

In `novaRewards/backend/`, use the `prom-client` library:

```js
const { Counter, Histogram, register } = require('prom-client');

// Counter example
const myCounter = new Counter({
  name: 'nova_my_event_total',
  help: 'Total number of my events',
  labelNames: ['status'],
});

// Histogram example
const myHistogram = new Histogram({
  name: 'nova_my_operation_duration_seconds',
  help: 'Duration of my operation in seconds',
  buckets: [0.05, 0.1, 0.5, 1, 2, 5],
});

// Increment / observe in your handler
myCounter.inc({ status: 'success' });
myHistogram.observe(durationInSeconds);
```

The `/metrics` endpoint is already wired to `register.metrics()` — no additional setup needed.

**Naming conventions:**
- Prefix all custom metrics with `nova_`.
- Use `_total` suffix for counters, `_seconds` for durations, `_bytes` for sizes.
- Keep label cardinality low — avoid user IDs or request IDs as label values.

### 2. Verify the metric appears in Prometheus

```bash
# Check the raw scrape output
curl -s http://backend:4000/metrics | grep nova_my_

# Query via Prometheus API
curl -G 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=nova_my_event_total'
```

### 3. Add an alert rule

Create or edit a file in `prometheus/rules/`. Group related alerts together:

```yaml
# prometheus/rules/my-feature-alerts.yml
groups:
  - name: my_feature_alerts
    interval: 30s
    rules:
      - alert: MyEventFailureRateHigh
        expr: |
          rate(nova_my_event_total{status="failed"}[5m]) > 0.5
        for: 5m
        labels:
          severity: warning
          component: backend
        annotations:
          summary: "My event failure rate is elevated"
          description: "Failure rate is {{ $value | humanize }}/s (threshold: 0.5/s)"
          runbook: "https://github.com/barry01-hash/Nova-Rewards/blob/main/monitoring/runbooks/my-event.md"
```

Reload Prometheus to pick up the new rule:

```bash
curl -X POST http://localhost:9090/-/reload
```

Verify the rule loaded without errors:

```bash
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | select(.name=="MyEventFailureRateHigh")'
```

### 4. Add a recording rule (optional, for expensive queries)

```yaml
# prometheus/rules/recording-rules.yml  (append to existing file)
groups:
  - name: nova_recording_rules
    rules:
      - record: job:nova_my_event_total:rate5m
        expr: sum(rate(nova_my_event_total[5m])) by (status)
```

Use the recorded metric name in dashboards and alerts instead of the raw expression.

### 5. Add a Grafana panel

1. Open the target dashboard in Grafana.
2. Click **Add panel** → **Add new panel**.
3. Enter the PromQL expression in the query editor.
4. Save the dashboard and export the updated JSON to `grafana/dashboards/`.

---

## Troubleshooting

**Prometheus not scraping a target**
```bash
# List all targets and their health
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job:.labels.job, health:.health, lastError:.lastError}'

# Test connectivity from inside the Prometheus container
docker exec nova-prometheus wget -qO- http://backend:4000/metrics | head
```

**Grafana shows "No data"**
```bash
# Confirm the Prometheus datasource is reachable
curl http://localhost:3000/api/datasources

# Run a simple query directly against Prometheus
curl -G 'http://localhost:9090/api/v1/query' --data-urlencode 'query=up'
```

**Alerts not firing / not reaching Slack or PagerDuty**
```bash
# Check evaluated alert rules
curl -s http://localhost:9090/api/v1/rules | jq '.data.groups[].rules[] | {name:.name, state:.state}'

# Check Alertmanager status and config
curl http://localhost:9093/api/v1/status

# Tail Alertmanager logs
docker logs nova-alertmanager --tail 50
```

**Reload configs without restarting containers**
```bash
curl -X POST http://localhost:9090/-/reload   # Prometheus
curl -X POST http://localhost:9093/-/reload   # Alertmanager
```

---

## Runbooks

Detailed incident response procedures:

| Alert | Runbook |
|-------|---------|
| HighErrorRate | [runbooks/high-error-rate.md](./runbooks/high-error-rate.md) |
| HighLatency | [runbooks/high-latency.md](./runbooks/high-latency.md) |
| ServiceDown | [runbooks/service-down.md](./runbooks/service-down.md) |
| PostgreSQLDown | [runbooks/postgres-down.md](./runbooks/postgres-down.md) |
| RedisDown | [runbooks/redis-down.md](./runbooks/redis-down.md) |
| HighCPUUsage | [runbooks/high-cpu.md](./runbooks/high-cpu.md) |
| HighMemoryUsage | [runbooks/high-memory.md](./runbooks/high-memory.md) |
| DiskSpaceLow | [runbooks/low-disk-space.md](./runbooks/low-disk-space.md) |
| HighDatabaseConnections | [runbooks/high-db-connections.md](./runbooks/high-db-connections.md) |

---

## References

- [Prometheus docs](https://prometheus.io/docs/)
- [Grafana docs](https://grafana.com/docs/)
- [Alertmanager docs](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [prom-client (Node.js)](https://github.com/siimon/prom-client)
- [postgres_exporter](https://github.com/prometheus-community/postgres_exporter)
- [redis_exporter](https://github.com/oliver006/redis_exporter)
