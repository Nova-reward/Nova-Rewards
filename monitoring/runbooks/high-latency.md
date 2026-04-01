# Runbook: High Latency

## Alert Details
- **Alert Name**: HighLatency
- **Severity**: Warning
- **Threshold**: 95th percentile latency > 1 second for 10 minutes

## Symptoms
- Slow API responses
- User complaints about performance
- Increased timeout errors

## Investigation Steps

### 1. Identify Slow Endpoints
```bash
# Check latency by route
curl -G 'http://prometheus:9090/api/v1/query' \
  --data-urlencode 'query=histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))'
```

### 2. Check System Resources
```bash
# CPU usage
docker stats nova-backend --no-stream

# Memory usage
docker exec -it nova-backend free -h

# Disk I/O
iostat -x 1 5
```

### 3. Check Database Performance
```bash
# Active queries
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT pid, now() - query_start as duration, query 
FROM pg_stat_activity 
WHERE state = 'active' 
ORDER BY duration DESC 
LIMIT 10;"

# Slow queries
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"

# Connection count
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT count(*) FROM pg_stat_activity;"
```

### 4. Check Redis Performance
```bash
# Redis latency
docker exec -it nova-redis redis-cli --latency

# Slow log
docker exec -it nova-redis redis-cli SLOWLOG GET 10

# Memory usage
docker exec -it nova-redis redis-cli INFO memory
```

### 5. Check Network Latency
```bash
# Test database connection
docker exec -it nova-backend time node -e "const {pool} = require('./db'); pool.query('SELECT 1').then(() => console.log('Done'))"

# Test Redis connection
docker exec -it nova-backend time node -e "const redis = require('./lib/redis'); redis.ping().then(() => console.log('Done'))"

# Test external APIs (Stellar)
docker exec -it nova-backend time curl -I https://horizon-testnet.stellar.org/
```

## Common Causes & Solutions

### Slow Database Queries
**Symptoms**: High database query times, connection pool exhaustion

**Solution**:
```bash
# Identify missing indexes
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY abs(correlation) DESC;"

# Add indexes for frequently queried columns
# Example: CREATE INDEX idx_users_wallet ON users(wallet_address);

# Analyze tables
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "ANALYZE;"
```

### Cache Miss Rate High
**Symptoms**: Increased database load, slow leaderboard queries

**Solution**:
```bash
# Check cache hit rate
docker exec -it nova-redis redis-cli INFO stats | grep keyspace

# Warm up cache
curl -X POST http://backend:4000/api/admin/cache/warm

# Increase cache TTL if appropriate
```

### High Traffic Load
**Symptoms**: All endpoints slow, high CPU usage

**Solution**:
```bash
# Scale up instances (AWS)
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name nova-rewards-asg \
  --desired-capacity 4

# Or scale Docker Compose
docker-compose up -d --scale backend=3

# Enable rate limiting if not already active
```

### Memory Leak
**Symptoms**: Gradually increasing memory, eventual OOM

**Solution**:
```bash
# Take heap snapshot
docker exec -it nova-backend node --expose-gc -e "
const v8 = require('v8');
const fs = require('fs');
const heapSnapshot = v8.writeHeapSnapshot();
console.log('Heap snapshot written to', heapSnapshot);
"

# Restart service to free memory
docker restart nova-backend

# Investigate memory leak in code
```

### External API Slowness
**Symptoms**: Stellar-related endpoints slow

**Solution**:
```bash
# Check Stellar Horizon status
curl https://horizon-testnet.stellar.org/

# Implement timeout and retry logic
# Add circuit breaker pattern

# Consider caching Stellar responses
```

## Temporary Mitigations

### 1. Increase Timeout Limits
```javascript
// In backend code
const timeout = process.env.REQUEST_TIMEOUT || 30000; // Increase from 5000
```

### 2. Enable Aggressive Caching
```bash
# Increase Redis cache TTL
docker exec -it nova-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### 3. Rate Limit Expensive Endpoints
```javascript
// Add stricter rate limiting
const expensiveEndpointLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10 // Reduce from 100
});
```

## Escalation

### When to Escalate
- Latency > 5 seconds for more than 15 minutes
- Multiple endpoints affected
- System resources exhausted
- Unable to identify root cause within 20 minutes

### Escalation Contacts
- **Backend Team Lead**: [Contact info]
- **Database Administrator**: [Contact info]
- **DevOps Team**: [Contact info]

## Post-Incident

### 1. Performance Analysis
- Review slow query logs
- Analyze traffic patterns
- Identify optimization opportunities

### 2. Code Optimization
- Add database indexes
- Optimize N+1 queries
- Implement query result caching

### 3. Infrastructure Tuning
- Adjust auto-scaling thresholds
- Optimize database configuration
- Review connection pool settings

## Related Runbooks
- [High Error Rate](./high-error-rate.md)
- [High Database Connections](./high-db-connections.md)
- [High CPU Usage](./high-cpu.md)
