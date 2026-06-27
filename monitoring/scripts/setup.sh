#!/bin/bash
set -e

echo "🚀 Setting up Nova Rewards Monitoring Stack..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your configuration before starting services"
    exit 0
fi

# Create monitoring network
echo "🌐 Creating monitoring network..."
docker network create nova-rewards_monitoring 2>/dev/null || echo "Network already exists"

# Start monitoring stack
echo "🐳 Starting monitoring services..."
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🔍 Checking service health..."

services=("prometheus:9090" "grafana:3000" "alertmanager:9093")
for service in "${services[@]}"; do
    name="${service%%:*}"
    port="${service##*:}"
    if curl -s "http://localhost:$port" > /dev/null; then
        echo "✅ $name is running on port $port"
    else
        echo "⚠️  $name may not be ready yet on port $port"
    fi
done

echo ""
echo "✨ Monitoring stack setup complete!"
echo ""
echo "📊 Access your dashboards:"
echo "   Grafana:       http://localhost:3000 (admin/admin)"
echo "   Prometheus:    http://localhost:9090"
echo "   Alertmanager:  http://localhost:9093"
echo ""
echo "📚 Next steps:"
echo "   1. Change Grafana admin password"
echo "   2. Configure Slack/PagerDuty in alertmanager.yml"
echo "   3. Import Grafana dashboards"
echo "   4. Test alerts"
