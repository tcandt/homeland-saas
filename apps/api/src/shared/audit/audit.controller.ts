import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RequirePermissions } from '../decorators/require-permissions.decorator';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('logs')
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'List recent audit logs for the current tenant' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'module', required: false, description: 'Comma-separated module names, e.g. Auth,Settings' })
  @ApiQuery({ name: 'action', required: false, enum: AuditAction })
  @ApiQuery({ name: 'userEmail', required: false })
  listLogs(
    @CurrentUser('tenantId') tenantId: string,
    @Query('limit') limit?: string,
    @Query('module') module?: string,
    @Query('action') action?: AuditAction,
    @Query('userEmail') userEmail?: string,
  ) {
    return this.audit.listRecent({
      tenantId,
      limit: Number(limit || 50),
      module,
      action,
      userEmail,
    });
  }
}
