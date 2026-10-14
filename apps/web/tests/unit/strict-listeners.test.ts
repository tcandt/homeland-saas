import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { attachStrictListeners } from '../e2e/utils/strict-listeners';

const paths = [
  '/api/v1/settings/profile?scope=USER',
  '/api/v1/settings/notifications?scope=TENANT',
  '/api/v1/settings/access-control?scope=TENANT',
  '/api/v1/finance/owners/profit-summary',
];
const response = (status: number, path = '/api/v1/notifications') => ({
  status: () => status, url: () => `http://localhost:3000${path}`,
});
const consoleError = (message: string) => ({ type: () => 'error', text: () => message, location: () => ({}) });

describe('Production acceptance strict network gate', () => {
  it.each([401, 403, 500, 501, 502, 503, 504, 599])('fails HTTP %i for both personas', (status) => {
    for (const persona of ['admin', 'finance'] as const) {
      const page = new EventEmitter();
      attachStrictListeners(page, persona);
      expect(() => page.emit('response', response(status))).toThrow(`Unexpected ${status}`);
    }
  });
  it.each(paths)('allows only finance 403 at exactly %s', (path) => {
    const finance = new EventEmitter();
    attachStrictListeners(finance, 'finance');
    expect(() => finance.emit('response', response(403, path))).not.toThrow();
    expect(() => finance.emit('console', consoleError('Failed to load resource: status of 403'))).not.toThrow();
    expect(() => finance.emit('console', consoleError('Failed to load resource: status of 403'))).toThrow();
    for (const status of [401, 500, 503]) {
      expect(() => finance.emit('response', response(status, path))).toThrow();
    }
    expect(() => finance.emit('response', response(403, `${path}${path.includes('?') ? '&' : '?'}extra=1`))).toThrow();
    const admin = new EventEmitter();
    attachStrictListeners(admin);
    expect(() => admin.emit('response', response(403, path))).toThrow();
  });
  it('does not suppress HTTP 503 or unpaired console 403, including SSE responses', () => {
    const page = new EventEmitter();
    attachStrictListeners(page, 'finance');
    expect(() => page.emit('console', consoleError('Failed to load resource: status of 503'))).toThrow();
    expect(() => page.emit('console', consoleError('Failed to load resource: status of 403'))).toThrow();
    expect(() => page.emit('response', response(503, '/api/v1/notifications/stream'))).toThrow();
  });
});
