#!/usr/bin/env bash
# generate-uptime-report.sh
# Queries Prometheus for 30-day uptime per endpoint and prints a Markdown report.
# Usage: PROMETHEUS_URL=http://localhost:9090 ./generate-uptime-report.sh

set -euo pipefail

PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
REPORT_DIR="${REPORT_DIR:-/tmp/nova-uptime-reports}"
DATE=$(date +%Y-%m)

mkdir -p "$REPORT_DIR"
REPORT_FILE="$REPORT_DIR/uptime-${DATE}.md"

query_uptime() {
  local instance="$1"
  curl -sf "${PROMETHEUS_URL}/api/v1/query" \
    --data-urlencode "query=avg_over_time(probe_success{job=\"blackbox-uptime\",instance=\"${instance}\"}[30d]) * 100" \
    | jq -r '.data.result[0].value[1] // "N/A"'
}

ENDPOINTS=(
  "${API_HEALTH_URL:-http://backend:4000/health}"
  "${FRONTEND_URL:-http://frontend:3000}"
  "${STELLAR_RPC_URL:-https://horizon-testnet.stellar.org}"
)

{
  echo "# Nova Rewards — Monthly Uptime Report (${DATE})"
  echo ""
  echo "Generated: $(date -u '+%Y-%m-%d %H:%M UTC')"
  echo ""
  echo "| Endpoint | 30-day Uptime | SLA Target | Status |"
  echo "|----------|--------------|------------|--------|"

  for endpoint in "${ENDPOINTS[@]}"; do
    uptime=$(query_uptime "$endpoint")
    if [[ "$uptime" == "N/A" ]]; then
      status="⚠️ No data"
    elif (( $(echo "$uptime >= 99.9" | bc -l) )); then
      status="✅ Met"
    else
      status="❌ Breached"
    fi
    printf "| %s | %.3f%% | 99.9%% | %s |\n" "$endpoint" "${uptime:-0}" "$status"
  done

  echo ""
  echo "SLA definition: 99.9% monthly uptime = max ~43 minutes downtime/month."
  echo "Runbook: [docs/ops/incident-response.md](../docs/ops/incident-response.md)"
} | tee "$REPORT_FILE"

echo ""
echo "Report saved to $REPORT_FILE"
