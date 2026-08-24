import { Controller, Get, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Public } from './shared/decorators/public.decorator';
import { InternalTokenGuard } from './shared/guards/internal-token.guard';
import * as fs from 'fs';
import { notificationWorkerHeartbeatPath, resolveAppRuntimeRole } from './shared/config/runtime-mode';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
      runtimeRole: resolveAppRuntimeRole(),
      notificationWorkerHeartbeat,
    };
  }
}
