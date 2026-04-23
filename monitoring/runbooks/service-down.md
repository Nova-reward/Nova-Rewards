# Runbook: Service Down

## Alert Details
- **Alert Name**: ServiceDown
- **Severity**: Critical
- **Threshold**: Service unreachable for 2 minutes

## Symptoms
- Health check endpoint returning errors or timing out
- Users unable to access the application
- All API requests failing

## Immediate Actions

### 1. Verify Service Status
```bash
# Check if containers are running
docker ps | grep nova

# Check service health
curl -v http://backend:4000/health

# Check logs for crash
docker logs nova-backend --tail 50
```

### 2. Check for Recent Changes
```bash
# Recent deployments
git log --oneline -5

# Recent container restarts
docker ps -a | grep nova-backend

# Check AWS deployment history (if applicable)
aws deploy list-deployments --application-name nova-rewards --max-items 5
```

### 3. Quick Restart
```bash
# Restart backend service
docker restart nova-backend

# Wait 30 seconds and check health
sleep 30
curl http://backend:4000/health

# If still down, restart all services
docker-compose restart
```

## Investigation Steps

### 1. Check Application Logs
```bash
# View recent logs
docker logs nova-backend --tail 200 --follow

# Search for errors
docker logs nova-backend 2>&1 | grep -i "error\|exception\|fatal"

# Check for OOM kills
dmesg | grep -i "out of memory"
```

### 2. Check System Resources
```bash
# Disk space
df -h

# Memory
free -h

# CPU
top -bn1 | head -20

# Docker resources
docker system df
```

### 3. Check Dependencies
```bash
# PostgreSQL
docker exec -it nova-postgres pg_isready
docker logs nova-postgres --tail 50

# Redis
docker exec -it nova-redis redis-cli ping
docker logs nova-redis --tail 50

# Network connectivity
docker network inspect nova-rewards_default
```

### 4. Check Port Availability
```bash
# Check if port 4000 is in use
netstat -tulpn | grep 4000

# Check if another process is using the port
lsof -i :4000

# Test port connectivity
telnet localhost 4000
```

## Common Causes & Solutions

### Application Crash
**Symptoms**: Container exited, error in logs

**Solution**:
```bash
# Check exit code
docker inspect nova-backend | grep -A 5 "State"

# Review crash logs
docker logs nova-backend --tail 100

# Start service
docker-compose up -d backend

# If crash persists, rollback
git checkout <previous-stable-commit>
docker-compose up -d --build backend
```

### Out of Memory
**Symptoms**: OOM killer messages, container restart

**Solution**:
```bash
# Check memory limits
docker inspect nova-backend | grep -A 10 "Memory"

# Increase memory limit
docker-compose.yml:
  backend:
    mem_limit: 2g
    mem_reservation: 1g

# Restart with new limits
docker-compose up -d backend
```

### Database Connection Failure
**Symptoms**: Cannot connect to database errors

**Solution**:
```bash
# Check database status
docker exec -it nova-postgres pg_isready

# Restart database
docker restart nova-postgres

# Wait for database to be ready
until docker exec -it nova-postgres pg_isready; do sleep 1; done

# Restart backend
docker restart nova-backend
```

### Port Conflict
**Symptoms**: Port already in use error

**Solution**:
```bash
# Find process using port
lsof -i :4000

# Kill conflicting process
kill -9 <PID>

# Or change backend port
# Update docker-compose.yml and restart
```

### Configuration Error
**Symptoms**: Environment variable errors, config validation failures

**Solution**:
```bash
# Check environment variables
docker exec -it nova-backend env | grep -E "DATABASE_URL|REDIS|STELLAR"

# Verify .env file
cat .env

# Reload configuration
docker-compose down
docker-compose up -d
```

### Network Issues
**Symptoms**: Cannot reach external services (Stellar, etc.)

**Solution**:
```bash
# Test external connectivity
docker exec -it nova-backend curl -I https://horizon-testnet.stellar.org/

# Check DNS resolution
docker exec -it nova-backend nslookup horizon-testnet.stellar.org

# Restart Docker network
docker network disconnect nova-rewards_default nova-backend
docker network connect nova-rewards_default nova-backend
```

## Recovery Procedures

### Full Service Restart
```bash
# Stop all services
docker-compose down

# Clean up (if needed)
docker system prune -f

# Start services
docker-compose up -d

# Verify health
sleep 30
curl http://backend:4000/health
```

### Rollback Deployment
```bash
# Identify last stable version
git log --oneline -10

# Rollback code
git checkout <stable-commit>

# Rebuild and restart
docker-compose down
docker-compose up -d --build

# Verify
curl http://backend:4000/health
```

### Scale Up (AWS)
```bash
# Increase instance count
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name nova-rewards-asg \
  --desired-capacity 4

# Check instance health
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names nova-rewards-asg
```

## Escalation

### When to Escalate
- Service down for more than 5 minutes
- Unable to restart service
- Data corruption suspected
- Multiple recovery attempts failed

### Escalation Contacts
- **On-Call Engineer**: Check PagerDuty
- **Backend Team Lead**: [Contact info]
- **DevOps Team**: [Contact info]
- **CTO**: [Contact info] (for extended outages)

## Communication

### User Communication
```
Subject: Nova Rewards Service Disruption

We are currently experiencing technical difficulties with the Nova Rewards platform. 
Our team is actively working to resolve the issue.

Status: Investigating
Started: [TIME]
Expected Resolution: [TIME]

We will provide updates every 15 minutes.
```

### Status Page Update
- Update status.novarewards.com
- Post to social media channels
- Send email to affected users

## Post-Incident

### 1. Incident Report
- Document timeline
- Identify root cause
- Calculate downtime and impact

### 2. Root Cause Analysis
- Why did the service go down?
- Why didn't monitoring catch it earlier?
- What can prevent this in the future?

### 3. Action Items
- Create tickets for fixes
- Update monitoring and alerting
- Improve deployment procedures
- Update runbooks

## Related Runbooks
- [High Error Rate](./high-error-rate.md)
- [Database Down](./postgres-down.md)
- [High Memory Usage](./high-memory.md)
