Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

Write-Host "=================================================="
Write-Host "[HomeLand Phase 2.1] Backend Verification Script"
Write-Host "=================================================="

Write-Host "`nInstalling dependencies..."
npm install

Write-Host "`nGenerating Prisma Client..."
npm run db:generate

Write-Host "`nPushing schema to SQLite (dev.db)..."
npm run db:push

Write-Host "`nSeeding database..."
npm run db:seed

Write-Host "`nChecking seed data..."
npm run db:check-seed

Write-Host "`nStarting NestJS Backend (apps/api)..."
npm run api:dev
