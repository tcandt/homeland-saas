import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';
import { PrismaService } from '../prisma.service';
import { ACTIVE_LIKE_CONTRACT_STATUSES } from '../contracts/contracts.adapter';
import * as fs from 'fs';
import { notificationWorkerHeartbeatPath } from '../shared/config/runtime-mode';

@Injectable()
export class MetricsService implements OnModuleInit {
  constructor(
    @InjectMetric('http_requests_total') private readonly requestsTotal: Counter<string>,
    @InjectMetric('http_request_duration_seconds') private readonly requestDuration: Histogram<string>,
    @InjectMetric('http_errors_total') private readonly errorsTotal: Counter<string>,
    @InjectMetric('active_contracts_total') private readonly activeContracts: Gauge<string>,
    @InjectMetric('active_rooms_total') private readonly activeRooms: Gauge<string>,
    @InjectMetric('monthly_revenue') private readonly monthlyRevenue: Gauge<string>,
    @InjectMetric('payment_webhook_logs') private readonly paymentWebhookLogs: Gauge<string>,
    @InjectMetric('sepay_reconciliation_audit_issues') private readonly sepayReconciliationAuditIssues: Gauge<string>,
    @InjectMetric('notification_queue_items') private readonly notificationQueueItems: Gauge<string>,
    @InjectMetric('notification_queue_oldest_age_seconds') private readonly notificationQueueOldestAgeSeconds: Gauge<string>,
    @InjectMetric('notification_worker_heartbeat_age_seconds') private readonly notificationWorkerHeartbeatAgeSeconds: Gauge<string>,
    @InjectMetric('hunonic_sync_latest_status') private readonly hunonicSyncLatestStatus: Gauge<string>,
    @InjectMetric('hunonic_sync_enabled_tenants') private readonly hunonicSyncEnabledTenants: Gauge<string>,
    @InjectMetric('hunonic_sync_missing_tenants') private readonly hunonicSyncMissingTenants: Gauge<string>,
    @InjectMetric('hunonic_sync_oldest_age_seconds') private readonly hunonicSyncOldestAgeSeconds: Gauge<string>,
    @InjectMetric('backup_age_seconds') private readonly backupAgeSeconds: Gauge<string>,
    @InjectMetric('backup_last_success') private readonly backupLastSuccess: Gauge<string>,
    @InjectMetric('backup_off_host_last_success') private readonly backupOffHostLastSuccess: Gauge<string>,
    @InjectMetric('backup_retention_local_copies') private readonly backupRetentionLocalCopies: Gauge<string>,
    @InjectMetric('backup_retention_prunable_copies') private readonly backupRetentionPrunableCopies: Gauge<string>,
    @InjectMetric('ai_calls_total') private readonly aiCalls: Counter<string>,
    @InjectMetric('ai_tokens_total') private readonly aiTokens: Counter<string>,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Initialize business metrics on startup
    await this.refreshBusinessMetrics();
  }

  // Call this from a scheduler or on-demand
  async refreshBusinessMetrics() {
    try {
      const [contracts, rooms, revenue] = await Promise.all([
        this.prisma.contract.count({ where: { status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } } }),
        this.prisma.room.count({ where: { status: 'OCCUPIED' } }),
        this.prisma.invoice.aggregate({
          where: {
            status: 'PAID',
            updatedAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: { paidAmount: true },
        }),
      ]);

      this.activeContracts.set(contracts);
      this.activeRooms.set(rooms);
      this.monthlyRevenue.set(Number(revenue._sum.paidAmount ?? 0));
      await this.refreshOperationalMetrics();
    } catch (e) {
      // Don't crash if metrics refresh fails
    }
  }

  async refreshOperationalMetrics() {
    await Promise.all([
      this.refreshPaymentWebhookMetrics(),
      this.refreshSePayReconciliationAuditMetrics(),
      this.refreshNotificationQueueMetrics(),
      this.refreshNotificationWorkerHeartbeatMetrics(),
      this.refreshHunonicSyncMetrics(),
      this.refreshBackupMetrics(),
    ]);
  }

