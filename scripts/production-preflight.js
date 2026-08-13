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
