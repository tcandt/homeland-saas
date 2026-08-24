import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ClsModule } from 'nestjs-cls';
import { EventEmitterModule } from '@nestjs/event-emitter';

import appConfig from './shared/config/app.config';
import authConfig from './shared/config/auth.config';

import { HealthController } from './health.controller';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './shared/audit/audit.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './shared/guards/permissions.guard';
import { BuildingsModule } from './buildings/buildings.module';
import { FloorsModule } from './floors/floors.module';
import { RoomsModule } from './rooms/rooms.module';
import { CustomersModule } from './customers/customers.module';
import { ContractsModule } from './contracts/contracts.module';
import { InvoicesModule } from './invoices/invoices.module';
import { DepositsModule } from './deposits/deposits.module';
import { FinanceModule } from './finance/finance.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SalesModule } from './sales/sales.module';
import { AiModule } from './ai/ai.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { EventsModule } from './shared/events/events.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { ReportsModule } from './reports/reports.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ReportSchedulerService } from './reports/report-scheduler.service';
import { AutomationModule } from './automation/automation.module';
import { CommunicationModule } from './communication/communication.module';
import { DocumentsModule } from './documents/documents.module';
import { MetricsModule } from './metrics/metrics.module';
import { ClockModule } from './shared/clock/clock.module';
import { v4 as uuidv4 } from 'uuid';
import { RepositoriesModule } from './shared/repositories/repositories.module';
import { SettingsModule } from './settings/settings.module';
import { PaymentsModule } from './payments/payments.module';
import { HunonicModule } from './hunonic/hunonic.module';
import { SystemUpdateModule } from './system-update/system-update.module';
import { schedulesEnabled, validateEnvironment } from './shared/config/environment.validation';
import { InternalTokenGuard } from './shared/guards/internal-token.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, authConfig],
      validate: validateEnvironment,
    }),
    PrismaModule,
    ClockModule,
    RepositoriesModule,
    LoggerModule.forRootAsync({
      useFactory: () => {
        const { ClsServiceManager } = require('nestjs-cls');
        return {
          pinoHttp: {
            level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
            transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
            customProps: (req, res) => {
              const cls = ClsServiceManager.getClsService();
              return {
                service: 'homeland-api',
                correlationId: cls?.getId() || req.headers['x-correlation-id'],
                userId: cls?.get('userId'),
                tenantId: cls?.get('tenantId'),
                method: req.method,
                path: req.url,
              };
            },
            redact: {
              paths: [
                'req.headers.authorization', 
                'req.headers.cookie', 
                'req.headers["x-api-key"]',
                'body.password', 
                'body.refreshToken', 
                'body.accessToken',
                'body.signatureBase64',
                'body.document',
                '*.password',
                '*.token',
                '*.accessToken',
                '*.refreshToken'
              ],
              censor: '[REDACTED]',
            },
          },
        };
      },
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { 
        mount: true, 
        generateId: true,
        idGenerator: (req: any) => req.headers['x-correlation-id'] || uuidv4(),
        setup: (cls, req, res) => { 
          // We wrap cls.set in a try-catch to completely avoid the 500 error if context is not fully ready
          try {
            cls.set('userId', req.user?.id); 
            if (res) {
              res.setHeader('x-correlation-id', cls.getId());
            }
          } catch (e) {
            // Ignore if context is not active
          }
        } 
      },
    }),
    EventEmitterModule.forRoot({ wildcard: true }),
    ScheduleModule.forRoot({ cronJobs: schedulesEnabled() }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const { redisStore } = await import('cache-manager-redis-yet');
        return {
          store: await redisStore({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            ttl: 60000,
          }),
        };
      },
    }),
    ThrottlerModule.forRoot([{
      name: 'short',
      ttl: 60000,
      limit: process.env.ENABLE_E2E_TEST_UTILS === 'true' ? 9999 : Number(process.env.THROTTLER_LIMIT ?? 100),
    }]),
    EventsModule,
    AuditModule,
    AuthModule,
    BuildingsModule,
    FloorsModule,
    RoomsModule,
    CustomersModule,
    ContractsModule,
    InvoicesModule,
    DepositsModule,
    FinanceModule,
    DashboardModule,
    SalesModule,
    ReportsModule,
    AnalyticsModule,
    AutomationModule,
    CommunicationModule,
    DocumentsModule,
    AiModule,
    MetricsModule,
    SettingsModule,
    PaymentsModule,
    HunonicModule,
    SystemUpdateModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    InternalTokenGuard,
    ReportSchedulerService,
  ],
})
export class AppModule {}
