# Monitoring & Alerting Deployment Checklist

Use this checklist to ensure proper deployment and configuration of the monitoring stack.

## Pre-Deployment

### Environment Setup
- [ ] Docker and Docker Compose installed
- [ ] Access to Nova Rewards backend
- [ ] Slack workspace access (for notifications)
- [ ] PagerDuty account (optional, for critical alerts)
- [ ] Sufficient disk space (minimum 20GB recommended)

### Configuration Files
- [ ] Copy `.env.example` to `.env`
- [ ] Set `GRAFANA_ADMIN_PASSWORD`
- [ ] Set `POSTGRES_PASSWORD`
- [ ] Set `SLACK_WEBHOOK_URL`
- [ ] Set `PAGERDUTY_SERVICE_KEY` (if using PagerDuty)
- [ ] Review and customize alert thresholds in `prometheus/rules/alerts.yml`

## Deployment

### Network Setup
- [ ] Create monitoring network: `docker network create nova-rewards_monitoring`
- [ ] Verify network created: `docker network ls | grep monitoring`

### Start Services
- [ ] Start monitoring stack: `docker-compose -f docker-compose.monitoring.yml up -d`
- [ ] Wait 30 seconds for services to initialize
- [ ] Check all services running: `docker-compose -f docker-compose.monitoring.yml ps`
- [ ] Verify no services in "Restarting" state

### Service Health Checks
- [ ] Prometheus accessible: http://localhost:9090
- [ ] Grafana accessible: http://localhost:3000
- [ ] Alertmanager accessible: http://localhost:9093
- [ ] Node Exporter: http://localhost:9100/metrics
- [ ] PostgreSQL Exporter: http://localhost:9187/metrics
- [ ] Redis Exporter: http://localhost:9121/metrics

## Configuration

### Grafana Setup
- [ ] Login to Grafana (admin/[your-password])
- [ ] Change admin password (if using default)
- [ ] Verify Prometheus datasource connected
- [ ] Import dashboards from `grafana/dashboards/`
- [ ] Test dashboard queries show data
- [ ] Configure user accounts and permissions

### Prometheus Verification
- [ ] Open Prometheus UI: http://localhost:9090
- [ ] Check Status > Targets - all should be "UP"
- [ ] Verify backend target is being scraped
- [ ] Test query: `up{job="nova-backend"}`
- [ ] Check Status > Rules - alert rules loaded
- [ ] Verify no configuration errors

### Alertmanager Configuration
- [ ] Open Alertmanager UI: http://localhost:9093
- [ ] Verify configuration loaded
- [ ] Check Status page for errors
- [ ] Test alert routing configuration

## Integration

### Backend Integration
- [ ] Backend exposes `/metrics` endpoint
- [ ] Metrics endpoint returns Prometheus format
- [ ] Test: `curl http://localhost:4000/metrics`
- [ ] Backend connected to monitoring network (if using integrated setup)
- [ ] Verify Prometheus scraping backend successfully

### Database Integration
- [ ] PostgreSQL Exporter can connect to database
- [ ] Database metrics appearing in Prometheus
- [ ] Test query: `pg_up`

### Cache Integration
- [ ] Redis Exporter can connect to Redis
- [ ] Redis metrics appearing in Prometheus
- [ ] Test query: `redis_up`

## Testing

### Metrics Collection
- [ ] HTTP request metrics appearing: `http_request_duration_seconds_count`
- [ ] System metrics appearing: `node_cpu_seconds_total`
- [ ] Database metrics appearing: `pg_stat_database_numbackends`
- [ ] Redis metrics appearing: `redis_memory_used_bytes`
- [ ] Business metrics appearing: `rewards_distributed_total`

### Alert Testing
- [ ] Run test alert script: `./scripts/test-alerts.sh`
- [ ] Verify test alert appears in Alertmanager
- [ ] Check Slack channel for test alert
- [ ] Check PagerDuty for test alert (if configured)
- [ ] Verify alert resolves after clearing

### Dashboard Testing
- [ ] Open Nova Rewards Overview dashboard
- [ ] Verify all panels show data
- [ ] Test time range selection
- [ ] Test dashboard refresh
- [ ] Verify no "No Data" panels

## Documentation

