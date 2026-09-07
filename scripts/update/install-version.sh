#!/usr/bin/env bash
set -euo pipefail

TARGET_REF=""
TARGET_DISPLAY_VERSION=""
REPOSITORY="https://github.com/tcandt/homeland-saas.git"
WORKSPACE="$(pwd)"
UPDATE_ROOT=""
ALLOW_SWITCH="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-version) TARGET_REF="${2:-}"; shift 2 ;;
    --target-display-version) TARGET_DISPLAY_VERSION="${2:-}"; shift 2 ;;
    --repository) REPOSITORY="${2:-}"; shift 2 ;;
    --workspace) WORKSPACE="${2:-}"; shift 2 ;;
    --update-root) UPDATE_ROOT="${2:-}"; shift 2 ;;
    --allow-switch) ALLOW_SWITCH="true"; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$TARGET_REF" ]]; then
  echo "Target ref is required." >&2
  exit 2
fi
if [[ -z "$TARGET_DISPLAY_VERSION" ]]; then
  if [[ "$TARGET_REF" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$ ]]; then
    TARGET_DISPLAY_VERSION="$TARGET_REF"
  else
    echo "Target display version is required when target ref is a commit SHA." >&2
    exit 2
  fi
fi
if [[ ! "$TARGET_REF" =~ ^([0-9a-fA-F]{40}|[0-9a-fA-F]{64}|v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?)$ ]]; then
  echo "Target ref must be an immutable commit SHA or a semantic-version tag." >&2
  exit 2
fi
if [[ ! "$TARGET_DISPLAY_VERSION" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$ ]]; then
  echo "Target display version must be a semantic version." >&2
  exit 2
