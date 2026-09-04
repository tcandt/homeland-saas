#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_VERSION="${1:-}"

if [[ -f "$SCRIPT_DIR/package.json" ]]; then
  PROJECT_ROOT="$SCRIPT_DIR"
elif [[ -f "$SCRIPT_DIR/../../package.json" ]]; then
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
elif [[ -f "$(pwd)/package.json" ]]; then
  PROJECT_ROOT="$(pwd)"
else
  PROJECT_ROOT="$SCRIPT_DIR"
fi

cd "$PROJECT_ROOT"

COMPOSE_FILE="docker-compose.public-production.yml"
if [[ ! -f "$COMPOSE_FILE" && -f "deploy/public-production/docker-compose.public-production.yml" ]]; then
  COMPOSE_FILE="deploy/public-production/docker-compose.public-production.yml"
fi

ENV_FILE=".env.public-production"
if [[ ! -f "$ENV_FILE" && -f "deploy/public-production/.env.public-production" ]]; then
  ENV_FILE="deploy/public-production/.env.public-production"
fi

echo "=================================================="
echo " HomeLand SaaS Production Updater & Auto-Pruner"
echo "=================================================="
echo "[-] Project Root: $PROJECT_ROOT"
echo "[-] Compose File: $COMPOSE_FILE"
echo "[-] Env File:     $ENV_FILE"

# 1. Auto-detect version from package.json if not provided
if [[ -z "$TARGET_VERSION" ]] && [[ -f "package.json" ]]; then
  DETECTED_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.2.4")
  TARGET_VERSION="v${DETECTED_VERSION#v}"
fi

if [[ -n "$TARGET_VERSION" ]]; then
  echo "[-] Target system version: $TARGET_VERSION"
  if [[ -f "$ENV_FILE" ]]; then
    if grep -q "^APP_VERSION=" "$ENV_FILE"; then
      sed -i "s/^APP_VERSION=.*/APP_VERSION=\"$TARGET_VERSION\"/" "$ENV_FILE"
    else
      echo "APP_VERSION=\"$TARGET_VERSION\"" >> "$ENV_FILE"
    fi
  fi
fi

# 2. Cleanup temporary archives
echo "[-] Step 1/4: Cleaning temporary files..."
rm -f "$PROJECT_ROOT"/*.tar.gz "$SCRIPT_DIR"/*.tar.gz 2>/dev/null || true

# 3. Check disk space - only prune builder cache if disk is critically low (< 2GB)
AVAILABLE_KB=$(df "$PROJECT_ROOT" | awk 'NR==2 {print $4}')
if [[ "$AVAILABLE_KB" -lt 2097152 ]]; then
  echo "[-] Low disk space detected (<2GB). Pruning builder cache to free space..."
  docker builder prune -f --filter "until=48h" || true
fi

# 4. Build Docker production images with layer caching (Fast incremental build)
echo "[-] Step 2/4: Building Docker production images (using cached layers)..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build

# 5. Start / recreate containers
echo "[-] Step 3/4: Recreating and starting updated containers..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --remove-orphans

echo "[-] Syncing Prisma database schema..."
sleep 2
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T api npx prisma db push --schema=packages/database/prisma/schema.prisma --skip-generate || true

# 6. Post-deploy cleanup of old dangling untagged images
echo "[-] Step 4/4: Post-deploy cleanup of dangling images..."
docker image prune -f || true

echo "=================================================="
echo " Verifying Service Health..."
echo "=================================================="
sleep 5
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

if command -v curl &>/dev/null; then
  echo ""
  echo "API Health Check:"
  curl -s http://localhost:49188/api/v1/health/ready || true
  echo ""
fi

echo "=================================================="
echo " Update and auto-cleanup completed successfully!"
echo "=================================================="
