import { Controller, Get, Post, Param, UseGuards, Body } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Automation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('automation')
export class AutomationController {
  constructor(
    private readonly automationService: AutomationService,
    private readonly cls: ClsService,
    private readonly prisma: PrismaService
  ) {}

  private async getTenantId() {
    const userId = this.cls.get('userId');
    const user = await this.prisma.user.findUnique({ where: { id: userId }});
    return user.tenantId;
  }

  @Get('workflows')
  @ApiOperation({ summary: 'Get all static workflows' })
  async getWorkflows() {
    return await this.automationService.getWorkflows();
  }

  @Get('rules')
  @ApiOperation({ summary: 'Get all static rules' })
  async getRules() {
    return await this.automationService.getRules();
  }

  @Get('executions')
  @ApiOperation({ summary: 'Get recent workflow executions' })
  async getExecutions() {
    const tenantId = await this.getTenantId();
    return await this.automationService.getExecutions(tenantId);
  }

  @Get('executions/:id')
  @ApiOperation({ summary: 'Get workflow execution detail' })
  async getExecutionById(@Param('id') id: string) {
    const tenantId = await this.getTenantId();
    return await this.automationService.getExecutionById(tenantId, id);
  }

  @Post('workflows/:name/run')
  @ApiOperation({ summary: 'Manually run a workflow' })
  async runWorkflow(
    @Param('name') name: string,
    @Body() payload: any
  ) {
    return await this.automationService.triggerWorkflow(name, 'manual_run', payload);
  }

  @Post('rules/:name/run')
  @ApiOperation({ summary: 'Manually run a rule' })
  async runRule(
    @Param('name') name: string,
    @Body() context: any
  ) {
    return await this.automationService.runRule(name, context);
  }
}
