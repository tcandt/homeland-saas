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
import { PrismaService } from '../prisma.service';
import { MetricsController } from './metrics.controller';

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
    PrismaService,
  ],
  exports: [MetricsService, MetricsInterceptor],
})
export class MetricsModule {}
