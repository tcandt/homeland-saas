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
last_install_path="$UPDATE_ROOT/last-install-manifest.json"
current_version="$(git -C "$workspace_path" rev-parse HEAD)"
rollback_release_path=""

step CHECKING 8 "Preparing rollback."
if [[ -z "$TARGET_VERSION" && -f "$last_install_path" ]]; then
  TARGET_VERSION="$(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(p.currentVersion || '')" "$last_install_path")"
fi
if [[ -z "$TARGET_VERSION" ]]; then
  echo "Target rollback version is required." >&2
  exit 2
fi
if [[ -f "$last_install_path" ]]; then
  rollback_release_path="$(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const target=process.argv[2]; console.log(p.currentVersion === target ? (p.previousReleasePath || '') : '')" "$last_install_path" "$TARGET_VERSION")"
fi

step BACKING_UP 35 "Rollback metadata prepared; database restore remains manual."
switched="false"
restart_requested="false"

if [[ "$ALLOW_SWITCH" == "true" || "${SYSTEM_UPDATE_ALLOW_SWITCH:-false}" == "true" ]]; then
  step SWITCHING 70 "Writing rollback active manifest."
  switched="true"
  cat > "$UPDATE_ROOT/current.json" <<JSON
{
  "releasePath": "$rollback_release_path",
  "targetVersion": "$TARGET_VERSION",
  "rolledBackAt": "$(date -Iseconds)",
  "note": "Database restore is not automatic."
}
JSON
  if [[ -n "${SYSTEM_UPDATE_RESTART_COMMAND:-}" ]]; then
    step RESTARTING 90 "Restart command configured; running service restart."
    bash -lc "$SYSTEM_UPDATE_RESTART_COMMAND"
    restart_requested="true"
  else
    step RESTARTING 90 "No restart command configured; service manager must restart manually."
  fi
else
  step SWITCHING 90 "Switch skipped; set SYSTEM_UPDATE_ALLOW_SWITCH=true after service manager is ready."
fi

manifest_path="$UPDATE_ROOT/last-rollback-manifest.json"
cat > "$manifest_path" <<JSON
{
  "type": "rollback",
  "currentVersion": "$current_version",
  "targetVersion": "$TARGET_VERSION",
  "releasePath": "$rollback_release_path",
  "switched": $switched,
  "restartRequested": $restart_requested,
  "finishedAt": "$(date -Iseconds)",
  "note": "Database restore is not automatic. Restore the matching dump manually if a migration changed data or schema."
}
JSON

step ROLLED_BACK 100 "Rollback runner completed."
echo "SYSTEM_UPDATE_MANIFEST $manifest_path"
