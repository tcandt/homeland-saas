'use client';

import React, { useState } from 'react';
import { Bot, User, Send, Database, AlertCircle, Zap, History } from 'lucide-react';
import { useAiChat, useAiUsage } from '../../lib/queries/ai.queries';
import { useAiStore } from '../../lib/stores/ai.store';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';

export default function AiCommandCenter() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<any[]>([{
    role: 'assistant',
    content: 'Xin chào! Tôi là trợ lý AI của HomeLand. Tôi có thể giúp gì cho bạn hôm nay?'
  }]);
  const [error, setError] = useState<string | null>(null);

  const { conversationId, setConversationId, selectedAgent, setSelectedAgent } = useAiStore();
  const { data: tokenUsageData } = useAiUsage();
  const tokenUsage = Array.isArray(tokenUsageData) ? tokenUsageData : (tokenUsageData?.data?.data || tokenUsageData?.data || []);

  const totalTokens = (Array.isArray(tokenUsage) ? tokenUsage : []).reduce((acc: any, curr: any) => acc + (curr.totalTokens || 0), 0);
  const estCost = (Array.isArray(tokenUsage) ? tokenUsage : []).reduce((acc: any, curr: any) => acc + Number(curr.estimatedCost || 0), 0);
  
  const chatMutation = useAiChat();

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setError(null);

    chatMutation.mutate(
      { 
        messages: [...messages, userMsg], 
        options: { conversationId, agent: selectedAgent } 
      },
      {
        onSuccess: (res: any) => {
          const result = res.data;
          setMessages(prev => [...prev, result.result.message]);
          if (result.conversationId && !conversationId) {
            setConversationId(result.conversationId);
          }
        },
        onError: (err: any) => {
          const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
          if (errMsg === 'AI_PROVIDER_NOT_CONFIGURED') {
            setError('Tính năng AI chưa được cấu hình. Vui lòng thiết lập API Key trong cài đặt.');
          } else if (errMsg === 'AI_TOOL_PERMISSION_DENIED') {
            setError('Bạn không có quyền sử dụng chức năng này qua AI.');
          } else {
            setError('Đã có lỗi xảy ra. Vui lòng thử lại sau.');
          }
        }
      }
    );
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

          {/* Context Sources */}
          <div data-testid="ai-knowledge-sources">
            <h3 className="text-xs font-bold text-muted uppercase mb-2 flex items-center gap-1.5"><Database size={14}/> Nguồn Dữ Liệu RAG</h3>
            <div className="space-y-2">
              <Card>
                <CardContent className="p-3 flex items-center justify-between text-sm">
                  <span className="font-bold text-text">Hợp đồng</span>
                  <Badge variant="success">Đã Index</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 flex items-center justify-between text-sm">
                  <span className="font-bold text-text">Hóa đơn</span>
                  <Badge variant="success">Đã Index</Badge>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 flex items-center justify-between text-sm">
                  <span className="font-bold text-text">Quy trình (SOP)</span>
                  <Badge variant="warning">Đang Index</Badge>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* History */}
          <div>
            <h3 className="text-xs font-bold text-muted uppercase mb-2 flex items-center gap-1.5"><History size={14}/> Lịch sử hội thoại</h3>
            <div className="text-sm text-muted font-bold italic">Chưa có hội thoại nào</div>
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
            <Button variant="ghost" size="sm">
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
          {messages.length === 0 && !error && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
              <Bot size={48} className="text-primary mb-4" />
              <h2 className="text-xl font-black mb-2">HomeLand AI Assistant</h2>
              <p className="text-sm font-medium max-w-md">Tôi có thể giúp bạn tổng hợp doanh thu, tra cứu phòng trống, dự báo dòng tiền, hoặc tự động sinh hợp đồng dựa trên dữ liệu hệ thống.</p>
              
              <div className="mt-8 flex flex-wrap gap-2 justify-center max-w-lg">
                <Button variant="outline" size="sm" onClick={() => setInput('Tháng này doanh thu bao nhiêu?')}>Tháng này doanh thu bao nhiêu?</Button>
                <Button variant="outline" size="sm" onClick={() => setInput('Phòng nào sắp hết hạn hợp đồng?')}>Phòng nào sắp hết hạn?</Button>
                <Button variant="outline" size="sm" onClick={() => setInput('Tạo hợp đồng mới cho phòng A203')}>Tạo hợp đồng mới</Button>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            let parsedContent = msg.content;
            let isToolResponse = false;
            let toolActionRequired = null;
            let draftData = null;

            if (msg.role === 'assistant' && msg.content.includes('"actionRequired"')) {
              try {
                const parsed = JSON.parse(msg.content);
                parsedContent = parsed.toolOutput || 'Thực hiện tác vụ thành công.';
                isToolResponse = true;
                toolActionRequired = parsed.actionRequired;
                draftData = parsed.data;
              } catch(e) {}
            }

            return (
            <div key={i} className={`flex gap-4 max-w-3xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`} data-testid={msg.role === 'assistant' ? 'ai-response-message' : 'ai-user-message'}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-surface border border-border text-text'}`}>
                {msg.role === 'user' ? <User size={16}/> : <Bot size={16}/>}
              </div>
              <div className="flex flex-col gap-2 max-w-[80%]">
                <div className={`px-4 py-3 rounded-2xl text-sm font-medium ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-surface border border-border text-text rounded-tl-none shadow-sm'}`}>
                  {parsedContent}
                </div>

                {isToolResponse && toolActionRequired === 'CONFIRM_DRAFT' && draftData && (
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
                        <Button className="flex-1" variant="primary" data-testid="ai-draft-approve">Review & Approve</Button>
                        <Button variant="outline" className="flex-1" data-testid="ai-draft-cancel">Cancel</Button>
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
              onChange={e => setInput(e.target.value)}
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
              disabled={!input.trim() || chatMutation.isPending}
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
