# HomeLand Public Production Bundle

This bundle is for the production upload set. It is separate from the testing bundle and uses production naming only.

## Ports

| Service | Host URL |
| --- | --- |
| Web | `http://localhost:49187` |
| API | `http://localhost:49188/api/v1` |
| Notification worker | no public port |
| PostgreSQL | `localhost:49189` |
| Redis | `localhost:49190` |

The web app calls the API through same-origin `/api/v1`, so a reverse proxy or Cloudflare Tunnel can point to the web service only.

## Start

From the repository root:

```bash
docker compose --env-file deploy/public-production/env.public-production -f deploy/public-production/docker-compose.public-production.yml up -d --build
```

If images were prebuilt and loaded already:

```bash
docker compose --env-file deploy/public-production/env.public-production -f deploy/public-production/docker-compose.public-production.yml up -d
```

## Registry Pull Mode

For VPS production, prefer immutable images pulled from GHCR instead of building on the host:

```bash
docker login ghcr.io
docker compose --env-file deploy/public-production/env.public-production -f deploy/public-production/docker-compose.registry-production.yml pull
docker compose --env-file deploy/public-production/env.public-production -f deploy/public-production/docker-compose.registry-production.yml up -d
```

Required variables in `deploy/public-production/env.public-production`:

- `API_TAG=<approved-api-tag-or-sha>`
- `WEB_TAG=<approved-web-tag-or-sha>`
- optional `API_IMAGE` / `WEB_IMAGE` when registry path changes
- `STORAGE_PROVIDER=local|s3|r2`
- `STORAGE_DIR=/app/storage` when `STORAGE_PROVIDER=local`

This mode keeps PostgreSQL, Redis, and local attachment storage on the VPS, but API/Web are deployed from reviewed registry artifacts only.

## Stop

```bash
docker compose --env-file deploy/public-production/env.public-production -f deploy/public-production/docker-compose.public-production.yml down
```

Registry mode uses the same command shape with `docker-compose.registry-production.yml`.

## Notes

- This bundle keeps its own PostgreSQL and Redis volumes.
- Local attachment storage persists in `documents_production_storage` when `STORAGE_PROVIDER=local`.
- The bundle also starts `notification_worker` so queue delivery can run out-of-process when `COMMUNICATION_IMMEDIATE_DELIVERY=false`.
- Backup/retention state lives in the `production_backups` volume, and notification worker heartbeat lives in `operations_runtime`.
- `SYSTEM_UPDATE_MODE=enabled` is set for production release flow.
- `docker-compose.registry-production.yml` is the preferred production entrypoint when CI already pushed `API_TAG` and `WEB_TAG` to GHCR.
- Replace `POSTGRES_PASSWORD`, `JWT_SECRET`, `MAINTENANCE_BYPASS_KEY`, and any optional integration secrets before deployment.
- For Cloudflare Tunnel, point the tunnel to `http://localhost:49187` on the server.

## Optional systemd timers

Template files are available in [deploy/public-production/systemd](C:/Users/tinhy/Music/homeland-saas/deploy/public-production/systemd):

- `homeland-backup-cycle.service`
- `homeland-backup-cycle.timer`
- `homeland-restore-drill.service`
- `homeland-restore-drill.timer`

Recommended install flow on Ubuntu:

```bash
sudo cp deploy/public-production/systemd/homeland-*.service /etc/systemd/system/
sudo cp deploy/public-production/systemd/homeland-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now homeland-backup-cycle.timer
sudo systemctl enable --now homeland-restore-drill.timer
systemctl list-timers --all | grep homeland
```

## Production bundle checks

Before deploy:

```bash
npm run bundle-preflight:prod -- --env-file deploy/public-production/env.public-production
npm run release-evidence:prod -- --env-file deploy/public-production/env.public-production
```
