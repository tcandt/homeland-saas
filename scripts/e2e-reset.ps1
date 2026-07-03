# Script to reset DB and seed for E2E Tests
Write-Host "Rebuilding Docker containers..."
docker compose down -v
docker compose up --build -d

Write-Host "Waiting for database to be ready..."
Start-Sleep -Seconds 10

Write-Host "Pushing Prisma Schema..."
npx prisma db push --schema=packages/database/prisma/schema.prisma --accept-data-loss

Write-Host "Seeding Test Data..."
# Setup a custom e2e seed script if needed, or just use the default
npx prisma db seed

Write-Host "Environment is ready for Playwright Acceptance Suite!"
