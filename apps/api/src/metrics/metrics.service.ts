import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MetricsService implements OnModuleInit {
  constructor(
    @InjectMetric('http_requests_total') private readonly requestsTotal: Counter<string>,
    @InjectMetric('http_request_duration_seconds') private readonly requestDuration: Histogram<string>,
    @InjectMetric('http_errors_total') private readonly errorsTotal: Counter<string>,
    @InjectMetric('active_contracts_total') private readonly activeContracts: Gauge<string>,
    @InjectMetric('active_rooms_total') private readonly activeRooms: Gauge<string>,
    @InjectMetric('monthly_revenue') private readonly monthlyRevenue: Gauge<string>,
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
        this.prisma.contract.count({ where: { status: 'ACTIVE' } }),
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
    } catch (e) {
      // Don't crash if metrics refresh fails
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
