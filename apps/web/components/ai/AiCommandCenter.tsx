'use client';

import React, { useRef, useState } from 'react';
import { Bot, User, Send, Database, AlertCircle, Zap, History } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { aiConversationKeys, useAiChat, useAiConversation, useAiConversations, useAiUsage } from '../../lib/queries/ai.queries';
import { useAiStore } from '../../lib/stores/ai.store';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';

type AiMessage = {
  id?: string;
  role: string;
  content: string;
};

type AiConversation = {
  id: string;
  title?: string | null;
  createdAt?: string;
  updatedAt?: string;
  messages?: AiMessage[];
};

export default function AiCommandCenter() {
  const [input, setInput] = useState('');
  const [draftMessages, setDraftMessages] = useState<AiMessage[]>([]);
  const [dismissedDraftKeys, setDismissedDraftKeys] = useState<Set<string>>(() => new Set());
  const [pendingMessage, setPendingMessage] = useState<AiMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retryRequestRef = useRef<{ idempotencyKey: string; content: string } | null>(null);

  const { conversationId, setConversationId, selectedAgent, setSelectedAgent } = useAiStore();
  const queryClient = useQueryClient();
  const conversationsQuery = useAiConversations();
  const conversationQuery = useAiConversation(conversationId);
  const { data: tokenUsageData } = useAiUsage();
  const tokenUsage = Array.isArray(tokenUsageData) ? tokenUsageData : ((tokenUsageData as any)?.data?.data || (tokenUsageData as any)?.data || []);

  const totalTokens = (Array.isArray(tokenUsage) ? tokenUsage : []).reduce((acc: any, curr: any) => acc + (curr.totalTokens || 0), 0);
  const estCost = (Array.isArray(tokenUsage) ? tokenUsage : []).reduce((acc: any, curr: any) => acc + Number(curr.estimatedCost || 0), 0);
  
  const chatMutation = useAiChat();
  const conversations = Array.isArray(conversationsQuery.data) ? conversationsQuery.data as AiConversation[] : [];
  const selectedConversation = conversationQuery.data as AiConversation | null | undefined;
  const isDetailLoading = Boolean(conversationId) && (conversationQuery.isPending || conversationQuery.isFetching);
  const isDetailError = Boolean(conversationId) && conversationQuery.isError;
  const persistedMessages = selectedConversation?.id === conversationId && Array.isArray(selectedConversation.messages)
    ? selectedConversation.messages
    : [];
  const visibleMessages = conversationId
    ? (isDetailLoading || isDetailError || !selectedConversation ? [] : persistedMessages)
    : draftMessages;
  const canSend = !chatMutation.isPending && input.trim() && (!conversationId || (!isDetailLoading && !isDetailError && Boolean(selectedConversation)));

  const handleSend = async () => {
    if (!canSend) return;
    
    const userMsg = { role: 'user', content: input.trim() };
    const idempotencyKey = retryRequestRef.current?.content === userMsg.content
      ? retryRequestRef.current.idempotencyKey
      : crypto.randomUUID();
    retryRequestRef.current = { idempotencyKey, content: userMsg.content };
    const requestMessages = [...visibleMessages, userMsg];
    if (conversationId) {
      setPendingMessage(userMsg);
    } else {
      setDraftMessages(prev => [...prev, userMsg]);
    }
    setInput('');
    setError(null);

    chatMutation.mutate(
      { 
        messages: requestMessages,
        options: { conversationId, agent: selectedAgent },
        idempotencyKey,
      },
      {
        onSuccess: async (res: any) => {
          const result = res.data || res;
          const nextConversationId = result.conversationId || conversationId;
          retryRequestRef.current = null;
          setPendingMessage(null);
          setDraftMessages([]);
          if (nextConversationId) {
            setConversationId(nextConversationId);
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: aiConversationKeys.all }),
              queryClient.invalidateQueries({ queryKey: aiConversationKeys.detail(nextConversationId) }),
              queryClient.invalidateQueries({ queryKey: ['ai-usage'] }),
            ]);
          }
        },
        onError: (err: any) => {
          setPendingMessage(null);
          if (!conversationId) {
            setDraftMessages((current) => current.slice(0, -1));
          }
          setInput(userMsg.content);
          const errorMsg = err?.message || err?.response?.data?.message || (typeof err === 'string' ? err : JSON.stringify(err));
          setError(errorMsg || 'Đã có lỗi xảy ra. Vui lòng thử lại sau.');
        }
      }
    );
  };

  const handleSelectConversation = (id: string) => {
    if (chatMutation.isPending) return;
    setConversationId(id);
    setPendingMessage(null);
    setError(null);
  };

  const handleClearChat = () => {
    if (chatMutation.isPending) return;
    setConversationId(null);
    setDraftMessages([]);
    setPendingMessage(null);
    setInput('');
    setError(null);
    setDismissedDraftKeys(new Set());
    retryRequestRef.current = null;
  };

  const dismissDraftConfirmation = (key: string) => {
    setDismissedDraftKeys((current) => new Set(current).add(key));
  };

  return (
    <div className="flex h-full bg-background overflow-hidden text-text" data-testid="ai-root">
      
      {/* Left Sidebar: Context & History */}
      <div className="w-[300px] border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-black text-lg text-text flex items-center gap-2">
            <Zap size={18} className="text-primary"/> AI Command Center
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Usage Card */}
          <Card data-testid="ai-token-usage">
            <CardContent className="p-4">
              <h3 className="text-xs font-bold text-muted uppercase mb-2">Sử dụng Token</h3>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-xl font-black text-text">{totalTokens.toLocaleString()}</div>
                  <div className="text-[10px] text-muted font-bold">Tổng token đã dùng</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-success">${estCost.toFixed(4)}</div>
                  <div className="text-[10px] text-muted font-bold">Chi phí ước tính</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* No tenant knowledge source or source-status query is available yet. */}
          <div data-testid="ai-knowledge-sources">
            <h3 className="text-xs font-bold text-muted uppercase mb-2 flex items-center gap-1.5"><Database size={14}/> Nguồn Dữ Liệu RAG</h3>
            <Card data-testid="ai-knowledge-source-unavailable">
              <CardContent className="p-3 text-sm">
                <div className="font-bold text-text">Nguồn tri thức của tenant chưa được kết nối</div>
                <p className="text-xs text-muted mt-1">Chưa có nguồn dữ liệu RAG nào khả dụng để tra cứu hoặc xác nhận trạng thái lập chỉ mục.</p>
              </CardContent>
            </Card>
          </div>

          {/* History */}
          <div data-testid="ai-conversation-history">
            <h3 className="text-xs font-bold text-muted uppercase mb-2 flex items-center gap-1.5"><History size={14}/> Lịch sử hội thoại</h3>
            {conversationsQuery.isPending || conversationsQuery.isFetching ? (
              <div className="text-sm text-muted font-bold italic" data-testid="ai-conversation-list-loading">Đang tải lịch sử hội thoại...</div>
            ) : conversationsQuery.isError ? (
              <div className="text-sm text-danger font-bold" data-testid="ai-conversation-list-error">Không thể tải lịch sử hội thoại.</div>
            ) : conversations.length === 0 ? (
              <div className="text-sm text-muted font-bold italic" data-testid="ai-conversation-list-empty">Chưa có hội thoại nào đã lưu</div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conversation) => (
                  <button
                    type="button"
                    key={conversation.id}
                    onClick={() => handleSelectConversation(conversation.id)}
                    disabled={chatMutation.isPending}
                    aria-current={conversationId === conversation.id ? 'page' : undefined}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${conversationId === conversation.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-text hover:bg-surface'}`}
                    data-testid={`ai-conversation-${conversation.id}`}
                  >
                    <div className="truncate font-bold">{conversation.title || 'Hội thoại chưa đặt tiêu đề'}</div>
                    {conversation.updatedAt && <div className="mt-0.5 text-[10px] font-medium text-muted">{new Date(conversation.updatedAt).toLocaleString('vi-VN')}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-card" data-testid="ai-chat-panel">
        
        {/* Header with Agent Selector */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface">
          <div className="flex items-center gap-3 w-[300px]">
            <span className="font-bold text-sm text-muted shrink-0">Agent:</span>
            <Select 
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              data-testid="ai-agent-selector"
              options={[
                { value: "OperationsAgent", label: "Operations Agent" },
                { value: "FinanceAgent", label: "Finance Agent" },
                { value: "BuildingAgent", label: "Building Agent" },
                { value: "DocumentAgent", label: "Document Agent" }
              ]}
            />
          </div>
          <div>
            <Button variant="ghost" size="sm" onClick={handleClearChat} disabled={chatMutation.isPending} data-testid="ai-clear-chat">
              Clear Chat
            </Button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-error/10 border-b border-error/20 p-3 flex items-start gap-2 text-error text-sm" data-testid="ai-error-state">
            <AlertCircle size={16} className="mt-0.5 shrink-0"/>
            <div>
              <div className="font-black">Lỗi kết nối AI</div>
              <div className="font-medium">{error}</div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isDetailLoading && (
            <div className="h-full flex items-center justify-center text-sm font-bold text-muted" data-testid="ai-history-detail-loading">
              Đang tải nội dung hội thoại...
            </div>
          )}

          {isDetailError && (
            <div className="h-full flex flex-col items-center justify-center text-center text-danger" data-testid="ai-history-detail-error">
              <AlertCircle size={32} className="mb-3" />
              <div className="font-black">Không thể tải nội dung hội thoại</div>
              <div className="mt-1 text-sm font-medium">Hãy chọn hội thoại khác hoặc tạo bản nháp mới.</div>
            </div>
          )}

          {conversationId && !isDetailLoading && !isDetailError && !selectedConversation && (
            <div className="h-full flex items-center justify-center text-sm font-bold text-muted" data-testid="ai-history-detail-empty">
              Hội thoại này không còn khả dụng.
            </div>
          )}

          {visibleMessages.length === 0 && !error && !conversationId && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <Bot size={48} className="text-primary mb-4" />
              <h2 className="text-xl font-black mb-2" data-testid="ai-empty-draft">HomeLand AI Assistant</h2>
              <p className="text-sm font-medium max-w-md">Tôi có thể giúp bạn tổng hợp doanh thu, tra cứu phòng trống, dự báo dòng tiền, hoặc tự động sinh hợp đồng dựa trên dữ liệu hệ thống.</p>
              
              <div className="mt-8 flex flex-wrap gap-2 justify-center max-w-lg">
                <Button variant="outline" size="sm" onClick={() => setInput('Tháng này doanh thu bao nhiêu?')}>Tháng này doanh thu bao nhiêu?</Button>
                <Button variant="outline" size="sm" onClick={() => setInput('Phòng nào sắp hết hạn hợp đồng?')}>Phòng nào sắp hết hạn?</Button>
                <Button variant="outline" size="sm" onClick={() => setInput('Tạo hợp đồng mới cho phòng A203')}>Tạo hợp đồng mới</Button>
              </div>
            </div>
          )}

          {visibleMessages.map((msg, i) => {
            const messageKey = msg.id || `draft-${i}-${msg.content}`;
            let parsedContent = String(msg.content ?? '');
            let isToolResponse = false;
            let toolActionRequired = null;
            let draftData = null;

            if (msg.role === 'assistant' && parsedContent.includes('"actionRequired"')) {
              try {
                const parsed = JSON.parse(msg.content);
                parsedContent = parsed.toolOutput || 'Thực hiện tác vụ thành công.';
                isToolResponse = true;
                toolActionRequired = parsed.actionRequired;
                draftData = parsed.data;
              } catch(e) {}
            }

            return (
            <div key={msg.id || i} className={`flex gap-4 max-w-3xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`} data-testid={msg.role === 'assistant' ? 'ai-response-message' : 'ai-user-message'}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-surface border border-border text-text'}`}>
                {msg.role === 'user' ? <User size={16}/> : <Bot size={16}/>}
              </div>
              <div className="flex flex-col gap-2 max-w-[80%]">
                <div className={`px-4 py-3 rounded-2xl text-sm font-medium ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-surface border border-border text-text rounded-tl-none shadow-sm'}`}>
                  {parsedContent}
                </div>

                {isToolResponse && toolActionRequired === 'CONFIRM_DRAFT' && draftData && !dismissedDraftKeys.has(messageKey) && (
                  <Card className="w-full mt-2 border-warning shadow-sm" data-testid="ai-draft-confirmation">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-warning font-black mb-3">
                        <AlertCircle size={16}/>
                        AI đề xuất tạo dữ liệu mới
                      </div>
                      <div className="text-sm bg-background p-3 rounded-xl border border-border mb-4 font-medium">
                        {draftData.title && <div className="mb-1"><strong>Tiêu đề:</strong> {draftData.title}</div>}
                        {draftData.content && <div className="mb-1"><strong>Nội dung:</strong> {draftData.content}</div>}
                        {draftData.description && <div className="mb-1"><strong>Mô tả:</strong> {draftData.description}</div>}
                        <div className="mt-2"><Badge variant="neutral">DRAFT</Badge></div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          className="flex-1"
                          variant="primary"
                          data-testid="ai-draft-approve"
                          disabled
                          title="Chưa có lệnh nghiệp vụ để duyệt bản nháp AI"
                        >
                          Chưa thể duyệt
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          data-testid="ai-draft-cancel"
                          onClick={() => dismissDraftConfirmation(messageKey)}
                        >
                          Đóng
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {isToolResponse && !toolActionRequired && draftData && (
                   <Card className="w-full mt-2 shadow-sm" data-testid="ai-tool-call">
                     <CardContent className="p-3">
                      <div className="font-black mb-2 text-muted uppercase text-[10px] flex items-center gap-1"><Zap size={12}/> Thực thi AI Tool</div>
                      {Array.isArray(draftData) ? (
                        draftData.map((d:any, idx:number) => (
                           <div key={idx} className="border-b border-border last:border-0 py-1 font-mono text-[11px] text-muted font-bold bg-background p-2 rounded-lg">
                              {JSON.stringify(d)}
                           </div>
                        ))
                      ) : (
                        <div className="font-mono text-[11px] text-muted font-bold bg-background p-2 rounded-lg">
                           {JSON.stringify(draftData, null, 2)}
                        </div>
                      )}
                     </CardContent>
                   </Card>
                )}
              </div>
            </div>
            );
          })}

          {pendingMessage && !isDetailLoading && !isDetailError && (
            <div className="flex gap-4 max-w-3xl mx-auto flex-row-reverse" data-testid="ai-pending-user-message">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary text-white"><User size={16}/></div>
              <div className="px-4 py-3 rounded-2xl text-sm font-medium bg-primary text-white rounded-tr-none">{pendingMessage.content}</div>
            </div>
          )}
          
          {chatMutation.isPending && (
            <div className="flex gap-4 max-w-3xl mx-auto">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-surface border border-border text-text">
                <Bot size={16}/>
              </div>
              <div className="px-4 py-3 rounded-2xl text-sm bg-surface border border-border text-muted rounded-tl-none flex items-center gap-2 shadow-sm">
                <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-border bg-surface">
          <div className="max-w-3xl mx-auto relative">
            <textarea 
              value={input}
              onChange={e => {
                const value = e.target.value;
                if (retryRequestRef.current?.content !== value.trim()) {
                  retryRequestRef.current = null;
                }
                setInput(value);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Hỏi AI bất cứ điều gì về dữ liệu của bạn..."
              className="w-full pl-4 pr-12 py-3 bg-card border border-border rounded-xl resize-none outline-none focus:border-primary focus:ring-1 focus:ring-primary text-sm shadow-inner text-text font-medium"
              rows={2}
              data-testid="ai-message-input"
            />
            <Button 
              onClick={handleSend}
              disabled={!canSend}
              variant="primary"
              className="absolute right-2 bottom-2 p-2 h-auto w-auto"
              data-testid="ai-send-button"
            >
              <Send size={16}/>
            </Button>
          </div>
          <div className="text-center text-[10px] font-bold text-muted mt-2">
            AI có thể mắc lỗi. Vui lòng kiểm tra lại các số liệu tài chính quan trọng.
          </div>
        </div>
      </div>

    </div>
  );
}
