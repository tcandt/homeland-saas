import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AiTool, AiToolContext } from './tool.interface';

@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private tools: Map<string, AiTool> = new Map();

  registerTool(tool: AiTool) {
    if (this.tools.has(tool.definition.name)) {
      this.logger.warn(`Tool ${tool.definition.name} is already registered. Overwriting.`);
    }
    this.tools.set(tool.definition.name, tool);
    this.logger.debug(`Registered AI Tool: ${tool.definition.name}`);
  }

  getTool(name: string): AiTool {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new BadRequestException(`AI Tool ${name} not found`);
    }
    return tool;
  }

  getAllTools(): AiTool[] {
    return Array.from(this.tools.values());
  }

  async executeTool(name: string, args: any, context: AiToolContext): Promise<any> {
    const tool = this.getTool(name);
    this.logger.log(`Executing tool ${name} with context ${JSON.stringify(context)}`);
    // Note: safety checks and permissions will be evaluated inside the tool itself or router
    return tool.execute(args, context);
  }
}
