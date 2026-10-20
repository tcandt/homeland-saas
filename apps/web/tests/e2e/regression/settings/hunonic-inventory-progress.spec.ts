import { expect, test } from '@playwright/test';

function inventoryFixture() {
  const meters: any[] = [];
  for (const [number, count] of [['31', 7], ['32', 7], ['24', 10], ['25', 10]] as const) {
    for (let index = 1; index <= count; index += 1) {
      const room = `${number}.${String(index).padStart(2, '0')}`;
      meters.push({ id: room, roomId: room, meterKind: 'ROOM', buildingCode: `${Number(number) < 30 ? 'LK08' : 'LK01'}.${number}`,
        roomCode: `PN ${room.replace('.', '-')}`, displayName: `P${room}`, deviceName: `P${room}`, status: 'on',
        energyMonthKwh: 10, moneyMonthVnd: 35000, lastSyncedAt: new Date().toISOString(), providerObservedAt: new Date().toISOString() });
    }
  }
  for (const number of ['24', '25']) meters.push({ id: `total${number}`, meterKind: 'BUILDING_TOTAL', buildingCode: `LK08.${number}`, roomCode: `TOTAL-${number}`, displayName: `Công tơ tổng tòa nhà LK08.${number}`, energyMonthKwh: 100, moneyMonthVnd: 350000, status: 'on', lastSyncedAt: new Date().toISOString() });
  meters.push({ id: 'ev', meterKind: 'EV_CHARGING', buildingCode: 'COMMON', roomCode: 'EV-CHARGING', displayName: 'Ổ cắm xe điện', energyMonthKwh: 20, moneyMonthVnd: 70000, status: 'on', lastSyncedAt: new Date().toISOString() });
  return meters;
}

test.describe('Hunonic inventory and actual server-progress presentation', () => {
  test('shows 37 devices and resumes real progress after reload on desktop/mobile', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop 1920', 'Single controlled responsive matrix');
    test.setTimeout(120000);
    const user = { id: 'hunonic-visual', tenantId: 'hunonic-visual-tenant', email: 'visual@homeland.local', fullName: 'Visual Admin', roles: ['ADMIN'], permissions: ['meter.read', 'meter.sync'] };
    await page.addInitScript((value) => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: { user: value, accessToken: 'mock-local-only', refreshToken: 'mock-refresh', isAuthenticated: true }, version: 0 }));
    }, user);
    const meters = inventoryFixture();
    let starts = 0;
    let polls = 0;
    let complete = false;
    let interruptPolling = false;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data: any = [];
      if (path.endsWith('/hunonic/overview')) data = { meters, summary: { mappings: 37, roomMeters: 34, online: 34 }, lockedPeriods: [] };
      else if (path.endsWith('/hunonic/rates')) data = { rows: [], summary: {}, residentialTemplate: [] };
      else if (path.endsWith('/hunonic/sync/start')) {
        starts += 1;
        data = { jobId: 'mock-server-job', status: 'RUNNING', percent: 12, phase: 'backfilling', processed: 9, total: 37 };
      } else if (path.endsWith('/hunonic/sync/status')) {
        polls += 1;
        if (interruptPolling) {
          await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary polling interruption' }) });
          return;
        }
        data = complete ? { jobId: 'mock-server-job', status: 'SUCCESS', percent: 100, phase: 'completed', processed: 37, total: 37,
          result: { syncedCount: 37, inventory: { managed: 37 }, backfillWarning: 'BACKFILL_UNAVAILABLE' } }
          : { jobId: 'mock-server-job', status: 'RUNNING', percent: 68, phase: 'syncing', processed: 14, total: 37 };
      } else if (path.endsWith('/auth/me')) data = user;
      else if (path.endsWith('/auth/security')) data = { idleTimeoutMinutes: 1440 };
      else if (path.includes('/settings/')) data = { value: { enabled: true } };
      else if (path.endsWith('/hunonic/history')) data = { monthlyRows: [], readings: [], filters: { rooms: [], lockedPeriods: [] }, pagination: {} };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
    });
    await page.goto('/electricity');
    await expect(page.getByText('Kiểm kê thực tế:', { exact: false })).toContainText('LK01.31: 7 • LK01.32: 7 • LK08.24: 11 • LK08.25: 11 • xe điện: 1');
    await expect(page.getByText('Công tơ tổng tòa nhà LK08.25', { exact: true })).toBeVisible();
    await expect(page.getByText('Ổ cắm xe điện', { exact: true })).toBeVisible();
    const button = page.getByRole('button', { name: 'Đồng bộ', exact: true });
    await button.click();
    const progress = page.getByRole('progressbar', { name: 'Tiến độ đồng bộ Hunonic' });
    await expect(progress).toHaveAttribute('aria-valuenow', '68');
    expect(polls).toBeGreaterThan(0);
    await expect(button).toBeDisabled();
    await page.reload();
    await expect(progress).toHaveAttribute('aria-valuenow', '68');
    expect(starts).toBe(1);
    interruptPolling = true;
    await expect(page.getByText('Temporary polling interruption', { exact: true })).toBeVisible();
    await expect(progress).toHaveAttribute('aria-valuenow', '68');
    await expect(button).toBeDisabled();
    expect(starts).toBe(1);
    interruptPolling = false;
    complete = true;
    await expect(progress).toHaveAttribute('aria-valuenow', '100');
    await expect(page.getByText('Đồng bộ hoàn tất (37 công tơ)', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'chưa tải được lịch sử' })).toBeVisible();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(progress).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      for (const id of ['hunonic-energy-total', 'hunonic-cost-total']) {
        expect(await page.getByTestId(id).evaluate(el => el.scrollWidth <= el.clientWidth && getComputedStyle(el).textOverflow !== 'ellipsis')).toBe(true);
      }
      await page.screenshot({ path: testInfo.outputPath(`hunonic-${width}.png`), fullPage: true });
    }
    await page.goto('/settings?section=hunonic');
    await expect(page.getByText('37 công tơ (37 online)', { exact: true })).toBeVisible();
    await expect(page.getByText('Chưa đồng bộ', { exact: true })).toHaveCount(0);
    expect(starts).toBe(1);
    expect(errors).toEqual([]);
  });
});
