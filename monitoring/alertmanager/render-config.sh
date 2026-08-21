#!/bin/sh
set -eu

input=/etc/alertmanager/alertmanager.tmpl.yml
output=/tmp/alertmanager.yml

slack_webhook_url=${SLACK_WEBHOOK_URL:-https://hooks.slack.com/services/YOUR/WEBHOOK/URL}
pagerduty_service_key=${PAGERDUTY_SERVICE_KEY:-not-configured}

awk -v slack_webhook_url="$slack_webhook_url" \
    -v pagerduty_service_key="$pagerduty_service_key" '
function replace_token(text, token, value, position) {
  while ((position = index(text, token)) > 0) {
    text = substr(text, 1, position - 1) value substr(text, position + length(token))
  }
  return text
}
{
  line = replace_token($0, "${SLACK_WEBHOOK_URL}", slack_webhook_url)
  line = replace_token(line, "${PAGERDUTY_SERVICE_KEY}", pagerduty_service_key)
  print line
}
' "$input" > "$output"

exec /bin/alertmanager "$@" --config.file="$output"
