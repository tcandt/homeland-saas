#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_VERSION="${1:-}"

cd "$SCRIPT_DIR"

echo "=================================================="
echo " HomeLand SaaS Production Updater & Auto-Pruner"
echo "=================================================="

# 1. Auto-detect version from package.json if not provided
if [[ -z "$TARGET_VERSION" ]] && [[ -f "package.json" ]]; then
  DETECTED_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.2.4")
  TARGET_VERSION="v${DETECTED_VERSION#v}"
fi

if [[ -n "$TARGET_VERSION" ]]; then
  echo "[-] Target system version: $TARGET_VERSION"
  if [[ -f ".env.public-production" ]]; then
    if grep -q "^APP_VERSION=" .env.public-production; then
      sed -i "s/^APP_VERSION=.*/APP_VERSION=\"$TARGET_VERSION\"/" .env.public-production
    else
      echo "APP_VERSION=\"$TARGET_VERSION\"" >> .env.public-production
    fi
  fi
fi

# 2. Cleanup temporary archives
echo "[-] Step 1/4: Cleaning temporary files..."
rm -f "$SCRIPT_DIR"/*.tar.gz 2>/dev/null || true

# 3. Check disk space - only prune builder cache if disk is critically low (< 2GB)
AVAILABLE_KB=$(df "$SCRIPT_DIR" | awk 'NR==2 {print $4}')
if [[ "$AVAILABLE_KB" -lt 2097152 ]]; then
  echo "[-] Low disk space detected (<2GB). Pruning builder cache to free space..."
  docker builder prune -f --filter "until=48h" || true
fi

# 4. Build Docker production images with layer caching (Fast incremental build)
echo "[-] Step 2/4: Building Docker production images (using cached layers)..."
docker compose --env-file .env.public-production -f docker-compose.public-production.yml build

# 5. Start / recreate containers
echo "[-] Step 3/4: Recreating and starting updated containers..."
docker compose --env-file .env.public-production -f docker-compose.public-production.yml up -d --remove-orphans

echo "[-] Syncing Prisma database schema..."
sleep 2
docker compose --env-file .env.public-production -f docker-compose.public-production.yml exec -T api npx prisma db push --schema=packages/database/prisma/schema.prisma --skip-generate || true

# 6. Post-deploy cleanup of old dangling untagged images
echo "[-] Step 4/4: Post-deploy cleanup of dangling images..."
docker image prune -f || true

echo "=================================================="
echo " Verifying Service Health..."
echo "=================================================="
sleep 5
docker compose --env-file .env.public-production -f docker-compose.public-production.yml ps

if command -v curl &>/dev/null; then
  echo ""
  echo "API Health Check:"
  curl -s http://localhost:49188/api/v1/health/ready || true
  echo ""
fi

echo "=================================================="
echo " Update and auto-cleanup completed successfully!"
echo "=================================================="
