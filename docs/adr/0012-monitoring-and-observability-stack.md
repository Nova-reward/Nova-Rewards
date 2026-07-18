# ADR 0012: Prometheus, Grafana, Loki, and Sentry Observability Stack

## Status

Accepted

## Context

Nova Rewards processes financial transactions and blockchain operations where
silent failures, latency regressions, and error spikes have direct user and
merchant impact. The platform needs:

- **Metrics** — request rates, error rates, latency percentiles, queue depths,
  and Stellar submission success rates.
- **Logs** — structured, searchable logs correlated across frontend, backend,
  and worker processes.
- **Alerts** — proactive notification when SLOs are breached or anomalies are
  detected.
- **Error tracking** — frontend JavaScript errors and backend unhandled
  exceptions with stack traces and user context.
- **Distributed tracing** — correlation IDs to trace a request from the browser
  through the API to the database and Stellar.

Considered options:

1. **CloudWatch only** — native AWS integration, no extra infrastructure, but
   limited query language, expensive at scale, and vendor lock-in.
2. **Datadog / New Relic** — full-stack SaaS observability, but high cost at
   scale and data leaves the AWS VPC.
3. **Prometheus + Grafana + Loki (self-hosted)** — open-source, runs in the
   same Kubernetes cluster, rich query languages (PromQL, LogQL), large
   ecosystem of exporters and dashboards.
4. **OpenTelemetry + Jaeger** — vendor-neutral tracing standard, but adds
   collector infrastructure and the team's immediate need is metrics and logs
   rather than full distributed tracing.

## Decision

Use a self-hosted Prometheus + Grafana + Loki + Alertmanager stack for
infrastructure and application observability, complemented by Sentry for
frontend error tracking and CloudWatch for AWS-native alarms:

- **Prometheus** scrapes the `/metrics` endpoint exposed by the Express backend
  (`prom-client`). Metrics include HTTP request duration histograms, error
  counters, queue depth gauges, and Stellar submission latency.
- **Grafana** provides dashboards for API performance, queue health, database
  connection pool utilisation, and Redis memory usage. Datasources include
  Prometheus, Loki, and optionally CloudWatch.
- **Loki** aggregates structured JSON logs from all containers (shipped via
  Promtail or the Docker Loki driver). Winston in the backend emits JSON logs
  with correlation IDs (`x-correlation-id` header) for cross-service tracing.
- **Alertmanager** routes alerts to Slack (webhook) and PagerDuty (integration
  key) based on severity. Alert rules cover error rate > 1%, p99 latency > 2s,
  queue depth > 1000, and Redis memory > 80%.
- **Sentry** (`@sentry/nextjs`) captures frontend JavaScript errors, Next.js
  server-side errors, and performance traces. Configured via
  `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_AUTH_TOKEN`.
- **CloudWatch** receives container logs via the `awslogs` Docker log driver
  when `LOG_DRIVER=awslogs` is set, and provides AWS-native alarms for RDS,
  ElastiCache, and ALB metrics.
- **Correlation IDs** are injected by `tracingMiddleware` on every request and
  propagated through BullMQ job metadata, enabling log correlation from HTTP
  request to async worker.

The monitoring stack is defined in `monitoring/` and deployed via Docker Compose
(staging) or Helm (production).

## Consequences

Positive:

- Prometheus and Loki run inside the cluster, keeping metrics and logs within
  the VPC boundary.
- PromQL and LogQL provide powerful ad-hoc query capabilities without per-query
  cost.
- Sentry provides actionable frontend error reports with source maps and user
  context.
- Correlation IDs enable end-to-end request tracing without a full distributed
  tracing infrastructure.
- Alertmanager's routing rules allow on-call escalation without a separate
  alerting SaaS.

Negative:

- Self-hosted Prometheus and Loki require storage provisioning, retention
  configuration, and operational maintenance.
- Prometheus is pull-based; short-lived jobs (one-shot migrations, scripts) must
  use the Pushgateway or structured logs instead.
- Without a full OpenTelemetry trace exporter, cross-service trace correlation
  relies on manually propagated correlation IDs rather than automatic span
  linking.
- Grafana dashboard definitions must be version-controlled to avoid configuration
  drift.

## Related

- Code: `novaRewards/backend/middleware/metricsMiddleware.js`
- Code: `novaRewards/backend/middleware/tracingMiddleware.js`
- Code: `novaRewards/backend/lib/logger.js`
- Code: `monitoring/`
- Code: `monitoring/.env.example`
- Code: `novaRewards/frontend/sentry.client.config.js`
- ADR: [0006 — Compose for Staging and Helm on AWS for Production](0006-deployment-topology.md)
- ADR: [0011 — AWS as Production Deployment Target](0011-deployment-target-aws-kubernetes.md)
