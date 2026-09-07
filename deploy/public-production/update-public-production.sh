#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_VERSION="${1:-}"
TARGET_REF="${2:-${SYSTEM_UPDATE_TARGET_REF:-}}"

if [[ -n "$TARGET_REF" && ! "$TARGET_REF" =~ ^[0-9a-fA-F]{40}$|^[0-9a-fA-F]{64}$ ]]; then
  echo "Target ref must be an immutable 40- or 64-character commit SHA." >&2
  exit 2
fi

if [[ -f "$SCRIPT_DIR/package.json" ]]; then
  PROJECT_ROOT="$SCRIPT_DIR"
elif [[ -f "$SCRIPT_DIR/../../package.json" ]]; then
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
elif [[ -f "$(pwd)/package.json" ]]; then
  PROJECT_ROOT="$(pwd)"
else
  echo "Unable to locate the HomeLand project root." >&2
  exit 2
fi

if [[ -f "$PROJECT_ROOT/.env.public-production" ]]; then
  ENV_FILE="$PROJECT_ROOT/.env.public-production"
elif [[ -f "$PROJECT_ROOT/deploy/public-production/.env.public-production" ]]; then
  ENV_FILE="$PROJECT_ROOT/deploy/public-production/.env.public-production"
else
  echo ".env.public-production was not found." >&2
  exit 2
fi

command -v flock >/dev/null 2>&1 || { echo "flock is required to serialize production updates." >&2; exit 2; }
mkdir -p "$PROJECT_ROOT/.codex-update"
exec 9>"$PROJECT_ROOT/.codex-update/host-update.lock"
if ! flock -n 9; then
  echo "Another production update is already running." >&2
  exit 2
fi

env_value() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" \
    | tail -n 1 \
    | sed -E "s/^[^=]+=//; s/^[[:space:]]*//; s/[[:space:]]*$//; s/^\"//; s/\"$//"
}

find_production_compose() {
  local root="$1"
  if [[ -f "$root/docker-compose.public-production.yml" ]]; then
    printf '%s\n' "$root/docker-compose.public-production.yml"
  elif [[ -f "$root/deploy/public-production/docker-compose.public-production.yml" ]]; then
    printf '%s\n' "$root/deploy/public-production/docker-compose.public-production.yml"
  else
    return 1
  fi
}

