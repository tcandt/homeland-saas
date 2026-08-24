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
backup_output_root="${SYSTEM_UPDATE_BACKUP_OUTPUT_DIR:-$workspace_path/.codex-backups/system-update}"
backup_path="$backup_output_root/$stamp-before-$safe_version"
manifest_path="$UPDATE_ROOT/last-install-manifest.json"
env_path="${SYSTEM_UPDATE_ENV_FILE:-$workspace_path/.env}"

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

storage_dir="${SYSTEM_UPDATE_STORAGE_DIR:-$(env_value "$env_path" STORAGE_DIR || true)}"
if [[ -z "$storage_dir" ]]; then
  storage_dir="$workspace_path/storage"
fi

step BACKING_UP 28 "Creating production backup bundle."
node "$workspace_path/scripts/production-backup.js" \
  --env-file "$env_path" \
  --output-dir "$backup_output_root" \
  --storage-dir "$storage_dir"
backup_manifest="$backup_output_root/latest-manifest.json"
backup_bundle_path="$(node -e "const fs=require('fs'),path=require('path'); const manifest=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(path.join(path.dirname(process.argv[1]), manifest.id || ''))" "$backup_manifest")"

restore_check_args=(
  "$workspace_path/scripts/production-restore-check.js"
  --manifest "$backup_manifest"
  --max-age-hours "${SYSTEM_UPDATE_BACKUP_MAX_AGE_HOURS:-24}"
)
if [[ "${SYSTEM_UPDATE_REQUIRE_OFF_HOST:-false}" == "true" ]]; then
  restore_check_args+=(--require-off-host)
fi
if [[ -n "${SYSTEM_UPDATE_PG_RESTORE_PATH:-}" ]]; then
  restore_check_args+=(--pg-restore "$SYSTEM_UPDATE_PG_RESTORE_PATH")
fi
if [[ "${SYSTEM_UPDATE_SKIP_PG_RESTORE_LIST:-false}" == "true" ]]; then
  restore_check_args+=(--skip-pg-restore-list)
fi

step BACKING_UP 35 "Verifying backup manifest and dump readability."
node "${restore_check_args[@]}"

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
restart_exit_code="null"
auto_rollback_performed="false"
rollback_restart_exit_code="null"
runner_exit_code=0
final_status="DONE"
if [[ "$ALLOW_SWITCH" == "true" || "${SYSTEM_UPDATE_ALLOW_SWITCH:-false}" == "true" ]]; then
  step SWITCHING 90 "Writing active version manifest."
  switched="true"
  cat > "$UPDATE_ROOT/current.json" <<JSON
{
  "releasePath": "$release_path",
  "targetVersion": "$TARGET_VERSION",
  "previousReleasePath": "$workspace_path",
  "previousVersion": "$current_version",
  "backupPath": "$backup_bundle_path",
  "activatedAt": "$(date -Iseconds)"
}
JSON
  if [[ -n "${SYSTEM_UPDATE_RESTART_COMMAND:-}" ]]; then
    step RESTARTING 94 "Restart command configured; running service restart."
    restart_requested="true"
    set +e
    bash -lc "$SYSTEM_UPDATE_RESTART_COMMAND"
    restart_exit_code="$?"
    set -e
    if [[ "$restart_exit_code" != "0" ]]; then
      final_status="FAILED_RESTART"
      runner_exit_code=1
      if [[ "${SYSTEM_UPDATE_AUTO_ROLLBACK:-true}" == "true" ]]; then
        step RESTARTING 97 "Restart/health failed; rolling back active manifest to previous release."
        auto_rollback_performed="true"
        cat > "$UPDATE_ROOT/current.json" <<JSON
{
  "releasePath": "$workspace_path",
  "targetVersion": "$current_version",
  "rolledBackFrom": "$TARGET_VERSION",
  "backupPath": "$backup_bundle_path",
  "activatedAt": "$(date -Iseconds)"
}
JSON
        set +e
        bash -lc "$SYSTEM_UPDATE_RESTART_COMMAND"
        rollback_restart_exit_code="$?"
        set -e
        if [[ "$rollback_restart_exit_code" == "0" ]]; then
          final_status="ROLLED_BACK_AFTER_FAILED_RESTART"
        else
          final_status="ROLLBACK_RESTART_FAILED"
        fi
      else
        step RESTARTING 97 "Restart/health failed; auto rollback is disabled."
      fi
    fi
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
  "backupPath": "$backup_bundle_path",
  "systemMetadataBackupPath": "$backup_path",
  "backupManifest": "$backup_manifest",
  "switched": $switched,
  "restartRequested": $restart_requested,
  "restartExitCode": $restart_exit_code,
  "autoRollbackPerformed": $auto_rollback_performed,
  "rollbackRestartExitCode": $rollback_restart_exit_code,
  "status": "$final_status",
  "finishedAt": "$(date -Iseconds)"
}
JSON

if [[ "$runner_exit_code" == "0" ]]; then
  step DONE 100 "Update runner completed."
else
  step FAILED 100 "Update runner failed; app rollback attempted according to manifest."
fi
echo "SYSTEM_UPDATE_MANIFEST $manifest_path"
exit "$runner_exit_code"
