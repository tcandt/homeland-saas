import { Controller, Get, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Public } from './shared/decorators/public.decorator';
import { InternalTokenGuard } from './shared/guards/internal-token.guard';
import * as fs from 'fs';
import { notificationWorkerHeartbeatPath, resolveAppRuntimeRole } from './shared/config/runtime-mode';
import { SchemaDiagnosticsService } from './schema-diagnostics.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly schemaDiagnostics?: SchemaDiagnosticsService) {}

  /** Liveness check: is the process running? */
  @Public()
  @Get()
  checkHealth() {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'HomeLand API',
    };
  }

  /** Readiness check: can the service serve traffic? */
  @Public()
  @Get('ready')
  async checkReadiness() {
    const checks: Record<string, { status: string; latencyMs?: number }> = {};

    // Check database
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks['database'] = { status: 'UP', latencyMs: Date.now() - dbStart };
    } catch {
      checks['database'] = { status: 'DOWN', latencyMs: Date.now() - dbStart };
    }

    // A successful `SELECT 1` only proves that PostgreSQL is reachable. Keep
    // traffic closed when the running application and database schema differ.
    const schemaStart = Date.now();
    try {
      const rows = await this.prisma.$queryRaw<Array<{ compatible: boolean }>>`
        SELECT (
          EXISTS (
            SELECT 1
            FROM "_prisma_migrations"
            WHERE migration_name = '20260923140000_add_ai_chat_requests'
              AND finished_at IS NOT NULL
              AND rolled_back_at IS NULL
          )
          AND EXISTS (
            SELECT 1
            FROM "_prisma_migrations"
            WHERE migration_name = '20261014130000_retire_sales_role_and_leads'
              AND finished_at IS NOT NULL
              AND rolled_back_at IS NULL
          )
          AND EXISTS (
            SELECT 1
            FROM "_prisma_migrations"
            WHERE migration_name = '20261017100000_booking_hold_cancel_adjustment_scope'
              AND finished_at IS NOT NULL
              AND rolled_back_at IS NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM "_prisma_migrations"
            WHERE finished_at IS NULL AND rolled_back_at IS NULL
          )
          AND to_regclass('public."SalesLead"') IS NULL
          AND (
            SELECT array_agg(e.enumlabel::text ORDER BY e.enumlabel::text)
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
              AND t.typname = 'RoleCode'
          ) = ARRAY['ADMIN', 'FINANCE', 'MANAGER']::text[]
          AND to_regclass('public."PaymentPromise"') IS NOT NULL
          AND to_regclass('public."NotificationTemplateVersion"') IS NOT NULL
          AND to_regclass('public."AiChatRequest"') IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'Customer'
              AND column_name = 'phoneNormalized'
          )
          AND EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'Customer'
              AND column_name = 'identityNoNormalized'
          )
        ) AS "compatible"
      `;
      checks['schema'] = {
        status: rows[0]?.compatible === true ? 'UP' : 'DOWN',
        latencyMs: Date.now() - schemaStart,
      };
    } catch {
      checks['schema'] = { status: 'DOWN', latencyMs: Date.now() - schemaStart };
    }

    const allUp = Object.values(checks).every((c) => c.status === 'UP');
    const result = {
      status: allUp ? 'READY' : 'NOT_READY',
      timestamp: new Date().toISOString(),
      checks,
    };
    if (!allUp) {
      throw new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        message: 'Service dependencies are not ready',
        details: result,
      });
    }
    return result;
  }

  /** Seed verification */
  @Public()
  @UseGuards(InternalTokenGuard)
  @Get('seed')
  async checkSeed() {
    try {
      const requiredBuildings = ['LK01.31', 'LK01.32', 'LK08.24', 'LK08.25'];
      const buildings = await this.prisma.building.findMany({
        where: { code: { in: requiredBuildings } },
      });

      const foundCodes = buildings.map((b) => b.code);
      const missing = requiredBuildings.filter((b) => !foundCodes.includes(b));

      if (missing.length === 0) {
        return { buildings: foundCodes };
      } else {
        throw new Error(`Seed FAILED: Missing buildings: ${missing.join(', ')}`);
      }
    } catch (error) {
      throw new Error(
        `Could not connect to database or query failed: ${error.message}`,
      );
    }
  }

  /** Build metadata verification */
  @Public()
  @UseGuards(InternalTokenGuard)
  @Get('build-info')
  getBuildInfo() {
    const heartbeatPath = notificationWorkerHeartbeatPath();
    let notificationWorkerHeartbeat = null;
    if (fs.existsSync(heartbeatPath)) {
      try {
        notificationWorkerHeartbeat = JSON.parse(fs.readFileSync(heartbeatPath, 'utf8'));
      } catch {
        notificationWorkerHeartbeat = { status: 'UNREADABLE', path: heartbeatPath };
      }
    }

    return {
      version: process.env.APP_VERSION || 'unknown',
      commit: process.env.COMMIT_SHA || 'unknown',
      buildId: process.env.BUILD_ID || 'unknown',
      buildTime: process.env.BUILD_TIME || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      // NODE_ENV is the runtime optimization mode, not the deployment target.
      deploymentEnvironment: process.env.DEPLOY_ENV || process.env.APP_ENV || process.env.ENVIRONMENT || process.env.NODE_ENV || 'development',
      runtimeRole: resolveAppRuntimeRole(),
      notificationWorkerHeartbeat,
    };
  }

  @Public()
  @UseGuards(InternalTokenGuard)
  @Get('staging-diagnostics')
  getStagingDiagnostics() {
    if (!this.schemaDiagnostics) throw new Error('Schema diagnostics service unavailable');
    return this.schemaDiagnostics.getDiagnostics();
  }
}
