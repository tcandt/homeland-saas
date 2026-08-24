import { Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsSchedulerService } from './metrics.scheduler';
import { MetricsController } from './metrics.controller';
import { InternalTokenGuard } from '../shared/guards/internal-token.guard';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: {
        enabled: true,
      },
      controller: MetricsController,
    }),
  ],
  providers: [
    // HTTP metrics
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
    makeCounterProvider({
      name: 'http_errors_total',
      help: 'Total number of HTTP errors (4xx/5xx)',
      labelNames: ['method', 'route', 'status'],
    }),
    // Business metrics
    makeGaugeProvider({
      name: 'active_contracts_total',
      help: 'Number of currently active contracts',
    }),
    makeGaugeProvider({
      name: 'active_rooms_total',
      help: 'Number of currently occupied rooms',
    }),
    makeGaugeProvider({
      name: 'monthly_revenue',
      help: 'Total revenue collected this month (VND)',
    }),
    makeGaugeProvider({
      name: 'payment_webhook_logs',
      help: 'Number of payment webhook logs by provider and processing status',
      labelNames: ['provider', 'status'],
    }),
    makeGaugeProvider({
      name: 'sepay_reconciliation_audit_issues',
      help: 'Number of SePay reconciliation audit issues by type and severity',
      labelNames: ['type', 'severity'],
    }),
    makeGaugeProvider({
      name: 'notification_queue_items',
      help: 'Number of notification queue items by channel and status',
      labelNames: ['channel', 'status'],
    }),
    makeGaugeProvider({
      name: 'notification_queue_oldest_age_seconds',
      help: 'Age in seconds of the oldest pending notification queue item',
    }),
    makeGaugeProvider({
      name: 'notification_worker_heartbeat_age_seconds',
      help: 'Age in seconds of the latest notification worker heartbeat file',
    }),
    makeGaugeProvider({
      name: 'hunonic_sync_latest_status',
      help: 'Number of enabled Hunonic tenants grouped by latest sync status',
      labelNames: ['status'],
    }),
    makeGaugeProvider({
      name: 'hunonic_sync_enabled_tenants',
      help: 'Number of tenants with Hunonic sync enabled',
    }),
    makeGaugeProvider({
      name: 'hunonic_sync_missing_tenants',
      help: 'Number of enabled Hunonic tenants without any sync log yet',
    }),
    makeGaugeProvider({
      name: 'hunonic_sync_oldest_age_seconds',
      help: 'Age in seconds of the oldest latest Hunonic sync observation across enabled tenants',
    }),
    makeGaugeProvider({
      name: 'backup_age_seconds',
      help: 'Age in seconds of the latest successful production backup manifest',
    }),
    makeGaugeProvider({
      name: 'backup_last_success',
      help: '1 when the latest production backup manifest reports success, otherwise 0',
    }),
    makeGaugeProvider({
      name: 'backup_off_host_last_success',
      help: '1 when the latest successful backup also has an off-host location, otherwise 0',
    }),
    makeGaugeProvider({
      name: 'backup_retention_local_copies',
      help: 'Number of local backup copies currently retained by the latest retention report',
    }),
    makeGaugeProvider({
      name: 'backup_retention_prunable_copies',
      help: 'Number of local backup copies marked prunable by the latest retention report',
    }),
    // AI metrics
    makeCounterProvider({
      name: 'ai_calls_total',
      help: 'Total AI provider API calls',
      labelNames: ['provider', 'model'],
    }),
    makeCounterProvider({
      name: 'ai_tokens_total',
      help: 'Total AI tokens consumed',
      labelNames: ['provider', 'model'],
    }),
    // Services
    MetricsService,
    MetricsInterceptor,
    MetricsSchedulerService,
    InternalTokenGuard,
  ],
  exports: [MetricsService, MetricsInterceptor],
})
export class MetricsModule {}
