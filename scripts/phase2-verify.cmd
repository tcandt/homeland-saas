@echo off
echo ==================================================
echo [HomeLand Phase 2.1] Backend Verification Script
echo ==================================================

echo.
echo Installing dependencies...
call npm install

echo.
echo Generating Prisma Client...
call npm run db:generate

echo.
echo Pushing schema to SQLite (dev.db)...
call npm run db:push

echo.
echo Seeding database...
call npm run db:seed

echo.
echo Checking seed data...
call npm run db:check-seed

echo.
echo Starting NestJS Backend (apps/api)...
call npm run api:dev

pause
