import { Body, ConflictException, Controller, Get, Headers, NotFoundException, Post, Req, ServiceUnavailableException, UseGuards, BadRequestException, Param } from '@nestjs/common';
import { createHash } from 'crypto';
import { AgentRouterService } from './agents/agent-router.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma.service';
import { AiMessage } from './providers/ai-provider.interface';

import { Throttle } from '@nestjs/throttler';
import { ChatRequestDto } from './dto/chat.dto';

function isAiMessageRole(role: string): role is AiMessage['role'] {
  return role === 'system' || role === 'user' || role === 'assistant' || role === 'tool';
}

const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHAT_REQUEST_LEASE_MS = 5 * 60 * 1000;

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly agentRouter: AgentRouterService,
    private readonly prisma: PrismaService,
  ) {}

  private get chatRequestModel(): any {
    const model = (this.prisma as any).aiChatRequest;
    if (!model) {
      throw new ServiceUnavailableException('AI_CHAT_IDEMPOTENCY_UNAVAILABLE');
    }
    return model;
  }

  private requireIdempotencyKey(value?: string) {
    const key = String(value || '').trim().toLowerCase();
    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw new BadRequestException('Idempotency-Key phải là UUID hợp lệ');
    }
    return key;
  }

  private createRequestHash(body: ChatRequestDto, currentMessage: AiMessage) {
    return createHash('sha256').update(JSON.stringify({
      conversationId: body.options?.conversationId || null,
      agent: body.options?.agent || null,
      module: body.options?.module || null,
      message: { role: currentMessage.role, content: currentMessage.content },
    })).digest('hex');
  }

  private deterministicConversationId(tenantId: string, userId: string, idempotencyKey: string) {
    return `c${createHash('sha256').update(`ai-chat:${tenantId}:${userId}:${idempotencyKey}`).digest('hex').slice(0, 24)}`;
  }

  private async claimChatRequest(
    tenantId: string,
    userId: string,
    idempotencyKey: string,
    requestHash: string,
    suppliedConversationId?: string,
  ) {
    const conversationId = suppliedConversationId || this.deterministicConversationId(tenantId, userId, idempotencyKey);
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + CHAT_REQUEST_LEASE_MS);
    const data = {
      tenantId,
      userId,
      conversationId,
      idempotencyKey,
      requestHash,
      status: 'RUNNING',
      leaseExpiresAt,
    };

    try {
      return await this.chatRequestModel.create({ data });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
    }

    const existing = await this.chatRequestModel.findUnique({
      where: { tenantId_userId_idempotencyKey: { tenantId, userId, idempotencyKey } },
    });
    if (!existing) {
      throw new ConflictException('AI_CHAT_REQUEST_STATE_LOST');
    }
    if (existing.requestHash !== requestHash) {
      throw new ConflictException('AI_CHAT_REQUEST_MISMATCH');
    }
    if (existing.status === 'COMPLETED' && existing.result) {
      return existing;
    }
    if (existing.status === 'PROVIDER_COMPLETED' && existing.result) {
      return existing;
    }
    if (existing.status === 'RUNNING') {
      if (!existing.leaseExpiresAt || new Date(existing.leaseExpiresAt).getTime() > now.getTime()) {
        throw new ConflictException('AI_CHAT_REQUEST_RUNNING');
      }
      const reclaimed = await this.chatRequestModel.updateMany({
        where: { id: existing.id, status: 'RUNNING', leaseExpiresAt: { lte: now } },
        data: { leaseExpiresAt, errorCode: null },
      });
      if (reclaimed.count !== 1) {
        throw new ConflictException('AI_CHAT_REQUEST_RUNNING');
      }
      return { ...existing, status: 'RUNNING', leaseExpiresAt, errorCode: null };
    }
    if (existing.status === 'FAILED') {
      const reclaimed = await this.chatRequestModel.updateMany({
        where: { id: existing.id, status: 'FAILED' },
        data: { status: 'RUNNING', result: null, errorCode: null, completedAt: null, leaseExpiresAt },
      });
      if (reclaimed.count !== 1) {
        throw new ConflictException('AI_CHAT_REQUEST_RUNNING');
      }
      return { ...existing, status: 'RUNNING', result: null, errorCode: null, completedAt: null, leaseExpiresAt };
    }
    throw new ConflictException('AI_CHAT_REQUEST_STATE_INVALID');
  }

  private async resolveConversation(
    tenantId: string,
    userId: string,
    request: any,
    body: ChatRequestDto,
  ) {
    const existing = await this.prisma.aiConversation.findFirst({
      where: { id: request.conversationId, tenantId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (existing) return existing;
    if (body.options?.conversationId) {
      throw new NotFoundException('Conversation not found.');
    }

    try {
      const created = await this.prisma.aiConversation.create({
        data: {
          id: request.conversationId,
          tenantId,
          userId,
          title: 'New Conversation',
          module: body.options?.module || 'chat',
        },
      });
      return { ...created, messages: [] };
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      const concurrent = await this.prisma.aiConversation.findFirst({
        where: { id: request.conversationId, tenantId, userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      if (!concurrent) throw error;
      return concurrent;
    }
  }

  private async markProviderCompleted(requestId: string, response: any) {
    const updated = await this.chatRequestModel.updateMany({
      where: { id: requestId, status: 'RUNNING' },
      data: {
        status: 'PROVIDER_COMPLETED',
        result: response,
        errorCode: null,
        leaseExpiresAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('AI_CHAT_REQUEST_STATE_LOST');
    }
  }

  private async markChatRequestFailed(requestId: string, error: unknown) {
    await this.chatRequestModel.updateMany({
      where: { id: requestId, status: 'RUNNING' },
      data: {
        status: 'FAILED',
        errorCode: String((error as any)?.message || 'AI_CHAT_FAILED').slice(0, 500),
        completedAt: new Date(),
        leaseExpiresAt: new Date(),
      },
    });
  }

  private async persistCompletedChat(requestId: string, conversationId: string, userMessage: AiMessage, response: any) {
    const assistantMessage = response?.result?.message;
    if (!assistantMessage || !isAiMessageRole(String(assistantMessage.role))) {
      throw new BadRequestException('AI_CHAT_RESPONSE_INVALID');
    }

    let toolCallLog: any = null;
    try {
      const parsed = JSON.parse(assistantMessage.content);
      toolCallLog = parsed?._toolCallLog || null;
    } catch {
      toolCallLog = null;
    }

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.aiMessage.create({
        data: { conversationId, role: userMessage.role, content: userMessage.content },
      });
      const assistant = await tx.aiMessage.create({
        data: { conversationId, role: assistantMessage.role, content: assistantMessage.content },
      });
      if (toolCallLog) {
        await tx.aiToolCall.create({
          data: {
            messageId: assistant.id,
            name: toolCallLog.name,
            arguments: toolCallLog.arguments,
            status: toolCallLog.status,
            durationMs: toolCallLog.durationMs,
          },
        });
      }
      const completed = await (tx as any).aiChatRequest.updateMany({
        where: { id: requestId, status: 'PROVIDER_COMPLETED' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      if (completed.count !== 1) {
        throw new ConflictException('AI_CHAT_REQUEST_STATE_LOST');
      }
      return user;
    });
  }

  @Throttle({ short: { limit: 20, ttl: 60000 } })
  @Post('chat')
  async chat(
    @Req() req: any,
    @Body() body: ChatRequestDto,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
  ) {
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

    const rawCurrentMessage = body.messages.at(-1);
    if (!rawCurrentMessage) {
      throw new BadRequestException('A current user message is required.');
    }
    if (rawCurrentMessage.role !== 'user') {
      throw new BadRequestException('Current message must have user role.');
    }
    const currentMessage: AiMessage = {
      role: 'user',
      content: String(rawCurrentMessage.content || ''),
    };

    const idempotencyKey = this.requireIdempotencyKey(idempotencyKeyHeader);
    const request = await this.claimChatRequest(
      tenantId,
      userId,
      idempotencyKey,
      this.createRequestHash(body, currentMessage),
      body.options?.conversationId,
    );
    if (request.status === 'COMPLETED' && request.result) {
      return request.result;
    }

    if (body.options?.conversationId) {
      try {
        const ownedConversation = await this.prisma.aiConversation.findFirst({
          where: {
            id: body.options.conversationId,
            tenantId,
            userId,
          },
          select: { id: true },
        });
        if (!ownedConversation) {
          throw new NotFoundException('Conversation not found.');
        }
      } catch (error) {
        if (request.status === 'RUNNING') {
          await this.markChatRequestFailed(request.id, error);
        }
        throw error;
      }
    }

    let conversation;
    try {
      conversation = await this.resolveConversation(tenantId, userId, request, body);
    } catch (error) {
      if (request.status === 'RUNNING') {
        await this.markChatRequestFailed(request.id, error);
      }
      throw error;
    }

    const persistedMessages: AiMessage[] = 'messages' in conversation
      ? conversation.messages.reduce((messages: AiMessage[], message: { role: string; content: string }) => {
          if (isAiMessageRole(message.role)) {
            messages.push({ role: message.role, content: message.content });
          }
          return messages;
        }, [] as AiMessage[])
      : [];
    const providerMessages = [
      ...persistedMessages,
      {
        role: currentMessage.role,
        content: currentMessage.content,
      },
    ] as AiMessage[];

    let response = request.status === 'PROVIDER_COMPLETED' ? request.result : null;
    if (!response) {
      try {
        const result = await this.agentRouter.processMessage(
          tenantId,
          userId,
          permissions,
          providerMessages,
          conversation.id,
          body.options?.agent,
        );
        response = { conversationId: conversation.id, result };
        await this.markProviderCompleted(request.id, response);
      } catch (error) {
        await this.markChatRequestFailed(request.id, error);
        throw error;
      }
    }

    await this.persistCompletedChat(request.id, conversation.id, currentMessage, response);
    return response;
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
