import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { HunonicService } from './hunonic.service';

@ApiTags('Hunonic')
@ApiBearerAuth()
@Controller('hunonic')
export class HunonicController {
  constructor(private readonly hunonicService: HunonicService) {}

  @Get('overview')
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Get Hunonic electricity overview for managed buildings' })
  overview(@CurrentUser('tenantId') tenantId: string) {
    return this.hunonicService.getOverview(tenantId);
  }

  @Get('rates')
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Get Hunonic electricity rate groups for mapped meters' })
  rates(@CurrentUser('tenantId') tenantId: string) {
    return this.hunonicService.getElectricityRates(tenantId);
  }

  @Post('rates/apply')
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Apply Hunonic electricity rate group to selected meters' })
  applyRates(
    @Body() body: any,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.hunonicService.applyElectricityRates(tenantId, body || {});
  }

  @Get('history')
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Search Hunonic reading history for managed buildings' })
  history(
    @Query() query: any,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.hunonicService.getHistory(tenantId, query || {});
  }

  @Get('reconciliation')
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Compare Hunonic monthly electricity data with issued invoices' })
  reconciliation(
    @Query() query: any,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.hunonicService.getReconciliation(tenantId, query || {});
  }

  @Post('history/lock')
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Lock Hunonic monthly periods to prevent sync overwrite' })
  lockHistory(
    @Body() body: any,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.hunonicService.lockPeriods(tenantId, body || {});
  }

  @Post('history/unlock')
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Unlock Hunonic monthly periods to allow sync overwrite' })
  unlockHistory(
    @Body() body: any,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.hunonicService.unlockPeriods(tenantId, body || {});
  }

  @Get('rooms/:roomId/electricity')
  @RequirePermissions('room.read')
  @ApiOperation({ summary: 'Get latest Hunonic electricity data for a room' })
  roomElectricity(
    @Param('roomId') roomId: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.hunonicService.getRoomElectricity(tenantId, roomId);
  }

  @Post('sync')
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Run Hunonic sync for the current tenant' })
  sync(@CurrentUser('tenantId') tenantId: string) {
    return this.hunonicService.syncTenant(tenantId, undefined, { backfillMonths: 6 });
  }

  @Post('test')
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Test Hunonic credentials without saving readings' })
  test(
    @Body() body: any,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.hunonicService.testConnection(tenantId, body || {});
  }
}
