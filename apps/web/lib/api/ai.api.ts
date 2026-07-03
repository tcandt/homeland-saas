import { apiClient } from './api.client';

export const aiApi = {
  chat: async (messages: any[], options?: any) => {
    return apiClient.post('/v1/ai/chat', { messages, options });
  },

  getConversations: async () => {
    return apiClient.get('/v1/ai/conversations');
  },

  getConversation: async (id: string) => {
    return apiClient.get(`/v1/ai/conversations/${id}`);
  },

  getUsage: async () => {
    return apiClient.get('/v1/ai/usage');
  }
};
