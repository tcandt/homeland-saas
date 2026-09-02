import { Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { SystemUpdateService } from './system-update.service';

@ApiTags('System Update')
@ApiBearerAuth()
@Controller('system-update')
export class SystemUpdateController {
  constructor(private readonly systemUpdateService: SystemUpdateService) {}

  @Get('check')
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Check current and available source versions' })
  check() {
    return this.systemUpdateService.checkForUpdates();
  }

  @Get('status')
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Get current update job status' })
  status() {
    return this.systemUpdateService.getStatus();
  }

  @Post('install')
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Create a controlled update job' })
  install(
    @CurrentUser('email') email: string,
    @Body() body: { targetVersion?: string; dryRun?: boolean },
  ) {
    assertSystemUpdateAdmin(email);
    return this.systemUpdateService.startInstall(body || {});
  }

  @Post('rollback')
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Create a controlled rollback job' })
  rollback(
    @CurrentUser('email') email: string,
    @Body() body: { targetVersion?: string; dryRun?: boolean },
  ) {
    assertSystemUpdateAdmin(email);
    return this.systemUpdateService.startRollback(body || {});
  }

  @Post('wipe-data')
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Wipe business data while preserving settings and accounts' })
  wipeData(
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: { password?: string; scope?: string; confirmPhrase?: string },
  ) {
    return this.systemUpdateService.wipeData(userId, tenantId, body || {});
  }
}

function assertSystemUpdateAdmin(email?: string) {
  if ((email || '').toLowerCase() !== 'admin@homeland.vn') {
    throw new ForbiddenException({
      code: 'SYSTEM_UPDATE_FORBIDDEN',
      message: 'Chỉ admin@homeland.vn được cập nhật hoặc rollback hệ thống.',
    });
  }
}
