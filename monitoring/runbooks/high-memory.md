# Runbook: High Memory Usage

## Alert Details
- **Alert Name**: HighMemoryUsage
- **Severity**: Warning
- **Threshold**: Memory > 85% for 10 minutes

## Symptoms
- Slow application performance
- Increased garbage collection
- Potential OOM kills
- Container restarts

## Investigation Steps

### 1. Check Memory Usage
```bash
# Container memory
docker stats nova-backend --no-stream

# System memory
free -h

# Process memory
ps aux --sort=-%mem | head -10
```

### 2. Check for Memory Leaks
```bash
# Node.js heap usage
docker exec -it nova-backend node -e "console.log(process.memoryUsage())"

# Monitor over time
watch -n 5 'docker exec -it nova-backend node -e "console.log(process.memoryUsage())"'
```

### 3. Take Heap Snapshot
```bash
# Generate heap snapshot
docker exec -it nova-backend node -e "
const v8 = require('v8');
const fs = require('fs');
const snapshot = v8.writeHeapSnapshot();
console.log('Snapshot written to:', snapshot);
"

# Copy snapshot for analysis
docker cp nova-backend:/app/[snapshot-file] ./
```

### 4. Check Application Logs
```bash
# Look for memory warnings
docker logs nova-backend 2>&1 | grep -i "memory\|heap\|gc"

# Check for large data processing
docker logs nova-backend 2>&1 | grep -i "processing\|loading"
```

## Common Causes & Solutions

### Memory Leak
**Symptoms**: Gradually increasing memory, never released

**Solution**:
```bash
# Immediate: Restart service
docker restart nova-backend

# Analyze heap snapshot with Chrome DevTools
# Identify leaked objects
# Fix code and deploy

# Common leak sources:
# - Event listeners not removed
# - Global variables accumulating data
# - Closures holding references
# - Caching without limits
```

### Large Data Sets in Memory
**Symptoms**: Memory spikes during specific operations

**Solution**:
```bash
# Implement streaming for large data
# Use pagination
# Process data in chunks
# Clear data after processing

# Example: Stream large query results
const stream = pool.query(new QueryStream('SELECT * FROM large_table'));
stream.on('data', processRow);
```

### Cache Growing Unbounded
**Symptoms**: Memory increases with cache size

**Solution**:
```bash
# Check Redis memory
docker exec -it nova-redis redis-cli INFO memory

# Set memory limits
docker exec -it nova-redis redis-cli CONFIG SET maxmemory 1gb
docker exec -it nova-redis redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Implement cache eviction in application
# Set TTL on cached items
# Limit cache size
```

### Too Many Concurrent Connections
**Symptoms**: Memory increases with connection count

**Solution**:
```bash
# Check connection pool
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT count(*) FROM pg_stat_activity;"

# Reduce pool size
# In backend code:
const pool = new Pool({
  max: 20, // Reduce from 50
  idleTimeoutMillis: 30000
});
```

### Large Request/Response Bodies
**Symptoms**: Memory spikes during API calls

**Solution**:
```javascript
// Limit request body size
app.use(express.json({ limit: '1mb' }));

// Stream large responses
res.setHeader('Content-Type', 'application/json');
stream.pipe(res);
```

## Temporary Mitigations

### 1. Restart Service
```bash
# Quick memory release
docker restart nova-backend
```

### 2. Increase Memory Limit
```yaml
# docker-compose.yml
services:
  backend:
    mem_limit: 2g
    mem_reservation: 1g
```

### 3. Force Garbage Collection
```bash
# If --expose-gc flag enabled
docker exec -it nova-backend node -e "global.gc(); console.log('GC forced')"
```

### 4. Clear Caches
```bash
# Clear Redis cache
docker exec -it nova-redis redis-cli FLUSHDB

# Clear application cache
curl -X POST http://backend:4000/api/admin/cache/clear
```

## Prevention

### 1. Memory Limits
```javascript
// Set Node.js memory limit
node --max-old-space-size=1024 server.js
```

### 2. Implement Proper Cleanup
```javascript
// Remove event listeners
emitter.removeListener('event', handler);

// Clear intervals/timeouts
clearInterval(intervalId);

// Close connections
connection.close();
```

### 3. Use Streaming
```javascript
// Stream large files
const stream = fs.createReadStream('large-file.json');
stream.pipe(res);

// Stream database results
const queryStream = new QueryStream('SELECT * FROM large_table');
```

### 4. Implement Cache Limits
```javascript
// LRU cache with size limit
const LRU = require('lru-cache');
const cache = new LRU({
  max: 500,
  maxAge: 1000 * 60 * 60
});
```

## Escalation

### When to Escalate
- Memory > 95% for more than 10 minutes
- Frequent OOM kills
- Memory leak confirmed but cause unknown
- Performance severely degraded

### Escalation Contacts
- **Backend Team Lead**: [Contact info]
- **Performance Engineer**: [Contact info]
- **DevOps Team**: [Contact info]

## Post-Incident

### 1. Memory Profiling
- Analyze heap snapshots
- Identify memory hotspots
- Review object retention

### 2. Code Review
- Review recent changes
- Check for memory leaks
- Implement proper cleanup

### 3. Monitoring Improvements
- Add memory leak detection
- Monitor heap growth rate
- Alert on abnormal patterns

## Related Runbooks
- [High CPU Usage](./high-cpu.md)
- [Service Down](./service-down.md)
- [High Redis Memory](./high-redis-memory.md)