  private async refreshPaymentWebhookMetrics() {
    const statuses = ['RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'NEEDS_REVIEW', 'FAILED'];
    for (const status of statuses) {
      this.paymentWebhookLogs.set({ provider: 'SEPAY', status }, 0);
    }

    const rows = await this.prisma.$queryRaw<Array<{ provider: string; status: string; count: bigint }>>`
      SELECT "provider", "status", COUNT(*)::bigint AS "count"
      FROM "PaymentWebhookLog"
      GROUP BY "provider", "status"
    `;

    for (const row of rows) {
      this.paymentWebhookLogs.set(
        { provider: String(row.provider || 'UNKNOWN'), status: String(row.status || 'UNKNOWN') },
        Number(row.count || 0),
      );
    }
  }

  private async refreshNotificationQueueMetrics() {
    const statuses = ['QUEUED', 'SENDING', 'DELIVERED', 'FAILED', 'RETRYING', 'DEAD_LETTER'];
    const channels = ['IN_APP', 'CONSOLE', 'EMAIL', 'TELEGRAM', 'ZALO', 'SMS', 'PUSH'];
    for (const channel of channels) {
      for (const status of statuses) {
        this.notificationQueueItems.set({ channel, status }, 0);
      }
    }

    const rows = await this.prisma.$queryRaw<Array<{ channel: string; status: string; count: bigint }>>`
      SELECT "channel", "status", COUNT(*)::bigint AS "count"
      FROM "NotificationQueue"
      GROUP BY "channel", "status"
    `;

    for (const row of rows) {
      this.notificationQueueItems.set(
        { channel: String(row.channel), status: String(row.status) },
        Number(row.count || 0),
      );
    }

    const oldestRows = await this.prisma.$queryRaw<Array<{ createdAt: Date }>>`
      SELECT "createdAt"
      FROM "NotificationQueue"
      WHERE "status" IN ('QUEUED', 'FAILED', 'RETRYING', 'SENDING')
      ORDER BY "createdAt" ASC
      LIMIT 1
    `;
    const oldest = oldestRows[0]?.createdAt ? new Date(oldestRows[0].createdAt).getTime() : null;
    this.notificationQueueOldestAgeSeconds.set(oldest ? Math.max(0, (Date.now() - oldest) / 1000) : 0);
  }

  private async refreshSePayReconciliationAuditMetrics() {
    const issueDefinitions = [
      { type: 'CONFIRMED_REQUEST_SOURCE_OPEN', severity: 'critical' },
      { type: 'PROCESSED_WEBHOOK_REQUEST_UNCONFIRMED', severity: 'critical' },
      { type: 'OVERPAYMENT_REFUND_PENDING_STALE', severity: 'warning' },
      { type: 'WEBHOOK_REVIEW_STALE', severity: 'warning' },
      { type: 'UNMATCHED_WEBHOOK_STALE', severity: 'warning' },
      { type: 'CONFIRMED_REQUEST_MISSING_TRANSACTION_ID', severity: 'warning' },
    ];

    for (const issue of issueDefinitions) {
      this.sepayReconciliationAuditIssues.set({ type: issue.type, severity: issue.severity }, 0);
    }

    const [confirmedSourceOpenRows, processedUnconfirmedRows, refundPendingRows, reviewStaleRows, unmatchedStaleRows, missingTransactionRows] =
      await Promise.all([
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS "count"
          FROM "PaymentRequest" pr
          LEFT JOIN "Invoice" i
            ON pr."sourceType" = 'INVOICE'
           AND pr."sourceId" = i."id"
           AND i."deletedAt" IS NULL
          LEFT JOIN "Deposit" d
            ON pr."sourceType" = 'DEPOSIT'
           AND pr."sourceId" = d."id"
           AND d."deletedAt" IS NULL
          WHERE pr."provider" = 'SEPAY'
            AND pr."status" = 'CONFIRMED'
            AND (
              (pr."sourceType" = 'INVOICE' AND (COALESCE(i."total", 0) - COALESCE(i."paidAmount", 0) - COALESCE(i."creditAmount", 0)) > 0.01)
              OR
              (pr."sourceType" = 'DEPOSIT' AND COALESCE(d."status"::text, '') NOT IN ('PAID', 'CONVERTED_TO_CONTRACT'))
            )
        `,
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
          WITH log_codes AS (
            SELECT
              l."id",
              COALESCE(l."payload"->>'code', l."payload"->>'payment_code') AS "paymentCode"
            FROM "PaymentWebhookLog" l
            WHERE l."provider" = 'SEPAY'
              AND l."status" = 'PROCESSED'
          )
          SELECT COUNT(DISTINCT lc."id")::bigint AS "count"
          FROM log_codes lc
          INNER JOIN "PaymentRequest" pr
            ON pr."provider" = 'SEPAY'
           AND pr."paymentCode" = lc."paymentCode"
          WHERE pr."status" <> 'CONFIRMED'
        `,
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS "count"
          FROM "PaymentRequest"
          WHERE "provider" = 'SEPAY'
            AND "metadata"->>'overpaymentResolution' = 'REFUND_PENDING'
            AND COALESCE("metadata"->>'overpaymentRefundCompletedAt', '') = ''
            AND "updatedAt" < NOW() - INTERVAL '24 hours'
        `,
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS "count"
          FROM "PaymentWebhookLog"
          WHERE "provider" = 'SEPAY'
            AND "status" IN ('FAILED', 'NEEDS_REVIEW')
            AND "createdAt" < NOW() - INTERVAL '6 hours'
        `,
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS "count"
          FROM "PaymentWebhookLog"
          WHERE "provider" = 'SEPAY'
            AND "status" IN ('RECEIVED', 'PROCESSING')
            AND "processedAt" IS NULL
            AND "createdAt" < NOW() - INTERVAL '1 hour'
        `,
        this.prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::bigint AS "count"
          FROM "PaymentRequest"
          WHERE "provider" = 'SEPAY'
            AND "status" = 'CONFIRMED'
            AND "providerTransactionId" IS NULL
            AND COALESCE("metadata"->>'manualAssigned', 'false') <> 'true'
        `,
      ]);

    const issueRows = [
      { type: 'CONFIRMED_REQUEST_SOURCE_OPEN', severity: 'critical', count: Number(confirmedSourceOpenRows[0]?.count || 0) },
      { type: 'PROCESSED_WEBHOOK_REQUEST_UNCONFIRMED', severity: 'critical', count: Number(processedUnconfirmedRows[0]?.count || 0) },
      { type: 'OVERPAYMENT_REFUND_PENDING_STALE', severity: 'warning', count: Number(refundPendingRows[0]?.count || 0) },
      { type: 'WEBHOOK_REVIEW_STALE', severity: 'warning', count: Number(reviewStaleRows[0]?.count || 0) },
      { type: 'UNMATCHED_WEBHOOK_STALE', severity: 'warning', count: Number(unmatchedStaleRows[0]?.count || 0) },
      { type: 'CONFIRMED_REQUEST_MISSING_TRANSACTION_ID', severity: 'warning', count: Number(missingTransactionRows[0]?.count || 0) },
    ];

    for (const issue of issueRows) {
      this.sepayReconciliationAuditIssues.set({ type: issue.type, severity: issue.severity }, issue.count);
    }
  }

  private async refreshNotificationWorkerHeartbeatMetrics() {
    const heartbeatPath = notificationWorkerHeartbeatPath();
    if (!fs.existsSync(heartbeatPath)) {
      this.notificationWorkerHeartbeatAgeSeconds.set(315360000);
      return;
    }

    try {
      const payload = JSON.parse(fs.readFileSync(heartbeatPath, 'utf8'));
      const checkedAt = Date.parse(String(payload.checkedAt || ''));
      this.notificationWorkerHeartbeatAgeSeconds.set(
        Number.isFinite(checkedAt) ? Math.max(0, (Date.now() - checkedAt) / 1000) : 315360000,
      );
    } catch {
      this.notificationWorkerHeartbeatAgeSeconds.set(315360000);
    }
  }

  private async refreshHunonicSyncMetrics() {
    const statuses = ['RUNNING', 'SUCCESS', 'FAILED'];
    for (const status of statuses) {
      this.hunonicSyncLatestStatus.set({ status }, 0);
    }

    const enabledTenantRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS "count"
      FROM "AppSetting"
      WHERE "key" = 'hunonic'
        AND "scope" = 'TENANT'
        AND COALESCE("value"->>'enabled', 'false') = 'true'
    `;
    const enabledTenants = Number(enabledTenantRows[0]?.count || 0);
    this.hunonicSyncEnabledTenants.set(enabledTenants);

    if (enabledTenants === 0) {
      this.hunonicSyncMissingTenants.set(0);
      this.hunonicSyncOldestAgeSeconds.set(0);
      return;
    }

    const latestStatusRows = await this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      WITH enabled_tenants AS (
        SELECT "tenantId"
        FROM "AppSetting"
        WHERE "key" = 'hunonic'
          AND "scope" = 'TENANT'
          AND COALESCE("value"->>'enabled', 'false') = 'true'
      ),
      latest_logs AS (
        SELECT DISTINCT ON (l."tenantId")
          l."tenantId",
          l."status",
          COALESCE(l."finishedAt", l."startedAt") AS "observedAt"
        FROM "HunonicSyncLog" l
        INNER JOIN enabled_tenants et ON et."tenantId" = l."tenantId"
        ORDER BY l."tenantId", l."startedAt" DESC
      )
      SELECT COALESCE("status", 'UNKNOWN') AS "status", COUNT(*)::bigint AS "count"
      FROM latest_logs
      GROUP BY COALESCE("status", 'UNKNOWN')
    `;

    let tenantsWithLogs = 0;
    for (const row of latestStatusRows) {
      const status = String(row.status || 'UNKNOWN');
      const count = Number(row.count || 0);
      tenantsWithLogs += count;
      this.hunonicSyncLatestStatus.set({ status }, count);
    }
    this.hunonicSyncMissingTenants.set(Math.max(0, enabledTenants - tenantsWithLogs));

    const oldestRows = await this.prisma.$queryRaw<Array<{ observedAt: Date }>>`
      WITH enabled_tenants AS (
        SELECT "tenantId"
        FROM "AppSetting"
        WHERE "key" = 'hunonic'
          AND "scope" = 'TENANT'
          AND COALESCE("value"->>'enabled', 'false') = 'true'
      ),
      latest_logs AS (
        SELECT DISTINCT ON (l."tenantId")
          l."tenantId",
          COALESCE(l."finishedAt", l."startedAt") AS "observedAt"
        FROM "HunonicSyncLog" l
        INNER JOIN enabled_tenants et ON et."tenantId" = l."tenantId"
        ORDER BY l."tenantId", l."startedAt" DESC
      )
      SELECT MIN("observedAt") AS "observedAt"
      FROM latest_logs
    `;
    const oldest = oldestRows[0]?.observedAt ? new Date(oldestRows[0].observedAt).getTime() : null;
    this.hunonicSyncOldestAgeSeconds.set(
      oldest ? Math.max(0, (Date.now() - oldest) / 1000) : 315360000,
    );
  }

  private async refreshBackupMetrics() {
    const manifestPath = process.env.BACKUP_MANIFEST_PATH || '.codex-backups/production/latest-manifest.json';
    const retentionReportPath =
      process.env.BACKUP_RETENTION_REPORT_PATH ||
      `${manifestPath.endsWith('.json') ? manifestPath.replace(/latest-manifest\.json$/i, 'latest-retention-report.json') : '.codex-backups/production/latest-retention-report.json'}`;
    if (!fs.existsSync(manifestPath)) {
      this.backupLastSuccess.set(0);
      this.backupOffHostLastSuccess.set(0);
      this.backupAgeSeconds.set(315360000);
      this.backupRetentionLocalCopies.set(0);
      this.backupRetentionPrunableCopies.set(0);
      return;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const completedAt = Date.parse(String(manifest.completedAt || manifest.createdAt || ''));
    const success = manifest.status === 'SUCCESS' || manifest.success === true;

    this.backupLastSuccess.set(success ? 1 : 0);
    this.backupOffHostLastSuccess.set(success && manifest.offHostLocation ? 1 : 0);
    this.backupAgeSeconds.set(Number.isFinite(completedAt) ? Math.max(0, (Date.now() - completedAt) / 1000) : 315360000);

    if (!fs.existsSync(retentionReportPath)) {
      this.backupRetentionLocalCopies.set(0);
      this.backupRetentionPrunableCopies.set(0);
      return;
    }

    try {
      const retentionReport = JSON.parse(fs.readFileSync(retentionReportPath, 'utf8'));
      this.backupRetentionLocalCopies.set(Number(retentionReport?.summary?.retainedBackups || 0));
      this.backupRetentionPrunableCopies.set(Number(retentionReport?.summary?.prunableBackups || 0));
    } catch {
      this.backupRetentionLocalCopies.set(0);
      this.backupRetentionPrunableCopies.set(0);
    }
  }

  // Called by MetricsInterceptor
  recordRequest(method: string, path: string, statusCode: number, durationMs: number) {
    const route = this.normalizePath(path);
    this.requestsTotal.inc({ method, route, status: String(statusCode) });
    this.requestDuration.observe({ method, route }, durationMs / 1000);
    if (statusCode >= 400) {
      this.errorsTotal.inc({ method, route, status: String(statusCode) });
    }
  }

  recordAiCall(provider: string, model: string, tokens: number) {
    this.aiCalls.inc({ provider, model });
    this.aiTokens.inc({ provider, model }, tokens);
  }

  // Normalize dynamic path segments: /api/v1/rooms/123 => /api/v1/rooms/:id
  private normalizePath(path: string): string {
    return path
      .replace(/\/api\/v\d+/, '')
      .replace(/\/[0-9a-f-]{36}/gi, '/:id')  // UUIDs
      .replace(/\/\d+/g, '/:id')              // numeric IDs
      .split('?')[0]                           // strip query string
      || '/';
  }
}
