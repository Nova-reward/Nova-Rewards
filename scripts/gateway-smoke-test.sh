#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${GATEWAY_URL:-http://localhost:8080}
PATHS=("/auth/" "/users/" "/rewards/" "/leaderboard/")

for path in "${PATHS[@]}"; do
  url="${BASE_URL}${path}"
  printf 'Checking %s\n' "$url"
  status=$(curl --silent --show-error --retry 3 --retry-delay 2 --max-time 10 --write-out '%{http_code}' --output /dev/null "$url" || echo "000")
  if [[ "$status" == "000" ]]; then
    echo "ERROR: gateway did not return a response for ${path}"
    exit 1
  fi
  if [[ "$status" == "502" || "$status" == "503" || "$status" == "504" ]]; then
    echo "ERROR: upstream unreachable through gateway for ${path} (HTTP ${status})"
    exit 1
  fi
  echo "OK: ${path} responded with HTTP ${status}"

done

echo "Gateway smoke test passed"
