import { create } from 'zustand';

interface AiState {
  conversationId: string | null;
  selectedAgent: string;
  setConversationId: (id: string | null) => void;
  setSelectedAgent: (agent: string) => void;
}

export const useAiStore = create<AiState>((set) => ({
  conversationId: null,
  selectedAgent: 'OperationsAgent',
  setConversationId: (id) => set({ conversationId: id }),
  setSelectedAgent: (agent) => set({ selectedAgent: agent }),
}));
