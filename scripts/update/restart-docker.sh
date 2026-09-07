#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${HOMELAND_ROOT:-$(pwd)}"
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
STOP_TIMEOUT_SECONDS="${SYSTEM_UPDATE_STOP_TIMEOUT_SECONDS:-30}"

log() {
  printf '[docker-update] %s\n' "$1"
}

env_value() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" \
    | tail -n 1 \
    | sed -E "s/^[^=]+=//; s/^[[:space:]]*//; s/[[:space:]]*$//; s/^\"//; s/\"$//"
}

absolute_from_root() {
  local root="$1"
  local candidate="$2"
  if [[ "$candidate" == /* ]]; then
    printf '%s\n' "$candidate"
  else
    printf '%s/%s\n' "$root" "$candidate"
  fi
}

command -v docker >/dev/null 2>&1 || {
  echo "Docker CLI is required. Run this updater on the Docker host or in a dedicated updater service." >&2
  exit 2
}
docker compose version >/dev/null

compose_files=()
env_file="${HOMELAND_ENV_FILE:-}"

if [[ -n "${HOMELAND_COMPOSE_FILE:-}" ]]; then
  compose_files+=("$HOMELAND_COMPOSE_FILE")
elif [[ -f "$ROOT_DIR/docker-compose.public-production.yml" ]]; then
  compose_files+=("$ROOT_DIR/docker-compose.public-production.yml")
elif [[ -f "$ROOT_DIR/deploy/public-production/docker-compose.public-production.yml" ]]; then
  compose_files+=("$ROOT_DIR/deploy/public-production/docker-compose.public-production.yml")
elif [[ -f "$ROOT_DIR/docker-compose.yml" && -f "$ROOT_DIR/docker-compose.app.yml" ]]; then
  compose_files+=("$ROOT_DIR/docker-compose.yml" "$ROOT_DIR/docker-compose.app.yml")
else
  echo "No supported Docker Compose configuration found under $ROOT_DIR." >&2
  exit 2
fi

for index in "${!compose_files[@]}"; do
  compose_files[$index]="$(absolute_from_root "$ROOT_DIR" "${compose_files[$index]}")"
  if [[ ! -f "${compose_files[$index]}" ]]; then
    echo "Compose file not found: ${compose_files[$index]}" >&2
    exit 2
  fi
done

if [[ -z "$env_file" ]]; then
  if [[ -f "$ROOT_DIR/.env.public-production" ]]; then
    env_file="$ROOT_DIR/.env.public-production"
  elif [[ -f "$ROOT_DIR/deploy/public-production/.env.public-production" ]]; then
    env_file="$ROOT_DIR/deploy/public-production/.env.public-production"
  elif [[ -f "$ROOT_DIR/.env" ]]; then
    env_file="$ROOT_DIR/.env"
  fi
else
  env_file="$(absolute_from_root "$ROOT_DIR" "$env_file")"
fi

COMPOSE=(docker compose --project-directory "$ROOT_DIR")
if [[ -n "$env_file" ]]; then
  if [[ ! -f "$env_file" ]]; then
    echo "Environment file not found: $env_file" >&2
    exit 2
  fi
  COMPOSE+=(--env-file "$env_file")
fi
for compose_file in "${compose_files[@]}"; do
  COMPOSE+=(-f "$compose_file")
done

compose() {
  PUBLIC_PRODUCTION_ENV_FILE="$env_file" "${COMPOSE[@]}" "$@"
}

# Recovery may use the previous checkout and the pre-update env file while the
# main build uses an immutable release worktree and the target-version env.
RECOVERY_ROOT="${HOMELAND_RECOVERY_ROOT:-$ROOT_DIR}"
RECOVERY_ROOT="$(cd "$RECOVERY_ROOT" && pwd)"
recovery_env_file="${HOMELAND_RECOVERY_ENV_FILE:-$env_file}"
if [[ -n "$recovery_env_file" ]]; then
  recovery_env_file="$(absolute_from_root "$RECOVERY_ROOT" "$recovery_env_file")"
fi
recovery_compose_files=()
if [[ -n "${HOMELAND_RECOVERY_COMPOSE_FILE:-}" ]]; then
  recovery_compose_files+=("$HOMELAND_RECOVERY_COMPOSE_FILE")
else
  recovery_compose_files+=("${compose_files[@]}")
fi
RECOVERY_COMPOSE=(docker compose --project-directory "$RECOVERY_ROOT")
if [[ -n "$recovery_env_file" ]]; then
  [[ -f "$recovery_env_file" ]] || {
    echo "Recovery environment file not found: $recovery_env_file" >&2
    exit 2
  }
  RECOVERY_COMPOSE+=(--env-file "$recovery_env_file")
fi
for recovery_compose_file in "${recovery_compose_files[@]}"; do
  recovery_compose_file="$(absolute_from_root "$RECOVERY_ROOT" "$recovery_compose_file")"
  [[ -f "$recovery_compose_file" ]] || {
    echo "Recovery Compose file not found: $recovery_compose_file" >&2
    exit 2
  }
  RECOVERY_COMPOSE+=(-f "$recovery_compose_file")
done

recovery_compose() {
  PUBLIC_PRODUCTION_ENV_FILE="$recovery_env_file" RUN_DB_MIGRATIONS=false "${RECOVERY_COMPOSE[@]}" "$@"
}

log "Validating Docker Compose configuration before changing containers."
compose config --quiet
mapfile -t configured_services < <(compose config --services)

has_service() {
  local expected="$1"
  printf '%s\n' "${configured_services[@]}" | grep -Fxq "$expected"
}

for required_service in api web; do
  if ! has_service "$required_service"; then
    echo "Required Compose service is missing: $required_service" >&2
    exit 2
  fi
done

stop_services=(web)
if has_service notification_worker; then
  stop_services+=(notification_worker)
fi
stop_services+=(api)

start_services=(api)
if has_service notification_worker; then
  start_services+=(notification_worker)
fi
start_services+=(web)

log "Checking Prisma migration history before stopping application containers."
migration_history_probe='const { PrismaClient } = require("@prisma/client"); const prisma = new PrismaClient(); (async () => { const [table] = await prisma.$queryRawUnsafe("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1) AS \"exists\"", "_prisma_migrations"); if (!table?.exists) { console.log("SYSTEM_UPDATE_MIGRATION_HISTORY unbaselined"); process.exitCode = 20; return; } const [history] = await prisma.$queryRawUnsafe("SELECT COUNT(*)::int AS \"count\", COUNT(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS \"failed\" FROM \"_prisma_migrations\""); if (!history?.count) { console.log("SYSTEM_UPDATE_MIGRATION_HISTORY unbaselined"); process.exitCode = 20; } else if (history.failed) { console.log("SYSTEM_UPDATE_MIGRATION_HISTORY failed"); process.exitCode = 21; } else { console.log(`SYSTEM_UPDATE_MIGRATION_HISTORY managed ${history.count}`); } })().catch(() => { console.error("Migration history preflight could not query the database."); process.exitCode = 22; }).finally(() => prisma.$disconnect());'
set +e
migration_history_output="$(recovery_compose run --rm --no-deps --entrypoint node api -e "$migration_history_probe" 2>&1)"
migration_history_exit_code=$?
set -e
printf '%s\n' "$migration_history_output"
if (( migration_history_exit_code != 0 )); then
  case "$migration_history_exit_code" in
    20)
      echo "Operational database has no Prisma migration history. Refusing the update before downtime; follow the DBA reconciliation gate in docs/operations/UPDATE_AND_ROLLBACK.md." >&2
      ;;
    21)
      echo "Operational database contains a failed Prisma migration. Resolve it before retrying the update." >&2
      ;;
    *)
      echo "Could not verify Prisma migration history safely; refusing the update before downtime." >&2
      ;;
  esac
  exit 2
fi

declare -A target_container_ids=()
declare -A seen_image_ids=()
declare -A old_image_refs=()
old_image_ids=()

log "Capturing the exact application image IDs currently used by Compose."
for service in "${stop_services[@]}"; do
  while IFS= read -r container_id; do
    [[ -n "$container_id" ]] || continue
    target_container_ids["$container_id"]=1
    image_id="$(docker inspect --format '{{.Image}}' "$container_id")"
    image_ref="$(docker inspect --format '{{.Config.Image}}' "$container_id")"
    log "Captured $service container $container_id on image $image_id ($image_ref)."
    if [[ -n "$image_id" && -z "${seen_image_ids[$image_id]:-}" ]]; then
      seen_image_ids["$image_id"]=1
      old_image_refs["$image_id"]="$image_ref"
      old_image_ids+=("$image_id")
    fi
  done < <(compose ps --all -q "$service")
done

# The application container must never stop itself mid-update. Docker control is
# intentionally host-side (or delegated to a separate updater container).
runtime_id="${HOSTNAME:-}"
if (( ${#runtime_id} >= 12 )); then
  for container_id in "${!target_container_ids[@]}"; do
    if [[ "$container_id" == "$runtime_id"* || "$runtime_id" == "$container_id"* ]]; then
      echo "Refusing to run from application container $container_id; use the host-side updater." >&2
      exit 2
    fi
  done
fi

# Refuse to plan deletion of a shared image. This happens before downtime.
for image_id in "${old_image_ids[@]}"; do
  tag_count="$(docker image inspect --format '{{len .RepoTags}}' "$image_id")"
  if (( tag_count > 1 )); then
    echo "Refusing to clean image $image_id because it has $tag_count tags; remove extra aliases first." >&2
    exit 2
  fi
  while IFS= read -r container_id; do
    [[ -n "$container_id" ]] || continue
    if [[ -z "${target_container_ids[$container_id]:-}" ]]; then
      echo "Refusing to clean shared image $image_id; container $container_id also uses it." >&2
      exit 2
    fi
  done < <(docker ps -aq --filter "ancestor=$image_id")
done

log "Pruning dangling Docker images before downtime; active and referenced images are retained."
docker image prune -f

mutation_started=false
deployment_healthy=false

recover_previous_release() {
  local exit_code=$?
  trap - EXIT
  if [[ "$exit_code" -ne 0 && "$mutation_started" == "true" && "$deployment_healthy" != "true" ]]; then
    set +e
    log "Update failed; removing partial application containers and restoring the previous image references."
    compose stop --timeout "$STOP_TIMEOUT_SECONDS" "${stop_services[@]}" >/dev/null 2>&1
    compose rm -f "${stop_services[@]}" >/dev/null 2>&1
    for image_id in "${old_image_ids[@]}"; do
      image_ref="${old_image_refs[$image_id]:-}"
      if [[ -n "$image_ref" && "$image_ref" != sha256:* && "$image_ref" != *@sha256:* ]]; then
        docker image tag "$image_id" "$image_ref" >/dev/null 2>&1
      fi
    done
    if recovery_compose up -d --no-build "${start_services[@]}"; then
      log "Previous application containers were recreated from retained images."
    else
      log "ERROR: automatic application recovery failed; old image IDs were retained for manual recovery."
    fi
  fi
  exit "$exit_code"
}
trap recover_previous_release EXIT

log "Stopping application containers only; PostgreSQL, Redis, and named volumes remain untouched."
mutation_started=true
compose stop --timeout "$STOP_TIMEOUT_SECONDS" "${stop_services[@]}"

# Keep stopped containers and their image IDs until the clean build succeeds.
# They are the recovery point if pull/build fails.
log "Building clean API and Web images from the immutable release source."
compose build --pull --no-cache api web

log "Applying reviewed Prisma migrations in a one-off container before applications start."
PUBLIC_PRODUCTION_ENV_FILE="$env_file" RUN_DB_MIGRATIONS=false \
  "${COMPOSE[@]}" run --rm --no-deps --entrypoint npx api \
  prisma migrate deploy --schema=packages/database/prisma/schema.prisma

log "Removing stopped application containers and starting the updated release."
compose rm -f "${stop_services[@]}"
PUBLIC_PRODUCTION_ENV_FILE="$env_file" RUN_DB_MIGRATIONS=false \
  "${COMPOSE[@]}" up -d --no-build "${start_services[@]}"

api_container_port="${API_CONTAINER_PORT:-$(env_value "$env_file" API_CONTAINER_PORT || true)}"
web_container_port="${WEB_CONTAINER_PORT:-$(env_value "$env_file" WEB_CONTAINER_PORT || true)}"
api_container_port="${api_container_port:-3001}"
web_container_port="${web_container_port:-3000}"
api_binding="$(compose port api "$api_container_port" | tail -n 1)"
web_binding="$(compose port web "$web_container_port" | tail -n 1)"
api_host_port="${api_binding##*:}"
web_host_port="${web_binding##*:}"
[[ "$api_host_port" =~ ^[0-9]+$ ]] || { echo "Unable to resolve published API port: $api_binding" >&2; exit 2; }
[[ "$web_host_port" =~ ^[0-9]+$ ]] || { echo "Unable to resolve published Web port: $web_binding" >&2; exit 2; }

api_health_url="${SYSTEM_UPDATE_API_HEALTH_URL:-http://127.0.0.1:${api_host_port}/api/v1/health/ready}"
web_health_url="${SYSTEM_UPDATE_WEB_HEALTH_URL:-http://127.0.0.1:${web_host_port}/login}"
health_script="$ROOT_DIR/scripts/update/health-check.sh"
if [[ ! -f "$health_script" ]]; then
  echo "Health-check script not found: $health_script" >&2
  exit 2
fi

log "Waiting for API and Web health checks to pass."
bash "$health_script" "$api_health_url" "$web_health_url"
deployment_healthy=true

log "Health checks passed; removing retained old application images when no container uses them."
for image_id in "${old_image_ids[@]}"; do
  referencing_containers="$(docker ps -aq --filter "ancestor=$image_id")"
  if [[ -n "$referencing_containers" ]]; then
    log "Keeping image $image_id because a container still references it."
  elif ! docker image rm "$image_id"; then
    log "Keeping image $image_id because Docker refused safe removal."
  fi
done
log "Pruning dangling images created by the completed build."
if ! docker image prune -f; then
  log "WARNING: dangling image prune failed after a healthy deployment; the new release remains active."
fi
trap - EXIT
log "Docker update completed successfully."
