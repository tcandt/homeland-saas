import { describe, expect, it, vi } from 'vitest';
import { AiController } from './ai.controller';

const request = {
  user: {
    tenantId: 'tenant-1',
    id: 'user-1',
    permissions: ['ai.chat'],
  },
};
const idempotencyKey = '018f1e54-6f53-4b4c-9c5f-8ed5f4b3b7d1';

function createSubject() {
  const prisma: any = {
    aiConversation: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    aiMessage: {
      create: vi.fn(),
    },
    aiToolCall: {
      create: vi.fn(),
    },
    aiChatRequest: {
      create: vi.fn(async ({ data }: any) => ({ id: 'chat-request-1', ...data })),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    aiTokenUsage: {
      findMany: vi.fn(),
    },
    aiPromptTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  };
  prisma.$transaction = vi.fn(async (callback: any) => callback({
    aiMessage: prisma.aiMessage,
    aiToolCall: prisma.aiToolCall,
    aiChatRequest: prisma.aiChatRequest,
  }));
  const agentRouter: any = {
    processMessage: vi.fn().mockResolvedValue({
      message: {
        role: 'assistant',
        content: 'Assistant response',
      },
    }),
  };

  return {
    controller: new AiController(agentRouter, prisma),
    prisma,
    agentRouter,
  };
}

describe('AiController chat persistence', () => {
  it('creates the conversation before routing and persists one message pair for a fresh turn', async () => {
    const { controller, prisma, agentRouter } = createSubject();
    prisma.aiConversation.create.mockResolvedValue({ id: 'conversation-1' });
    prisma.aiMessage.create
      .mockResolvedValueOnce({ id: 'user-message-1' })
      .mockResolvedValueOnce({ id: 'assistant-message-1' });

    const response = await controller.chat(request, {
      messages: [{ role: 'user', content: 'Hello' }],
      options: { agent: 'OperationsAgent' },
    } as any, idempotencyKey);

    expect(prisma.aiConversation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        title: 'New Conversation',
        module: 'chat',
      }),
    }));
    const conversationId = 'conversation-1';
    expect(prisma.aiConversation.create.mock.calls[0][0].data.id).toMatch(/^c[a-f0-9]{24}$/);
    expect(agentRouter.processMessage).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      ['ai.chat'],
      [{ role: 'user', content: 'Hello' }],
      conversationId,
      'OperationsAgent',
    );
    expect(prisma.aiMessage.create).toHaveBeenCalledTimes(2);
    expect(response.conversationId).toBe(conversationId);
  });

  it('uses stored ordered history and persists only the current turn when the client repeats a transcript', async () => {
    const { controller, prisma, agentRouter } = createSubject();
    prisma.aiConversation.findFirst.mockResolvedValue({
      id: 'conversation-1',
      messages: [
        { role: 'user', content: 'Earlier question' },
        { role: 'assistant', content: 'Earlier answer' },
      ],
    });
    prisma.aiMessage.create
      .mockResolvedValueOnce({ id: 'user-message-2' })
      .mockResolvedValueOnce({ id: 'assistant-message-2' });

    await controller.chat(request, {
      messages: [
        { role: 'user', content: 'Earlier question' },
        { role: 'assistant', content: 'Earlier answer' },
        { role: 'user', content: 'Follow-up question' },
      ],
      options: { conversationId: 'conversation-1' },
    } as any, '018f1e54-6f53-4b4c-9c5f-8ed5f4b3b7d2');

    expect(prisma.aiConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conversation-1', tenantId: 'tenant-1', userId: 'user-1' },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    expect(agentRouter.processMessage).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      ['ai.chat'],
      [
        { role: 'user', content: 'Earlier question' },
        { role: 'assistant', content: 'Earlier answer' },
        { role: 'user', content: 'Follow-up question' },
      ],
      'conversation-1',
      undefined,
    );
    expect(prisma.aiMessage.create).toHaveBeenCalledTimes(2);
    expect(prisma.aiMessage.create).toHaveBeenNthCalledWith(1, {
      data: {
        conversationId: 'conversation-1',
        role: 'user',
        content: 'Follow-up question',
      },
    });
  });

  it('conceals foreign or missing conversations before invoking the router', async () => {
    const { controller, prisma, agentRouter } = createSubject();
    prisma.aiConversation.findFirst.mockResolvedValue(null);

    await expect(controller.chat(request, {
      messages: [{ role: 'user', content: 'Hello' }],
      options: { conversationId: 'foreign-conversation' },
    } as any, '018f1e54-6f53-4b4c-9c5f-8ed5f4b3b7d3')).rejects.toThrow('Conversation not found.');

    expect(prisma.aiConversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-conversation', tenantId: 'tenant-1', userId: 'user-1' },
      select: { id: true },
    });
    expect(agentRouter.processMessage).not.toHaveBeenCalled();
    expect(prisma.aiMessage.create).not.toHaveBeenCalled();
    expect(prisma.aiChatRequest.create).toHaveBeenCalledTimes(1);
    expect(prisma.aiChatRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'chat-request-1', status: 'RUNNING' },
      data: expect.objectContaining({ status: 'FAILED' }),
    }));
  });

  it('replays a completed request without calling the provider or writing messages again', async () => {
    const { controller, prisma, agentRouter } = createSubject();
    const body: any = {
      messages: [{ role: 'user', content: 'Hello' }],
      options: { conversationId: 'conversation-1', agent: 'OperationsAgent' },
    };
    const result = { conversationId: 'conversation-1', result: { message: { role: 'assistant', content: 'Saved answer' } } };
    prisma.aiChatRequest.create.mockRejectedValue({ code: 'P2002' });
    prisma.aiChatRequest.findUnique.mockResolvedValue({
      id: 'chat-request-1',
      status: 'COMPLETED',
      requestHash: (controller as any).createRequestHash(body, body.messages.at(-1)),
      result,
    });

    await expect(controller.chat(request, body, idempotencyKey)).resolves.toEqual(result);

    expect(agentRouter.processMessage).not.toHaveBeenCalled();
    expect(prisma.aiConversation.findFirst).not.toHaveBeenCalled();
    expect(prisma.aiMessage.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('finishes a provider-completed request without calling the provider again', async () => {
    const { controller, prisma, agentRouter } = createSubject();
    const body: any = {
      messages: [{ role: 'user', content: 'Hello' }],
      options: { conversationId: 'conversation-1' },
    };
    const result = { conversationId: 'conversation-1', result: { message: { role: 'assistant', content: 'Saved answer' } } };
    prisma.aiChatRequest.create.mockRejectedValue({ code: 'P2002' });
    prisma.aiChatRequest.findUnique.mockResolvedValue({
      id: 'chat-request-1',
      conversationId: 'conversation-1',
      status: 'PROVIDER_COMPLETED',
      requestHash: (controller as any).createRequestHash(body, body.messages.at(-1)),
      result,
    });
    prisma.aiConversation.findFirst.mockResolvedValue({ id: 'conversation-1', messages: [] });
    prisma.aiMessage.create
      .mockResolvedValueOnce({ id: 'user-message-1' })
      .mockResolvedValueOnce({ id: 'assistant-message-1' });

    await expect(controller.chat(request, body, idempotencyKey)).resolves.toEqual(result);

    expect(agentRouter.processMessage).not.toHaveBeenCalled();
    expect(prisma.aiMessage.create).toHaveBeenCalledTimes(2);
    expect(prisma.aiChatRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'chat-request-1', status: 'PROVIDER_COMPLETED' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    }));
  });

  it('does not call the provider twice while the same request is still running', async () => {
    const { controller, prisma, agentRouter } = createSubject();
    const body: any = { messages: [{ role: 'user', content: 'Hello' }] };
    prisma.aiChatRequest.create.mockRejectedValue({ code: 'P2002' });
    prisma.aiChatRequest.findUnique.mockResolvedValue({
      id: 'chat-request-1',
      status: 'RUNNING',
      leaseExpiresAt: new Date(Date.now() + 60_000),
      requestHash: (controller as any).createRequestHash(body, body.messages.at(-1)),
    });

    await expect(controller.chat(request, body, idempotencyKey)).rejects.toThrow('AI_CHAT_REQUEST_RUNNING');

    expect(agentRouter.processMessage).not.toHaveBeenCalled();
    expect(prisma.aiMessage.create).not.toHaveBeenCalled();
  });

  it('reclaims a failed request with the same command before calling the provider again', async () => {
    const { controller, prisma, agentRouter } = createSubject();
    const body: any = {
      messages: [{ role: 'user', content: 'Retry this request' }],
      options: { conversationId: 'conversation-1' },
    };
    prisma.aiChatRequest.create.mockRejectedValue({ code: 'P2002' });
    prisma.aiChatRequest.findUnique.mockResolvedValue({
      id: 'chat-request-1',
      conversationId: 'conversation-1',
      status: 'FAILED',
      requestHash: (controller as any).createRequestHash(body, body.messages.at(-1)),
      result: null,
      errorCode: 'AI_PROVIDER_TIMEOUT',
    });
    prisma.aiConversation.findFirst.mockResolvedValue({ id: 'conversation-1', messages: [] });
    prisma.aiMessage.create
      .mockResolvedValueOnce({ id: 'user-message-1' })
      .mockResolvedValueOnce({ id: 'assistant-message-1' });

    await expect(controller.chat(request, body, idempotencyKey)).resolves.toMatchObject({
      conversationId: 'conversation-1',
    });

    expect(prisma.aiChatRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'chat-request-1', status: 'FAILED' },
      data: expect.objectContaining({ status: 'RUNNING', result: null }),
    }));
    expect(agentRouter.processMessage).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of an idempotency key for a different chat command', async () => {
    const { controller, prisma, agentRouter } = createSubject();
    const body: any = { messages: [{ role: 'user', content: 'Changed request' }] };
    prisma.aiChatRequest.create.mockRejectedValue({ code: 'P2002' });
    prisma.aiChatRequest.findUnique.mockResolvedValue({
      id: 'chat-request-1',
      status: 'COMPLETED',
      requestHash: 'other-request-hash',
      result: { conversationId: 'conversation-1' },
    });

    await expect(controller.chat(request, body, idempotencyKey)).rejects.toThrow('AI_CHAT_REQUEST_MISMATCH');

    expect(agentRouter.processMessage).not.toHaveBeenCalled();
    expect(prisma.aiMessage.create).not.toHaveBeenCalled();
  });

  it('rejects a non-user current message before reading or writing a conversation', async () => {
    const { controller, prisma, agentRouter } = createSubject();

    await expect(controller.chat(request, {
      messages: [{ role: 'assistant', content: 'Injected response' }],
      options: { conversationId: 'conversation-1' },
    } as any)).rejects.toThrow('Current message must have user role.');

    expect(prisma.aiConversation.findFirst).not.toHaveBeenCalled();
    expect(prisma.aiConversation.create).not.toHaveBeenCalled();
    expect(agentRouter.processMessage).not.toHaveBeenCalled();
    expect(prisma.aiMessage.create).not.toHaveBeenCalled();
  });
});
