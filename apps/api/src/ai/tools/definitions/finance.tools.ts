import { AiTool, AiToolContext, AiToolDefinition } from '../tool.interface';

export class ListOverdueInvoicesTool implements AiTool {
  definition: AiToolDefinition = {
    name: 'listOverdueInvoices',
    description: 'Liệt kê danh sách các hóa đơn đã quá hạn thanh toán',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Số lượng tối đa' }
      },
      required: []
    },
    isSafe: true,
    requiredPermissions: ['finance.read']
  };

  async execute(args: any, context: AiToolContext): Promise<any> {
    return {
      message: 'Danh sách hóa đơn quá hạn',
      data: [
        { id: 'inv-1', amount: 5000000, daysOverdue: 5, room: 'A101' },
        { id: 'inv-2', amount: 3500000, daysOverdue: 2, room: 'B202' }
      ]
    };
  }
}

export class GetFinanceSummaryTool implements AiTool {
  definition: AiToolDefinition = {
    name: 'getFinanceSummary',
    description: 'Lấy báo cáo tổng quan tài chính (thu, chi, công nợ)',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', description: 'Kỳ báo cáo: month, quarter, year' }
      },
      required: ['period']
    },
    isSafe: true,
    requiredPermissions: ['finance.read']
  };

  async execute(args: any, context: AiToolContext): Promise<any> {
    return {
      message: `Báo cáo tài chính cho kỳ ${args.period}`,
      data: {
        revenue: 150000000,
        expense: 40000000,
        profit: 110000000
      }
    };
  }
}
