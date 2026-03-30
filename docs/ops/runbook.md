# Nova Rewards — DevOps Runbook

## Service Architecture Overview

| Service | Description |
|---------|-------------|
| API Server | Node.js REST API handling merchant and user requests. Runs on ECS (Fargate) or EC2 behind an ALB. Connects to RDS (PostgreSQL) and Redis. |
| Redis (ElastiCache) | In-memory cache and session store. Used by the API server for rate limiting, session tokens, and short-lived data. |
| Database (RDS PostgreSQL) | Primary persistent store for users, merchants, campaigns, transactions, and redemptions. Multi-AZ enabled in production. |
| Smart Contract Event Processor | Background service that listens to Soroban/Stellar contract events and writes them to the database. Connects to a Stellar RPC endpoint and RDS. |

All services communicate within a private VPC. The ALB is the only public-facing entry point.

---

## Routine Maintenance

### Restart the API Server

**Via systemd (EC2):**
```bash
sudo systemctl restart nova-api
```

**Via ECS (force new deployment):**
```bash
aws ecs update-service \
  --cluster <placeholder-cluster-name> \
  --service <placeholder-service-name> \
  --force-new-deployment
```

### Redis ElastiCache Failover

**Via AWS Console:**
1. Go to ElastiCache → Redis clusters → select `<placeholder-cluster-name>`
2. Actions → **Failover Primary**

**Via CLI:**
```bash
aws elasticache test-failover \
  --replication-group-id <placeholder-replication-group-id> \
  --node-group-id 0001
```

### RDS Reboot (non-failover)
```bash
aws rds reboot-db-instance \
  --db-instance-identifier <placeholder-db-instance-id>
```

### RDS Failover (Multi-AZ)
```bash
aws rds failover-db-cluster \
  --db-cluster-identifier <placeholder-db-cluster-id>
```

---

## Backup Strategy

### Automated RDS Snapshots
- **Schedule:** Daily automated snapshots
- **Retention:** 7 days
- **Configuration:** Set in Terraform (`terraform/main.tf` → `backup_retention_period = 7`) or via RDS console under **Maintenance & backups**.

### Manual Snapshot Before Major Deployments
```bash
aws rds create-db-snapshot \
  --db-instance-identifier <placeholder-db-instance-id> \
  --db-snapshot-identifier pre-deploy-<date>
```

### Restore from Snapshot

**Via AWS Console:**
1. RDS → Snapshots → select snapshot → **Restore Snapshot**
2. Configure instance class, VPC, and security groups to match production
3. Update `DATABASE_URL` environment variable to point to the restored instance

**Via CLI:**
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier nova-restored-<date> \
  --db-snapshot-identifier pre-deploy-<date>
```

---

## Incident Response Checklist

1. **Detect** — Alert fired via PagerDuty / CloudWatch, or user report received in support channel
2. **Assess** — Check CloudWatch dashboards, application logs (ECS log groups), error rates, and affected service health
3. **Communicate** — Post in `<placeholder-incident-slack-channel>`, update status page at `<placeholder-status-page-url>`, assign incident commander
4. **Mitigate** — Apply immediate fix (restart service, scale up, rollback deployment) to restore service
5. **Resolve** — Confirm all metrics stable, error rates back to baseline, close PagerDuty incident
6. **Post-mortem** — Schedule within 48 hours; document findings in `docs/ops/post-mortems/YYYY-MM-DD-<title>.md`

---

## Common Alert Runbooks

### High CPU

**Symptoms:** CPU > 80% sustained for 5+ minutes on ECS task or EC2 instance.

**Steps:**
1. SSH into instance or check ECS task logs for runaway processes
2. Run `top` or `htop` to identify the offending process
3. If API server: scale out ECS tasks
   ```bash
   aws ecs update-service \
     --cluster <placeholder-cluster-name> \
     --service <placeholder-service-name> \
     --desired-count <increased-count>
   ```
4. If EC2: scale the Auto Scaling Group or switch to a larger instance type

---

### Database Connection Exhaustion

**Symptoms:** `too many connections` errors in API logs; RDS `DatabaseConnections` metric at max.

**Steps:**
1. Check connection pool config (`DB_POOL_MAX` env var) — reduce if over-provisioned
2. Restart the API server to flush stale connections (see [Restart the API Server](#restart-the-api-server))
3. If persistent, enable or switch to **RDS Proxy** to pool connections at the infrastructure level
4. Check for long-running idle connections:
   ```sql
   SELECT pid, state, query_start, query FROM pg_stat_activity WHERE state = 'idle';
   ```

---

### Redis Evictions

**Symptoms:** `evicted_keys` metric rising in ElastiCache; cache miss rate increasing.

**Steps:**
1. Check `maxmemory-policy` in ElastiCache parameter group — set to `allkeys-lru` for general caching
2. Review which keys are consuming the most memory using `redis-cli --bigkeys`
3. If memory is genuinely insufficient, scale up the ElastiCache node type via console or Terraform

---

### Contract Event Processing Lag

**Symptoms:** On-chain events not reflected in the database; event processor CloudWatch metric `blocks_behind` increasing.

**Steps:**
1. Check event processor logs in CloudWatch (`/nova/event-processor`)
2. Verify the Stellar RPC endpoint is healthy:
   ```bash
   curl <placeholder-stellar-rpc-url>/health
   ```
3. If RPC is down, switch to the backup endpoint in the event processor config
4. If blocks were missed, trigger a replay from the last confirmed block:
   ```bash
   # Set START_BLOCK env var and restart the processor
   aws ecs update-service \
     --cluster <placeholder-cluster-name> \
     --service <placeholder-event-processor-service> \
     --force-new-deployment
   ```
