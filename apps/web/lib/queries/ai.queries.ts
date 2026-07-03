import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from '../api/ai.api';

export const useAiChat = () => {
  return useMutation({
    mutationFn: (data: { messages: any[], options?: any }) => aiApi.chat(data.messages, data.options),
  });
};

export const useAiConversations = () => {
  return useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => aiApi.getConversations(),
  });
};

export const useAiUsage = () => {
  return useQuery({
    queryKey: ['ai-usage'],
    queryFn: () => aiApi.getUsage(),
  });
};
