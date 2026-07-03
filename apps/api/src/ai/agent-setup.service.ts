import { Injectable, OnModuleInit } from '@nestjs/common';
import { AgentRegistryService } from './agents/agent-registry.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { FinanceAgent } from './agents/definitions/finance.agent';
import { BuildingAgent, DocumentAgent, OperationsAgent, ContractAgent, SalesAgent } from './agents/definitions/core.agents';
import { GetDashboardSummaryTool } from './tools/definitions/dashboard.tools';
import { SearchRoomsTool, GetRoomDetailTool } from './tools/definitions/rooms.tools';
import { ListOverdueInvoicesTool, GetFinanceSummaryTool } from './tools/definitions/finance.tools';
import { SearchDocumentsTool } from './tools/definitions/documents.tools';
import { CreateTaskDraftTool, CreateNotificationDraftTool } from './tools/definitions/actions.tools';

@Injectable()
export class AgentSetupService implements OnModuleInit {
  constructor(
    private readonly agentRegistry: AgentRegistryService,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  onModuleInit() {
    // 1. Register Tools
    const tools = [
      new GetDashboardSummaryTool(),
      new SearchRoomsTool(),
      new GetRoomDetailTool(),
      new ListOverdueInvoicesTool(),
      new GetFinanceSummaryTool(),
      new SearchDocumentsTool(),
      new CreateTaskDraftTool(),
      new CreateNotificationDraftTool(),
    ];

    for (const tool of tools) {
      this.toolRegistry.registerTool(tool);
    }

    // 2. Register Agents
    const agents = [
      new FinanceAgent(),
      new BuildingAgent(),
      new DocumentAgent(),
      new OperationsAgent(),
      new ContractAgent(),
      new SalesAgent(),
    ];

    for (const agent of agents) {
      this.agentRegistry.registerAgent(agent);
    }
  }
}
