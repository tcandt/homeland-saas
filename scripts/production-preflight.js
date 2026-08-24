const fs = require('fs');
const path = require('path');

const INSECURE_JWT_SECRETS = new Set([
  'fallback_secret_for_dev_only',
  'homeland_super_secret_key_change_in_production',
  'verification-only-loopback-secret-2026-not-for-deployment',
]);

const MANUAL_ACCEPTANCE = [
  'Map both production bank accounts to the correct owner and buildings.',
  'Verify a small SePay transaction and idempotent webhook for each owner.',
  'Verify Hunonic sync without duplicates or writes to locked periods.',
  'Verify Zalo, Telegram, and SMTP delivery plus retry logging.',
  'Complete an off-host backup and documented restore drill.',
  'Enable monitoring and alerting, then assign an incident owner.',
  'Hand off separate credentials and require first-login password changes.',
];

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function booleanIsFalse(value) {
  return stringValue(value).toLowerCase() === 'false';
}

function normalizeRuntimeRole(value) {
  const normalized = stringValue(value).toLowerCase();
  return normalized || 'all';
}

function normalizeStorageProvider(value) {
  const normalized = stringValue(value).toLowerCase();
  return normalized || 'local';
}

function parseSizeBytes(value, fallback) {
  const raw = stringValue(value).toLowerCase();
  if (!raw) return fallback;
  const match = raw.match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)?$/);
  if (!match) return NaN;
  const amount = Number(match[1]);
  const unit = match[2] || 'b';
  const multiplier = unit === 'gb' ? 1024 ** 3 : unit === 'mb' ? 1024 ** 2 : unit === 'kb' ? 1024 : 1;
  return Math.round(amount * multiplier);
}

