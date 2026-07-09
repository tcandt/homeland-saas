# Resume Invoice Epic Verification

The verification gate for Epic 04 (Invoice Generation) is currently blocked due to a local infrastructure isolation issue (the agent shell cannot reach the Docker daemon or PostgreSQL on port 5433). 

Please execute the following commands manually in a local terminal (PowerShell or Admin terminal):

```powershell
cd D:\homeland-new\homeland-saas
docker ps
docker compose up -d
netstat -ano | findstr 5433
npm run db:generate
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
npm run verify:prod
```

Once `verify:prod` passes, please return to the AI and confirm that the verification has passed manually to resume Epic closure.
