#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${HOMELAND_ROOT:-$(pwd)}"
cd "$ROOT_DIR"
docker compose -f docker-compose.yml -f docker-compose.app.yml up -d --build api web
bash "$ROOT_DIR/scripts/update/health-check.sh"
