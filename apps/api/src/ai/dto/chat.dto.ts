import { createZodDto } from 'nestjs-zod';
import { z } from 'nestjs-zod/z';

export const AiMessageSchema = z.object({
  role: z.literal('user').default('user'),
  content: z.string().trim().min(1).max(20_000),
}).strict();

export const ChatRequestSchema = z.object({
  messages: z.array(AiMessageSchema).min(1).max(50),
  options: z.object({
    conversationId: z.string().min(1).optional(),
    agent: z.string().min(1).max(80).optional(),
    module: z.string().min(1).max(80).optional(),
  }).strict().optional(),
}).strict();

export class ChatRequestDto extends createZodDto(ChatRequestSchema) {}
