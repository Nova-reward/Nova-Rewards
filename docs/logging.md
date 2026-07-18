**Structured Logging & Centralized Log Aggregation**

- **What**: Structured JSON logs using `pino` with per-request `correlationId`.
- **Where**: Applied to `novaRewards/backend` service; includes k8s Fluent Bit config and Terraform CloudWatch log groups for retention.

Configuration
- `LOG_LEVEL` env var controls log level (default `info`).
- `SERVICE_NAME` env var sets the `service` field in logs.
- Correlation ID header: `x-correlation-id` (falls back to `x-trace-id` or generated per request).

Files added/changed
- [novaRewards/backend/lib/logger.js](novaRewards/backend/lib/logger.js#L1-L200): pino logger and pino-http middleware.
- [novaRewards/backend/middleware/tracingMiddleware.js](novaRewards/backend/middleware/tracingMiddleware.js#L1-L200): sets `correlationId` and stores it in AsyncLocalStorage.
- [novaRewards/backend/server.js](novaRewards/backend/server.js#L1-L200): mounts logging middleware and uses structured logging in error handler and startup.
- [k8s/fluent-bit.yaml](k8s/fluent-bit.yaml#L1-L200): Fluent Bit DaemonSet + config to forward logs to CloudWatch (placeholder variables).
- [infra/logging.tf](infra/logging.tf#L1-L200): CloudWatch log groups with retention (info=30d, error=90d).

How it works
- Each incoming request gets a `correlationId` header assigned (or propagated if present).
- The `pino-http` middleware emits JSON logs with fields: `time`, `level`, `service`, `correlationId`, `msg`.
- Outbound HTTP calls from the backend include `x-correlation-id` when available.

Next steps / deployment
- Run `terraform apply` in `infra/` to create CloudWatch log groups (requires AWS credentials).
- Deploy `k8s/fluent-bit.yaml` to the cluster (update `${AWS_REGION}` in the ConfigMap or use a K8s secret/IRSA to grant CloudWatch permissions).
- Rebuild and deploy `nova-rewards-backend` image; ensure `LOG_LEVEL` and `SERVICE_NAME` are set (defaults provided in the k8s deployment patch).