function isLoopbackHost(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function parseUrl(value, protocols) {
  try {
    const parsed = new URL(value);
    if (!protocols.includes(parsed.protocol)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function checkConnectionUrl(config, key, protocols, options) {
  const parsed = parseUrl(stringValue(config[key]), protocols);
  if (!parsed) {
    return fail(key.toLowerCase(), `${key} is missing or has an unsupported protocol.`);
  }
  if (!options.allowLoopback && isLoopbackHost(parsed.hostname)) {
    return fail(key.toLowerCase(), `${key} must not target loopback for a live deployment.`);
  }
  return pass(key.toLowerCase(), `${key} is present and structurally valid.`);
}

function checkPublicUrl(config, key, options, expectedPathPrefix, allowRelative = false) {
  const rawValue = stringValue(config[key]);
  if (allowRelative && rawValue.startsWith('/') && !rawValue.startsWith('//')) {
    if (!expectedPathPrefix || rawValue.startsWith(expectedPathPrefix)) {
      return pass(key.toLowerCase(), `${key} uses a same-origin path.`);
    }
  }

  const parsed = parseUrl(rawValue, ['http:', 'https:']);
  if (!parsed) return fail(key.toLowerCase(), `${key} must be an absolute URL.`);

  const loopback = isLoopbackHost(parsed.hostname);
  if (!loopback && parsed.protocol !== 'https:') {
    return fail(key.toLowerCase(), `${key} must use HTTPS outside loopback.`);
  }
  if (loopback && !options.allowLoopback) {
    return fail(key.toLowerCase(), `${key} must not target loopback for a live deployment.`);
  }
  if (expectedPathPrefix && !parsed.pathname.startsWith(expectedPathPrefix)) {
    return fail(key.toLowerCase(), `${key} must include the expected API path.`);
  }
  return pass(key.toLowerCase(), `${key} is valid for the selected deployment mode.`);
}

function pass(id, message) {
  return { id, status: 'PASS', message };
}

function fail(id, message) {
  return { id, status: 'FAIL', message };
}

function runProductionPreflight(config, options = {}) {
  const normalizedOptions = { allowLoopback: options.allowLoopback === true };
  const checks = [];

  checks.push(
    stringValue(config.NODE_ENV) === 'production'
      ? pass('node_env', 'NODE_ENV is production.')
      : fail('node_env', 'NODE_ENV must be production.'),
  );
  checks.push(checkConnectionUrl(config, 'DATABASE_URL', ['postgres:', 'postgresql:'], normalizedOptions));
  checks.push(checkConnectionUrl(config, 'REDIS_URL', ['redis:', 'rediss:'], normalizedOptions));
  checks.push(checkPublicUrl(config, 'APP_URL', normalizedOptions));
  checks.push(checkPublicUrl(config, 'NEXT_PUBLIC_API_URL', normalizedOptions, '/api', true));

  const corsOrigins = stringValue(config.CORS_ORIGINS)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  let corsValid = corsOrigins.length > 0;
  for (const origin of corsOrigins) {
    const parsed = parseUrl(origin, ['http:', 'https:']);
    if (!parsed || parsed.origin !== origin.replace(/\/$/, '') || origin.includes('*')) {
      corsValid = false;
      break;
    }
    if ((!isLoopbackHost(parsed.hostname) && parsed.protocol !== 'https:') || (!normalizedOptions.allowLoopback && isLoopbackHost(parsed.hostname))) {
      corsValid = false;
      break;
    }
  }
  checks.push(
    corsValid
      ? pass('cors_origins', 'CORS_ORIGINS contains explicit allowed origins.')
      : fail('cors_origins', 'CORS_ORIGINS must contain explicit HTTPS origins without paths or wildcards.'),
  );

  const jwtSecret = stringValue(config.JWT_SECRET);
  checks.push(
    jwtSecret.length >= 32 && !INSECURE_JWT_SECRETS.has(jwtSecret)
      ? pass('jwt_secret', 'JWT_SECRET meets the minimum production policy.')
      : fail('jwt_secret', 'JWT_SECRET is missing, too short, or uses a documented non-production value.'),
  );

  const internalToken = stringValue(config.INTERNAL_API_TOKEN);
  checks.push(
    internalToken.length >= 32
      ? pass('internal_api_token', 'INTERNAL_API_TOKEN is configured for metrics/build-info/seed endpoints.')
      : fail('internal_api_token', 'INTERNAL_API_TOKEN must be set to at least 32 characters.'),
  );

  const apiBodyLimit = parseSizeBytes(config.API_BODY_LIMIT, 2 * 1024 * 1024);
  checks.push(
    Number.isFinite(apiBodyLimit) && apiBodyLimit > 0 && apiBodyLimit <= 5 * 1024 * 1024
      ? pass('api_body_limit', 'API_BODY_LIMIT is bounded for JSON/urlencoded requests.')
      : fail('api_body_limit', 'API_BODY_LIMIT must be a positive value no larger than 5mb.'),
  );

  const documentUploadLimit = parseSizeBytes(config.DOCUMENT_UPLOAD_LIMIT_BYTES, 20 * 1024 * 1024);
  checks.push(
    Number.isFinite(documentUploadLimit) && documentUploadLimit > 0 && documentUploadLimit <= 50 * 1024 * 1024
      ? pass('document_upload_limit', 'DOCUMENT_UPLOAD_LIMIT_BYTES is bounded for document uploads.')
      : fail('document_upload_limit', 'DOCUMENT_UPLOAD_LIMIT_BYTES must be positive and no larger than 50mb.'),
  );

  const storageDir = stringValue(config.STORAGE_DIR);
  const storageProvider = normalizeStorageProvider(config.STORAGE_PROVIDER);
  checks.push(
    ['local', 's3', 'r2'].includes(storageProvider)
      ? pass('storage_provider', 'STORAGE_PROVIDER is valid.')
      : fail('storage_provider', 'STORAGE_PROVIDER must be one of local, s3, or r2.'),
  );
  checks.push(
    storageProvider !== 'local' || (storageDir && path.isAbsolute(storageDir))
      ? pass('storage_dir', storageProvider === 'local'
        ? 'STORAGE_DIR points to an explicit absolute host-mounted storage path.'
        : 'STORAGE_DIR is optional because object storage is enabled.')
      : fail('storage_dir', 'STORAGE_DIR must be an explicit absolute path for production attachments when STORAGE_PROVIDER=local.'),
  );
  const s3Endpoint = stringValue(config.S3_ENDPOINT);
  const s3Bucket = stringValue(config.S3_BUCKET);
  const s3AccessKeyId = stringValue(config.S3_ACCESS_KEY_ID);
  const s3SecretAccessKey = stringValue(config.S3_SECRET_ACCESS_KEY);
  const s3Parsed = s3Endpoint ? parseUrl(s3Endpoint, ['http:', 'https:']) : null;
  checks.push(
    storageProvider === 'local'
      ? pass('object_storage_config', 'Object storage configuration is not required for local storage mode.')
      : (s3Parsed && s3Bucket && s3AccessKeyId && s3SecretAccessKey
        ? pass('object_storage_config', 'S3/R2 object storage configuration is present and structurally valid.')
        : fail('object_storage_config', 'S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY are required when STORAGE_PROVIDER=s3/r2.')),
  );

  const communicationImmediateDelivery = stringValue(config.COMMUNICATION_IMMEDIATE_DELIVERY || 'true').toLowerCase();
  const runtimeRole = normalizeRuntimeRole(config.APP_RUNTIME_ROLE);
  checks.push(
    ['true', 'false'].includes(communicationImmediateDelivery)
      ? pass('communication_delivery_mode', 'COMMUNICATION_IMMEDIATE_DELIVERY is explicit.')
      : fail('communication_delivery_mode', 'COMMUNICATION_IMMEDIATE_DELIVERY must be true or false.'),
  );
  checks.push(
    ['all', 'api', 'notification-worker'].includes(runtimeRole)
      ? pass('app_runtime_role', 'APP_RUNTIME_ROLE is valid.')
      : fail('app_runtime_role', 'APP_RUNTIME_ROLE must be one of all, api, or notification-worker.'),
  );
  checks.push(
    !(communicationImmediateDelivery === 'false' && runtimeRole === 'api')
      ? pass('notification_queue_consumer', 'Notification queue has a viable consumer strategy.')
      : fail('notification_queue_consumer', 'COMMUNICATION_IMMEDIATE_DELIVERY=false cannot be combined with APP_RUNTIME_ROLE=api unless a separate notification-worker process is deployed.'),
  );
  checks.push(
    booleanIsFalse(config.ALLOW_REGISTRATION)
      ? pass('api_registration', 'Public API registration is disabled.')
      : fail('api_registration', 'ALLOW_REGISTRATION must be explicitly false.'),
  );
  checks.push(
    booleanIsFalse(config.NEXT_PUBLIC_ALLOW_REGISTRATION)
      ? pass('web_registration', 'Public web registration is disabled.')
      : fail('web_registration', 'NEXT_PUBLIC_ALLOW_REGISTRATION must be explicitly false at build time.'),
  );
  checks.push(
    booleanIsFalse(config.ENABLE_SWAGGER)
      ? pass('swagger', 'Swagger is disabled.')
      : fail('swagger', 'ENABLE_SWAGGER must be explicitly false.'),
  );
  checks.push(
    stringValue(config.DISABLE_SCHEDULED_JOBS).toLowerCase() !== 'true'
      ? pass('scheduled_jobs', 'Scheduled jobs are enabled for the live runtime.')
      : fail('scheduled_jobs', 'Scheduled jobs are disabled; hourly Hunonic sync will not run.'),
  );

  const failed = checks.filter((check) => check.status === 'FAIL').length;
  return {
    configReady: failed === 0,
    liveReady: false,
    summary: { passed: checks.length - failed, failed, total: checks.length },
    checks,
    manualAcceptance: [...MANUAL_ACCEPTANCE],
  };
}

function formatHumanReport(result) {
  const lines = ['HomeLand production configuration preflight', ''];
  for (const check of result.checks) {
    lines.push(`[${check.status}] ${check.id}: ${check.message}`);
  }
  lines.push('', `Configuration: ${result.configReady ? 'PASS' : 'FAIL'} (${result.summary.passed}/${result.summary.total})`);
  lines.push('LIVE status: BLOCKED until every manual acceptance item is evidenced.');
  lines.push('', 'Manual acceptance still required:');
  result.manualAcceptance.forEach((item) => lines.push(`- ${item}`));
  return lines.join('\n');
}

function parseArguments(argv) {
  const options = { allowLoopback: false, json: false, envFile: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--allow-loopback') options.allowLoopback = true;
    else if (argument === '--json') options.json = true;
    else if (argument === '--env-file') {
      options.envFile = argv[index + 1] || null;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  if (options.envFile) {
    const envPath = path.resolve(options.envFile);
    if (!fs.existsSync(envPath)) throw new Error('The requested environment file does not exist.');
    process.loadEnvFile(envPath);
  }
  const result = runProductionPreflight(process.env, options);
  process.stdout.write(`${options.json ? JSON.stringify(result, null, 2) : formatHumanReport(result)}\n`);
  process.exitCode = result.configReady ? 0 : 1;
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`Production preflight failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  formatHumanReport,
  parseArguments,
  runProductionPreflight,
};
