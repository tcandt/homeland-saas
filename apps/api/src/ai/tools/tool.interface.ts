export interface AiToolContext {
  tenantId: string;
  userId: string;
  permissions?: string[];
}

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema format
  isSafe: boolean; // false if action requires user confirmation
  returnsDraft?: boolean;
  requiredPermissions?: string[];
}

export interface AiTool {
  definition: AiToolDefinition;
  execute(args: any, context: AiToolContext): Promise<any>;
}
