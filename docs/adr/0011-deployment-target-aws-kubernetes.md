# ADR 0011: AWS as Production Deployment Target with Kubernetes (Helm)

## Status

Accepted

## Context

Nova Rewards needs a production deployment target that provides:

- TLS termination and DDoS protection at the edge
- Horizontal autoscaling for the stateless backend API
- Managed, encrypted, highly available PostgreSQL and Redis
- Secure secret storage with rotation support
- Structured logging, metrics, and alerting
- Reproducible infrastructure-as-code that can be reviewed in pull requests

Considered options:

1. **Heroku / Railway / Render** — low operational overhead, but limited control
   over networking, encryption, and compliance posture; vendor lock-in for
   managed add-ons.
2. **AWS with EC2 + Docker Compose** — familiar, but manual scaling, no
   self-healing, and infrastructure drift without IaC.
3. **AWS with ECS (Fargate)** — managed container runtime, good AWS integration,
   but less portable than Kubernetes and fewer ecosystem tools.
4. **AWS with EKS / self-managed Kubernetes + Helm** — portable, rich ecosystem
   (HPA, PDB, Ingress, Secrets), reproducible via Helm charts, but higher
   operational complexity.
5. **GCP / Azure** — comparable managed services, but the team has existing AWS
   expertise and the Stellar ecosystem tooling is AWS-centric.

## Decision

Use AWS as the production cloud provider with Kubernetes workloads managed by
Helm charts:

- **Compute:** EKS (or EC2 Auto Scaling Group with self-managed Kubernetes) runs
  frontend and backend as Deployments with HPA (Horizontal Pod Autoscaler) and
  PDB (Pod Disruption Budget) for zero-downtime rolling updates.
- **Load balancing:** AWS ALB with ACM-managed TLS certificate terminates HTTPS.
  Nginx handles reverse-proxy routing in staging.
- **Database:** RDS PostgreSQL (Multi-AZ) with PgBouncer connection pooling.
  Encrypted at rest (AES-256) and in transit (TLS).
- **Cache / Queue:** ElastiCache Redis with TLS in-transit (`rediss://` scheme).
  Used for caching, rate limiting, BullMQ queues, and JWT revocation.
- **Secrets:** AWS Secrets Manager stores all credentials (database passwords,
  JWT key pair, field encryption key, Stellar signing keys). The backend fetches
  secrets at startup via the AWS SDK; no secrets are baked into container images
  or Kubernetes ConfigMaps.
- **CDN:** Cloudflare CDN for static frontend assets; CloudFront as an
  alternative for AWS-native deployments.
- **Observability:** Prometheus + Grafana + Alertmanager for metrics and
  alerting; Loki for log aggregation; CloudWatch for AWS-native metrics and
  alarms; Sentry for frontend error tracking.
- **IaC:** Terraform manages VPC, subnets, security groups, RDS, ElastiCache,
  IAM roles, and ALB. Helm manages Kubernetes workloads.
- **Staging:** Docker Compose (`docker-compose.staging.yml`) provides a local
  environment with Nginx, frontend, backend, PostgreSQL, Redis, and one-shot
  migrations. Staging is not identical to production (see consequences).

## Consequences

Positive:

- Managed RDS and ElastiCache eliminate database and cache operational overhead.
- HPA and rolling deployments provide autoscaling and zero-downtime updates.
- AWS Secrets Manager with rotation support reduces the risk of long-lived
  static credentials.
- Terraform and Helm keep infrastructure changes reviewable and reproducible.
- Prometheus/Grafana/Loki provide a unified observability stack independent of
  cloud vendor.

Negative:

- EKS and the surrounding AWS services add significant operational complexity
  compared to a PaaS.
- Staging (Docker Compose) and production (Kubernetes/AWS) are not identical;
  environment-specific bugs remain possible.
- Secrets must be managed differently across Compose (`.env` files), Kubernetes
  (Secrets), and AWS (Secrets Manager), requiring careful alignment.
- Helm values, Terraform variables, and application environment validation
  (`validateEnv`) must stay in sync as new variables are added.

## Related

- Code: `novaRewards/docker-compose.staging.yml`
- Code: `helm/nova-rewards/`
- Code: `infra/` (Terraform)
- Code: `monitoring/`
- Code: `novaRewards/backend/middleware/validateEnv.js`
- ADR: [0006 — Compose for Staging and Helm on AWS for Production](0006-deployment-topology.md)
- ADR: [0002 — PostgreSQL and Redis](0002-postgresql-system-of-record-with-redis-operational-cache.md)
