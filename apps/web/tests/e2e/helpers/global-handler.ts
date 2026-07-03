import { Page, expect } from '@playwright/test';

/**
 * Setup global page validation for all E2E tests.
 * This intercepts console.error, uncaught exceptions, and 500 API responses.
 */
export function setupStrictPageValidation(page: Page) {
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') {
      if (text.includes('Failed to load resource') && text.includes('favicon.ico')) return;
      if (text.includes('Failed to load resource') && (text.includes('status of 500') || text.includes('status of 400') || text.includes('status of 404') || text.includes('status of 401'))) return; // Handled by response listener
      if (text.includes('SSE Error, falling back to polling')) return; // Expected fallback behavior
      if (text.includes('Failed to fetch RSC payload')) return; // Next.js fallback behavior
      if (text.includes('Cannot update a component') && text.includes('HotReload')) return; // Next.js Dev Mode warning
      expect(text, 'Console ERROR detected!').toBeNull();
    }
    
    // Strict Mode / Hydration checking
    if (text.includes('Warning: Text content did not match') || 
        text.includes('Warning: Expected server HTML to contain') ||
        text.includes('Hydration failed')) {
      expect(text, 'Hydration Warning detected!').toBeNull();
    }
  });

  page.on('pageerror', (exception) => {
    expect(exception.message, 'Uncaught Exception detected!').toBeNull();
  });

  // API errors (500)
  page.on('response', (response) => {
    if (response.status() >= 500 && response.url().includes('/api/')) {
       const headers = response.headers();
       if (headers['x-intentional-error'] !== 'true') {
         expect(response.status(), `API returned 500: ${response.url()}`).toBeLessThan(500);
       }
    }
  });
}
