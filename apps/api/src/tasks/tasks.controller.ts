import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../shared/decorators/require-permissions.decorator';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @RequirePermissions('task.read')
  @ApiOperation({ summary: 'List active tenant tasks' })
  list(@CurrentUser('tenantId') tenantId: string) {
    return this.tasksService.list(tenantId);
  }

  @Get('summary')
  @RequirePermissions('task.read')
  @ApiOperation({ summary: 'Get tenant task board summary' })
  summary(@CurrentUser('tenantId') tenantId: string) {
    return this.tasksService.getSummary(tenantId);
  }

  @Get(':id')
  @RequirePermissions('task.read')
  @ApiOperation({ summary: 'Get an active tenant task' })
  detail(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.tasksService.getDetail(id, tenantId);
  }

  @Patch(':id/status')
  @RequirePermissions('task.update')
  @ApiOperation({ summary: 'Transition an active tenant task status' })
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status?: string },
    @CurrentUser('tenantId') tenantId: string,
  ) {
    return this.tasksService.updateStatus(id, body?.status, tenantId);
  }
}
