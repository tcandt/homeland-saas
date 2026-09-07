const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Docker updater retains rollback images, migrates before startup, checks health, then cleans', () => {
  const script = read('scripts/update/restart-docker.sh');
  const orderedMarkers = [
    ['compose validation', 'log "Validating Docker Compose configuration'],
    ['migration history preflight', 'log "Checking Prisma migration history before stopping'],
    ['current image capture', 'log "Capturing the exact application image IDs'],
    ['pre-stop dangling prune', 'log "Pruning dangling Docker images before downtime'],
    ['application stop', 'log "Stopping application containers only'],
    ['clean build', 'log "Building clean API and Web images'],
    ['one-off migration', 'log "Applying reviewed Prisma migrations in a one-off container'],
    ['application container replacement', 'log "Removing stopped application containers'],
    ['published port discovery', 'api_binding="$(compose port api'],
    ['health gate', 'log "Waiting for API and Web health checks'],
    ['old image removal', 'log "Health checks passed; removing retained old application images'],
    ['post-health dangling prune', 'log "Pruning dangling images created by the completed build'],
  ];

  let previousIndex = -1;
  for (const [label, marker] of orderedMarkers) {
    const index = script.indexOf(marker);
    assert.ok(index >= 0, `Missing ${label}: ${marker}`);
    assert.ok(index > previousIndex, `${label} is out of order`);
    previousIndex = index;
  }

  assert.match(script, /stop_services=\(web\)/);
  assert.match(script, /stop_services\+=\(notification_worker\)/);
  assert.match(script, /stop_services\+=\(api\)/);
  assert.match(script, /trap recover_previous_release EXIT/);
  assert.match(script, /recovery_compose up -d --no-build/);
  assert.match(script, /old_image_refs\["\$image_id"\]/);
  assert.match(script, /Refusing to run from application container/);
  assert.match(script, /deployment_healthy=true/);
  assert.match(script, /referencing_containers="\$\(docker ps -aq --filter/);
  assert.match(script, /dangling image prune failed after a healthy deployment/);
  assert.equal((script.match(/docker image prune -f/g) || []).length, 2);
  assert.match(script, /compose build --pull --no-cache api web/);
  assert.match(script, /run --rm --no-deps --entrypoint npx api/);
  assert.match(script, /SYSTEM_UPDATE_MIGRATION_HISTORY unbaselined/);
  assert.match(script, /recovery_compose run --rm --no-deps --entrypoint node api/);
  assert.match(script, /Refusing the update before downtime/);
  assert.match(script, /compose rm -f "\$\{stop_services\[@\]\}"/);
  assert.match(script, /RUN_DB_MIGRATIONS=false[\s\\]*\n[\s\S]*up -d --no-build/);
  assert.doesNotMatch(script, /docker\s+(?:system|volume)\s+prune/);
  assert.doesNotMatch(script, /docker\s+builder\s+prune/);
  assert.doesNotMatch(script, /docker\s+image\s+prune\s+-a/);
  assert.doesNotMatch(script, /docker\s+compose[^\n]*\sdown(?:\s|$)/);
  assert.doesNotMatch(script, /--volumes\b/);
  assert.doesNotMatch(script, /docker\s+image\s+rm\s+--force/);
  assert.doesNotMatch(script, /prisma\s+db\s+push/);
});

test('Docker updater resolves packaged and repository production layouts', () => {
  const script = read('scripts/update/restart-docker.sh');

  assert.match(script, /HOMELAND_COMPOSE_FILE/);
  assert.match(script, /docker-compose\.public-production\.yml/);
  assert.match(script, /deploy\/public-production\/docker-compose\.public-production\.yml/);
  assert.match(script, /docker-compose\.yml/);
  assert.match(script, /docker-compose\.app\.yml/);
  assert.match(script, /--project-directory "\$ROOT_DIR"/);
  assert.match(script, /PUBLIC_PRODUCTION_ENV_FILE="\$env_file"/);
  assert.match(script, /Refusing to clean shared image/);
  assert.match(script, /because it has \$tag_count tags; remove extra aliases first/);
  assert.match(script, /HOMELAND_RECOVERY_ENV_FILE/);

  const productionCompose = read('deploy/public-production/docker-compose.public-production.yml');
  assert.equal(
    (productionCompose.match(/PUBLIC_PRODUCTION_ENV_FILE:-\.env\.public-production/g) || []).length,
    3,
  );
});

