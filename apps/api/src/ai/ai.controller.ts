import { Controller, Post, Get, Body, Req, UseGuards, Param, BadRequestException } from '@nestjs/common';
import { AgentRouterService } from './agents/agent-router.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma.service';
import { AiMessage } from './providers/ai-provider.interface';

import { Throttle } from '@nestjs/throttler';
import { ChatRequestDto } from './dto/chat.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly agentRouter: AgentRouterService,
    private readonly prisma: PrismaService,
  ) {}

  @Throttle({ short: { limit: 20, ttl: 60000 } })
  @Post('chat')
  async chat(@Req() req: any, @Body() body: ChatRequestDto) {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    // req.user.permissions is assumed to be an array of strings
    const permissions = req.user.permissions || [];

    if (!body.messages || body.messages.length > 50) {
       throw new BadRequestException('Too many messages in context. Max 50 allowed.');
    }
    const totalChars = body.messages.reduce((acc, msg) => acc + (msg.content?.length || 0), 0);
    if (totalChars > 100000) {
       throw new BadRequestException('Context payload too large.');
    }

    const messages = body.messages.map((message) => ({
      role: 'user',
      content: message.content,
    })) as AiMessage[];

    const result = await this.agentRouter.processMessage(tenantId, userId, permissions, messages, body.options?.conversationId, body.options?.agent);
    
    // Save conversation history (simple implementation)
    let convId = body.options?.conversationId;
    if (!convId) {
      const conv = await this.prisma.aiConversation.create({
        data: {
          tenantId,
          userId,
          title: 'New Conversation',
          module: body.options?.module || 'chat',
        }
      });
      convId = conv.id;
    }

    // Save user messages and assistant messages
    for (const msg of messages) {
      await this.prisma.aiMessage.create({
        data: {
          conversationId: convId,
          role: msg.role,
          content: msg.content,
        }
      });
    }

    const aiMessage = await this.prisma.aiMessage.create({
      data: {
        conversationId: convId,
        role: result.message.role,
        content: result.message.content,
      }
    });

    // Check if tool call log exists
    let toolCallLog = null;
    try {
      const parsed = JSON.parse(result.message.content);
      if (parsed._toolCallLog) {
        toolCallLog = parsed._toolCallLog;
      }
    } catch(e) {}

    if (toolCallLog) {
       await this.prisma.aiToolCall.create({
         data: {
           messageId: aiMessage.id,
           name: toolCallLog.name,
           arguments: toolCallLog.arguments,
           status: toolCallLog.status,
           durationMs: toolCallLog.durationMs,
         }
       });
    }

    return {
      conversationId: convId,
      result
    };
  }

  @Get('conversations')
  async getConversations(@Req() req: any) {
    return this.prisma.aiConversation.findMany({
      where: { tenantId: req.user.tenantId, userId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });
  }

  @Get('conversations/:id')
  async getConversationDetails(@Req() req: any, @Param('id') id: string) {
    return this.prisma.aiConversation.findFirst({
      where: { id, tenantId: req.user.tenantId, userId: req.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  }

  @Get('usage')
  async getUsage(@Req() req: any) {
    return this.prisma.aiTokenUsage.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  @Get('prompts')
  async getPrompts(@Req() req: any) {
    return this.prisma.aiPromptTemplate.findMany({
      where: {
        OR: [
          { tenantId: req.user.tenantId },
          { tenantId: null }
        ],
        isActive: true
      }
    });
  }

  @Post('prompts')
  async createPrompt(@Req() req: any, @Body() body: any) {
    return this.prisma.aiPromptTemplate.create({
      data: {
        ...body,
        tenantId: req.user.tenantId
      }
    });
  }
}
