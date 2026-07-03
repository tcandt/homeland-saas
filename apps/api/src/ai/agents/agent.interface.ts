import { AiTool } from '../tools/tool.interface';

export interface AiAgentDefinition {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];
  requiredPermissions: string[];
  safetyRules: string[];
}

export interface AiAgent {
  definition: AiAgentDefinition;
  getTools(): AiTool[];
}