git_remote() {
  (
    export GIT_TERMINAL_PROMPT=0
    local token="${SYSTEM_UPDATE_GITHUB_TOKEN:-${GITHUB_TOKEN:-${GH_TOKEN:-}}}"
    if [[ -z "$token" ]]; then
      token="$(env_value "$ENV_FILE" SYSTEM_UPDATE_GITHUB_TOKEN || true)"
    fi
    if [[ -z "$token" ]]; then
      token="$(env_value "$ENV_FILE" GITHUB_TOKEN || true)"
    fi

    if [[ -n "$token" && "${GIT_REMOTE_URL:-}" == https://github.com/* ]]; then
      command -v base64 >/dev/null 2>&1 || {
        echo "base64 is required for token-authenticated Git fetch." >&2
        exit 2
      }
      local auth_value
      local config_count="${GIT_CONFIG_COUNT:-0}"
      [[ "$config_count" =~ ^[0-9]+$ ]] || config_count=0
      auth_value="$(printf 'x-access-token:%s' "$token" | base64 | tr -d '\r\n')"
      export "GIT_CONFIG_KEY_${config_count}=http.extraHeader"
      export "GIT_CONFIG_VALUE_${config_count}=Authorization: Basic ${auth_value}"
      export GIT_CONFIG_COUNT="$((config_count + 1))"
    fi
    git "$@"
  )
}

docker_tag_version_pattern='^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$'
if [[ -n "$TARGET_VERSION" && ! "$TARGET_VERSION" =~ $docker_tag_version_pattern ]]; then
  echo "Invalid target version: $TARGET_VERSION" >&2
  exit 2
fi
if [[ -n "$TARGET_VERSION" ]]; then
  TARGET_VERSION="v${TARGET_VERSION#v}"
fi

# Build only from a source tree whose commit/version has been verified. A Git
# checkout is materialized as a detached worktree so the live checkout and its
# uncommitted files are never changed by the updater.
SOURCE_ROOT="${HOMELAND_RELEASE_ROOT:-}"
TARGET_SHA=""
if [[ -n "$SOURCE_ROOT" ]]; then
  SOURCE_ROOT="$(cd "$SOURCE_ROOT" && pwd)"
  if [[ -d "$SOURCE_ROOT/.git" || -f "$SOURCE_ROOT/.git" ]]; then
    command -v git >/dev/null 2>&1 || { echo "Git CLI is required to verify HOMELAND_RELEASE_ROOT." >&2; exit 2; }
    git -C "$SOURCE_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
      echo "HOMELAND_RELEASE_ROOT contains invalid Git metadata: $SOURCE_ROOT" >&2
      exit 2
    }
    TARGET_SHA="$(git -C "$SOURCE_ROOT" rev-parse 'HEAD^{commit}')"
    if [[ -n "$TARGET_REF" && "${TARGET_SHA,,}" != "${TARGET_REF,,}" ]]; then
      echo "HOMELAND_RELEASE_ROOT is at $TARGET_SHA, not requested commit $TARGET_REF." >&2
      exit 2
    fi
  elif [[ -n "$TARGET_REF" ]]; then
    echo "Cannot verify target ref $TARGET_REF because HOMELAND_RELEASE_ROOT has no Git metadata." >&2
    exit 2
  fi
elif [[ -d "$PROJECT_ROOT/.git" || -f "$PROJECT_ROOT/.git" ]]; then
  command -v git >/dev/null 2>&1 || { echo "Git CLI is required to resolve the release source." >&2; exit 2; }
  git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
    echo "Project contains Git metadata but is not a valid worktree: $PROJECT_ROOT" >&2
    exit 2
  }
  GIT_REMOTE="${SYSTEM_UPDATE_GIT_REMOTE:-origin}"
  GIT_REMOTE_URL="$(git -C "$PROJECT_ROOT" remote get-url "$GIT_REMOTE")"
  export GIT_REMOTE_URL
  echo "[-] Fetching release refs from Git remote: $GIT_REMOTE"
  git_remote -C "$PROJECT_ROOT" fetch --prune --tags "$GIT_REMOTE"

  if [[ -n "$TARGET_REF" ]]; then
    git -C "$PROJECT_ROOT" cat-file -e "${TARGET_REF}^{commit}" 2>/dev/null || {
      echo "Target commit $TARGET_REF was not fetched from $GIT_REMOTE." >&2
      exit 2
    }
    TARGET_SHA="$(git -C "$PROJECT_ROOT" rev-parse "${TARGET_REF}^{commit}")"
    reachable_ref="$(git -C "$PROJECT_ROOT" for-each-ref --count=1 --format='%(refname)' --contains "$TARGET_SHA" \
      "refs/remotes/$GIT_REMOTE" refs/tags)"
    if [[ -z "$reachable_ref" ]]; then
      echo "Target commit $TARGET_SHA is not reachable from a fetched remote branch or release tag." >&2
      exit 2
    fi
  elif [[ -n "$TARGET_VERSION" ]]; then
    if ! TARGET_SHA="$(git -C "$PROJECT_ROOT" rev-parse "refs/tags/${TARGET_VERSION}^{commit}" 2>/dev/null)"; then
      echo "Release tag $TARGET_VERSION was not found. Pass its immutable commit SHA as the second argument." >&2
      exit 2
    fi
  else
    git_remote -C "$PROJECT_ROOT" fetch "$GIT_REMOTE" HEAD
    TARGET_SHA="$(git -C "$PROJECT_ROOT" rev-parse 'FETCH_HEAD^{commit}')"
  fi

  RELEASES_ROOT="$PROJECT_ROOT/.codex-update/host-releases"
  SOURCE_ROOT="$RELEASES_ROOT/$TARGET_SHA"
  mkdir -p "$RELEASES_ROOT"
  if [[ -e "$SOURCE_ROOT" ]]; then
    [[ -d "$SOURCE_ROOT/.git" || -f "$SOURCE_ROOT/.git" ]] || {
      echo "Existing release path is not a Git worktree: $SOURCE_ROOT" >&2
      exit 2
    }
    existing_sha="$(git -C "$SOURCE_ROOT" rev-parse 'HEAD^{commit}')"
    [[ "$existing_sha" == "$TARGET_SHA" ]] || {
      echo "Existing release worktree does not match target commit $TARGET_SHA." >&2
      exit 2
    }
  else
    git -C "$PROJECT_ROOT" worktree add --detach "$SOURCE_ROOT" "$TARGET_SHA"
  fi
