import { apiClient } from './client';

export const aiApi = {
  chat: async (messages: any[], options?: any) => {
    return apiClient.post('/ai/chat', { messages, options });
  },

  getConversations: async () => {
    return apiClient.get('/ai/conversations');
  },

  getConversation: async (id: string) => {
    return apiClient.get(`/ai/conversations/${id}`);
  },

  getUsage: async () => {
    return apiClient.get('/ai/usage');
  }
};
