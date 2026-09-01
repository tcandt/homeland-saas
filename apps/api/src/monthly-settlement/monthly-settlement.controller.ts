import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { MonthlySettlementService } from './monthly-settlement.service';

@ApiTags('Monthly Settlement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('monthly-settlement')
export class MonthlySettlementController {
  constructor(private readonly settlementService: MonthlySettlementService) {}

  @Get('overview')
  @RequirePermissions('invoice.read')
  @ApiOperation({ summary: 'Lấy dữ liệu thống kê chốt tháng và trạng thái gửi thông báo từng phòng' })
  getOverview(
    @CurrentUser('tenantId') tenantId: string,
    @Query('period') period?: string,
    @Query('buildingId') buildingId?: string,
    @Query('search') search?: string,
    @Query('notificationStatus') notificationStatus?: string,
    @Query('paymentStatus') paymentStatus?: string,
  ) {
    return this.settlementService.getOverview(tenantId, {
      period,
      buildingId,
      search,
      notificationStatus,
      paymentStatus,
    });
  }

  @Post('close-month')
  @RequirePermissions('invoice.update')
  @ApiOperation({ summary: 'Thực hiện chốt tháng (tạo hóa đơn và khóa chỉ số công tơ điện)' })
  closeMonth(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { period?: string; roomIds?: string[]; autoSend?: boolean },
  ) {
    return this.settlementService.closeMonth(tenantId, userId, body || {});
  }

  @Post('send-notifications')
  @RequirePermissions('invoice.update')
  @ApiOperation({ summary: 'Gửi thông báo thanh toán qua Zalo cho danh sách phòng' })
  sendNotifications(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { period?: string; roomIds?: string[]; invoiceIds?: string[] },
  ) {
    return this.settlementService.sendNotifications(tenantId, userId, body || {});
  }

  @Post('resend/:roomId')
  @RequirePermissions('invoice.update')
  @ApiOperation({ summary: 'Gửi lại thông báo thanh toán Zalo cho 1 phòng cụ thể' })
  resendSingle(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('roomId') roomId: string,
    @Body() body: { period?: string },
  ) {
    return this.settlementService.resendSingle(tenantId, userId, roomId, body?.period);
  }

  @Get('settings')
  @RequirePermissions('setting.read')
  @ApiOperation({ summary: 'Lấy cấu hình tự động chốt & gửi thông báo' })
  getSettings(@CurrentUser('tenantId') tenantId: string) {
    return this.settlementService.getSettings(tenantId);
  }

  @Post('settings')
  @RequirePermissions('setting.update')
  @ApiOperation({ summary: 'Cập nhật cấu hình tự động chốt & gửi thông báo' })
  saveSettings(@CurrentUser('tenantId') tenantId: string, @Body() body: any) {
    return this.settlementService.saveSettings(tenantId, body || {});
  }
}
