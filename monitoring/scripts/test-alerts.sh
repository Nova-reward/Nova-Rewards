#!/bin/bash

echo "🧪 Testing Nova Rewards Alert System..."

# Test Alertmanager connectivity
echo "1. Testing Alertmanager..."
if curl -s http://localhost:9093/api/v1/status > /dev/null; then
    echo "✅ Alertmanager is reachable"
else
    echo "❌ Alertmanager is not reachable"
    exit 1
fi

# Send test alert
echo "2. Sending test alert..."
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning",
      "component": "monitoring"
    },
    "annotations": {
      "summary": "Test alert from monitoring setup",
      "description": "This is a test alert to verify the alerting pipeline"
    }
  }]'

echo ""
echo "✅ Test alert sent!"
echo "Check your notification channels (Slack/PagerDuty) for the alert."