else
  # Packaged deployments have no Git metadata. They are accepted only when the
  # package's embedded version exactly matches the requested version.
  SOURCE_ROOT="$PROJECT_ROOT"
  if [[ -n "$TARGET_REF" ]]; then
    echo "Cannot verify target ref $TARGET_REF because this release has no Git metadata." >&2
    exit 2
  fi
fi

[[ -f "$SOURCE_ROOT/package.json" ]] || { echo "Release package.json not found under $SOURCE_ROOT" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "Node.js is required to verify the release version." >&2; exit 2; }
SOURCE_VERSION="$(node -p "require(process.argv[1]).version" "$SOURCE_ROOT/package.json")"
SOURCE_VERSION="v${SOURCE_VERSION#v}"
if [[ ! "$SOURCE_VERSION" =~ $docker_tag_version_pattern ]]; then
  echo "Source version $SOURCE_VERSION is not safe as a Docker image tag (build metadata with '+' is unsupported)." >&2
  exit 2
fi
if [[ -z "$TARGET_VERSION" ]]; then
  TARGET_VERSION="$SOURCE_VERSION"
elif [[ "$SOURCE_VERSION" != "$TARGET_VERSION" ]]; then
  echo "Refusing to tag mismatched source: requested $TARGET_VERSION, source declares $SOURCE_VERSION." >&2
  exit 2
fi

if [[ -n "$TARGET_SHA" ]]; then
  verified_sha="$(git -C "$SOURCE_ROOT" rev-parse 'HEAD^{commit}')"
  [[ "$verified_sha" == "$TARGET_SHA" ]] || {
    echo "Release source changed while preparing update; expected $TARGET_SHA, got $verified_sha." >&2
    exit 2
  }
  if [[ -n "$(git -C "$SOURCE_ROOT" status --porcelain)" ]]; then
    echo "Release worktree is not clean; refusing to build a mutable source tree: $SOURCE_ROOT" >&2
    exit 2
  fi
fi

if ! COMPOSE_FILE="$(find_production_compose "$SOURCE_ROOT")"; then
  echo "docker-compose.public-production.yml was not found in verified release source." >&2
  exit 2
fi

RESTART_SCRIPT="$SOURCE_ROOT/scripts/update/restart-docker.sh"
if [[ ! -f "$RESTART_SCRIPT" ]]; then
  echo "Docker update runner not found: $RESTART_SCRIPT" >&2
  exit 2
fi

echo "=================================================="
echo " HomeLand SaaS Production Docker Updater"
echo "=================================================="
echo "[-] Operational root: $PROJECT_ROOT"
echo "[-] Release source:   $SOURCE_ROOT"
echo "[-] Target commit:    ${TARGET_SHA:-packaged-release}"
echo "[-] Compose file:     $COMPOSE_FILE"
echo "[-] Environment:      $ENV_FILE"
echo "[-] Target version:   $TARGET_VERSION"

env_backup="${ENV_FILE}.backup-$(date +%Y%m%d-%H%M%S)"
cp -p "$ENV_FILE" "$env_backup"

# Recovery must use the Compose definition that created the currently active
# release, not the target release definition that may itself be broken.
active_state_file="$PROJECT_ROOT/.codex-update/host-current.json"
RECOVERY_ROOT="$PROJECT_ROOT"
if ! RECOVERY_COMPOSE_FILE="$(find_production_compose "$RECOVERY_ROOT")"; then
  echo "Could not resolve the pre-update Compose file under $RECOVERY_ROOT." >&2
  exit 2
