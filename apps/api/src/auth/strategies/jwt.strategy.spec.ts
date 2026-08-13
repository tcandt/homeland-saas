import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('JwtStrategy transport security', () => {
  it('accepts JWTs from the Authorization header only', () => {
    const source = readFileSync(__filename.replace(/\.spec\.ts$/, '.ts'), 'utf8');

    expect(source).toContain('ExtractJwt.fromAuthHeaderAsBearerToken()');
    expect(source).not.toContain('fromUrlQueryParameter');
  });
});
