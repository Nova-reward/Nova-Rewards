# Runbook: PostgreSQL Down

## Alert Details
- **Alert Name**: PostgreSQLDown
- **Severity**: Critical
- **Threshold**: Database unreachable for 2 minutes

## Symptoms
- All database queries failing
- Application unable to start
- Connection timeout errors

## Immediate Actions

### 1. Check Database Status
```bash
# Check if container is running
docker ps | grep postgres

# Check database health
docker exec -it nova-postgres pg_isready -U nova

# View logs
docker logs nova-postgres --tail 100
```

### 2. Quick Restart
```bash
# Restart PostgreSQL
docker restart nova-postgres

# Wait for database to be ready
until docker exec -it nova-postgres pg_isready -U nova; do 
  echo "Waiting for database..."
  sleep 2
done

# Restart backend to reconnect
docker restart nova-backend
```

## Investigation Steps

### 1. Check Container Status
```bash
# Container status
docker inspect nova-postgres | grep -A 10 "State"

# Resource usage
docker stats nova-postgres --no-stream

# Check for OOM kills
dmesg | grep -i "postgres\|oom"
```

### 2. Check Database Logs
```bash
# Recent logs
docker logs nova-postgres --tail 200

# Search for errors
docker logs nova-postgres 2>&1 | grep -i "error\|fatal\|panic"

# Check PostgreSQL log file
docker exec -it nova-postgres cat /var/lib/postgresql/data/log/postgresql-*.log
```

### 3. Check Disk Space
```bash
# Host disk space
df -h

# Database volume
docker exec -it nova-postgres df -h /var/lib/postgresql/data

# Database size
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT pg_size_pretty(pg_database_size('nova_rewards'));"
```

### 4. Check Connections
```bash
# Active connections
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT count(*) FROM pg_stat_activity;"

# Connection limit
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SHOW max_connections;"

# Blocked queries
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT pid, usename, pg_blocking_pids(pid) as blocked_by, query 
FROM pg_stat_activity 
WHERE cardinality(pg_blocking_pids(pid)) > 0;"
```

## Common Causes & Solutions

### Container Crashed
**Symptoms**: Container not running, exit code in logs

**Solution**:
```bash
# Check exit reason
docker inspect nova-postgres | grep -A 5 "State"

# Start container
docker start nova-postgres

# If fails to start, check logs
docker logs nova-postgres

# Recreate container if corrupted
docker-compose up -d postgres
```

### Out of Disk Space
**Symptoms**: "No space left on device" errors

**Solution**:
```bash
# Clean up Docker
docker system prune -a --volumes -f

# Remove old logs
find /var/log -type f -name "*.log" -mtime +7 -delete

# Vacuum database
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "VACUUM FULL;"

# Increase disk size (AWS)
aws ec2 modify-volume --volume-id vol-xxx --size 100
```

### Too Many Connections
**Symptoms**: "too many connections" error

**Solution**:
```bash
# Kill idle connections
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND state_change < current_timestamp - INTERVAL '10 minutes';"

# Increase max_connections
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
ALTER SYSTEM SET max_connections = 200;"

# Restart database
docker restart nova-postgres
```

### Data Corruption
**Symptoms**: "invalid page header" or "corrupted" errors

**Solution**:
```bash
# Check database integrity
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT datname, pg_database_size(datname) 
FROM pg_database;"

# Restore from backup
docker exec -it nova-postgres pg_restore -U nova -d nova_rewards /backups/latest.dump

# If no backup, try recovery
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "REINDEX DATABASE nova_rewards;"
```

### Configuration Error
**Symptoms**: Database won't start, config errors in logs

**Solution**:
```bash
# Check configuration
docker exec -it nova-postgres cat /var/lib/postgresql/data/postgresql.conf

# Reset to defaults
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
ALTER SYSTEM RESET ALL;"

# Restart
docker restart nova-postgres
```

## Recovery Procedures

### Full Database Restart
```bash
# Stop database
docker stop nova-postgres

# Check for locks
lsof | grep postgres

# Start database
docker start nova-postgres

# Verify
docker exec -it nova-postgres pg_isready -U nova
```

### Restore from Backup
```bash
# Stop backend
docker stop nova-backend

# Restore database
docker exec -i nova-postgres pg_restore -U nova -d nova_rewards -c < /path/to/backup.dump

# Or from SQL dump
docker exec -i nova-postgres psql -U nova -d nova_rewards < /path/to/backup.sql

# Start backend
docker start nova-backend
```

### Failover to Replica (if configured)
```bash
# Promote replica to primary
docker exec -it nova-postgres-replica pg_ctl promote

# Update backend connection string
# Point to new primary database

# Restart backend
docker restart nova-backend
```

## Escalation

### When to Escalate
- Database down for more than 5 minutes
- Data corruption detected
- Unable to restore from backup
- Replica failover required

### Escalation Contacts
- **Database Administrator**: [Contact info]
- **DevOps Team**: [Contact info]
- **Backend Team Lead**: [Contact info]

## Prevention

### 1. Regular Backups
```bash
# Daily backup script
docker exec -it nova-postgres pg_dump -U nova nova_rewards > backup_$(date +%Y%m%d).sql

# Automated backup with cron
0 2 * * * /path/to/backup-script.sh
```

### 2. Monitoring
- Set up connection pool monitoring
- Monitor disk space usage
- Track slow queries
- Alert on replication lag

### 3. Maintenance
```bash
# Weekly vacuum
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "VACUUM ANALYZE;"

# Monthly reindex
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "REINDEX DATABASE nova_rewards;"
```

## Post-Incident

### 1. Root Cause Analysis
- Why did the database go down?
- Was there a warning sign?
- How can we prevent this?

### 2. Backup Verification
- Test backup restoration
- Verify backup schedule
- Check backup retention

### 3. Improvements
- Implement database replication
- Set up automated failover
- Improve monitoring and alerting

## Related Runbooks
- [Service Down](./service-down.md)
- [High Database Connections](./high-db-connections.md)
- [Low Disk Space](./low-disk-space.md)
