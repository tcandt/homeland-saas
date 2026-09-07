import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query } from '@nestjs/common';
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
  check(@Query('refresh') refresh?: string) {
    return this.systemUpdateService.checkForUpdates({ forceRefresh: refresh === 'true' || refresh === '1' });
  }

  @Get('status')
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Get current update job status' })
  status() {
    return this.systemUpdateService.getStatus();
  }

  @Post('install')
  @RequirePermissions('system.update.run')
  @ApiOperation({ summary: 'Create a controlled update job' })
  install(
    @CurrentUser('email') email: string,
    @Body() body: { targetVersion?: string; targetRef?: string; dryRun?: boolean },
  ) {
    assertSystemUpdateAdmin(email);
    return this.systemUpdateService.startInstall(body || {});
  }

  @Post('rollback')
  @RequirePermissions('system.update.run')
  @ApiOperation({ summary: 'Create a controlled rollback job' })
  rollback(
    @CurrentUser('email') email: string,
    @Body() body: { targetVersion?: string; dryRun?: boolean },
  ) {
    assertSystemUpdateAdmin(email);
    return this.systemUpdateService.startRollback(body || {});
  }

  @Post('wipe-data')
  @RequirePermissions('system.data.wipe')
  @ApiOperation({ summary: 'Wipe business data while preserving settings and accounts' })
  wipeData(
    @CurrentUser('email') email: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: { password?: string; scope?: string; confirmPhrase?: string },
  ) {
    assertSystemUpdateAdmin(email);
    return this.systemUpdateService.wipeData(userId, tenantId, body || {});
  }

  @Get('backups')
  @RequirePermissions('system.backup.read')
  @ApiOperation({ summary: 'Get backup agent connection status and snapshot list' })
  getBackups() {
    return this.systemUpdateService.getBackupStatus();
  }

  @Post('backups/create')
  @RequirePermissions('system.backup.create')
  @ApiOperation({ summary: 'Create manual backup snapshot' })
  createBackup(@CurrentUser('email') email: string, @Body() body?: { note?: string }) {
    assertSystemUpdateAdmin(email);
    return this.systemUpdateService.createBackupSnapshot(body);
  }

  @Post('backups/restore')
  @RequirePermissions('system.backup.restore')
  @ApiOperation({ summary: 'Restore data from a backup snapshot' })
  restoreBackup(
    @CurrentUser('email') email: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('tenantId') tenantId: string,
    @Body() body: { snapshotId: string; password?: string },
  ) {
    assertSystemUpdateAdmin(email);
    return this.systemUpdateService.restoreBackupSnapshot(userId, tenantId, body || { snapshotId: '' });
  }

  @Delete('backups/:id')
  @RequirePermissions('system.backup.delete')
  @ApiOperation({ summary: 'Delete a backup snapshot' })
  deleteBackup(@CurrentUser('email') email: string, @Param('id') snapshotId: string) {
    assertSystemUpdateAdmin(email);
    return this.systemUpdateService.deleteBackupSnapshot(snapshotId);
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