fi
if [[ -f "$active_state_file" ]]; then
  mapfile -t active_state < <(node -e "const fs=require('fs'); const s=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); console.log(s.sourceRoot || ''); console.log(s.composeFile || '')" "$active_state_file")
  if (( ${#active_state[@]} != 2 )) || [[ -z "${active_state[0]}" || -z "${active_state[1]}" ]]; then
    echo "Active release state is invalid: $active_state_file" >&2
    exit 2
  fi
  RECOVERY_ROOT="${active_state[0]}"
  RECOVERY_COMPOSE_FILE="${active_state[1]}"
fi
[[ -d "$RECOVERY_ROOT" ]] || { echo "Recovery root does not exist: $RECOVERY_ROOT" >&2; exit 2; }
[[ -f "$RECOVERY_COMPOSE_FILE" ]] || { echo "Recovery Compose file does not exist: $RECOVERY_COMPOSE_FILE" >&2; exit 2; }

mkdir -p "$(dirname "$active_state_file")"
active_state_temp="${active_state_file}.$$"
node -e "const fs=require('fs'); const [file,sourceRoot,composeFile,version,commitSha]=process.argv.slice(1); fs.writeFileSync(file, JSON.stringify({ sourceRoot, composeFile, version, commitSha: commitSha || null, activatedAt: new Date().toISOString() }, null, 2) + '\n', { mode: 0o600 });" \
  "$active_state_temp" "$SOURCE_ROOT" "$COMPOSE_FILE" "$TARGET_VERSION" "$TARGET_SHA"
update_activated=false

restore_environment_on_failure() {
  exit_code=$?
  trap - EXIT
  if [[ "$exit_code" -ne 0 ]]; then
    if [[ "$update_activated" == "true" ]]; then
      echo "[-] The new release is healthy, but active-state finalization failed. The new environment remains active; prepared state is $active_state_temp" >&2
    else
      rm -f "$active_state_temp"
      cp -p "$env_backup" "$ENV_FILE"
      echo "[-] Update failed; restored environment file from $env_backup" >&2
    fi
  fi
  exit "$exit_code"
}
trap restore_environment_on_failure EXIT

if grep -q '^APP_VERSION=' "$ENV_FILE"; then
  sed -i "s/^APP_VERSION=.*/APP_VERSION=\"$TARGET_VERSION\"/" "$ENV_FILE"
else
  printf '\nAPP_VERSION="%s"\n' "$TARGET_VERSION" >> "$ENV_FILE"
fi
if [[ -n "$TARGET_SHA" ]]; then
  if grep -q '^COMMIT_SHA=' "$ENV_FILE"; then
    sed -i "s/^COMMIT_SHA=.*/COMMIT_SHA=\"$TARGET_SHA\"/" "$ENV_FILE"
  else
    printf 'COMMIT_SHA="%s"\n' "$TARGET_SHA" >> "$ENV_FILE"
  fi
elif grep -q '^COMMIT_SHA=' "$ENV_FILE"; then
  sed -i 's/^COMMIT_SHA=.*/COMMIT_SHA=""/' "$ENV_FILE"
fi

echo "[-] Environment backup: $env_backup"
HOMELAND_ROOT="$SOURCE_ROOT" \
HOMELAND_COMPOSE_FILE="$COMPOSE_FILE" \
HOMELAND_ENV_FILE="$ENV_FILE" \
HOMELAND_RECOVERY_ROOT="$RECOVERY_ROOT" \
HOMELAND_RECOVERY_COMPOSE_FILE="$RECOVERY_COMPOSE_FILE" \
HOMELAND_RECOVERY_ENV_FILE="$env_backup" \
bash "$RESTART_SCRIPT"
update_activated=true
mv -f "$active_state_temp" "$active_state_file"
trap - EXIT

echo "=================================================="
echo " Update completed and health checks passed."
echo "=================================================="
