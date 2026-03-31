# DevOps Infrastructure Setup

This directory contains configuration and deployment files for Nova Rewards DevOps infrastructure. It implements solutions for logging, secret management, CDN, and staging environment.

## Overview

### 📋 Structure

```
infrastructure/
├── logging/              # Centralized logging with Loki, Prometheus, Grafana
├── secrets/              # Secret management with Vault and AWS Secrets Manager
├── cdn/                  # CDN configuration with CloudFront and Cloudflare
├── staging/              # Staging environment setup with preview deployments
└── ssl/                  # SSL/TLS certificate management
```

## 🚀 Issues Addressed

### #420: Logging Infrastructure
- **Service**: Loki for centralized log aggregation
- **Monitoring**: Prometheus for metrics collection
- **Visualization**: Grafana dashboards
- **Alerting**: Prometheus Alertmanager with Slack integration
- **Retention**: 30-day log retention policy
- **Files**:
  - `logging/loki-config.yml` - Loki configuration
  - `logging/docker-compose-logging.yml` - Complete logging stack
  - `logging/prometheus.yml` - Metrics scraping
  - `logging/promtail-config.yml` - Log collection
  - `logging/alertmanager.yml` - Alert rules
  - `logging/alert_rules.yml` - Prometheus alert conditions

**Quick Start**:
```bash
cd infrastructure/logging
docker-compose -f docker-compose-logging.yml up -d
# Access Grafana at http://localhost:3000 (admin/admin)
# Access Loki UI at http://localhost:3100
```

### #421: Secret Management
- **Vault**: HashiCorp Vault for secrets management
- **Rotation**: Automated secret rotation every 24 hours
- **RBAC**: Role-based access control policies
- **CloudWatch**: Integration with AWS Secrets Manager
- **Files**:
  - `secrets/vault-config.hcl` - Vault server configuration
  - `secrets/docker-compose-secrets.yml` - Vault stack
  - `secrets/vault-policies.hcl` - RBAC policies
  - `secrets/secret-rotator.sh` - Rotation script

**Quick Start**:
```bash
cd infrastructure/secrets
docker-compose -f docker-compose-secrets.yml --profile setup up
# Initialize and unseal Vault
# Access Vault UI at http://localhost:8200 (requires token)
```

**Secret Rotation**:
- Database credentials: Automatic rotation via database plugin
- API keys: Manual rotation with version tracking
- Environment secrets: Scheduled hourly rotation
- Rotation window: 24-hour default interval

### #422: CDN Configuration
- **Primary**: CloudFront for AWS-based CDN
- **DDoS Protection**: Cloudflare WAF and DDoS protection
- **Caching**: Intelligent cache rules by content type
- **Rate Limiting**: 100 requests/10 seconds per IP
- **Files**:
  - `cdn/terraform-cdn.tf` - CloudFront + Cloudflare setup
  - `cdn/CLOUDFLARE_SETUP.md` - Manual configuration guide

**Cache Rules**:
```
Static Assets (images, fonts): 
  - Cache: 1 year
  - Compression: Enabled

HTML/CSS/JS:
  - Cache: 30 days
  - Compression: Brotli enabled

API Endpoints (/api/*):
  - Cache: Disabled
  - Bypass cache on all requests
```

**DDoS Protection**:
- Cloudflare OWASP CRS rules
- Rate limiting per IP
- Country-level blocking (configurable)
- Bot management
- SSL/TLS inspection

**Deployment**:
```bash
cd terraform
terraform init
terraform plan -var-file=cdn.tfvars
terraform apply -var-file=cdn.tfvars
```

### #423: Staging Environment
- **Mirroring**: Production-like staging environment
- **Data Seeding**: Automated test data provisioning
- **Preview Deployments**: PR-based ephemeral environments
- **Files**:
  - `staging/docker-compose-staging.yml` - Staging stack
  - `staging/seed-staging-db.sh` - Data seeding script
  - `staging/nginx-staging.conf` - Reverse proxy config
  - `.github/workflows/preview-deployment.yml` - PR preview workflow

**Quick Start**:
```bash
cd infrastructure/staging
docker-compose -f docker-compose-staging.yml up -d
./seed-staging-db.sh seed
# Access at http://localhost
```

**Preview Deployments** (Automated via GitHub Actions):
- Triggered on PR creation/updates
- Auto-deployed to Heroku
- Database seeded with test data
- Expires 7 days after PR closes
- Comment posted with preview URLs

**Seed Data Includes**:
- 6 test users (admin + 5 users)
- 1000 NOVA tokens per wallet
- 100 completed rewards
- 50 sample transactions
- 20 referral relationships

## 📚 Integration Guide

