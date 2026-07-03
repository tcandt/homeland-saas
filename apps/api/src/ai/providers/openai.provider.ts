import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, AiMessage, AiChatOptions, AiChatResult } from './ai-provider.interface';
import OpenAI from 'openai';

@Injectable()
export class OpenAIProvider implements AiProvider {
  name = 'OPENAI';
  private readonly logger = new Logger(OpenAIProvider.name);
  private client: OpenAI | null = null;
  private defaultChatModel: string;
  private defaultEmbeddingModel: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey && apiKey !== 'your-api-key') {
      this.client = new OpenAI({ apiKey });
    }
    
    this.defaultChatModel = this.configService.get<string>('OPENAI_CHAT_MODEL', 'gpt-4o-mini');
    this.defaultEmbeddingModel = this.configService.get<string>('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small');
  }

  async chat(messages: AiMessage[], options?: AiChatOptions): Promise<AiChatResult> {
    if (!this.client) {
      throw new Error('AI_PROVIDER_NOT_CONFIGURED');
    }

    const model = options?.model || this.defaultChatModel;
    const maxTokens = options?.maxTokens || this.configService.get<number>('AI_MAX_TOKENS', 4096);
    const temperature = options?.temperature || this.configService.get<number>('AI_TEMPERATURE', 0.2);

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: messages.map(m => ({ role: m.role as any, content: m.content })),
        max_tokens: maxTokens,
        temperature,
      });

      const choice = response.choices[0];
      const usage = response.usage;

      return {
        message: {
          role: 'assistant',
          content: choice.message.content || '',
        },
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        provider: this.name,
        model,
      };
    } catch (error: any) {
      this.logger.error(`OpenAI Chat Error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async embed(text: string, options?: { model?: string }): Promise<number[]> {
    if (!this.client) {
      throw new Error('AI_PROVIDER_NOT_CONFIGURED');
    }

    const model = options?.model || this.defaultEmbeddingModel;

    try {
      const response = await this.client.embeddings.create({
        model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error: any) {
      this.logger.error(`OpenAI Embedding Error: ${error.message}`, error.stack);
      throw error;
    }
  }
}
