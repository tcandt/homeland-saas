export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface AiChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiChatResult {
  message: AiMessage;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  provider: string;
  model: string;
}

export interface AiProvider {
  name: string;
  chat(messages: AiMessage[], options?: AiChatOptions): Promise<AiChatResult>;
  embed(text: string, options?: { model?: string }): Promise<number[]>;
}
