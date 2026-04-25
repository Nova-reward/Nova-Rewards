# ADR 0006: Compose for Staging and Helm on AWS for Production

## Status

Accepted

## Context

The project needs a staging topology that contributors can run and inspect
without provisioning cloud infrastructure, while production needs TLS,
autoscaling, private managed data services, encrypted secrets, health probes,
and observability.

## Decision

Use two deployment tracks:

- Staging uses `novaRewards/docker-compose.staging.yml` with Nginx, frontend,
  backend, PostgreSQL, Redis, and one-shot migrations.
- Production uses the Helm chart in `helm/nova-rewards` for frontend/backend
  deployments, services, ingress, HPA, PDB, config, and Kubernetes secrets.
- AWS infrastructure in `infra/` provides VPC networking, ALB, EC2 or worker
  capacity, private encrypted RDS PostgreSQL, encrypted ElastiCache Redis, IAM,
  and Secrets Manager.
- Observability is provided through Prometheus, Grafana, Alertmanager, Loki, and
  CloudWatch integrations.

## Consequences

Positive:

- Contributors can validate staging behavior locally with Compose.
- Production runtime has replica controls, health probes, and managed stateful
  services.
- Terraform and Helm keep infrastructure and workload changes reviewable.

Negative:

- Staging and production are not identical, so environment-specific bugs remain
  possible.
- Secrets must be managed differently across Compose, Kubernetes, and AWS.
- Helm values, Terraform variables, and application environment validation must
  stay aligned.

## Related

- Diagram: [System Design - Deployment Topology](../system-design.md#deployment-topology)
- Code: `novaRewards/docker-compose.staging.yml`
- Code: `novaRewards/docker-compose.prod.yml`
- Code: `helm/nova-rewards`
- Code: `infra`
- Code: `monitoring`

