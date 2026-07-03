import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AiAgent } from './agent.interface';

@Injectable()
export class AgentRegistryService {
  private readonly logger = new Logger(AgentRegistryService.name);
  private agents: Map<string, AiAgent> = new Map();

  registerAgent(agent: AiAgent) {
    if (this.agents.has(agent.definition.name)) {
      this.logger.warn(`Agent ${agent.definition.name} is already registered.`);
    }
    this.agents.set(agent.definition.name, agent);
    this.logger.debug(`Registered AI Agent: ${agent.definition.name}`);
  }

  getAgent(name: string): AiAgent {
    const agent = this.agents.get(name);
    if (!agent) {
      throw new BadRequestException(`AI Agent ${name} not found`);
    }
    return agent;
  }

  getAllAgents(): AiAgent[] {
    return Array.from(this.agents.values());
  }
}
