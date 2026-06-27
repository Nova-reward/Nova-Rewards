# Health Check Quick Start

## Testing Locally

Start the server:
```bash
npm run dev
```

Test basic health check:
```bash
curl http://localhost:3001/api/health
```

Test detailed health check:
```bash
curl http://localhost:3001/api/health/detailed
```

## Run Tests

```bash
npm test -- health.test.js
```

## Production Monitoring

### Using curl
```bash
# Basic check
curl https://your-domain.com/api/health

# Detailed check with formatted output
curl -s https://your-domain.com/api/health/detailed | jq
```

### Using monitoring tools
- **Uptime Robot**: Monitor `/api/health` endpoint
- **Datadog**: Use HTTP check on `/api/health/detailed`
- **New Relic**: Configure synthetic monitoring
- **Prometheus**: Scrape `/metrics` endpoint (already configured)

## Response Codes

- `200`: System healthy or degraded (still operational)
- `503`: System unhealthy (critical components down)

## What Gets Checked

✅ PostgreSQL database connectivity and response time  
✅ Redis cache connectivity and response time  
✅ Stellar Horizon API connectivity and response time  
✅ System memory usage  
✅ Disk space (basic check, install `check-disk-space` for details)  
✅ Overall response time  
✅ Process uptime
