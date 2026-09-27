import { expect } from '@playwright/test';
import { test } from '../../fixtures/rbac.fixture';

test.describe('AI persisted history', () => {
  test('loads persisted messages, does not retain the prior transcript while switching, and clears to a draft', async ({ admin }) => {
    const page = admin.page;

    await page.route('**/api/v1/ai/usage', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }));
    await page.route('**/api/v1/ai/conversations', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { id: 'conversation-a', title: 'Hội thoại A', updatedAt: '2026-09-23T08:00:00.000Z' },
          { id: 'conversation-b', title: 'Hội thoại B', updatedAt: '2026-09-23T09:00:00.000Z' },
        ],
      }),
    }));
    await page.route('**/api/v1/ai/conversations/*', async (route) => {
      const isSecondConversation = route.request().url().endsWith('/conversation-b');
      if (isSecondConversation) await new Promise((resolve) => setTimeout(resolve, 200));

      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: isSecondConversation ? 'conversation-b' : 'conversation-a',
            messages: [{
              id: isSecondConversation ? 'message-b' : 'message-a',
              role: 'assistant',
              content: isSecondConversation ? 'Nội dung hội thoại B' : 'Nội dung hội thoại A',
            }],
          },
        }),
      });
    });

    await page.goto('/ai');
    await expect(page.getByTestId('ai-conversation-conversation-a')).toBeVisible();
    await page.getByTestId('ai-conversation-conversation-a').click();
    await expect(page.getByText('Nội dung hội thoại A')).toBeVisible();

    await page.getByTestId('ai-conversation-conversation-b').click();
    await expect(page.getByTestId('ai-history-detail-loading')).toBeVisible();
    await expect(page.getByText('Nội dung hội thoại A')).toBeHidden();
    await expect(page.getByText('Nội dung hội thoại B')).toBeVisible();

    await page.getByTestId('ai-clear-chat').click();
    await expect(page.getByTestId('ai-empty-draft')).toBeVisible();
    await expect(page.getByText('Nội dung hội thoại B')).toBeHidden();
  });
});
