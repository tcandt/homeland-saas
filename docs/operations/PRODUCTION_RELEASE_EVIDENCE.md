# Production Release Evidence

Date: 2026-08-24
APP_VERSION: v1.1.4
API_TAG: v1.1.4
WEB_TAG: v1.1.4
COMMIT_SHA: replace-with-approved-commit-sha
BUILD_ID: public-production
BUILD_TIME: 2026-08-24T00:00:00Z

## Runtime Targets

- APP_URL: https://homeland.example.com
- API host port: 49188
- Web host port: 49187
- Readiness URL: https://homeland.example.com/api/v1/health/ready

## Required Evidence

- [ ] `npm run host-check:prod -- --path / --min-free-gb 8 --max-used-percent 85 --containers homeland_production_api,homeland_production_web,homeland_production_postgres,homeland_production_redis,homeland_production_cloudflared` passed on the VPS.
- [ ] `npm run bundle-preflight:prod -- --env-file deploy/public-production/env.public-production` passed.
- [ ] `npm run preflight:prod -- --env-file deploy/public-production/env.public-production` passed.
- [ ] `docker compose --env-file deploy/public-production/env.public-production -f deploy/public-production/docker-compose.registry-production.yml pull` completed with the approved tags.
- [ ] `docker compose --env-file deploy/public-production/env.public-production -f deploy/public-production/docker-compose.registry-production.yml up -d` completed.
- [ ] `prisma migrate deploy` outcome recorded, including whether migrations were skipped or applied.
- [ ] `curl -i /api/v1/health` and `/api/v1/health/ready` returned 200 after rollout.
- [ ] Web login smoke passed for admin, adminA, adminB, manager.
- [ ] One small SePay transaction per owner was verified end-to-end.
- [ ] Zalo, Telegram, SMTP test delivery evidence attached.
- [ ] Backup manifest ID and latest restore drill evidence attached.

## Rollback Record

- Previous API_TAG: ____________________
- Previous WEB_TAG: ____________________
- Rollback trigger threshold: health, smoke, 5xx, wrong owner/bank, duplicate payment, broken queue.
- Rollback command: `docker compose --env-file deploy/public-production/env.public-production -f deploy/public-production/docker-compose.registry-production.yml up -d` after restoring previous tags.

## Notes

- Database rollback is not automatic.
- If STORAGE_PROVIDER=local, attachment persistence depends on the `documents_production_storage` Docker volume.
