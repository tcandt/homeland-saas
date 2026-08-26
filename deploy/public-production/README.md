# HomeLand Public Production Bundle

Production domain: `https://homeland.ductinh.one`

This bundle is the clean production upload set for a fresh VPS rebuild. It keeps the existing public port layout and assumes the Cloudflare Tunnel will continue forwarding to the web container on `localhost:49187`.

## Ports

| Service | Host URL |
| --- | --- |
| Web | `http://localhost:49187` |
| API | `http://localhost:49188/api/v1` |
| PostgreSQL | `localhost:49189` |
| Redis | `localhost:49190` |
| Notification worker | no public port |

The web app calls the API through same-origin `/api/v1`, so Cloudflare Tunnel only needs to target `http://localhost:49187`.

## Fresh reset

For a full wipe-and-rebuild on the VPS:

```bash
cp deploy/public-production/.env.public-production.example deploy/public-production/.env.public-production
nano deploy/public-production/.env.public-production
bash deploy/public-production/reset-public-production.sh
```

For a one-command Ubuntu VPS bootstrap on a clean server:

```bash
cd /path/to/homeland-saas/deploy/public-production
sudo bash setup-public-production-ubuntu.sh
```

What the reset script does:

1. Stops the current production stack and removes named volumes for PostgreSQL, Redis cache state, attachments, backups, and runtime state.
2. Starts PostgreSQL and Redis again on the same ports.
3. Resets the database schema from the current Prisma model and seeds a fresh dataset.
4. Starts `api`, `notification_worker`, and `web`.

What the Ubuntu setup script does:

1. Installs Docker Engine and Docker Compose plugin if missing.
2. Copies `.env.public-production.example` to `.env.public-production` when needed.
3. Generates strong defaults for `POSTGRES_PASSWORD`, `JWT_SECRET`, `INTERNAL_API_TOKEN`, and `MAINTENANCE_BYPASS_KEY` if still placeholders.
4. Forces `APP_URL` and `CORS_ORIGINS` to `https://homeland.ductinh.one`.
5. Runs the full reset script to rebuild PostgreSQL, Redis, API, worker, and web.
6. Starts Cloudflare Tunnel automatically if `CLOUDFLARE_TUNNEL_TOKEN` is present in the env file.

Default seeded login after reset:

- Email: `admin@homeland.vn`
- Password: `admin123456`
- First login must change password when `SEED_FORCE_PASSWORD_CHANGE=true`

## Manual start

Source-build mode:

```bash
docker compose --env-file deploy/public-production/.env.public-production -f deploy/public-production/docker-compose.public-production.yml up -d --build
```

Registry mode:

```bash
docker login ghcr.io
docker compose --env-file deploy/public-production/.env.public-production -f deploy/public-production/docker-compose.registry-production.yml pull
docker compose --env-file deploy/public-production/.env.public-production -f deploy/public-production/docker-compose.registry-production.yml up -d
```

## Required production changes before public exposure

These values must not stay at placeholder defaults:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `INTERNAL_API_TOKEN`
- `MAINTENANCE_BYPASS_KEY`
- any real S3/R2 credentials if object storage is enabled

## Production verdict

Current state is close to production-ready for a single VPS deployment, with these characteristics:

- `notification_worker` already runs out-of-process when `COMMUNICATION_IMMEDIATE_DELIVERY=false`
- same-origin web to API routing reduces browser-side cross-origin overhead
- SePay multi-account routing is now backed by DB routing plus historical payment snapshots
- transaction history already exposes unmatched and needs-review webhook traffic for manual reconciliation

Remaining operational gaps:

1. Storage is still `local` by default. This is acceptable for one VPS, but not enough for stronger disaster recovery.
2. In-app system update is present, but production rollout should still rely on reviewed deploy artifacts and evidence, not blind in-place updates.
3. Seeded default admin credentials are intentionally weak for bootstrap convenience. Treat them as temporary only.

## Performance notes

Recommended settings for smoother production behavior:

- keep `COMMUNICATION_IMMEDIATE_DELIVERY=false`
- keep `notification_worker` running
- do not expose PostgreSQL or Redis publicly beyond server-local/admin access
- prefer GHCR immutable tags in registry mode when release artifacts already exist
- move to S3/R2 storage once production documents and attachments grow

## Verification

After deploy:

```bash
curl -i http://localhost:49188/api/v1/health
curl -i http://localhost:49188/api/v1/health/ready
curl -I https://homeland.ductinh.one
docker compose --env-file deploy/public-production/.env.public-production -f deploy/public-production/docker-compose.public-production.yml ps
```

Optional release checks before shipping:

```bash
npm run bundle-preflight:prod -- --env-file deploy/public-production/.env.public-production
npm run release-evidence:prod -- --env-file deploy/public-production/.env.public-production
```

## Optional systemd timers

Template files are available in [deploy/public-production/systemd](C:/Users/tinhy/Music/homeland-saas/deploy/public-production/systemd):

- `homeland-backup-cycle.service`
- `homeland-backup-cycle.timer`
- `homeland-restore-drill.service`
- `homeland-restore-drill.timer`
