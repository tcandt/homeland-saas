const fs = require('fs');
const path = require('path');

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseEnvFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Environment file does not exist: ${resolved}`);
  }

  const env = {};
  const lines = fs.readFileSync(resolved, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function pass(id, message) {
  return { id, status: 'PASS', message };
}

function fail(id, message) {
  return { id, status: 'FAIL', message };
}

function warn(id, message) {
  return { id, status: 'WARN', message };
}

function looksLikeSha(value) {
  return /^[0-9a-f]{7,40}$/i.test(value);
}

function looksLikeVersion(value) {
  return /^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
}

function runProductionBundlePreflight(config) {
  const checks = [];
  const appVersion = stringValue(config.APP_VERSION);
  const apiTag = stringValue(config.API_TAG);
  const webTag = stringValue(config.WEB_TAG);
  const commitSha = stringValue(config.COMMIT_SHA);
  const buildId = stringValue(config.BUILD_ID);
  const buildTime = stringValue(config.BUILD_TIME);
  const appUrl = stringValue(config.APP_URL);
  const corsOrigins = stringValue(config.CORS_ORIGINS);
  const postgresPassword = stringValue(config.POSTGRES_PASSWORD);
  const jwtSecret = stringValue(config.JWT_SECRET);
  const internalApiToken = stringValue(config.INTERNAL_API_TOKEN);
  const maintenanceBypassKey = stringValue(config.MAINTENANCE_BYPASS_KEY);
  const runDbMigrations = stringValue(config.RUN_DB_MIGRATIONS).toLowerCase();
  const storageProvider = stringValue(config.STORAGE_PROVIDER || 'local').toLowerCase();
  const storageDir = stringValue(config.STORAGE_DIR);
  const s3Endpoint = stringValue(config.S3_ENDPOINT);
  const s3Bucket = stringValue(config.S3_BUCKET);
  const s3AccessKeyId = stringValue(config.S3_ACCESS_KEY_ID);
  const s3SecretAccessKey = stringValue(config.S3_SECRET_ACCESS_KEY);

  checks.push(looksLikeVersion(appVersion) ? pass('app_version', 'APP_VERSION uses a release-style semantic version.') : fail('app_version', 'APP_VERSION must look like v1.1.3.'));
  checks.push(looksLikeVersion(apiTag) || looksLikeSha(apiTag) ? pass('api_tag', 'API_TAG is immutable.') : fail('api_tag', 'API_TAG must be an approved release tag or commit SHA.'));
  checks.push(apiTag.toLowerCase() !== 'latest' ? pass('api_tag_latest', 'API_TAG does not use latest.') : fail('api_tag_latest', 'API_TAG must not use latest.'));
  checks.push(looksLikeVersion(webTag) || looksLikeSha(webTag) ? pass('web_tag', 'WEB_TAG is immutable.') : fail('web_tag', 'WEB_TAG must be an approved release tag or commit SHA.'));
  checks.push(webTag.toLowerCase() !== 'latest' ? pass('web_tag_latest', 'WEB_TAG does not use latest.') : fail('web_tag_latest', 'WEB_TAG must not use latest.'));
  checks.push(looksLikeSha(commitSha) ? pass('commit_sha', 'COMMIT_SHA is present.') : fail('commit_sha', 'COMMIT_SHA must be a 7-40 character git SHA.'));
  checks.push(buildId ? pass('build_id', 'BUILD_ID is present.') : fail('build_id', 'BUILD_ID must be present.'));
  checks.push(buildTime ? pass('build_time', 'BUILD_TIME is present.') : fail('build_time', 'BUILD_TIME must be present.'));
  checks.push(appUrl.startsWith('https://') ? pass('app_url', 'APP_URL uses HTTPS.') : fail('app_url', 'APP_URL must use HTTPS.'));
  checks.push(corsOrigins && !corsOrigins.includes('*') ? pass('cors_origins', 'CORS_ORIGINS is explicit.') : fail('cors_origins', 'CORS_ORIGINS must be explicit and must not contain wildcards.'));
  checks.push(postgresPassword.length >= 16 && !postgresPassword.includes('replace-with') ? pass('postgres_password', 'POSTGRES_PASSWORD is populated.') : fail('postgres_password', 'POSTGRES_PASSWORD must be replaced with a strong secret.'));
  checks.push(jwtSecret.length >= 32 && !jwtSecret.includes('replace-with') ? pass('jwt_secret', 'JWT_SECRET is populated.') : fail('jwt_secret', 'JWT_SECRET must be replaced with a strong secret.'));
  checks.push(internalApiToken.length >= 32 && !internalApiToken.includes('replace-with') ? pass('internal_api_token', 'INTERNAL_API_TOKEN is populated.') : fail('internal_api_token', 'INTERNAL_API_TOKEN must be replaced with a strong secret.'));
  checks.push(maintenanceBypassKey.length >= 16 && !maintenanceBypassKey.includes('replace-with') ? pass('maintenance_bypass_key', 'MAINTENANCE_BYPASS_KEY is populated.') : warn('maintenance_bypass_key', 'MAINTENANCE_BYPASS_KEY is empty or still placeholder; keep this only if maintenance bypass is intentionally disabled.'));
  checks.push(['true', 'false'].includes(runDbMigrations) ? pass('run_db_migrations', 'RUN_DB_MIGRATIONS is explicit.') : fail('run_db_migrations', 'RUN_DB_MIGRATIONS must be true or false.'));
  checks.push(['local', 's3', 'r2'].includes(storageProvider) ? pass('storage_provider', 'STORAGE_PROVIDER is valid.') : fail('storage_provider', 'STORAGE_PROVIDER must be local, s3, or r2.'));

  if (storageProvider === 'local') {
    checks.push(path.posix.isAbsolute(storageDir) ? pass('storage_dir', 'STORAGE_DIR is absolute for local persistent storage.') : fail('storage_dir', 'STORAGE_DIR must be an absolute in-container path when STORAGE_PROVIDER=local.'));
  } else {
    checks.push(s3Endpoint && s3Bucket && s3AccessKeyId && s3SecretAccessKey
      ? pass('object_storage_config', 'Object storage settings are populated for s3/r2 mode.')
      : fail('object_storage_config', 'S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required when STORAGE_PROVIDER=s3/r2.'));
  }

  const failed = checks.filter((check) => check.status === 'FAIL').length;
  const warned = checks.filter((check) => check.status === 'WARN').length;
  return {
    ready: failed === 0,
    summary: { passed: checks.length - failed - warned, warned, failed, total: checks.length },
    checks,
  };
}

function formatHumanReport(result) {
  const lines = ['HomeLand production bundle preflight', ''];
  for (const check of result.checks) {
    lines.push(`[${check.status}] ${check.id}: ${check.message}`);
  }
  lines.push('', `Bundle preflight: ${result.ready ? 'PASS' : 'FAIL'} (${result.summary.passed}/${result.summary.total}, warnings ${result.summary.warned})`);
  return lines.join('\n');
}

function parseArguments(argv) {
  const options = { envFile: 'deploy/public-production/env.public-production', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env-file') {
      options.envFile = argv[index + 1] || options.envFile;
      index += 1;
    } else if (argument === '--json') {
      options.json = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  const result = runProductionBundlePreflight(parseEnvFile(options.envFile));
  process.stdout.write(`${options.json ? JSON.stringify(result, null, 2) : formatHumanReport(result)}\n`);
  process.exitCode = result.ready ? 0 : 1;
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`Production bundle preflight failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  formatHumanReport,
  parseArguments,
  parseEnvFile,
  runProductionBundlePreflight,
};
