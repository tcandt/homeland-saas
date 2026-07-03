const fs = require('fs');
const file = 'apps/web/tests/e2e/acceptance/production-acceptance.spec.ts';
let content = fs.readFileSync(file, 'utf8');

const top = `import { test, expect } from '@playwright/test';
import { test as rbacTest } from '../fixtures/rbac.fixture';
import { DataFactory } from '../utils/data-factory';
import { checkA11y } from '../utils/a11y-helper';

rbacTest.describe.configure({ mode: 'serial' });

const failOnError = (msg: string) => {
  console.log('--- STRICT FAIL TRIGGERED ---', msg);
  throw new Error(\`STRICT FAIL: \${msg}\`);
};

export const attachStrictListeners = (page: any) => {
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      if (msg.text().includes('SSE Error')) return;
      failOnError(\`Console Error: \${msg.text()}\`);
    }
    if (msg.text().includes('Hydration') || msg.text().includes('Minified React error')) failOnError(\`Hydration Warning: \${msg.text()}\`);
  });
`;

const idx = content.indexOf("  page.on('pageerror', (err: any) => {");
fs.writeFileSync(file, top + content.substring(idx));