fi
if [[ "$REPOSITORY" =~ ^https?://[^/@]+:[^/@]+@ ]]; then
  echo "Credential-bearing repository URLs are not supported; use SYSTEM_UPDATE_GITHUB_TOKEN." >&2
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

write_release_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  local temp_file
  temp_file="$(mktemp "${file}.tmp.XXXXXX")"
  if [[ -f "$file" ]]; then
    awk -v key="$key" -v value="$value" '
      BEGIN { written = 0 }
      $0 ~ "^[[:space:]]*" key "[[:space:]]*=" {
        if (!written) print key "=\"" value "\""
        written = 1
        next
      }
      { print }
      END { if (!written) print key "=\"" value "\"" }
    ' "$file" > "$temp_file"
  else
    printf '%s="%s"\n' "$key" "$value" > "$temp_file"
  fi
  chmod 600 "$temp_file"
  mv -f "$temp_file" "$file"
}

clone_target() {
  (
    export GIT_TERMINAL_PROMPT=0
    local token="${SYSTEM_UPDATE_GITHUB_TOKEN:-${GITHUB_TOKEN:-${GH_TOKEN:-}}}"
    if [[ -n "$token" && "$REPOSITORY" == https://github.com/* ]]; then
      local auth_value
      auth_value="$(printf 'x-access-token:%s' "$token" | base64 | tr -d '\r\n')"
      local config_count="${GIT_CONFIG_COUNT:-0}"
      if [[ ! "$config_count" =~ ^[0-9]+$ ]]; then config_count=0; fi
      export "GIT_CONFIG_KEY_${config_count}=http.extraHeader"
      export "GIT_CONFIG_VALUE_${config_count}=Authorization: Basic ${auth_value}"
      export GIT_CONFIG_COUNT="$((config_count + 1))"
    fi
    git clone --no-checkout "$REPOSITORY" "$release_path"
    git -C "$release_path" remote set-url origin "$REPOSITORY"
    git -C "$release_path" checkout --detach "$TARGET_REF"
  )
}

workspace_path="$(cd "$WORKSPACE" && pwd)"
if [[ -z "$UPDATE_ROOT" ]]; then
  UPDATE_ROOT="$workspace_path/.codex-update"
fi
mkdir -p "$UPDATE_ROOT/releases"
UPDATE_ROOT="$(cd "$UPDATE_ROOT" && pwd)"
export SYSTEM_UPDATE_ROOT="$UPDATE_ROOT"

stamp="$(date +%Y%m%d-%H%M%S)"
safe_version="$(echo "$TARGET_DISPLAY_VERSION" | sed -E 's/[^0-9A-Za-z_.-]/_/g')"
release_path="$UPDATE_ROOT/releases/$stamp-$safe_version"
backup_output_root="${SYSTEM_UPDATE_BACKUP_OUTPUT_DIR:-$workspace_path/.codex-backups/system-update}"
mkdir -p "$backup_output_root"
backup_output_root="$(cd "$backup_output_root" && pwd)"
export SYSTEM_UPDATE_BACKUP_OUTPUT_DIR="$backup_output_root"
backup_path="$backup_output_root/$stamp-before-$safe_version"
manifest_path="$UPDATE_ROOT/last-install-manifest.json"
env_path="${SYSTEM_UPDATE_ENV_FILE:-$workspace_path/.env}"

if [[ -e "$release_path" ]]; then
  echo "Release path already exists: $release_path" >&2
  exit 1
fi
mkdir -p "$release_path" "$backup_path"

step CHECKING 5 "Preparing update to $TARGET_DISPLAY_VERSION ($TARGET_REF)."
previous_app_version="${APP_VERSION:-}"
if [[ ! "$previous_app_version" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$ ]]; then
  previous_app_version=""
fi
if [[ -z "$previous_app_version" && -f "$workspace_path/package.json" ]]; then
  if previous_declared_version="$(node -p "require(process.argv[1]).version" "$workspace_path/package.json" 2>/dev/null)" \
    && [[ "$previous_declared_version" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$ ]]; then
    previous_app_version="v${previous_declared_version#v}"
  fi
fi
previous_commit_sha="${COMMIT_SHA:-}"
if [[ ! "$previous_commit_sha" =~ ^[0-9a-fA-F]{40}$|^[0-9a-fA-F]{64}$ ]]; then
  previous_commit_sha=""
fi
if current_version="$(git -C "$workspace_path" rev-parse HEAD 2>/dev/null)"; then
  :
else
  current_version="${COMMIT_SHA:-${APP_VERSION:-unknown}}"
fi
if [[ -z "$previous_commit_sha" && "$current_version" =~ ^[0-9a-fA-F]{40}$|^[0-9a-fA-F]{64}$ ]]; then
  previous_commit_sha="$current_version"
fi

step BACKING_UP 20 "Backing up available env and metadata."
if [[ -f "$env_path" ]]; then
  cp "$env_path" "$backup_path/.env"
fi
cat > "$backup_path/metadata.json" <<JSON
{
  "currentVersion": "$current_version",
  "targetVersion": "$TARGET_DISPLAY_VERSION",
  "requestedTargetRef": "$TARGET_REF",
  "createdAt": "$(date -Iseconds)",
  "workspace": "$workspace_path"
}
JSON

storage_dir="${SYSTEM_UPDATE_STORAGE_DIR:-$(env_value "$env_path" STORAGE_DIR || true)}"
if [[ -z "$storage_dir" ]]; then
  storage_dir="$workspace_path/storage"
fi

step BACKING_UP 28 "Creating production backup bundle."
backup_args=(
  "$workspace_path/scripts/production-backup.js"
  --output-dir "$backup_output_root"
  --storage-dir "$storage_dir"
)
if [[ -f "$env_path" ]]; then
  backup_args+=(--env-file "$env_path")
else
  backup_args+=(--env-managed-externally)
  step BACKING_UP 28 "Env file is managed by the deployment host and is not mounted in the API container."
fi
if [[ -n "${SYSTEM_UPDATE_PG_DUMP_PATH:-}" ]]; then
  backup_args+=(--pg-dump "$SYSTEM_UPDATE_PG_DUMP_PATH")
fi
node "${backup_args[@]}"
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
clone_target
source_commit="$(git -C "$release_path" rev-parse 'HEAD^{commit}')"
source_version="$(node -p "require(process.argv[1]).version" "$release_path/package.json")"
source_version="v${source_version#v}"
expected_version="v${TARGET_DISPLAY_VERSION#v}"
if [[ "$source_version" != "$expected_version" ]]; then
  echo "Checked-out source declares $source_version, expected $expected_version." >&2
  exit 1
fi
if [[ -f "$env_path" ]]; then
  cp "$env_path" "$release_path/.env"
fi
write_release_env_value "$release_path/.env" APP_VERSION "$expected_version"
write_release_env_value "$release_path/.env" COMMIT_SHA "$source_commit"
write_release_env_value "$release_path/.env" SYSTEM_UPDATE_ROOT "$UPDATE_ROOT"
write_release_env_value "$release_path/.env" SYSTEM_UPDATE_BACKUP_OUTPUT_DIR "$backup_output_root"

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
final_status="PREPARED"
if [[ "$ALLOW_SWITCH" == "true" || "${SYSTEM_UPDATE_ALLOW_SWITCH:-false}" == "true" ]]; then
  step SWITCHING 90 "Writing active version manifest."
  switched="true"
  final_status="DONE"
  cat > "$UPDATE_ROOT/current.json" <<JSON
{
  "releasePath": "$release_path",
  "targetVersion": "$TARGET_DISPLAY_VERSION",
  "targetRef": "$source_commit",
  "appVersion": "$expected_version",
  "previousReleasePath": "$workspace_path",
  "previousVersion": "$current_version",
  "backupPath": "$backup_bundle_path",
  "activatedAt": "$(date -Iseconds)"
}
JSON
  if [[ -n "${SYSTEM_UPDATE_RESTART_COMMAND:-}" ]]; then
    step RESTARTING 94 "Restart command configured; running service restart."
    restart_requested="true"
    export APP_VERSION="$expected_version"
    export COMMIT_SHA="$source_commit"
    export SYSTEM_UPDATE_ROOT="$UPDATE_ROOT"
    export SYSTEM_UPDATE_BACKUP_OUTPUT_DIR="$backup_output_root"
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
  "targetRef": "$previous_commit_sha",
  "appVersion": "$previous_app_version",
  "rolledBackFrom": "$TARGET_DISPLAY_VERSION",
  "backupPath": "$backup_bundle_path",
  "activatedAt": "$(date -Iseconds)"
}
JSON
        if [[ -n "$previous_app_version" ]]; then
          export APP_VERSION="$previous_app_version"
        else
          unset APP_VERSION
        fi
        if [[ -n "$previous_commit_sha" ]]; then
          export COMMIT_SHA="$previous_commit_sha"
        else
          unset COMMIT_SHA
        fi
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
  step BLOCKED 90 "Release prepared, but switching is disabled; activate it with the host updater or service manager."
fi

cat > "$manifest_path" <<JSON
{
  "type": "install",
  "currentVersion": "$current_version",
  "targetVersion": "$TARGET_DISPLAY_VERSION",
  "targetRef": "$source_commit",
  "requestedTargetRef": "$TARGET_REF",
  "previousAppVersion": "$previous_app_version",
  "previousCommitSha": "$previous_commit_sha",
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
  if [[ "$switched" == "true" ]]; then
    step DONE 100 "Update runner completed."
  else
    step BLOCKED 100 "Release preparation completed; the active version was not switched."
  fi
else
  step FAILED 100 "Update runner failed; app rollback attempted according to manifest."
fi
echo "SYSTEM_UPDATE_MANIFEST $manifest_path"
exit "$runner_exit_code"
