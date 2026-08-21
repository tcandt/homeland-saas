#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${HOMELAND_ROOT:-$(pwd)}"
CURRENT_MANIFEST="${SYSTEM_UPDATE_ROOT:-$ROOT_DIR/.codex-update}/current.json"

if [[ -f "$CURRENT_MANIFEST" ]]; then
  export HOMELAND_RELEASE_PATH
  HOMELAND_RELEASE_PATH="$(node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(p.releasePath || '')" "$CURRENT_MANIFEST")"
fi

cd "${HOMELAND_RELEASE_PATH:-$ROOT_DIR}"
pm2 startOrReload "$ROOT_DIR/ecosystem.config.cjs" --update-env
bash "$ROOT_DIR/scripts/update/health-check.sh"
