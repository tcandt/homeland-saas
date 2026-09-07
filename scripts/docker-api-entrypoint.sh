#!/bin/bash
set -euo pipefail

echo "=========================================="
echo "HomeLand API Docker Entrypoint"
echo "=========================================="

if [ "${RUN_DB_MIGRATIONS:-false}" = "true" ]; then
  echo "1. Applying reviewed database migrations..."
  npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
else
  echo "1. Skipping database migrations (RUN_DB_MIGRATIONS is not true)."
fi

echo "2. Starting the production API..."
exec npm run start:prod --workspace=api