test('Public production wrapper locks build source to a verified ref and delegates recovery metadata', () => {
  const script = read('deploy/public-production/update-public-production.sh');

  assert.match(script, /Invalid target version/);
  assert.match(script, /flock -n 9/);
  assert.match(script, /Another production update is already running/);
  assert.match(script, /Target ref must be an immutable 40- or 64-character commit SHA/);
  assert.match(script, /fetch --prune --tags/);
  assert.match(script, /GIT_CONFIG_VALUE_/);
  assert.match(script, /cat-file -e "\$\{TARGET_REF\}\^\{commit\}"/);
  assert.match(script, /for-each-ref[\s\S]*--contains "\$TARGET_SHA"/);
  assert.match(script, /not reachable from a fetched remote branch or release tag/);
  assert.match(script, /rev-parse 'FETCH_HEAD\^\{commit\}'/);
  assert.match(script, /worktree add --detach/);
  assert.match(script, /status --porcelain/);
  assert.match(script, /Refusing to tag mismatched source/);
  assert.match(script, /HOMELAND_RELEASE_ROOT/);
  assert.match(script, /HOMELAND_RELEASE_ROOT is at \$TARGET_SHA, not requested commit/);
  assert.match(script, /HOMELAND_RELEASE_ROOT has no Git metadata/);
  assert.match(script, /APP_VERSION/);
  assert.match(script, /COMMIT_SHA/);
  assert.match(script, /host-current\.json/);
  assert.match(script, /\.backup-/);
  assert.match(script, /trap restore_environment_on_failure EXIT/);
  assert.match(script, /cp -p "\$env_backup" "\$ENV_FILE"/);
  assert.match(script, /update_activated=true[\s\S]*mv -f "\$active_state_temp"/);
  assert.match(script, /new release is healthy, but active-state finalization failed/);
  assert.match(script, /HOMELAND_ROOT="\$SOURCE_ROOT"/);
  assert.match(script, /HOMELAND_COMPOSE_FILE="\$COMPOSE_FILE"/);
  assert.match(script, /HOMELAND_ENV_FILE="\$ENV_FILE"/);
  assert.match(script, /HOMELAND_RECOVERY_ROOT="\$RECOVERY_ROOT"/);
  assert.match(script, /HOMELAND_RECOVERY_COMPOSE_FILE="\$RECOVERY_COMPOSE_FILE"/);
  assert.match(script, /HOMELAND_RECOVERY_ENV_FILE="\$env_backup"/);
  assert.doesNotMatch(script, /HOMELAND_RECOVERY_ROOT="\$SOURCE_ROOT"/);
  assert.match(script, /build metadata with '\+' is unsupported/);
  assert.match(script, /bash "\$RESTART_SCRIPT"/);
  assert.doesNotMatch(script, /docker\s+compose/);
  assert.doesNotMatch(script, /prisma\s+db\s+push/);

  const productionCompose = read('deploy/public-production/docker-compose.public-production.yml');
  assert.doesNotMatch(productionCompose, /APP_VERSION:-v\d+/);
  assert.match(productionCompose, /APP_VERSION:\?APP_VERSION is required/);
});

test('API image contains update runners and startup only applies reviewed migrations', () => {
  const dockerfile = read('Dockerfile.api');
  const entrypoint = read('scripts/docker-api-entrypoint.sh');

  assert.match(dockerfile, /COPY scripts\/update \.\/scripts\/update/);
  assert.match(dockerfile, /scripts\/production-backup\.js/);
  assert.match(dockerfile, /scripts\/production-restore-check\.js/);
  assert.match(dockerfile, /scripts\/check-mojibake\.js/);
  assert.match(entrypoint, /prisma migrate deploy/);
  assert.doesNotMatch(entrypoint, /prisma\s+db\s+push/);
  assert.doesNotMatch(entrypoint, /migrate deploy[^\n]*\|\|\s*true/);
});

