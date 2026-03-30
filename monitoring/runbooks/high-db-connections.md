# Runbook: High Database Connections

## Alert Details
- **Alert Name**: HighDatabaseConnections
- **Severity**: Warning
- **Threshold**: Connections > 80% of max_connections for 5 minutes

## Symptoms
- Slow database queries
- Connection timeout errors
- "too many connections" errors
- Application unable to connect to database

## Investigation Steps

### 1. Check Current Connection Count
```bash
# Total connections
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT count(*) as total_connections FROM pg_stat_activity;"

# Max connections allowed
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SHOW max_connections;"

# Connection usage percentage
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT 
  count(*) as current,
  (SELECT setting::int FROM pg_settings WHERE name='max_connections') as max,
  round(100.0 * count(*) / (SELECT setting::int FROM pg_settings WHERE name='max_connections'), 2) as percent
FROM pg_stat_activity;"
```

### 2. Identify Connection Sources
```bash
# Connections by application
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT application_name, count(*) 
FROM pg_stat_activity 
GROUP BY application_name 
ORDER BY count(*) DESC;"

# Connections by state
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT state, count(*) 
FROM pg_stat_activity 
GROUP BY state;"

# Idle connections
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT count(*) as idle_connections 
FROM pg_stat_activity 
WHERE state = 'idle';"
```

### 3. Check Long-Running Queries
```bash
# Active queries
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT pid, usename, state, now() - query_start as duration, query 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY duration DESC 
LIMIT 10;"

# Idle in transaction
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT pid, usename, now() - state_change as duration, query 
FROM pg_stat_activity 
WHERE state = 'idle in transaction' 
ORDER BY duration DESC;"
```

### 4. Check Backend Connection Pool
```bash
# Check pool configuration
docker exec -it nova-backend node -e "
const {pool} = require('./db');
console.log('Pool size:', pool.totalCount);
console.log('Idle:', pool.idleCount);
console.log('Waiting:', pool.waitingCount);
"
```

## Common Causes & Solutions

### Connection Leak in Application
**Symptoms**: Connections never released, gradually increasing

**Solution**:
```bash
# Immediate: Kill idle connections
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND state_change < current_timestamp - INTERVAL '10 minutes';"

# Fix in code: Ensure connections are released
// Always use try/finally or async/await properly
const client = await pool.connect();
try {
  const result = await client.query('SELECT * FROM users');
  return result.rows;
} finally {
  client.release(); // Always release!
}
```

### Connection Pool Misconfigured
**Symptoms**: Too many connections from single backend instance

**Solution**:
```javascript
// Reduce pool size in backend
const pool = new Pool({
  max: 20, // Reduce from 50
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Or use environment variable
const pool = new Pool({
  max: process.env.DB_POOL_SIZE || 20,
});
```

### Too Many Backend Instances
**Symptoms**: Multiple instances each with full connection pool

**Solution**:
```bash
# Calculate: max_connections / number_of_instances
# Example: 100 connections / 5 instances = 20 per instance

# Reduce pool size per instance
# Or reduce number of instances
docker-compose up -d --scale backend=3
```

### Long-Running Transactions
**Symptoms**: Connections held for extended periods

**Solution**:
```bash
# Kill long-running transactions
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle in transaction' 
AND state_change < current_timestamp - INTERVAL '5 minutes';"

# Add transaction timeout in application
await client.query('SET statement_timeout = 30000'); // 30 seconds
```

### Connection Pooler Not Used
**Symptoms**: Direct connections without pooling

**Solution**:
```bash
# Implement PgBouncer for connection pooling
docker run -d \
  --name pgbouncer \
  -e DATABASES_HOST=postgres \
  -e DATABASES_PORT=5432 \
  -e DATABASES_USER=nova \
  -e DATABASES_PASSWORD=password \
  -e DATABASES_DBNAME=nova_rewards \
  -e POOL_MODE=transaction \
  -e MAX_CLIENT_CONN=1000 \
  -e DEFAULT_POOL_SIZE=25 \
  pgbouncer/pgbouncer

# Update backend to connect through PgBouncer
DATABASE_URL=postgresql://nova:password@pgbouncer:6432/nova_rewards
```

## Temporary Mitigations

### 1. Increase max_connections
```bash
# Increase limit (requires restart)
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
ALTER SYSTEM SET max_connections = 200;"

# Restart database
docker restart nova-postgres
```

### 2. Kill Idle Connections
```bash
# Kill all idle connections
docker exec -it nova-postgres psql -U nova -d nova_rewards -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND pid != pg_backend_pid();"
```

### 3. Reduce Backend Pool Size
```bash
# Temporarily reduce pool size
docker exec -it nova-backend node -e "
const {pool} = require('./db');
pool.options.max = 10;
console.log('Pool size reduced to 10');
"
```

### 4. Enable Connection Timeout
```javascript
// Add to backend configuration
const pool = new Pool({
  connectionTimeoutMillis: 5000, // Fail fast
  idleTimeoutMillis: 30000, // Close idle connections
});
```

## Prevention

### 1. Proper Connection Management
```javascript
// Use pool.query() for simple queries
const result = await pool.query('SELECT * FROM users');

// Use client for transactions
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO users...');
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release(); // Always release!
}
```

### 2. Connection Pool Sizing
```javascript
// Formula: (max_connections - superuser_reserved) / number_of_instances
// Example: (100 - 3) / 5 instances = ~19 per instance

const pool = new Pool({
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
});
```

### 3. Monitoring
```javascript
// Log pool stats periodically
setInterval(() => {
  console.log('Pool stats:', {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  });
}, 60000);
```

### 4. Use PgBouncer
```yaml
# docker-compose.yml
pgbouncer:
  image: pgbouncer/pgbouncer
  environment:
    DATABASES_HOST: postgres
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 1000
    DEFAULT_POOL_SIZE: 25
```

## Escalation

### When to Escalate
- Connections at 100% for more than 5 minutes
- Unable to reduce connection count
- Application experiencing widespread failures
- Database performance severely degraded

### Escalation Contacts
- **Database Administrator**: [Contact info]
- **Backend Team Lead**: [Contact info]
- **DevOps Team**: [Contact info]

## Post-Incident

### 1. Connection Audit
- Review application connection handling
- Check for connection leaks
- Verify proper error handling

### 2. Configuration Review
- Optimize pool sizes
- Review max_connections setting
- Consider PgBouncer implementation

### 3. Monitoring Improvements
- Add connection pool metrics
- Alert on connection leaks
- Track connection lifetime

## Related Runbooks
- [PostgreSQL Down](./postgres-down.md)
- [High Latency](./high-latency.md)
- [Service Down](./service-down.md)
