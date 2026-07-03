import { AiAgent, AiAgentDefinition } from '../agent.interface';
import { AiTool } from '../../tools/tool.interface';
import { GetFinanceSummaryTool, ListOverdueInvoicesTool } from '../../tools/definitions/finance.tools';
import { GetDashboardSummaryTool } from '../../tools/definitions/dashboard.tools';
import { CreateNotificationDraftTool } from '../../tools/definitions/actions.tools';

export class FinanceAgent implements AiAgent {
  definition: AiAgentDefinition = {
    id: 'agent_finance',
    name: 'FinanceAgent',
    description: 'Quản lý tài chính, doanh thu, công nợ và hóa đơn',
    systemPrompt: `Bạn là trợ lý Tài chính của hệ thống HomeLand PMS.
Chuyên môn của bạn là tổng hợp báo cáo doanh thu, thu chi, và theo dõi công nợ.
Luôn cung cấp thông tin tài chính một cách cẩn thận và chính xác.`,
    allowedTools: ['getFinanceSummary', 'listOverdueInvoices', 'getDashboardSummary', 'createNotificationDraft'],
    requiredPermissions: ['finance.read'],
    safetyRules: ['Không được approve hóa đơn', 'Không được thực hiện payment hay refund', 'Chỉ tạo notification nháp']
  };

  getTools(): AiTool[] {
    return [
      new GetFinanceSummaryTool(),
      new ListOverdueInvoicesTool(),
      new GetDashboardSummaryTool(),
      new CreateNotificationDraftTool()
    ];
  }
}
