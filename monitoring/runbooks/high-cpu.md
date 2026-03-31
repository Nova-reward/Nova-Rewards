# Runbook: High CPU Usage

## Alert Details
- **Alert Name**: HighCPUUsage
- **Severity**: Warning
- **Threshold**: CPU > 80% for 10 minutes

## Symptoms
- Slow application response times
- Increased latency
- Potential service degradation

## Investigation Steps

### 1. Verify CPU Usage
```bash
# Check current CPU usage
docker stats nova-backend --no-stream

# System-wide CPU
top -bn1 | head -20

# Per-process CPU
ps aux --sort=-%cpu | head -10
```

### 2. Identify CPU-Intensive Processes
```bash
# Inside container
docker exec -it nova-backend top -bn1

# Node.js process details
docker exec -it nova-backend ps aux | grep node
```

### 3. Check Application Logs
```bash
# Recent logs
docker logs nova-backend --tail 200 --follow

# Look for infinite loops or heavy operations
docker logs nova-backend 2>&1 | grep -i "processing\|computing\|calculating"
```

### 4. Profile Application
```bash
# Generate CPU profile (if profiling enabled)
docker exec -it nova-backend node --prof server.js

# Or use clinic.js
docker exec -it nova-backend clinic doctor -- node server.js
```

## Common Causes & Solutions

### Infinite Loop or Recursion
**Symptoms**: Single process consuming 100% CPU

**Solution**:
```bash
# Identify the problematic code from logs
# Restart service immediately
docker restart nova-backend

# Deploy hotfix to resolve infinite loop
```

### Heavy Computation
**Symptoms**: CPU spikes during specific operations

**Solution**:
```bash
# Identify expensive operations
# Move to background job queue
# Optimize algorithm
# Add caching
```

### High Traffic Load
**Symptoms**: CPU increases with request rate

**Solution**:
```bash
# Scale horizontally
docker-compose up -d --scale backend=3

# Or on AWS
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name nova-rewards-asg \
  --desired-capacity 4

# Enable rate limiting
# Optimize hot paths
```

### Memory Leak Causing GC Pressure
**Symptoms**: High CPU with increasing memory

**Solution**:
```bash
# Check memory usage
docker stats nova-backend

# Restart to free memory
docker restart nova-backend

# Investigate memory leak
# Take heap snapshot for analysis
```

### Inefficient Database Queries
**Symptoms**: CPU high during database operations

**Solution**:
```bash
# Check slow queries
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT query, calls, total_time, mean_time 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;"

# Optimize queries
# Add indexes
# Use query result caching
```

## Temporary Mitigations

### 1. Scale Up
```bash
# Add more instances
docker-compose up -d --scale backend=4
```

### 2. Rate Limiting
```javascript
// Reduce rate limits temporarily
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50 // Reduce from 100
});
```

### 3. Disable Non-Critical Features
```bash
# Disable background jobs temporarily
# Disable analytics
# Reduce logging verbosity
```

## Escalation

### When to Escalate
- CPU > 95% for more than 15 minutes
- Service becoming unresponsive
- Unable to identify root cause
- Scaling doesn't help

### Escalation Contacts
- **Backend Team Lead**: [Contact info]
- **DevOps Team**: [Contact info]
- **Performance Engineer**: [Contact info]

## Post-Incident

### 1. Performance Analysis
- Profile application code
- Identify bottlenecks
- Review algorithm efficiency

### 2. Optimization
- Optimize hot code paths
- Add caching where appropriate
- Improve query performance
- Consider async processing

### 3. Capacity Planning
- Review auto-scaling thresholds
- Plan for traffic growth
- Consider instance upgrades

## Related Runbooks
- [High Memory Usage](./high-memory.md)
- [High Latency](./high-latency.md)
- [Service Down](./service-down.md)
