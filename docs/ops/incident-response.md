# Incident Response Runbook

This runbook covers uptime incidents for Nova Rewards public-facing endpoints. It is linked from Alertmanager notifications.

**SLA targets:**

| Endpoint | SLA |
|----------|-----|
| API health (`/health`) | 99.9% monthly |
| Frontend | 99.9% monthly |
| Stellar RPC | 99.5% monthly |

99.9% monthly = max ~43 minutes downtime/month.

---

## General Incident Process

1. **Alert fires** — Alertmanager notifies `#nova-critical` (Slack) and PagerDuty within 2 minutes of downtime.
2. **Acknowledge** — On-call engineer acknowledges in PagerDuty and posts in `#nova-incidents`.
3. **Diagnose** — Follow the relevant section below.
4. **Mitigate** — Apply the fastest fix to restore service.
5. **Resolve** — Confirm metrics are stable, close PagerDuty incident.
6. **Post-mortem** — Schedule within 48 hours; document in `docs/ops/post-mortems/YYYY-MM-DD-<title>.md`.

On-call schedule: [docs/ops/on-call.md](./on-call.md)

---

## API Down

**Alert:** `APIHealthEndpointDown`

**Symptoms:** `GET /health` returns non-2xx or times out.

**Steps:**

1. Check backend container/process:
   ```bash
   # Docker Compose
   docker compose ps backend
   docker compose logs --tail=50 backend

   # ECS
   aws ecs describe-tasks --cluster nova-prod --tasks $(aws ecs list-tasks --cluster nova-prod --service-name nova-backend --query 'taskArns[0]' --output text)
   ```

2. Restart if crashed:
   ```bash
   # Docker Compose
   docker compose restart backend

   # ECS — force new deployment
   aws ecs update-service --cluster nova-prod --service nova-backend --force-new-deployment
   ```

3. Check database connectivity (a DB outage will cause the health check to fail):
   ```bash
   docker compose exec backend node -e "require('./db').query('SELECT 1').then(() => console.log('DB OK')).catch(console.error)"
   ```

4. Check Redis connectivity:
   ```bash
   docker compose exec redis redis-cli ping
   ```

5. If the issue persists, roll back to the previous image tag:
   ```bash
   # Update the image tag in docker-compose.yml or ECS task definition to the last known-good tag
   ```

---

## Frontend Down

**Alert:** `FrontendDown`

**Symptoms:** Frontend URL returns non-2xx or times out.

**Steps:**

1. Check frontend container:
   ```bash
   docker compose ps frontend
   docker compose logs --tail=50 frontend
   ```

2. Restart:
   ```bash
   docker compose restart frontend
   ```

3. If deployed on Vercel, check the Vercel dashboard for deployment errors and roll back to the previous deployment.

4. Check Nginx gateway (the public entry point):
   ```bash
   docker compose logs --tail=50 nginx
   docker compose restart nginx
   ```

---

## Stellar RPC Down

**Alert:** `StellarRPCDown`

**Symptoms:** Horizon/Soroban RPC endpoint unreachable. On-chain reward issuance and contract event processing will fail.

**Steps:**

1. Verify the outage is external (Stellar network, not our infra):
   ```bash
   curl -sf https://horizon-testnet.stellar.org | jq .horizon_version
   # Check https://status.stellar.org for network incidents
   ```

2. If the primary RPC is down, switch to the backup endpoint in `.env`:
   ```bash
   # In novaRewards/.env
   HORIZON_URL=https://horizon.stellar.org   # mainnet fallback
   # or use a third-party provider: https://soroban-testnet.stellar.org
   ```
   Then restart the backend:
   ```bash
   docker compose restart backend
   ```

3. If the Stellar network itself is degraded, queue reward issuance jobs for retry rather than failing immediately. The `bullmq` job queue handles retries automatically.

4. Monitor `https://status.stellar.org` and restore the primary endpoint once it recovers.

---

## High Latency

**Alert:** `EndpointHighLatency`

**Symptoms:** Probe response time > 3 seconds.

**Steps:**

1. Check current API response times in Grafana → Nova Platform Metrics dashboard.
2. Look for slow database queries:
   ```sql
   SELECT pid, now() - query_start AS duration, query
   FROM pg_stat_activity
   WHERE state = 'active' AND now() - query_start > interval '1 second'
   ORDER BY duration DESC;
   ```
3. Check Redis hit rate — a cold cache after a restart will cause elevated latency.
4. Scale out if load is the cause:
   ```bash
   aws ecs update-service --cluster nova-prod --service nova-backend --desired-count 4
   ```

---

## Monthly Uptime Report

A report is generated automatically on the first day of each month by:

```bash
cd monitoring
PROMETHEUS_URL=http://localhost:9090 ./scripts/generate-uptime-report.sh
```

Reports are saved to `/tmp/nova-uptime-reports/uptime-YYYY-MM.md`. Archive them in `docs/ops/uptime-reports/`.

---

## Escalation

| Severity | Response Time | Escalation Path |
|----------|--------------|-----------------|
| Critical | 15 min | On-call → Engineering Lead → CTO |
| Warning  | 2 hours | On-call → Engineering Lead |

Contact list: [docs/ops/on-call.md](./on-call.md)
