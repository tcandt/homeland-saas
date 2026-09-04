#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${HOMELAND_ROOT:-$(pwd)}"
cd "$ROOT_DIR"

# Clean docker cache and old images before build to ensure free disk space
docker builder prune -a -f || true
docker image prune -f || true

if [[ -f ".env.public-production" && -f "docker-compose.public-production.yml" ]]; then
  docker compose --env-file .env.public-production -f docker-compose.public-production.yml up -d --build --remove-orphans
else
  docker compose -f docker-compose.yml -f docker-compose.app.yml up -d --build api web
fi

# Clean up intermediate dangling images after build
docker image prune -f || true

if [[ -f "$ROOT_DIR/scripts/update/health-check.sh" ]]; then
  bash "$ROOT_DIR/scripts/update/health-check.sh"
fi