### 1. Enable Logging
```bash
# Deploy logging stack
docker-compose -f infrastructure/logging/docker-compose-logging.yml up -d

# Configure application to send logs
export LOKI_URL=http://localhost:3100
export PROMETHEUS_URL=http://localhost:9090
```

### 2. Configure Secrets Management
```bash
# Deploy Vault
docker-compose -f infrastructure/secrets/docker-compose-secrets.yml up -d

# Initialize Vault (one-time)
vault operator init
vault operator unseal [key1] [key2] [key3]

# Apply policies
vault policy write admin infrastructure/secrets/vault-policies.hcl

# Start secret rotator
docker-compose -f infrastructure/secrets/docker-compose-secrets.yml up -d secret-rotator
```

### 3. Deploy CDN
```bash
# Set environment variables
export CLOUDFLARE_API_TOKEN=<your-token>
export TF_VAR_cloudflare_api_token=<your-token>

# Deploy infrastructure
cd terraform
terraform apply -var-file=cdn.tfvars
```

### 4. Staging Environment
```bash
# Start staging environment
docker-compose -f infrastructure/staging/docker-compose-staging.yml up -d

# Seed test data
infrastructure/staging/seed-staging-db.sh seed

# Clear test data
infrastructure/staging/seed-staging-db.sh clear
```

## 🔍 Monitoring & Alerts

### Grafana Dashboards
- Application Performance: Response times, throughput, errors
- Infrastructure: Docker, database, Redis metrics
- Business Metrics: Active users, transactions, rewards
- Logging: Log volume, error rates, trace analysis

### Alert Channels
- **Critical**: Slack #critical-alerts, PagerDuty
- **Warning**: Slack #warning-alerts, Email
- **Info**: Slack #info-alerts

### Key Metrics
```
- HTTP Error Rate > 5% for 5 minutes
- P99 Latency > 1 second for 5 minutes
- Database Connection Pool > 90% utilized
- Disk Space < 10% remaining
- Memory Usage > 85%
- Loki unavailable > 5 minutes
- Alertmanager unavailable > 5 minutes
```

## 🔐 Security Best Practices

### Secrets Management
- All secrets stored in Vault or AWS Secrets Manager
- Automatic rotation every 24 hours
- Environment-specific secret handling
- Audit logging for all access
- TTL-based token expiration

### CDN Security
- TLS 1.2+ required
- HTTP/2 enabled
- HSTS preload headers
- CSP headers enforced
- X-Frame-Options: DENY

### Staging Environment
- Isolated network
- Separate database instance
- Test credentials only
- Read-only access to production data
- Automatic cleanup after 24 hours

## 📊 Performance Targets

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| API Response Time (p99) | < 500ms | > 1000ms |
| Error Rate | < 0.1% | > 5% |
| Cache Hit Rate | > 70% | < 50% |
| Availability | 99.9% | < 99.5% |
| Log Ingestion Latency | < 5s | > 30s |

## 🆘 Troubleshooting

### Logging Issues
```bash
# Check Loki health
curl http://localhost:3100/ready

# View Loki logs
docker logs loki

# Test Promtail connectivity
docker logs promtail

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets
```

### Secret Management Issues
```bash
# Check Vault status
vault status

# Verify policies
vault policy list
vault policy read admin

# Check secret rotator logs
docker logs secret-rotator

# Manual secret rotation
vault read database/creds/postgres
```

### CDN Issues
```bash
# Check CloudFront distribution
aws cloudfront get-distribution --id <distribution-id>

# Test Cloudflare cache
curl -I https://nova-rewards.com
curl -v -H "CF-Cache-Status" https://nova-rewards.com

# View cache analytics
# Via Cloudflare dashboard: Analytics > Traffic
```

### Staging Environment Issues
```bash
# Check database connection
docker exec postgres-staging psql -U staging_user -d nova_rewards_staging -c "SELECT 1"

# View backend logs
docker logs backend-staging

# Check frontend health
curl http://localhost/health

# Test API
curl http://localhost/api/health
```

## 🔄 Deployment Checklist

- [ ] Logging stack deployed and healthy
- [ ] Prometheus scraping metrics
- [ ] Grafana dashboards accessible
- [ ] Alert rules configured
- [ ] Vault initialized and unsealed
- [ ] Secret rotation running
- [ ] CDN distribution created
- [ ] Cloudflare zone configured
- [ ] DNS records updated
- [ ] Staging environment running
- [ ] Data seeding automated
- [ ] Preview deployment workflow active
- [ ] Health checks passing
- [ ] Load testing completed
- [ ] Documentation updated

## 📖 Additional Resources

- [Loki Documentation](https://grafana.com/docs/loki/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Vault Documentation](https://www.vaultproject.io/docs)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [Cloudflare Documentation](https://developers.cloudflare.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

## 📝 License

See LICENSE file in the repository root.
