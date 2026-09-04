#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_VERSION="${1:-}"

cd "$SCRIPT_DIR"

echo "=================================================="
echo " HomeLand SaaS Production Updater & Auto-Pruner"
echo "=================================================="

# 1. Update APP_VERSION in .env.public-production if provided
if [[ -n "$TARGET_VERSION" ]]; then
  echo "[-] Setting target version to: $TARGET_VERSION"
  if [[ -f ".env.public-production" ]]; then
    sed -i "s/^APP_VERSION=.*/APP_VERSION=\"$TARGET_VERSION\"/" .env.public-production || true
  fi
fi

# 2. Cleanup dangling tar.gz to free disk space immediately
echo "[-] Step 1/5: Cleaning temporary archive files..."
rm -f "$SCRIPT_DIR"/*.tar.gz 2>/dev/null || true

# 3. Clean Docker Build Cache and dangling images before build to guarantee disk space
echo "[-] Step 2/5: Auto-pruning Docker builder cache and unused images..."
docker builder prune -a -f || true
docker image prune -a -f --filter "until=24h" || true

# 4. Build fresh docker images
echo "[-] Step 3/5: Building Docker production images..."
docker compose --env-file .env.public-production -f docker-compose.public-production.yml build

# 5. Start / recreate containers
echo "[-] Step 4/5: Recreating and starting containers..."
docker compose --env-file .env.public-production -f docker-compose.public-production.yml up -d --remove-orphans

# 6. Post-build prune to remove old intermediate images
echo "[-] Step 5/5: Post-deploy cleanup of dangling images..."
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
