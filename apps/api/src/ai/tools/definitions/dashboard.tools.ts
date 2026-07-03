import { AiTool, AiToolContext, AiToolDefinition } from '../tool.interface';

export class GetDashboardSummaryTool implements AiTool {
  definition: AiToolDefinition = {
    name: 'getDashboardSummary',
    description: 'Lấy tóm tắt các số liệu tổng quan trên dashboard của hệ thống',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    },
    isSafe: true,
    requiredPermissions: ['dashboard.read']
  };

  async execute(args: any, context: AiToolContext): Promise<any> {
    return {
      message: 'Dashboard summary retrieved successfully',
      data: {
        totalRevenue: 500000000,
        occupancyRate: 85,
        overdueInvoices: 5
      }
    };
  }
}
