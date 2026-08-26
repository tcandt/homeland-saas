#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$SCRIPT_DIR}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.public-production}"
ENV_TEMPLATE="${ENV_TEMPLATE:-$APP_DIR/.env.public-production.example}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_DIR/docker-compose.public-production.yml}"
RESET_SCRIPT="${RESET_SCRIPT:-$APP_DIR/reset-public-production.sh}"
DOMAIN="${DOMAIN:-homeland.ductinh.one}"
WEB_URL="https://${DOMAIN}"
API_READY_URL="${API_READY_URL:-http://localhost:49188/api/v1/health/ready}"
CLOUDFLARED_NAME="${CLOUDFLARED_NAME:-homeland_production_cloudflared}"

log() {
  printf '\n==> %s\n' "$1"
}

random_hex() {
  local length="${1:-32}"
  openssl rand -hex "$length"
}

replace_or_append_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=\"${value}\"|g" "$ENV_FILE"
  else
    printf '%s="%s"\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

ensure_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Please run this script with sudo." >&2
    exit 1
  fi
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  log "Installing Docker Engine and Docker Compose plugin"
  apt-get update
  apt-get install -y ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

prepare_env_file() {
  log "Preparing env file"
  if [[ ! -f "$ENV_FILE" ]]; then
    cp "$ENV_TEMPLATE" "$ENV_FILE"
  fi

  local postgres_password jwt_secret internal_token bypass_key
  postgres_password="$(grep '^POSTGRES_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
  jwt_secret="$(grep '^JWT_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
  internal_token="$(grep '^INTERNAL_API_TOKEN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
  bypass_key="$(grep '^MAINTENANCE_BYPASS_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"

  [[ -z "$postgres_password" || "$postgres_password" == replace-with-* ]] && replace_or_append_env "POSTGRES_PASSWORD" "$(random_hex 24)"
  [[ -z "$jwt_secret" || "$jwt_secret" == replace-with-* ]] && replace_or_append_env "JWT_SECRET" "$(random_hex 32)"
  [[ -z "$internal_token" || "$internal_token" == replace-with-* ]] && replace_or_append_env "INTERNAL_API_TOKEN" "$(random_hex 32)"
  [[ -z "$bypass_key" || "$bypass_key" == replace-with-* ]] && replace_or_append_env "MAINTENANCE_BYPASS_KEY" "$(random_hex 16)"

  replace_or_append_env "APP_URL" "$WEB_URL"
  replace_or_append_env "CORS_ORIGINS" "$WEB_URL"
}

start_cloudflared_if_configured() {
  local tunnel_token
  tunnel_token="$(grep '^CLOUDFLARE_TUNNEL_TOKEN=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')"
  if [[ -z "$tunnel_token" ]]; then
    log "Skipping Cloudflare Tunnel start because CLOUDFLARE_TUNNEL_TOKEN is empty"
    return
  fi

  log "Starting Cloudflare Tunnel container"
  docker rm -f "$CLOUDFLARED_NAME" >/dev/null 2>&1 || true
  docker run -d \
    --name "$CLOUDFLARED_NAME" \
    --restart unless-stopped \
    --network host \
    cloudflare/cloudflared:latest \
    tunnel --no-autoupdate run --token "$tunnel_token" >/dev/null
}

run_stack_reset() {
  log "Resetting and starting production stack"
  chmod +x "$RESET_SCRIPT"
  ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" bash "$RESET_SCRIPT"
}

show_summary() {
  log "Checking health"
  local attempts=0
  local max_attempts=20
  local sleep_seconds=5
  until curl -fsS "$API_READY_URL" >/dev/null; do
    attempts=$((attempts + 1))
    if [[ "$attempts" -ge "$max_attempts" ]]; then
      echo "API health check failed after $((max_attempts * sleep_seconds)) seconds: $API_READY_URL" >&2
      docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps || true
      return 1
    fi
    sleep "$sleep_seconds"
  done
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

  cat <<EOF

Setup completed.

Domain: ${WEB_URL}
API ready: ${API_READY_URL}
Admin login: admin@homeland.vn / admin123456

Next actions:
1. Review ${ENV_FILE} and rotate bootstrap credentials after first login.
2. Confirm Cloudflare Tunnel DNS routes to localhost:49187.
3. Verify:
   curl -i ${API_READY_URL}
   curl -I ${WEB_URL}
EOF
}

ensure_root
install_docker
prepare_env_file
run_stack_reset
start_cloudflared_if_configured
show_summary
