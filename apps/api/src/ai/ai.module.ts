import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenAIProvider } from './providers/openai.provider';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { AgentRegistryService } from './agents/agent-registry.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { AgentRouterService } from './agents/agent-router.service';
import { AgentSetupService } from './agent-setup.service';

import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AiController, KnowledgeController],
  providers: [PrismaService, AiService, OpenAIProvider, KnowledgeService, AgentRegistryService, ToolRegistryService, AgentRouterService, AgentSetupService],
  exports: [AiService, KnowledgeService, AgentRouterService]
})
export class AiModule {}
