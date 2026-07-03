#!/bin/bash
set -e

echo "=========================================="
echo "HomeLand API Docker Entrypoint"
echo "=========================================="

echo "1. Waiting for PostgreSQL to be ready..."
while ! nc -z postgres 5432; do
  sleep 1
done
echo "PostgreSQL is up and running!"

echo "2. Generating Prisma Client..."
npx prisma generate --schema=packages/database/prisma/schema.prisma

echo "3. Pushing schema to PostgreSQL..."
npx prisma db push --schema=packages/database/prisma/schema.prisma --accept-data-loss

echo "4. Running Seed Script..."
npx prisma db seed --schema=packages/database/prisma/schema.prisma

echo "5. Starting NestJS Backend (apps/api)..."
npm run dev --workspace=api
