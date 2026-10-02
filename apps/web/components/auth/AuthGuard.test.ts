import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

describe('AuthGuard activity tracking', () => {
  it('records activity only from user event handling and throttles writes', () => {
    const source = readFileSync(join(__dirname, 'AuthGuard.tsx'), 'utf8');

    expect(source).toContain('const recordUserActivity = () =>');
    expect(source).toContain('authApi.recordActivity()');
    expect(source).toContain('now - lastActivityRecordedAtRef.current < 60_000');
    expect(source).toContain('window.addEventListener(eventName, recordUserActivity');
    expect(source).not.toContain('setInterval(authApi.recordActivity');
  });
});
