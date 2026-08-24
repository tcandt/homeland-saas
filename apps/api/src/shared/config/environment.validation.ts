import { isValidAppRuntimeRole, resolveAppRuntimeRole } from './runtime-mode';

const INSECURE_JWT_SECRETS = new Set([
  'fallback_secret_for_dev_only',
  'homeland_super_secret_key_change_in_production',
]);

export function validateEnvironment(config: Record<string, unknown>) {
  const env = stringValue(config.NODE_ENV) || 'development';
  if (env !== 'production') return config;

  const required = ['DATABASE_URL', 'REDIS_URL', 'APP_URL', 'CORS_ORIGINS', 'JWT_SECRET'] as const;
  const missing = required.filter((key) => !stringValue(config[key]));
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }

  const jwtSecret = stringValue(config.JWT_SECRET);
  if (jwtSecret.length < 32 || INSECURE_JWT_SECRETS.has(jwtSecret)) {
    throw new Error('JWT_SECRET must be at least 32 characters and must not use a documented development value.');
  }

  const appUrl = parseAbsoluteUrl('APP_URL', stringValue(config.APP_URL));
  const corsOrigins = stringValue(config.CORS_ORIGINS)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one origin in production.');
  }
  for (const origin of corsOrigins) {
    const parsed = parseAbsoluteUrl('CORS_ORIGINS', origin);
    if (parsed.origin !== origin.replace(/\/$/, '')) {
      throw new Error(`CORS_ORIGINS must contain origins without paths: ${origin}`);
    }
  }
  if (appUrl.protocol !== 'https:' && !isLoopbackHost(appUrl.hostname)) {
    throw new Error('APP_URL must use HTTPS outside loopback environments.');
  }

  const runtimeRole = resolveAppRuntimeRole(config);
  if (!isValidAppRuntimeRole(runtimeRole)) {
    throw new Error('APP_RUNTIME_ROLE must be one of: all, api, notification-worker.');
  }

  const storageProvider = stringValue(config.STORAGE_PROVIDER || 'local').toLowerCase() || 'local';
  if (!['local', 's3', 'r2'].includes(storageProvider)) {
    throw new Error('STORAGE_PROVIDER must be one of: local, s3, r2.');
  }
  if (storageProvider === 'local') {
    const storageDir = stringValue(config.STORAGE_DIR);
    if (!storageDir) {
      throw new Error('STORAGE_DIR must be set in production when STORAGE_PROVIDER=local.');
    }
  } else {
    const s3Endpoint = stringValue(config.S3_ENDPOINT);
    const s3Bucket = stringValue(config.S3_BUCKET);
    const s3AccessKeyId = stringValue(config.S3_ACCESS_KEY_ID);
    const s3SecretAccessKey = stringValue(config.S3_SECRET_ACCESS_KEY);
    if (!s3Endpoint || !s3Bucket || !s3AccessKeyId || !s3SecretAccessKey) {
      throw new Error('S3 object storage configuration is incomplete for STORAGE_PROVIDER=s3/r2.');
    }
    parseAbsoluteUrl('S3_ENDPOINT', s3Endpoint);
  }

  return config;
}

export function schedulesEnabled(config: Record<string, unknown> = process.env) {
  return stringValue(config.DISABLE_SCHEDULED_JOBS).toLowerCase() !== 'true';
}

export function configuredCorsOrigins() {
  const configured = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (configured.length > 0) return configured;
  return process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseAbsoluteUrl(key: string, value: string) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${key} must be a valid absolute URL.`);
  }
}

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}
