const failOnError = (msg: string) => {
  console.log('--- STRICT FAIL TRIGGERED ---', msg);
  throw new Error(`STRICT FAIL: ${msg}`);
};

export const attachStrictListeners = (page: any, persona: 'admin' | 'finance' = 'admin') => {
  // These are deliberate persona-boundary probes made by the finance UI. Keep
  // the exception narrow: only the exact endpoint and status are acceptable;
  // all 401s, other 403s and all 5xx responses remain fatal.
  const expected403 = new Map<string, number>(persona === 'finance' ? [
    ['/api/v1/settings/profile?scope=USER', 0],
    ['/api/v1/settings/notifications?scope=TENANT', 0],
    ['/api/v1/settings/access-control?scope=TENANT', 0],
    ['/api/v1/finance/owners/profit-summary', 0],
  ] : []);
  const consumeExpected403 = () => {
    for (const [url, count] of expected403) {
      if (count > 0) {
        expected403.set(url, count - 1);
        return true;
      }
    }
    return false;
  };
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (
        text.includes('SSE Error') ||
        text.includes('notifications/stream')
      ) return;
      if (text.includes('429')) {
        const url = msg.location()?.url || '';
        if (url.includes('auth/login') || url.includes('auth/refresh')) return;
      }
      if (text.includes('status of 403') && consumeExpected403()) return;
      failOnError(`Console Error: ${text}`);
    }
    if (msg.text().includes('Hydration') || msg.text().includes('Minified React error')) failOnError(`Hydration Warning: ${msg.text()}`);
  });
  page.on('pageerror', (err: any) => {
    failOnError(`Page Error: ${err.message}`);
  });
  page.on('response', (response: any) => {
    const status = response.status();
    const responseUrl = new URL(response.url());
    const normalizedUrl = `${responseUrl.pathname}${responseUrl.search}`;
    if (status === 403 && expected403.has(normalizedUrl)) {
      expected403.set(normalizedUrl, (expected403.get(normalizedUrl) || 0) + 1);
      return;
    }
    if (status >= 500 || status === 401 || status === 403) {
      failOnError(`Unexpected ${status} from ${response.url()}`);
    }
  });
};

