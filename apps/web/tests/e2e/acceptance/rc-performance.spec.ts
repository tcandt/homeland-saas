import { expect } from '@playwright/test';
import { test } from '../fixtures/admin.fixture';
import * as fs from 'fs';

test.describe('RC-04 Performance Baseline', () => {

  const routes = [
    '/',
    '/buildings',
    '/finance',
    '/documents',
    '/notifications',
    '/automation',
    '/ai'
  ];

  const results: any[] = [];

  for (const route of routes) {
    test(`Measure Performance for ${route}`, async ({ admin }) => {
      const { page } = admin;
      let jsErrors = 0;
      let consoleErrors = 0;

      page.on('pageerror', (err) => {
        jsErrors++;
      });
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          console.log(`[${route}] Console Error: ${msg.text()}`);
          consoleErrors++;
        }
      });

      // Navigation
      await page.goto(route, { waitUntil: 'load' });
      
      // Wait for network idle to ensure everything is loaded
      await page.waitForLoadState('networkidle');

      // Capture performance metrics
      const performanceTimingJson = await page.evaluate(() => JSON.stringify(window.performance.timing));
      const performanceTiming = JSON.parse(performanceTimingJson);
      
      const lcp = await page.evaluate(async () => {
        return new Promise<number>((resolve) => {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            resolve(lastEntry.startTime);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          
          setTimeout(() => resolve(0), 2500); // Fallback timeout 2.5s
        });
      });

      const ttfb = performanceTiming.responseStart - performanceTiming.navigationStart;
      const domContentLoaded = performanceTiming.domContentLoadedEventEnd - performanceTiming.navigationStart;

      const result = {
        route,
        ttfb,
        lcp: lcp || 0,
        domContentLoaded,
        jsErrors,
        consoleErrors
      };
      
      results.push(result);
      fs.appendFileSync('performance-results.jsonl', JSON.stringify(result) + '\n');
    });
  }
});