### Team Onboarding
- [ ] Share Grafana URL and credentials with team
- [ ] Share Prometheus URL with team
- [ ] Review runbooks with on-call engineers
- [ ] Document escalation procedures
- [ ] Create team access to Slack channels
- [ ] Set up PagerDuty rotation (if using)

### Runbook Review
- [ ] Review `high-error-rate.md` with team
- [ ] Review `service-down.md` with team
- [ ] Review `high-latency.md` with team
- [ ] Review `postgres-down.md` with DBA
- [ ] Review `redis-down.md` with team
- [ ] Review `high-cpu.md` with team
- [ ] Review `high-memory.md` with team

## Production Hardening

### Security
- [ ] Change default Grafana admin password
- [ ] Restrict Prometheus access (internal only)
- [ ] Restrict Alertmanager access (internal only)
- [ ] Configure Grafana authentication (LDAP/OAuth)
- [ ] Enable HTTPS for Grafana
- [ ] Set up firewall rules
- [ ] Review and restrict network access

### Backup & Recovery
- [ ] Set up Prometheus data backup
- [ ] Test backup restoration
- [ ] Document backup procedures
- [ ] Set up Grafana dashboard backup
- [ ] Document recovery procedures

### Monitoring the Monitors
- [ ] Set up alerts for Prometheus disk usage
- [ ] Set up alerts for Prometheus scrape failures
- [ ] Monitor Grafana availability
- [ ] Monitor Alertmanager notification failures
- [ ] Set up meta-monitoring dashboard

## Operational Readiness

### Incident Response
- [ ] Define on-call rotation
- [ ] Set up PagerDuty schedules
- [ ] Configure escalation policies
- [ ] Test incident response procedures
- [ ] Conduct tabletop exercise
- [ ] Document communication procedures

### Maintenance Procedures
- [ ] Schedule regular backup verification
- [ ] Plan for Prometheus data retention
- [ ] Set up log rotation
- [ ] Document update procedures
- [ ] Plan for capacity growth

### Performance Tuning
- [ ] Review scrape intervals
- [ ] Optimize recording rules
- [ ] Set appropriate retention periods
- [ ] Monitor Prometheus resource usage
- [ ] Tune alert evaluation intervals

## Post-Deployment

### Week 1
- [ ] Monitor alert accuracy (false positives/negatives)
- [ ] Adjust alert thresholds if needed
- [ ] Gather team feedback on dashboards
- [ ] Document any issues encountered
- [ ] Update runbooks based on real incidents

### Week 2-4
- [ ] Review alert fatigue
- [ ] Optimize dashboard layouts
- [ ] Add custom business metrics
- [ ] Conduct incident response drill
- [ ] Review and update documentation

### Monthly
- [ ] Review monitoring coverage
- [ ] Update alert thresholds based on trends
- [ ] Review and update runbooks
- [ ] Conduct team training
- [ ] Plan for improvements

## Success Metrics

### Technical Metrics
- [ ] Mean Time to Detect (MTTD) < 2 minutes
- [ ] Mean Time to Resolve (MTTR) < 15 minutes
- [ ] Alert accuracy > 95%
- [ ] Dashboard load time < 3 seconds
- [ ] Prometheus scrape success rate > 99%

### Team Metrics
- [ ] Team regularly reviews dashboards
- [ ] Incidents resolved using runbooks
- [ ] On-call engineers trained
- [ ] Documentation kept up-to-date
- [ ] Continuous improvement process in place

## Troubleshooting

### Common Issues Checklist
- [ ] Services not starting: Check logs with `docker-compose logs`
- [ ] No metrics: Verify backend `/metrics` endpoint
- [ ] Prometheus not scraping: Check network connectivity
- [ ] Grafana no data: Verify Prometheus datasource
- [ ] Alerts not firing: Check Alertmanager configuration
- [ ] Notifications not received: Verify webhook URLs

## Sign-Off

### Deployment Team
- [ ] DevOps Engineer: _________________ Date: _______
- [ ] Backend Engineer: ________________ Date: _______
- [ ] SRE: ____________________________ Date: _______

### Stakeholder Approval
- [ ] Engineering Manager: _____________ Date: _______
- [ ] Product Owner: __________________ Date: _______
- [ ] Security Team: ___________________ Date: _______

## Notes

Use this space to document any deviations from the checklist or additional steps taken:

```
[Add notes here]
```

---

**Checklist Version**: 1.0
**Last Updated**: 2024
**Next Review**: [Date]
