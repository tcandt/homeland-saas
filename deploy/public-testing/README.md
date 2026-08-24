# HomeLand Public Testing Bundle

This bundle runs a separate Docker stack for public testing without changing the default local ports.

## Ports

| Service | Host URL |
| --- | --- |
| Web | `http://localhost:43187` |
| API | `http://localhost:43188/api/v1` |
| PostgreSQL | `localhost:43189` |
| Redis | `localhost:43190` |

The web app calls the API through same-origin `/api/v1`, so testers only need the web URL.

## Start

If `homeland-public-testing-images.tar` is present, load the prebuilt images first:

```bash
docker load -i homeland-public-testing-images.tar
```

Then start the stack:

```bash
cp deploy/public-testing/env.public-testing.example deploy/public-testing/env.public-testing
docker compose --env-file deploy/public-testing/env.public-testing -f deploy/public-testing/docker-compose.public-testing.yml up -d --build
```

If the images were loaded from tar and you do not want to rebuild:

```bash
docker compose --env-file deploy/public-testing/env.public-testing -f deploy/public-testing/docker-compose.public-testing.yml up -d
```

## Stop

```bash
docker compose --env-file deploy/public-testing/env.public-testing -f deploy/public-testing/docker-compose.public-testing.yml down
```

## Notes

- Copy `env.public-testing.example` to `env.public-testing` and fill real values before starting.
- Existing development files such as `.env`, `docker-compose.yml`, and `docker-compose.app.yml` are not modified.
- `SYSTEM_UPDATE_MODE` remains `dry-run` for testing safety.
- `RUN_DB_MIGRATIONS=false` by default. Set it to `true` only when reviewed migrations should run on startup.
- This stack uses a new PostgreSQL volume. Import a database backup into `homeland_public_testing_postgres_testing_data` if existing settings/data must be preserved.
