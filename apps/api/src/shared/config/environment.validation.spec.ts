import { describe, expect, it } from 'vitest';
import { schedulesEnabled, validateEnvironment } from './environment.validation';

describe('production environment validation', () => {
  const valid = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://user:secret@db:5432/homeland',
    REDIS_URL: 'redis://redis:6379',
    APP_URL: 'https://api.homeland.example',
    CORS_ORIGINS: 'https://homeland.example',
    JWT_SECRET: 'a-production-secret-with-more-than-32-characters',
    STORAGE_DIR: '/app/storage',
  };

  it('accepts a complete production configuration', () => {
    expect(validateEnvironment({ ...valid })).toEqual(valid);
  });

  it('rejects documented development secrets', () => {
    expect(() => validateEnvironment({
      ...valid,
      JWT_SECRET: 'homeland_super_secret_key_change_in_production',
    })).toThrow('JWT_SECRET');
  });

  it('rejects missing CORS allowlist and non-HTTPS public API URLs', () => {
    expect(() => validateEnvironment({ ...valid, CORS_ORIGINS: '' })).toThrow('CORS_ORIGINS');
    expect(() => validateEnvironment({ ...valid, APP_URL: 'http://api.homeland.example' })).toThrow('HTTPS');
  });

  it('keeps development configuration permissive', () => {
    expect(validateEnvironment({ NODE_ENV: 'development' })).toEqual({ NODE_ENV: 'development' });
  });

  it('disables scheduled jobs only when explicitly requested', () => {
    expect(schedulesEnabled({})).toBe(true);
    expect(schedulesEnabled({ DISABLE_SCHEDULED_JOBS: 'false' })).toBe(true);
    expect(schedulesEnabled({ DISABLE_SCHEDULED_JOBS: 'TRUE' })).toBe(false);
  });
});
