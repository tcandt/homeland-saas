#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env.public-production}"
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/docker-compose.public-production.yml}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

echo "==> Stopping production stack and removing named volumes"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down -v --remove-orphans || true

echo "==> Starting PostgreSQL and Redis"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d postgres redis

echo "==> Waiting for PostgreSQL to become ready"
attempts=0
max_attempts=30
sleep_seconds=3
until docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres pg_isready -U homeland -d homeland >/dev/null 2>&1; do
  attempts=$((attempts + 1))
  if [[ "$attempts" -ge "$max_attempts" ]]; then
    echo "PostgreSQL did not become ready in time." >&2
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail 200 postgres || true
    exit 1
  fi
  sleep "$sleep_seconds"
done

echo "==> Resetting database schema and seeding fresh production data"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm --no-deps --entrypoint sh api -lc 'npm run db:reset:prod'

echo "==> Building and starting API and web"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --build api web

echo "==> Starting notification worker"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d notification_worker

echo "==> Current stack status"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

echo
echo "Fresh production reset completed."
echo "Admin login: admin@homeland.vn / admin123456"
echo "Web URL: https://homeland.ductinh.one"
echo "API health: http://localhost:49188/api/v1/health/ready"
