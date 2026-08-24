import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { MetricsService } from './metrics.service';

function metricMock() {
  return {
    inc: vi.fn(),
    observe: vi.fn(),
    set: vi.fn(),
  };
}

function sqlText(input: unknown) {
  if (Array.isArray(input)) return input.join(' ');
  return String(input ?? '');
}

describe('MetricsService operational metrics', () => {
  let tempDir: string;
  const originalBackupManifestPath = process.env.BACKUP_MANIFEST_PATH;
  const originalNotificationWorkerHeartbeatPath = process.env.NOTIFICATION_WORKER_HEARTBEAT_PATH;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-metrics-'));
  });

  afterEach(() => {
    process.env.BACKUP_MANIFEST_PATH = originalBackupManifestPath;
    process.env.NOTIFICATION_WORKER_HEARTBEAT_PATH = originalNotificationWorkerHeartbeatPath;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('publishes payment webhook, notification queue, and backup freshness metrics', async () => {
    const manifestPath = path.join(tempDir, 'latest-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      status: 'SUCCESS',
      completedAt: new Date(Date.now() - 5_000).toISOString(),
      offHostLocation: 'r2:homeland/backup-1',
    }));
    const retentionReportPath = path.join(tempDir, 'latest-retention-report.json');
    fs.writeFileSync(retentionReportPath, JSON.stringify({
      summary: {
        retainedBackups: 5,
        prunableBackups: 2,
      },
    }));
    process.env.BACKUP_MANIFEST_PATH = manifestPath;
    process.env.BACKUP_RETENTION_REPORT_PATH = retentionReportPath;
    const heartbeatPath = path.join(tempDir, 'notification-worker-heartbeat.json');
    fs.writeFileSync(heartbeatPath, JSON.stringify({
      checkedAt: new Date(Date.now() - 7_000).toISOString(),
    }));
    process.env.NOTIFICATION_WORKER_HEARTBEAT_PATH = heartbeatPath;

    const paymentWebhookLogs = metricMock();
    const sepayReconciliationAuditIssues = metricMock();
    const notificationQueueItems = metricMock();
    const notificationQueueOldestAgeSeconds = metricMock();
    const notificationWorkerHeartbeatAgeSeconds = metricMock();
    const hunonicSyncLatestStatus = metricMock();
    const hunonicSyncEnabledTenants = metricMock();
    const hunonicSyncMissingTenants = metricMock();
    const hunonicSyncOldestAgeSeconds = metricMock();
    const backupAgeSeconds = metricMock();
    const backupLastSuccess = metricMock();
    const backupOffHostLastSuccess = metricMock();
    const backupRetentionLocalCopies = metricMock();
    const backupRetentionPrunableCopies = metricMock();
    const prisma = {
      $queryRaw: vi.fn().mockImplementation(async (parts: TemplateStringsArray) => {
        const text = sqlText(parts);
        if (text.includes('FROM "PaymentWebhookLog"') && text.includes('GROUP BY "provider", "status"')) {
          return [{ provider: 'SEPAY', status: 'FAILED', count: 2n }];
        }
        if (text.includes('CONFIRMED_REQUEST_SOURCE_OPEN')) return [];
        if (text.includes('FROM "PaymentRequest" pr') && text.includes('pr."status" = \'CONFIRMED\'')) {
          return [{ count: 1n }];
        }
        if (text.includes('log_codes')) return [{ count: 2n }];
        if (text.includes('overpaymentResolution')) return [{ count: 0n }];
        if (text.includes('status" IN (\'FAILED\', \'NEEDS_REVIEW\')')) return [{ count: 3n }];
        if (text.includes('status" IN (\'RECEIVED\', \'PROCESSING\')')) return [{ count: 4n }];
        if (text.includes('providerTransactionId" IS NULL')) return [{ count: 0n }];
        if (text.includes('FROM "NotificationQueue"') && text.includes('GROUP BY "channel", "status"')) {
          return [{ channel: 'ZALO', status: 'DEAD_LETTER', count: 1n }];
        }
        if (text.includes('FROM "NotificationQueue"') && text.includes('LIMIT 1')) {
          return [{ createdAt: new Date(Date.now() - 12_000) }];
        }
        if (text.includes('latest_logs') && text.includes('GROUP BY COALESCE("status", \'UNKNOWN\')')) {
          return [{ status: 'SUCCESS', count: 1n }, { status: 'FAILED', count: 1n }];
        }
        if (text.includes('SELECT MIN("observedAt") AS "observedAt"')) {
          return [{ observedAt: new Date(Date.now() - 30 * 60_000) }];
        }
        if (text.includes('FROM "AppSetting"') && text.includes('COUNT(*)::bigint AS "count"')) {
          return [{ count: 2n }];
        }
        throw new Error(`Unexpected query: ${text}`);
      }),
    };

    const service = new MetricsService(
      metricMock() as any,
      metricMock() as any,
      metricMock() as any,
      metricMock() as any,
      metricMock() as any,
      metricMock() as any,
      paymentWebhookLogs as any,
      sepayReconciliationAuditIssues as any,
      notificationQueueItems as any,
      notificationQueueOldestAgeSeconds as any,
      notificationWorkerHeartbeatAgeSeconds as any,
      hunonicSyncLatestStatus as any,
      hunonicSyncEnabledTenants as any,
      hunonicSyncMissingTenants as any,
      hunonicSyncOldestAgeSeconds as any,
      backupAgeSeconds as any,
      backupLastSuccess as any,
      backupOffHostLastSuccess as any,
      backupRetentionLocalCopies as any,
      backupRetentionPrunableCopies as any,
      metricMock() as any,
      metricMock() as any,
      prisma as any,
    );

    await service.refreshOperationalMetrics();

    expect(paymentWebhookLogs.set).toHaveBeenCalledWith({ provider: 'SEPAY', status: 'FAILED' }, 2);
    expect(sepayReconciliationAuditIssues.set).toHaveBeenCalledWith(
      { type: 'CONFIRMED_REQUEST_SOURCE_OPEN', severity: 'critical' },
      1,
    );
    expect(sepayReconciliationAuditIssues.set).toHaveBeenCalledWith(
      { type: 'UNMATCHED_WEBHOOK_STALE', severity: 'warning' },
      4,
    );
    expect(notificationQueueItems.set).toHaveBeenCalledWith({ channel: 'ZALO', status: 'DEAD_LETTER' }, 1);
    expect(notificationQueueOldestAgeSeconds.set).toHaveBeenCalledWith(expect.any(Number));
    expect(notificationWorkerHeartbeatAgeSeconds.set).toHaveBeenCalledWith(expect.any(Number));
    expect(hunonicSyncEnabledTenants.set).toHaveBeenCalledWith(2);
    expect(hunonicSyncLatestStatus.set).toHaveBeenCalledWith({ status: 'FAILED' }, 1);
    expect(hunonicSyncMissingTenants.set).toHaveBeenCalledWith(0);
    expect(hunonicSyncOldestAgeSeconds.set).toHaveBeenCalledWith(expect.any(Number));
    expect(backupLastSuccess.set).toHaveBeenCalledWith(1);
    expect(backupOffHostLastSuccess.set).toHaveBeenCalledWith(1);
    expect(backupAgeSeconds.set).toHaveBeenCalledWith(expect.any(Number));
    expect(backupRetentionLocalCopies.set).toHaveBeenCalledWith(5);
    expect(backupRetentionPrunableCopies.set).toHaveBeenCalledWith(2);
    expect(backupAgeSeconds.set.mock.calls.at(-1)?.[0]).toBeLessThan(60);
  });

  it('marks backup metrics unhealthy when manifest is missing', async () => {
    process.env.BACKUP_MANIFEST_PATH = path.join(tempDir, 'missing.json');
    process.env.BACKUP_RETENTION_REPORT_PATH = path.join(tempDir, 'missing-retention.json');
    process.env.NOTIFICATION_WORKER_HEARTBEAT_PATH = path.join(tempDir, 'missing-heartbeat.json');

    const backupAgeSeconds = metricMock();
    const backupLastSuccess = metricMock();
    const backupOffHostLastSuccess = metricMock();
    const backupRetentionLocalCopies = metricMock();
    const backupRetentionPrunableCopies = metricMock();
    const sepayReconciliationAuditIssues = metricMock();
    const notificationQueueOldestAgeSeconds = metricMock();
    const notificationWorkerHeartbeatAgeSeconds = metricMock();
    const hunonicSyncLatestStatus = metricMock();
    const hunonicSyncEnabledTenants = metricMock();
    const hunonicSyncMissingTenants = metricMock();
    const hunonicSyncOldestAgeSeconds = metricMock();
    const prisma = {
      $queryRaw: vi.fn().mockImplementation(async (parts: TemplateStringsArray) => {
        const text = sqlText(parts);
        if (text.includes('FROM "PaymentWebhookLog"') && text.includes('GROUP BY "provider", "status"')) return [];
        if (text.includes('FROM "NotificationQueue"') && text.includes('GROUP BY "channel", "status"')) return [];
        if (text.includes('FROM "NotificationQueue"') && text.includes('LIMIT 1')) return [];
        if (text.includes('latest_logs') && text.includes('GROUP BY COALESCE("status", \'UNKNOWN\')')) return [];
        if (text.includes('SELECT MIN("observedAt") AS "observedAt"')) return [];
        if (text.includes('FROM "AppSetting"') && text.includes('COUNT(*)::bigint AS "count"')) return [{ count: 0n }];
        if (
          text.includes('FROM "PaymentRequest" pr') ||
          text.includes('log_codes') ||
          text.includes('overpaymentResolution') ||
          text.includes('PaymentWebhookLog') ||
          text.includes('providerTransactionId" IS NULL')
        ) {
          return [];
        }
        throw new Error(`Unexpected query: ${text}`);
      }),
    };

    const service = new MetricsService(
      metricMock() as any,
      metricMock() as any,
      metricMock() as any,
      metricMock() as any,
      metricMock() as any,
      metricMock() as any,
      metricMock() as any,
      sepayReconciliationAuditIssues as any,
      metricMock() as any,
      notificationQueueOldestAgeSeconds as any,
      notificationWorkerHeartbeatAgeSeconds as any,
      hunonicSyncLatestStatus as any,
      hunonicSyncEnabledTenants as any,
      hunonicSyncMissingTenants as any,
      hunonicSyncOldestAgeSeconds as any,
      backupAgeSeconds as any,
      backupLastSuccess as any,
      backupOffHostLastSuccess as any,
      backupRetentionLocalCopies as any,
      backupRetentionPrunableCopies as any,
      metricMock() as any,
      metricMock() as any,
      prisma as any,
    );

    await service.refreshOperationalMetrics();

    expect(sepayReconciliationAuditIssues.set).toHaveBeenCalledWith(
      { type: 'OVERPAYMENT_REFUND_PENDING_STALE', severity: 'warning' },
      0,
    );
    expect(backupLastSuccess.set).toHaveBeenCalledWith(0);
    expect(backupOffHostLastSuccess.set).toHaveBeenCalledWith(0);
    expect(backupAgeSeconds.set).toHaveBeenCalledWith(315360000);
    expect(hunonicSyncEnabledTenants.set).toHaveBeenCalledWith(0);
    expect(hunonicSyncMissingTenants.set).toHaveBeenCalledWith(0);
    expect(hunonicSyncOldestAgeSeconds.set).toHaveBeenCalledWith(0);
    expect(backupRetentionLocalCopies.set).toHaveBeenCalledWith(0);
    expect(backupRetentionPrunableCopies.set).toHaveBeenCalledWith(0);
    expect(notificationQueueOldestAgeSeconds.set).toHaveBeenCalledWith(0);
    expect(notificationWorkerHeartbeatAgeSeconds.set).toHaveBeenCalledWith(315360000);
  });
});
