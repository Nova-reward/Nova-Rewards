# Runbook: Redis Down

## Alert Details
- **Alert Name**: RedisDown
- **Severity**: Critical
- **Threshold**: Redis unreachable for 2 minutes

## Symptoms
- Cache operations failing
- Leaderboard queries slow or failing
- Rate limiting not working
- Session management issues

## Immediate Actions

### 1. Check Redis Status
```bash
# Check if container is running
docker ps | grep redis

# Test connection
docker exec -it nova-redis redis-cli ping

# View logs
docker logs nova-redis --tail 100
```

### 2. Quick Restart
```bash
# Restart Redis
docker restart nova-redis

# Wait for Redis to be ready
until docker exec -it nova-redis redis-cli ping | grep -q PONG; do 
  echo "Waiting for Redis..."
  sleep 1
done

# Restart backend to reconnect
docker restart nova-backend
```

## Investigation Steps

### 1. Check Container Status
```bash
# Container status
docker inspect nova-redis | grep -A 10 "State"

# Resource usage
docker stats nova-redis --no-stream

# Check for OOM kills
dmesg | grep -i "redis\|oom"
```

### 2. Check Redis Logs
```bash
# Recent logs
docker logs nova-redis --tail 200

# Search for errors
docker logs nova-redis 2>&1 | grep -i "error\|warning\|fatal"
```

### 3. Check Memory Usage
```bash
# Redis memory info
docker exec -it nova-redis redis-cli INFO memory

# Memory stats
docker exec -it nova-redis redis-cli MEMORY STATS

# Check eviction policy
docker exec -it nova-redis redis-cli CONFIG GET maxmemory-policy
```

### 4. Check Persistence
```bash
# Last save time
docker exec -it nova-redis redis-cli LASTSAVE

# Check RDB file
docker exec -it nova-redis ls -lh /data/dump.rdb

# Check AOF status
docker exec -it nova-redis redis-cli INFO persistence
```

## Common Causes & Solutions

### Container Crashed
**Symptoms**: Container not running, exit code in logs

**Solution**:
```bash
# Check exit reason
docker inspect nova-redis | grep -A 5 "State"

# Start container
docker start nova-redis

# If fails to start, check logs
docker logs nova-redis

# Recreate container if needed
docker-compose up -d redis
```

### Out of Memory
**Symptoms**: OOM errors, eviction warnings

**Solution**:
```bash
# Check memory usage
docker exec -it nova-redis redis-cli INFO memory | grep used_memory_human

# Clear cache if safe
docker exec -it nova-redis redis-cli FLUSHDB

# Increase memory limit
# Update docker-compose.yml:
#   redis:
#     mem_limit: 2g

# Set maxmemory
docker exec -it nova-redis redis-cli CONFIG SET maxmemory 1gb
docker exec -it nova-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Restart with new limits
docker-compose up -d redis
```

### Persistence Failure
**Symptoms**: "Failed to save DB" errors

**Solution**:
```bash
# Check disk space
df -h

# Check permissions
docker exec -it nova-redis ls -la /data

# Disable persistence temporarily
docker exec -it nova-redis redis-cli CONFIG SET save ""

# Fix permissions
docker exec -it nova-redis chown redis:redis /data

# Re-enable persistence
docker exec -it nova-redis redis-cli CONFIG SET save "900 1 300 10 60 10000"
```

### Connection Limit Reached
**Symptoms**: "max number of clients reached" error

**Solution**:
```bash
# Check current connections
docker exec -it nova-redis redis-cli CLIENT LIST | wc -l

# Check max clients
docker exec -it nova-redis redis-cli CONFIG GET maxclients

# Increase limit
docker exec -it nova-redis redis-cli CONFIG SET maxclients 10000

# Kill idle connections
docker exec -it nova-redis redis-cli CLIENT KILL TYPE normal SKIPME yes
```

### Slow Commands
**Symptoms**: High latency, timeout errors

**Solution**:
```bash
# Check slow log
docker exec -it nova-redis redis-cli SLOWLOG GET 10

# Check for blocking commands
docker exec -it nova-redis redis-cli CLIENT LIST | grep -i "blocked"

# Identify expensive keys
docker exec -it nova-redis redis-cli --bigkeys

# Optimize or remove problematic keys
```

## Recovery Procedures

### Full Redis Restart
```bash
# Stop Redis
docker stop nova-redis

# Clear old data if corrupted
docker volume rm nova-rewards_redis_data

# Start Redis
docker start nova-redis

# Verify
docker exec -it nova-redis redis-cli ping
```

### Restore from Backup
```bash
# Stop Redis
docker stop nova-redis

# Restore RDB file
docker cp /path/to/backup/dump.rdb nova-redis:/data/dump.rdb

# Start Redis
docker start nova-redis

# Verify data
docker exec -it nova-redis redis-cli DBSIZE
```

### Warm Up Cache
```bash
# Trigger cache warming
curl -X POST http://backend:4000/api/admin/cache/warm

# Or manually populate critical data
docker exec -it nova-redis redis-cli SET key value EX 3600
```

## Impact Assessment

### Services Affected
- **Leaderboard**: Will query database directly (slower)
- **Rate Limiting**: May not work (potential abuse)
- **Session Management**: Users may be logged out
- **Cache**: All cache misses, increased database load

### Temporary Workarounds
```javascript
// In backend code, handle Redis failures gracefully
try {
  const cached = await redis.get(key);
  return cached;
} catch (error) {
  console.error('Redis error, falling back to database:', error);
  return await database.query(sql);
}
```

## Escalation

### When to Escalate
- Redis down for more than 5 minutes
- Data loss suspected
- Unable to restart Redis
- Performance severely degraded

### Escalation Contacts
- **Backend Team Lead**: [Contact info]
- **DevOps Team**: [Contact info]
- **Database Administrator**: [Contact info]

## Prevention

### 1. Regular Backups
```bash
# Backup RDB file
docker exec -it nova-redis redis-cli BGSAVE
docker cp nova-redis:/data/dump.rdb /backups/redis_$(date +%Y%m%d).rdb

# Automated backup with cron
0 3 * * * /path/to/redis-backup-script.sh
```

### 2. Monitoring
- Monitor memory usage
- Track eviction rate
- Alert on connection count
- Monitor persistence failures

### 3. Configuration
```bash
# Optimal Redis configuration
maxmemory 1gb
maxmemory-policy allkeys-lru
save 900 1 300 10 60 10000
maxclients 10000
timeout 300
```

## Post-Incident

### 1. Data Verification
- Verify cache consistency
- Check for data loss
- Validate leaderboard data

### 2. Root Cause Analysis
- Why did Redis go down?
- Was memory exhausted?
- Configuration issue?

### 3. Improvements
- Implement Redis Sentinel for HA
- Set up Redis Cluster
- Improve memory management
- Add better monitoring

## Related Runbooks
- [Service Down](./service-down.md)
- [High Memory Usage](./high-memory.md)
- [High Redis Memory](./high-redis-memory.md)