test('install runners explicitly mark host-managed env when no env file is mounted', () => {
  const shellRunner = read('scripts/update/install-version.sh');
  const powershellRunner = read('scripts/update/install-version.ps1');
  const shellRollback = read('scripts/update/rollback-version.sh');
  const powershellRollback = read('scripts/update/rollback-version.ps1');

  assert.match(shellRunner, /if \[\[ -f "\$env_path" \]\]; then[\s\S]*backup_args\+=\(--env-file "\$env_path"\)/);
  assert.match(shellRunner, /backup_args\+=\(--env-managed-externally\)/);
  assert.match(shellRunner, /managed by the deployment host/);
  assert.match(powershellRunner, /if \(Test-Path -LiteralPath \$envPath\)[\s\S]*\$backupArgs \+= @\("--env-file", \$envPath\)/);
  assert.match(powershellRunner, /\$backupArgs \+= "--env-managed-externally"/);
  assert.match(powershellRunner, /managed by the deployment host/);
  assert.match(shellRunner, /backup_args\+=\(--pg-dump "\$SYSTEM_UPDATE_PG_DUMP_PATH"\)/);
  assert.match(powershellRunner, /\$backupArgs \+= @\("--pg-dump", \$env:SYSTEM_UPDATE_PG_DUMP_PATH\)/);
  assert.match(shellRunner, /COMMIT_SHA:-\$\{APP_VERSION:-unknown\}/);
  assert.match(shellRollback, /COMMIT_SHA:-\$\{APP_VERSION:-unknown\}/);
  assert.match(powershellRunner, /elseif \(\$env:COMMIT_SHA\)[\s\S]*elseif \(\$env:APP_VERSION\)/);
  assert.match(powershellRollback, /elseif \(\$env:COMMIT_SHA\)[\s\S]*elseif \(\$env:APP_VERSION\)/);

  assert.match(shellRunner, /--target-display-version/);
  assert.match(powershellRunner, /TargetDisplayVersion/);
  assert.match(shellRunner, /Credential-bearing repository URLs are not supported/);
  assert.match(powershellRunner, /Credential-bearing repository URLs are not supported/);
  assert.match(shellRunner, /GIT_CONFIG_VALUE_/);
  assert.match(powershellRunner, /GIT_CONFIG_VALUE_/);
  assert.match(shellRunner, /remote set-url origin "\$REPOSITORY"/);
  assert.match(powershellRunner, /remote set-url origin \$RepositoryUrl/);
  assert.match(shellRunner, /Checked-out source declares/);
  assert.match(powershellRunner, /Checked-out source declares/);
  assert.match(shellRunner, /export APP_VERSION="\$expected_version"/);
  assert.match(shellRunner, /export COMMIT_SHA="\$source_commit"/);
  assert.match(shellRunner, /"targetRef": "\$source_commit"/);
  assert.match(shellRunner, /write_release_env_value "\$release_path\/\.env" SYSTEM_UPDATE_ROOT/);
  assert.match(powershellRunner, /\$env:APP_VERSION = \$expectedDisplayVersion/);
  assert.match(powershellRunner, /\$env:COMMIT_SHA = \$sourceCommit/);
  assert.match(powershellRunner, /targetRef = \$sourceCommit/);
  assert.match(powershellRunner, /Set-ReleaseEnvValue[^\n]*SYSTEM_UPDATE_ROOT/);
  assert.match(shellRunner, /step BLOCKED 100 "Release preparation completed/);
  assert.match(powershellRunner, /Write-Step "BLOCKED" 100 "Release preparation completed/);
  assert.match(shellRollback, /Rollback target does not match a valid previous release/);
  assert.match(powershellRollback, /Rollback target does not match a valid previous release/);
  assert.match(shellRollback, /rollback_release_path\/package\.json/);
  assert.match(powershellRollback, /Join-Path \$rollbackReleasePath "package\.json"/);
  assert.doesNotMatch(shellRunner, /https:\/\/\$\{?(?:SYSTEM_UPDATE_GITHUB_TOKEN|GITHUB_TOKEN|GH_TOKEN)/);

  const pm2Restart = read('scripts/update/restart-pm2.sh');
  assert.match(pm2Restart, /export SYSTEM_UPDATE_ROOT="\$update_root"/);
  assert.match(pm2Restart, /p\.appVersion/);
  assert.match(pm2Restart, /p\.targetRef/);
  assert.match(pm2Restart, /pm2 startOrReload "\$active_root\/ecosystem\.config\.cjs"/);
});

test('both update screens use a native disabled state and only display versions returned by the API', () => {
  const settings = read('apps/web/components/settings/sections/SettingsSystemUpdate.tsx');
  const consolePage = read('apps/web/app/update/page.tsx');

  for (const source of [settings, consolePage]) {
    assert.match(source, /disabled=\{!canInstall\}/);
    assert.match(source, /onClick=\{openInstallConfirmation\}/);
    assert.match(source, /systemUpdateApi\.check\(true\)/);
    assert.match(source, /Hệ thống đang ở phiên bản mới nhất/);
    assert.doesNotMatch(source, /webPackage/);
    assert.doesNotMatch(source, /latestVersion\s*\|\|\s*info\?\.currentVersion/);
  }

  assert.match(settings, /settings-install-disabled-reason/);
  assert.match(consolePage, /update-install-disabled-reason/);
});
