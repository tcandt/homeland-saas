#!/usr/bin/env bash
set -euo pipefail

API_URL="${1:-${SYSTEM_UPDATE_API_HEALTH_URL:-http://127.0.0.1:3001/api/v1/health/ready}}"
WEB_URL="${2:-${SYSTEM_UPDATE_WEB_HEALTH_URL:-http://127.0.0.1:3000/login}}"
TIMEOUT_SECONDS="${SYSTEM_UPDATE_HEALTH_TIMEOUT_SECONDS:-90}"
deadline=$((SECONDS + TIMEOUT_SECONDS))

check_url() {
  local url="$1"
  curl -fsS --max-time 5 "$url" >/dev/null
}

until check_url "$API_URL" && check_url "$WEB_URL"; do
  if (( SECONDS >= deadline )); then
    echo "Health check failed: API=$API_URL WEB=$WEB_URL" >&2
    exit 1
  fi
  sleep 3
done

echo "Health check passed: API=$API_URL WEB=$WEB_URL"
