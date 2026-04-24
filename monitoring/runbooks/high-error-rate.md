# Runbook: High Error Rate

## Alert Details
- **Alert Name**: HighErrorRate
- **Severity**: Critical
- **Threshold**: 5xx error rate > 5% for 5 minutes

## Symptoms
- Users experiencing 500/502/503/504 errors
- Increased error rate in application logs
- Potential service degradation

## Investigation Steps

### 1. Check Current Error Rate
```bash
# View current error rate in Grafana
# Navigate to: Nova Rewards Dashboard > Error Rate panel

# Or query Prometheus directly
curl -G 'http://prometheus:9090/api/v1/query' \
  --data-urlencode 'query=sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[5m])) / sum(rate(http_request_duration_seconds_count[5m]))'
```

### 2. Identify Affected Endpoints
```bash
# Check which routes are failing
curl -G 'http://prometheus:9090/api/v1/query' \
  --data-urlencode 'query=sum(rate(http_request_duration_seconds_count{status_code=~"5.."}[5m])) by (route)'
```

### 3. Check Application Logs
```bash
# View recent error logs
docker logs nova-backend --tail 100 --follow | grep -i error

# Or check CloudWatch Logs (AWS)
aws logs tail /nova-rewards/production/app --follow --filter-pattern "ERROR"
```

### 4. Check Service Health
```bash
# Test health endpoint
curl http://backend:4000/health

# Check service status
docker ps | grep nova-backend
```

### 5. Check Dependencies
```bash
# PostgreSQL
docker exec -it nova-postgres pg_isready

# Redis
docker exec -it nova-redis redis-cli ping

# Check connection pool
docker exec -it nova-backend node -e "const {pool} = require('./db'); pool.query('SELECT 1').then(() => console.log('DB OK')).catch(console.error)"
```

## Common Causes & Solutions

### Database Connection Issues
**Symptoms**: Errors related to database queries, connection timeouts

**Solution**:
```bash
# Check database connections
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "SELECT count(*) FROM pg_stat_activity;"

# Restart database if needed
docker restart nova-postgres

# Check connection pool settings in backend
```

### Redis Connection Issues
**Symptoms**: Cache-related errors, timeout errors

**Solution**:
```bash
# Check Redis status
docker exec -it nova-redis redis-cli INFO

# Clear cache if corrupted
docker exec -it nova-redis redis-cli FLUSHDB

# Restart Redis
docker restart nova-redis
```

### Memory Exhaustion
**Symptoms**: Out of memory errors, container restarts

**Solution**:
```bash
# Check memory usage
docker stats nova-backend

# Restart backend service
docker restart nova-backend

# Scale up if needed (AWS)
aws autoscaling set-desired-capacity --auto-scaling-group-name nova-rewards-asg --desired-capacity 4
```

### Stellar Network Issues
**Symptoms**: Errors related to Stellar SDK, transaction failures

**Solution**:
```bash
# Check Stellar Horizon status
curl https://horizon-testnet.stellar.org/

# Verify network connectivity
docker exec -it nova-backend curl -I https://horizon-testnet.stellar.org/
```

### Code Deployment Issues
**Symptoms**: Errors started after recent deployment

**Solution**:
```bash
# Rollback to previous version
git log --oneline -10
git checkout <previous-commit>
docker-compose up -d --build backend

# Or rollback via AWS (if using ECS/EKS)
```

## Escalation

### When to Escalate
- Error rate > 10% for more than 10 minutes
- Multiple services affected
- Database or Redis completely down
- Unable to identify root cause within 15 minutes

### Escalation Contacts
- **On-Call Engineer**: Check PagerDuty rotation
- **Backend Team Lead**: [Contact info in team docs]
- **DevOps Team**: [Contact info in team docs]

## Post-Incident

### 1. Document the Incident
- Create incident report in incident management system
- Document timeline, root cause, and resolution

### 2. Review Metrics
- Analyze error patterns in Grafana
- Check if similar issues occurred before

### 3. Implement Preventive Measures
- Add monitoring for identified gaps
- Update alerting thresholds if needed
- Create tickets for code fixes or infrastructure improvements

## Related Runbooks
- [Service Down](./service-down.md)
- [High Latency](./high-latency.md)
- [Database Issues](./postgres-down.md)
