#!/usr/bin/env bash
set -euo pipefail

TARGET_VERSION=""
REPOSITORY="https://github.com/tcandt/homeland-saas.git"
WORKSPACE="$(pwd)"
UPDATE_ROOT=""
ALLOW_SWITCH="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-version) TARGET_VERSION="${2:-}"; shift 2 ;;
    --repository) REPOSITORY="${2:-}"; shift 2 ;;
    --workspace) WORKSPACE="${2:-}"; shift 2 ;;
    --update-root) UPDATE_ROOT="${2:-}"; shift 2 ;;
    --allow-switch) ALLOW_SWITCH="true"; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$TARGET_VERSION" ]]; then
  echo "Target version is required." >&2
  exit 2
fi

step() {
  echo "SYSTEM_UPDATE_STEP $1 $2 $3"
}

env_value() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" | head -n 1 | sed -E "s/^[^=]+=//; s/^\"//; s/\"$//"
}

workspace_path="$(cd "$WORKSPACE" && pwd)"
if [[ -z "$UPDATE_ROOT" ]]; then
  UPDATE_ROOT="$workspace_path/.codex-update"
fi
mkdir -p "$UPDATE_ROOT/releases" "$workspace_path/.codex-backups/system-update"

stamp="$(date +%Y%m%d-%H%M%S)"
safe_version="$(echo "$TARGET_VERSION" | sed -E 's/[^0-9A-Za-z_.-]/_/g')"
release_path="$UPDATE_ROOT/releases/$stamp-$safe_version"
backup_path="$workspace_path/.codex-backups/system-update/$stamp-before-$safe_version"
manifest_path="$UPDATE_ROOT/last-install-manifest.json"
env_path="$workspace_path/.env"

if [[ -e "$release_path" ]]; then
  echo "Release path already exists: $release_path" >&2
  exit 1
fi
mkdir -p "$release_path" "$backup_path"

step CHECKING 5 "Preparing update to $TARGET_VERSION."
current_version="$(git -C "$workspace_path" rev-parse HEAD)"

step BACKING_UP 20 "Backing up env and metadata."
if [[ -f "$env_path" ]]; then
  cp "$env_path" "$backup_path/.env"
fi
cat > "$backup_path/metadata.json" <<JSON
{
  "currentVersion": "$current_version",
  "targetVersion": "$TARGET_VERSION",
  "createdAt": "$(date -Iseconds)",
  "workspace": "$workspace_path"
}
JSON

database_backup=""
database_url="$(env_value "$env_path" DATABASE_URL || true)"
pg_dump_bin="${SYSTEM_UPDATE_PG_DUMP_PATH:-pg_dump}"
if [[ -n "$database_url" ]] && command -v "$pg_dump_bin" >/dev/null 2>&1; then
  step BACKING_UP 28 "Creating database backup."
  database_backup="$backup_path/database.dump"
  "$pg_dump_bin" "$database_url" -F c -f "$database_backup"
  step BACKING_UP 35 "Database backup created."
else
  step BACKING_UP 35 "Database backup skipped; DATABASE_URL or pg_dump unavailable."
fi

step DOWNLOADING 42 "Cloning target source into isolated release directory."
git clone --no-checkout "$REPOSITORY" "$release_path"
git -C "$release_path" checkout "$TARGET_VERSION"
if [[ -f "$env_path" ]]; then
  cp "$env_path" "$release_path/.env"
fi

npm_bin="${SYSTEM_UPDATE_NPM_PATH:-npm}"
if [[ "${SYSTEM_UPDATE_RUN_BUILD:-true}" != "false" ]]; then
  step BUILDING 56 "Installing dependencies from lockfile."
  "$npm_bin" ci --prefix "$release_path"
  step BUILDING 68 "Building release."
  "$npm_bin" run build --prefix "$release_path"
else
  step BUILDING 68 "Build skipped by SYSTEM_UPDATE_RUN_BUILD=false."
fi

step MIGRATING 76 "Migration is not applied automatically by this runner."
step HEALTH_CHECK 84 "Running source preflight checks."
node "$release_path/scripts/check-mojibake.js"

switched="false"
restart_requested="false"
if [[ "$ALLOW_SWITCH" == "true" || "${SYSTEM_UPDATE_ALLOW_SWITCH:-false}" == "true" ]]; then
  step SWITCHING 90 "Writing active version manifest."
  switched="true"
  cat > "$UPDATE_ROOT/current.json" <<JSON
{
  "releasePath": "$release_path",
  "targetVersion": "$TARGET_VERSION",
  "backupPath": "$backup_path",
  "activatedAt": "$(date -Iseconds)"
}
JSON
  if [[ -n "${SYSTEM_UPDATE_RESTART_COMMAND:-}" ]]; then
    step RESTARTING 94 "Restart command configured; running service restart."
    bash -lc "$SYSTEM_UPDATE_RESTART_COMMAND"
    restart_requested="true"
  else
    step RESTARTING 94 "No restart command configured; service manager must restart manually."
  fi
else
  step SWITCHING 90 "Switch skipped; set SYSTEM_UPDATE_ALLOW_SWITCH=true after service manager is ready."
fi

cat > "$manifest_path" <<JSON
{
  "type": "install",
  "currentVersion": "$current_version",
  "targetVersion": "$TARGET_VERSION",
  "previousReleasePath": "$workspace_path",
  "releasePath": "$release_path",
  "backupPath": "$backup_path",
  "databaseBackup": "$database_backup",
  "switched": $switched,
  "restartRequested": $restart_requested,
  "finishedAt": "$(date -Iseconds)"
}
JSON

step DONE 100 "Update runner completed."
echo "SYSTEM_UPDATE_MANIFEST $manifest_path"
