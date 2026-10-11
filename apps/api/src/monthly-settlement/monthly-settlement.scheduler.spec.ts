import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonthlySettlementScheduler } from './monthly-settlement.scheduler';

describe('Monthly settlement runtime ownership', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

  function setup() {
    const prisma = {
      tenantOrg: { findMany: vi.fn().mockResolvedValue([{ id: 'tenant', name: 'Tenant' }]) },
      user: { findFirst: vi.fn().mockResolvedValue({ id: 'admin' }) },
    };
    const settlement = {
      getSettings: vi.fn().mockResolvedValue({ autoCloseEnabled: true, autoSendNotification: false }),
      finalizeUsagePeriod: vi.fn().mockResolvedValue({ usagePeriod: '2026-09', billingPeriod: '2026-10', lockedCount: 1 }),
      closeMonth: vi.fn().mockResolvedValue({ settledCount: 1, sentCount: 0 }),
      sendNotifications: vi.fn().mockResolvedValue({ totalRequested: 1, sentCount: 1, failedCount: 0 }),
    };
    return { prisma, settlement, scheduler: new MonthlySettlementScheduler(prisma as any, settlement as any) };
  }

  it('notification workers cannot close usage periods or create monthly invoices', async () => {
    vi.stubEnv('APP_RUNTIME_ROLE', 'notification-worker');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T16:59:59Z'));
    const { scheduler, prisma, settlement } = setup();
    await scheduler.handleAutoMonthEndClosing();
    await scheduler.handleAutoSendMonthlyPaymentNotifications();
    await scheduler.handleHeartbeatCheck();
    expect(prisma.tenantOrg.findMany).not.toHaveBeenCalled();
    expect(settlement.finalizeUsagePeriod).not.toHaveBeenCalled();
    expect(settlement.closeMonth).not.toHaveBeenCalled();
  });

  it.each(['api', 'all'])('retains month-end cutoff for %s runtime in Vietnam time', async (role) => {
    vi.stubEnv('APP_RUNTIME_ROLE', role);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T16:59:59Z'));
    const { scheduler, settlement } = setup();
    await scheduler.handleAutoMonthEndClosing();
    expect(settlement.finalizeUsagePeriod).toHaveBeenCalledWith('tenant', { period: '2026-09' });
    expect(settlement.closeMonth).toHaveBeenCalledWith('tenant', 'admin', {
      period: '2026-10',
      autoSend: false,
    });
  });

  it('sends the already-prepared billing period on the first day for API runtime', async () => {
    vi.stubEnv('APP_RUNTIME_ROLE', 'api');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T01:00:00Z'));
    const { scheduler, settlement } = setup();
    settlement.getSettings.mockResolvedValue({ autoCloseEnabled: true, autoSendNotification: true });
    await scheduler.handleAutoSendMonthlyPaymentNotifications();
    expect(settlement.sendNotifications).toHaveBeenCalledWith('tenant', 'admin', { period: '2026-10', dedupe: true });
    expect(settlement.closeMonth).not.toHaveBeenCalled();
  });
});
