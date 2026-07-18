# Health Check Endpoints

## Overview
The health check endpoints provide monitoring capabilities for the NovaRewards backend system, allowing you to verify the status of all critical components.

## Endpoints

### Basic Health Check
```
GET /api/health
```

Simple endpoint that returns 200 if the server is running. Use this for basic uptime monitoring.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

### Detailed Health Check
```
GET /api/health/detailed
```

Comprehensive health check that monitors all system components and returns detailed status information.

**Response (200 - Healthy):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-03-29T10:30:00.000Z",
    "responseTime": "150ms",
    "uptime": "3600.50s",
    "environment": "production",
    "checks": {
      "database": {
        "status": "healthy",
        "responseTime": 45,
        "error": null
      },
      "cache": {
        "status": "healthy",
        "responseTime": 12,
        "error": null
      },
      "stellar": {
        "status": "healthy",
        "responseTime": 320,
        "error": null,
        "network": "testnet",
        "latestLedger": 12345678
      },
      "disk": {
        "status": "healthy",
        "available": "N/A (requires diskusage module)",
        "total": "N/A (requires diskusage module)",
        "percentUsed": "N/A (requires diskusage module)"
      },
      "memory": {
        "status": "healthy",
        "free": "4.25 GB",
        "total": "16.00 GB",
        "percentUsed": "73.44%",
        "processMemory": {
          "rss": "125.50 MB",
          "heapTotal": "45.20 MB",
          "heapUsed": "32.10 MB",
          "external": "2.30 MB"
        }
      }
    }
  }
}
```

**Response (503 - Unhealthy):**
```json
{
  "success": false,
  "data": {
    "status": "unhealthy",
    "timestamp": "2026-03-29T10:30:00.000Z",
    "responseTime": "150ms",
    "uptime": "3600.50s",
    "environment": "production",
    "checks": {
      "database": {
        "status": "unhealthy",
        "responseTime": null,
        "error": "Connection refused"
      }
    }
  }
}
```

## Health Status Levels

- **healthy**: All systems operational, response times within acceptable thresholds
- **degraded**: Systems operational but with slow response times or non-critical issues
- **unhealthy**: Critical systems (database or cache) are down

## Component Thresholds

| Component | Healthy | Degraded | Unhealthy |
|-----------|---------|----------|-----------|
| Database  | < 1000ms | ≥ 1000ms | Connection failed |
| Cache     | < 500ms | ≥ 500ms | Connection failed |
| Stellar   | < 2000ms | ≥ 2000ms | Connection failed |
| Memory    | < 85% used | ≥ 85% used | N/A |

## Monitoring Integration

### Uptime Monitoring
Use the basic endpoint for simple uptime checks:
```bash
curl https://your-domain.com/api/health
```

### Detailed Monitoring
Use the detailed endpoint for comprehensive monitoring:
```bash
curl https://your-domain.com/api/health/detailed
```

### Alerting
Set up alerts based on:
- HTTP status code 503 (unhealthy)
- `status: "degraded"` in response
- Individual component status
- Response time thresholds

## Future Enhancements

To enable detailed disk space monitoring, install the `check-disk-space` package:
```bash
npm install check-disk-space
```

Then update `healthCheckService.js` to use it for accurate disk metrics.
