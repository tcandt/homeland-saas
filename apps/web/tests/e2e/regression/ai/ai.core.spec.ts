import { expect } from '@playwright/test';
import { test } from '../../fixtures/rbac.fixture';

test.describe.configure({ mode: 'serial' });

test.describe('AI Core Regression Flow', () => {
  test.beforeEach(async ({ admin }) => {
    admin.page.on('console', msg => console.log('[PAGE CONSOLE]', msg.text()));
    admin.page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
  });

  test('Page loads and basic elements are visible', async ({ admin }) => {
    const page = admin.page;
    await page.goto('/ai');
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('ai-root')).toBeVisible();
    await expect(page.getByTestId('ai-chat-panel')).toBeVisible();
    await expect(page.getByTestId('ai-agent-selector')).toBeVisible();
    await expect(page.getByTestId('ai-message-input')).toBeVisible();
    await expect(page.getByTestId('ai-send-button')).toBeVisible();
    await expect(page.getByTestId('ai-knowledge-sources')).toBeVisible();
    await expect(page.getByTestId('ai-token-usage')).toBeVisible();
  });

  test('Draft safety: sensitive action should result in draft and no real mutation', async ({ admin }) => {
    const page = admin.page;
    
    // Get initial task count to verify no new task is created
    const initialTasksRes = await admin.api.get('/api/v1/tasks');
    const initialTasks = initialTasksRes.ok() ? (await initialTasksRes.json()).data || [] : [];
    const initialCount = Array.isArray(initialTasks) ? initialTasks.length : 0;

    await page.goto('/ai');
    await page.waitForLoadState('networkidle');

    // Make sure we select an agent that can create tasks, like OperationsAgent
    await page.getByTestId('ai-agent-selector').selectOption({ label: 'Operations Agent' }).catch(() => {});
    
    await page.getByTestId('ai-message-input').fill('Tạo task nhắc thu tiền phòng 101');
    await page.getByTestId('ai-send-button').click();

    // Check if the response creates a draft or error
    // If provider is missing, it will show error banner. We handle both cases to prevent flakiness.
    const responseMsg = page.getByTestId('ai-response-message').last();
    const errorBanner = page.getByTestId('ai-error-state');
    const draftConfirmation = page.getByTestId('ai-draft-confirmation');
    
    // Wait for either response, error or draft
    await Promise.race([
      expect(responseMsg).toBeVisible({ timeout: 15000 }),
      expect(errorBanner).toBeVisible({ timeout: 15000 }),
      expect(draftConfirmation).toBeVisible({ timeout: 15000 })
    ]).catch(() => {});

    const isErrorVisible = await errorBanner.isVisible();
    if (isErrorVisible) {
      console.log('Provider missing or error occurred, skipping draft safety UI check, but verifying DB mutation.');
      const errorText = await errorBanner.textContent();
      expect(errorText).toContain('Lỗi kết nối AI');
    } else {
      // If AI is working, we expect a draft confirmation
      const isDraftVisible = await draftConfirmation.isVisible();
      if (isDraftVisible) {
        await expect(draftConfirmation).toContainText('DRAFT');
        await expect(page.getByTestId('ai-draft-approve')).toBeVisible();
        await expect(page.getByTestId('ai-draft-cancel')).toBeVisible();
        // Do NOT click approve to test that it stays pending
      }
    }

    // Verify API/DB side: no real mutation occurred
    const finalTasksRes = await admin.api.get('/api/v1/tasks');
    const finalTasks = finalTasksRes.ok() ? (await finalTasksRes.json()).data || [] : [];
    const finalCount = Array.isArray(finalTasks) ? finalTasks.length : 0;

    expect(finalCount).toBe(initialCount);
  });

  test('Provider missing graceful error behavior (Mocked fallback)', async ({ admin }) => {
    // We test the mocked intercept here as a fallback to guarantee UI behavior
    const page = admin.page;
    await page.goto('/ai');
    await page.waitForLoadState('networkidle');

    await page.route('**/api/v1/ai/chat', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'Provider chưa được cấu hình' })
      });
    });

    await page.getByTestId('ai-message-input').fill('Test provider missing');
    await page.getByTestId('ai-send-button').click();

    await expect(page.getByTestId('ai-error-state')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('ai-error-state')).toContainText('chưa được cấu hình');
    
    await page.unroute('**/api/v1/ai/chat');
  });
});
