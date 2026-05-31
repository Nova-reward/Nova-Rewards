# Rolling Deployment & Rollback Guide

Closes #938

## Strategy

Both `backend` and `frontend` deployments use `RollingUpdate` with:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

`maxUnavailable: 0` guarantees zero downtime — old pods stay up until new pods pass readiness.

## Health Checks

New pods must pass the readiness probe before receiving traffic:

| Service  | Probe path      | Period | Failure threshold |
|----------|-----------------|--------|-------------------|
| Backend  | `GET /health`   | 5s     | 3 (15s total)     |
| Frontend | `GET /api/healthz` | 5s  | 3 (15s total)     |

A startup probe allows up to 60 s for the container to initialise before liveness kicks in.

## Deploying a New Version

```bash
# Update the image tag
kubectl set image deployment/nova-rewards-backend \
  backend=nova-rewards-backend:<NEW_TAG> \
  -n nova-rewards

kubectl set image deployment/nova-rewards-frontend \
  frontend=nova-rewards-frontend:<NEW_TAG> \
  -n nova-rewards

# Watch rollout progress
kubectl rollout status deployment/nova-rewards-backend -n nova-rewards
kubectl rollout status deployment/nova-rewards-frontend -n nova-rewards
```

## Automated Rollback (within 5 minutes)

If new pods fail readiness probes the rollout stalls automatically — no traffic is shifted to broken pods. To revert:

```bash
kubectl rollout undo deployment/nova-rewards-backend  -n nova-rewards
kubectl rollout undo deployment/nova-rewards-frontend -n nova-rewards
```

Verify the rollback completed:

```bash
kubectl rollout status deployment/nova-rewards-backend  -n nova-rewards
kubectl rollout status deployment/nova-rewards-frontend -n nova-rewards
```

## Database Migrations

Migrations **must be backward-compatible** so old and new code can run simultaneously during the rolling window:

1. **Add columns as nullable** — never add a `NOT NULL` column without a default in the same migration.
2. **Never rename or drop columns** in the same release as the code change. Use a two-phase approach:
   - Phase 1: add new column, deploy code that writes to both old and new.
   - Phase 2 (next release): remove old column.
3. Run migrations before deploying new pods:
   ```bash
   kubectl run migrate --rm -it --image=nova-rewards-backend:<NEW_TAG> \
     --env="DATABASE_URL=$DATABASE_URL" \
     -- node database/migrate.js
   ```

## Rollback History

```bash
# List revision history
kubectl rollout history deployment/nova-rewards-backend -n nova-rewards

# Roll back to a specific revision
kubectl rollout undo deployment/nova-rewards-backend \
  --to-revision=<REVISION> -n nova-rewards
```
