import { useQuery, useMutation } from '@tanstack/react-query';
import { aiApi } from '../api/ai.api';

export const aiConversationKeys = {
  all: ['ai-conversations'] as const,
  detail: (id: string) => ['ai-conversations', id] as const,
};

export const useAiChat = () => {
  return useMutation({
    mutationFn: (data: { messages: any[], options?: any; idempotencyKey: string }) =>
      aiApi.chat(data.messages, data.options, data.idempotencyKey),
  });
};

export const useAiConversations = () => {
  return useQuery({
    queryKey: aiConversationKeys.all,
    queryFn: () => aiApi.getConversations(),
  });
};

export const useAiConversation = (id: string | null) => {
  return useQuery({
    queryKey: aiConversationKeys.detail(id ?? 'draft'),
    queryFn: () => aiApi.getConversation(id!),
    enabled: Boolean(id),
  });
};

export const useAiUsage = () => {
  return useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => aiApi.getUsage(),
  });
};
