import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { parseServerSentEvents } from './server-sent-events';

describe('parseServerSentEvents', () => {
  it('parses complete data events and preserves an incomplete tail', () => {
    expect(parseServerSentEvents('data: {"count":1}\n\ndata: {"count":')).toEqual({
      events: ['{"count":1}'],
      remainder: 'data: {"count":',
    });
  });

  it('supports CRLF and multi-line data payloads', () => {
    expect(parseServerSentEvents('event: message\r\ndata: first\r\ndata: second\r\n\r\n')).toEqual({
      events: ['first\nsecond'],
      remainder: '',
    });
  });

  it('keeps notification access tokens out of the stream URL', () => {
    const headerSource = readFileSync(join(__dirname, '..', 'components', 'layout', 'Header.tsx'), 'utf8');

    expect(headerSource).toContain('Authorization: `Bearer ${accessToken}`');
    expect(headerSource).not.toContain('notifications/stream?token=');
  });
});
