import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AiProvider, AiMessage, AiChatOptions } from './providers/ai-provider.interface';
import { trace } from '@opentelemetry/api';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private providers: Map<string, AiProvider> = new Map();
  private defaultProviderName: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private openAIProvider: OpenAIProvider,
  ) {
    this.providers.set(this.openAIProvider.name, this.openAIProvider);
    this.defaultProviderName = this.configService.get<string>('AI_DEFAULT_PROVIDER', 'OPENAI');
  }

  getProvider(name?: string): AiProvider {
    const providerName = name || this.defaultProviderName;
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new BadRequestException(`AI Provider ${providerName} not found`);
    }
    return provider;
  }

  async chat(
    tenantId: string,
    userId: string,
    messages: AiMessage[],
    options?: AiChatOptions & { module?: string; conversationId?: string; provider?: string }
  ) {
    const tracer = trace.getTracer('ai-service');
    return tracer.startActiveSpan('AI Tool Call', async (span) => {
      try {
        const provider = this.getProvider(options?.provider);
        span.setAttribute('ai.provider', provider.name);
        
        // Execute the chat
        const result = await provider.chat(messages, options);
  
        span.setAttribute('ai.model', result.model);
        if (result.totalTokens) {
          span.setAttribute('ai.tokens.prompt', result.promptTokens);
          span.setAttribute('ai.tokens.completion', result.completionTokens);
          span.setAttribute('ai.tokens.total', result.totalTokens);
        }

        // Track usage if enabled
        const trackCost = this.configService.get<string>('AI_COST_TRACKING', 'true') === 'true';
        if (trackCost) {
          // Calculate estimated cost (placeholder values, in reality query AiModelConfig)
          const costConfig = await this.prisma.aiModelConfig.findUnique({
            where: { provider_modelName: { provider: provider.name, modelName: result.model } }
          });
  
          let estimatedCost = 0;
        if (costConfig) {
          estimatedCost = 
            (result.promptTokens / 1000) * Number(costConfig.costPer1kPrompt) + 
            (result.completionTokens / 1000) * Number(costConfig.costPer1kCompletion);
        }

        await this.prisma.aiTokenUsage.create({
          data: {
            tenantId,
            userId,
            provider: provider.name,
            model: result.model,
            module: options?.module,
            conversationId: options?.conversationId,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            totalTokens: result.totalTokens,
            estimatedCost: estimatedCost,
          }
        });
      }

      return result;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // 2 = ERROR
      if (error.message === 'AI_PROVIDER_NOT_CONFIGURED') {
        throw new BadRequestException({
          error: 'AI_PROVIDER_NOT_CONFIGURED',
          message: 'AI provider API key is not configured. Please setup .env or UI config.'
        });
      }
      this.logger.error(`AI Chat Error: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to process AI chat request');
    } finally {
      span.end();
    }
  });
}

  async embed(text: string, providerName?: string) {
    const provider = this.getProvider(providerName);
    return provider.embed(text);
  }
}
