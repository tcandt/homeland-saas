#!/usr/bin/env bash
set -euo pipefail

TARGET_VERSION=""
WORKSPACE="$(pwd)"
UPDATE_ROOT=""
ALLOW_SWITCH="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-version) TARGET_VERSION="${2:-}"; shift 2 ;;
    --workspace) WORKSPACE="${2:-}"; shift 2 ;;
    --update-root) UPDATE_ROOT="${2:-}"; shift 2 ;;
    --allow-switch) ALLOW_SWITCH="true"; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

step() {
  echo "SYSTEM_UPDATE_STEP $1 $2 $3"
}

workspace_path="$(cd "$WORKSPACE" && pwd)"
if [[ -z "$UPDATE_ROOT" ]]; then
  UPDATE_ROOT="$workspace_path/.codex-update"
fi
mkdir -p "$UPDATE_ROOT"
UPDATE_ROOT="$(cd "$UPDATE_ROOT" && pwd)"
export SYSTEM_UPDATE_ROOT="$UPDATE_ROOT"
last_install_path="$UPDATE_ROOT/last-install-manifest.json"
if current_version="$(git -C "$workspace_path" rev-parse HEAD 2>/dev/null)"; then
  :
else
  current_version="${COMMIT_SHA:-${APP_VERSION:-unknown}}"
fi
rollback_release_path=""

step CHECKING 8 "Preparing rollback."
if [[ -z "$TARGET_VERSION" && -f "$last_install_path" ]]; then
  TARGET_VERSION="$(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(p.currentVersion || '')" "$last_install_path")"
fi
if [[ -z "$TARGET_VERSION" ]]; then
  echo "Target rollback version is required." >&2
  exit 2
fi
if [[ ! -f "$last_install_path" ]]; then
  echo "Last install manifest is required to resolve the rollback release." >&2
  exit 2
fi
rollback_release_path="$(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const target=process.argv[2]; console.log(p.currentVersion === target ? (p.previousReleasePath || '') : '')" "$last_install_path" "$TARGET_VERSION")"
rollback_app_version="$(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(p.previousAppVersion || '')" "$last_install_path")"
rollback_commit_sha="$(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const target=process.argv[2]; console.log(p.previousCommitSha || (/^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(target) ? target : ''))" "$last_install_path" "$TARGET_VERSION")"
if [[ -z "$rollback_release_path" || ! -d "$rollback_release_path" ]]; then
  echo "Rollback target does not match a valid previous release in the last install manifest." >&2
  exit 2
fi
if [[ -z "$rollback_app_version" && -f "$rollback_release_path/package.json" ]]; then
  if rollback_declared_version="$(node -p "require(process.argv[1]).version" "$rollback_release_path/package.json" 2>/dev/null)" \
    && [[ "$rollback_declared_version" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$ ]]; then
    rollback_app_version="v${rollback_declared_version#v}"
  fi
fi
if [[ -z "$rollback_commit_sha" ]] && rollback_source_commit="$(git -C "$rollback_release_path" rev-parse 'HEAD^{commit}' 2>/dev/null)" \
  && [[ "$rollback_source_commit" =~ ^[0-9a-fA-F]{40}$|^[0-9a-fA-F]{64}$ ]]; then
  rollback_commit_sha="$rollback_source_commit"
fi

step BACKING_UP 35 "Rollback metadata prepared; database restore remains manual."
switched="false"
restart_requested="false"
final_status="PREPARED"

if [[ "$ALLOW_SWITCH" == "true" || "${SYSTEM_UPDATE_ALLOW_SWITCH:-false}" == "true" ]]; then
  step SWITCHING 70 "Writing rollback active manifest."
  switched="true"
  final_status="ROLLED_BACK"
  cat > "$UPDATE_ROOT/current.json" <<JSON
{
  "releasePath": "$rollback_release_path",
  "targetVersion": "$TARGET_VERSION",
  "targetRef": "$rollback_commit_sha",
  "appVersion": "$rollback_app_version",
  "rolledBackAt": "$(date -Iseconds)",
  "note": "Database restore is not automatic."
}
JSON
  if [[ -n "${SYSTEM_UPDATE_RESTART_COMMAND:-}" ]]; then
    step RESTARTING 90 "Restart command configured; running service restart."
    if [[ -n "$rollback_app_version" ]]; then export APP_VERSION="$rollback_app_version"; else unset APP_VERSION; fi
    if [[ -n "$rollback_commit_sha" ]]; then export COMMIT_SHA="$rollback_commit_sha"; else unset COMMIT_SHA; fi
    export SYSTEM_UPDATE_ROOT="$UPDATE_ROOT"
    bash -lc "$SYSTEM_UPDATE_RESTART_COMMAND"
    restart_requested="true"
  else
    step RESTARTING 90 "No restart command configured; service manager must restart manually."
  fi
else
  step BLOCKED 90 "Rollback target verified, but switching is disabled; set SYSTEM_UPDATE_ALLOW_SWITCH=true after service manager is ready."
fi

manifest_path="$UPDATE_ROOT/last-rollback-manifest.json"
cat > "$manifest_path" <<JSON
{
  "type": "rollback",
  "currentVersion": "$current_version",
  "targetVersion": "$TARGET_VERSION",
  "targetRef": "$rollback_commit_sha",
  "appVersion": "$rollback_app_version",
  "releasePath": "$rollback_release_path",
  "switched": $switched,
  "restartRequested": $restart_requested,
  "status": "$final_status",
  "finishedAt": "$(date -Iseconds)",
  "note": "Database restore is not automatic. Restore the matching dump manually if a migration changed data or schema."
}
JSON

if [[ "$switched" == "true" ]]; then
  step ROLLED_BACK 100 "Rollback runner completed."
else
  step BLOCKED 100 "Rollback was prepared but no active release was switched."
fi
echo "SYSTEM_UPDATE_MANIFEST $manifest_path"
