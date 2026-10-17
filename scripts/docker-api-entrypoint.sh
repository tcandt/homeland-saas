#!/bin/bash
set -euo pipefail

echo "=========================================="
echo "HomeLand API Docker Entrypoint"
echo "=========================================="

if [ "${RUN_DB_MIGRATIONS:-false}" = "true" ]; then
  echo "1. Applying reviewed database migrations..."
  node node_modules/prisma/build/index.js migrate deploy --schema=packages/database/prisma/schema.prisma
else
  echo "1. Skipping database migrations (RUN_DB_MIGRATIONS is not true)."
fi

echo "2. Starting the production API..."
# Preserve the former npm workspace cwd (relative storage/config paths depend on
# it) while making Node PID 1 and forwarding shutdown signals directly.
cd apps/api
exec node dist/main
