# Homeland PMS - Production Runbook

## 1. Deployment
To deploy the application to a fresh production environment:

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install dependencies
npm ci

# 3. Build API and Web
npm run build --workspace=api
npm run build --workspace=web

# 4. Start Docker services (PostgreSQL, Redis)
docker compose up -d

# 5. Push Prisma Schema and Seed Data
npx prisma db push --schema=packages/database/prisma/schema.prisma
npx prisma db seed --schema=packages/database/prisma/schema.prisma

# 6. Start the applications using PM2 or Node
npm run start --workspace=api
npm run start --workspace=web
```

## 2. Security and Permissions

### API Protection
*   All endpoints must be protected using `@UseGuards(JwtAuthGuard, PermissionsGuard)`.
*   Specify required permissions using `@RequirePermissions('module.action')`.
*   Public endpoints must use `@Public()`.

### E2E Testing Toggle
*   The environment variable `ENABLE_E2E_TEST_UTILS=true` must **NEVER** be set in production.
*   It exposes bypasses and simulated failures used strictly for the testing suite.

## 3. Database Management

### Migrations
Do not use `db push` for schema changes in production. Use standard migration workflows:
```bash
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

### Backups
Ensure pgvector database backups are configured via standard PostgreSQL backup utilities (pg_dump).

## 4. Monitoring & Troubleshooting
*   **Logs**: Check application logs for unhandled exceptions or 500 status codes.
*   **SSE Issues**: If Real-time updates fail, the frontend will automatically fallback to polling every 5-15 seconds.
*   **Rate Limits**: If users complain about 429 errors during login, verify they are not triggering the brute-force protection logic. Limit can be configured via `THROTTLER_LIMIT`.
