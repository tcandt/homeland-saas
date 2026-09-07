#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${HOMELAND_ROOT:-$(pwd)}"
ROOT_DIR="$(cd "$ROOT_DIR" && pwd)"
update_root="${SYSTEM_UPDATE_ROOT:-$ROOT_DIR/.codex-update}"
if [[ "$update_root" != /* ]]; then
  update_root="$ROOT_DIR/$update_root"
fi
mkdir -p "$update_root"
update_root="$(cd "$update_root" && pwd)"
export SYSTEM_UPDATE_ROOT="$update_root"
CURRENT_MANIFEST="$update_root/current.json"

if [[ -f "$CURRENT_MANIFEST" ]]; then
  mapfile -t active_release < <(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(p.releasePath || ''); console.log(p.appVersion || ''); console.log(p.targetRef || '')" "$CURRENT_MANIFEST")
  HOMELAND_RELEASE_PATH="${active_release[0]:-}"
  [[ -n "$HOMELAND_RELEASE_PATH" ]] || { echo "Active release path is missing from $CURRENT_MANIFEST" >&2; exit 2; }
  export HOMELAND_RELEASE_PATH
  if [[ "${active_release[1]:-}" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$ ]]; then
    export APP_VERSION="${active_release[1]}"
  fi
  if [[ "${active_release[2]:-}" =~ ^[0-9a-fA-F]{40}$|^[0-9a-fA-F]{64}$ ]]; then
    export COMMIT_SHA="${active_release[2]}"
  fi
fi

active_root="${HOMELAND_RELEASE_PATH:-$ROOT_DIR}"
cd "$active_root"
pm2 startOrReload "$active_root/ecosystem.config.cjs" --update-env
bash "$active_root/scripts/update/health-check.sh"
