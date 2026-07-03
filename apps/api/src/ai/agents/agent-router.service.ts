import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AgentRegistryService } from './agent-registry.service';
import { ToolRegistryService } from '../tools/tool-registry.service';
import { AiService } from '../ai.service';
import { AiMessage } from '../providers/ai-provider.interface';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AgentRouterService {
  private readonly logger = new Logger(AgentRouterService.name);

  constructor(
    private readonly agentRegistry: AgentRegistryService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  async processMessage(
    tenantId: string, 
    userId: string, 
    userPermissions: string[],
    messages: AiMessage[], 
    conversationId?: string,
    requestedAgent?: string
  ) {
    const agentName = requestedAgent || 'OperationsAgent';
    let agent;
    try {
       agent = this.agentRegistry.getAgent(agentName);
    } catch (e) {
       this.logger.warn(`Agent ${agentName} not found, falling back to basic chat`);
       return this.aiService.chat(tenantId, userId, messages, { conversationId, module: agentName });
    }

    // Prepare Tools based on Agent
    const agentTools = agent.definition.allowedTools.map(tName => {
      try {
        return this.toolRegistry.getTool(tName);
      } catch {
        return null;
      }
    }).filter(t => t !== null);

    // TODO: replace prompt parsing with OpenAI tool_choice/function calling after real provider verification
    // We will instruct the model via system prompt to respond with JSON if it wants to call a tool,
    // OR we can pass it natively if OpenAIProvider is upgraded.
    
    // Check tool permissions
    const availableToolsStr = agentTools.map(t => {
      return `- ${t.definition.name}: ${t.definition.description} (requires: ${t.definition.requiredPermissions?.join(', ') || 'none'})`;
    }).join('\n');

    const systemPrompt: AiMessage = {
      role: 'system',
      content: `${agent.definition.systemPrompt}
      
Các rule an toàn bắt buộc:
${agent.definition.safetyRules.map(r => '- ' + r).join('\n')}

Bạn có thể gọi các tool sau bằng cách trả về đúng định dạng JSON:
\`\`\`json
{
  "tool": "toolName",
  "args": { ... }
}
\`\`\`
Nếu không cần dùng tool, hãy trả lời bình thường.
Danh sách tool:
${availableToolsStr}`
    };

    const chatMessages = [systemPrompt, ...messages];
    
    const result = await this.aiService.chat(tenantId, userId, chatMessages, { conversationId, module: agentName });

    // Detect if AI called a tool
    let toolCallResult = null;
    let toolCallData = null;
    try {
      if (result.message.content.includes('```json')) {
        const jsonStr = result.message.content.split('```json')[1].split('```')[0].trim();
        const parsed = JSON.parse(jsonStr);
        if (parsed.tool) {
          toolCallData = parsed;
        }
      }
    } catch(e) {}

    if (toolCallData) {
      const toolToCall = agentTools.find(t => t.definition.name === toolCallData.tool);
      if (toolToCall) {
        // Permission Check
        const required = toolToCall.definition.requiredPermissions || [];
        const hasPermission = required.every(p => userPermissions.includes(p));
        
        if (!hasPermission) {
          throw new BadRequestException('AI_TOOL_PERMISSION_DENIED');
        }

        // Execute Tool with Timeout (30s)
        const startMs = Date.now();
        const timeoutMs = 30000;
        
        toolCallResult = await Promise.race([
          toolToCall.execute(toolCallData.args, { tenantId, userId, permissions: userPermissions }),
          new Promise((_, reject) => setTimeout(() => reject(new BadRequestException('AI_TOOL_TIMEOUT')), timeoutMs))
        ]);
        
        const durationMs = Date.now() - startMs;

        // Note: The message is saved in AiController. We can log the tool execution independently here.
        // It relies on AiMessage existing, but AiController handles messages after router returns.
        // For accurate tracking, AiController should handle tool call DB writes, but for this abstraction:
        
        result.message.content = JSON.stringify({
          actionRequired: toolCallResult.actionRequired,
          draftId: toolCallResult.data?.draftId,
          toolOutput: toolCallResult.message,
          data: toolCallResult.data,
          _toolCallLog: {
             name: toolCallData.tool,
             arguments: toolCallData.args,
             status: 'SUCCESS',
             durationMs
          }
        });
      }
    }

    return result;
  }
}
