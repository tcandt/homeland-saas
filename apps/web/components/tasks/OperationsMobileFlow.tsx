"use client";

import React, { useState } from "react";
import { 
  Wrench, MessageSquare, AlertCircle, Clock, 
  CheckCircle2, ChevronRight, Phone, Send,
  MoreVertical, FileText, Plus, BellRing
} from "lucide-react";
import { Button } from "@/components/ui/Button";

// --- MOCK DATA ---
const tickets = [
  { id: "TK-1042", title: "Khách báo hỏng điều hòa (không mát)", room: "P.201", status: "pending", priority: "high", time: "2 giờ trước", user: "Trần Văn B" },
  { id: "TK-1043", title: "Vòi nước bồn rửa mặt bị rỉ", room: "P.105", status: "pending", priority: "medium", time: "5 giờ trước", user: "Lê Thị C" },
  { id: "TK-1041", title: "Thay bóng đèn hành lang", room: "Tầng 3", status: "in_progress", priority: "low", time: "Hôm qua", assignee: "KTV Tuấn" },
  { id: "TK-1040", title: "Xử lý nghẹt cống nhà vệ sinh", room: "P.402", status: "done", priority: "high", time: "2 ngày trước", assignee: "KTV Hùng" },
];

const chats = [
  { id: 1, name: "Trần Văn B", room: "P.201", lastMsg: "Dạ vâng anh, tầm mấy giờ thợ qua ạ?", time: "10:45", unread: 2, isOnline: true },
  { id: 2, name: "Nguyễn Hương Giang", room: "P.302", lastMsg: "Em gửi bill chuyển khoản tháng này nhé.", time: "Hôm qua", unread: 1, isOnline: false },
  { id: 3, name: "Phạm Minh Tâm", room: "P.101", lastMsg: "Cảm ơn anh, phòng em nước mạnh lại rồi.", time: "T2", unread: 0, isOnline: false },
];

export default function OperationsMobileFlow() {
  const [activeTab, setActiveTab] = useState<'maintenance' | 'crm'>('crm');

  // Calculate unread/pending statuses
  const hasPendingTickets = tickets.some(t => t.status === 'pending');
  const hasUnreadChats = chats.some(c => c.unread > 0);

  return (
    <div className="flex flex-col gap-[20px] w-full box-border pb-[100px] bg-background">
      
      <div className="bg-card border border-border p-1 rounded-xl flex mt-1 shadow-sm mx-1 gap-1">
        <Button 
          variant="ghost"
          onClick={() => setActiveTab('crm')}
          className={`relative flex-1 h-9 text-[13px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'crm' 
              ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-sm' 
              : 'text-muted hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          {hasUnreadChats && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger animate-pulse shadow-[0_0_8px_rgba(var(--danger-rgb),0.8)]"></span>}
          <MessageSquare size={16} /> Chăm sóc Khách
        </Button>
        <Button 
          variant="ghost"
          onClick={() => setActiveTab('maintenance')}
          className={`relative flex-1 h-9 text-[13px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === 'maintenance' 
              ? 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-sm' 
              : 'text-muted hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          {hasPendingTickets && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger animate-pulse shadow-[0_0_8px_rgba(var(--danger-rgb),0.8)]"></span>}
          <Wrench size={16} /> Vận Hành & Sửa Chữa
        </Button>
      </div>

      {activeTab === 'maintenance' ? <MaintenanceTab /> : <CrmTab />}

    </div>
  );
}

function MaintenanceTab() {
  return (
    <div className="flex flex-col gap-[20px]">
      {/* METRICS */}
      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-black text-text px-1">Tổng quan Sự cố</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="h-[80px] bg-rose-500/10 border border-rose-500/20 rounded-[12px] p-3 flex flex-col justify-between shadow-sm">
            <span className="text-[12px] font-semibold text-rose-600 uppercase">Mới / Cấp bách</span>
            <span className="text-[24px] font-black text-rose-500 leading-none">2</span>
          </div>
          <div className="h-[80px] bg-blue-500/10 border border-blue-500/20 rounded-[12px] p-3 flex flex-col justify-between shadow-sm">
            <span className="text-[12px] font-semibold text-blue-600 uppercase">Đang xử lý</span>
            <span className="text-[24px] font-black text-blue-500 leading-none">1</span>
          </div>
          <div className="h-[80px] bg-emerald-500/10 border border-emerald-500/20 rounded-[12px] p-3 flex flex-col justify-between shadow-sm">
            <span className="text-[12px] font-semibold text-emerald-600 uppercase">Đã xong (T.Này)</span>
            <span className="text-[24px] font-black text-emerald-500 leading-none">14</span>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <div className="flex gap-2 px-1">
        <Button variant="outline" className="flex-1 h-10 text-[12px] font-bold flex items-center justify-center gap-2">
          <Plus size={14} className="text-primary" /> Báo hỏng mới
        </Button>
        <Button variant="outline" className="flex-1 h-10 text-[12px] font-bold flex items-center justify-center gap-2">
          <FileText size={14} className="text-primary" /> Lịch bảo trì
        </Button>
      </div>

      {/* TICKET LIST */}
      <section className="flex flex-col gap-2">
        <div className="flex justify-between items-end px-1">
          <h3 className="text-[15px] font-black text-text">Danh sách Yêu cầu</h3>
          <span className="text-[11px] font-bold text-[#4f46e5] cursor-pointer">Lọc & Sắp xếp</span>
        </div>
        
        <div className="flex flex-col gap-3">
          {tickets.map((t, i) => (
            <div key={i} className="bg-card border border-border rounded-[14px] p-3.5 shadow-sm flex flex-col gap-3 relative overflow-hidden group active:scale-[0.98] transition-transform">
              {/* Status Indicator Bar */}
              <div className={`absolute top-0 left-0 w-1 h-full ${
                t.status === 'pending' ? 'bg-rose-500' : 
                t.status === 'in_progress' ? 'bg-blue-500' : 'bg-emerald-500'
              }`}></div>
              
              <div className="flex justify-between items-start pl-2">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-text leading-snug">{t.title}</span>
                    {t.priority === 'high' && <AlertCircle size={14} className="text-rose-500 shrink-0" />}
                  </div>
                  <span className="text-[12px] font-medium text-muted">{t.room} • {t.user || 'Hệ thống'}</span>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] font-bold text-muted">{t.time}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pl-2 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2">
                  {t.status === 'pending' && <span className="bg-rose-500/10 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-[4px]">Chờ tiếp nhận</span>}
                  {t.status === 'in_progress' && <span className="bg-blue-500/10 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-[4px]">Đang sửa</span>}
                  {t.status === 'done' && <span className="bg-emerald-500/10 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-[4px]">Hoàn thành</span>}
                  
                  {t.assignee && (
                    <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                      <Wrench size={10} /> {t.assignee}
                    </span>
                  )}
                </div>
                
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full">
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CrmTab() {
  return (
    <div className="flex flex-col gap-[20px]">
      
      {/* QUICK ACTIONS */}
      <div className="flex gap-2 px-1">
        <Button variant="outline" className="flex-1 h-auto py-3 bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary flex flex-col items-center justify-center gap-1 rounded-xl">
          <BellRing size={20} />
          <span className="text-[13px]">Gửi Thông báo chung</span>
        </Button>
        <div className="flex-1 flex flex-col gap-2">
          <Button variant="outline" className="flex-1 h-10 text-[12px] font-bold flex items-center justify-center gap-2">
            <Plus size={14} className="text-primary" /> Mẫu tin nhắn
          </Button>
          <Button variant="outline" className="flex-1 h-10 text-[12px] font-bold flex items-center justify-center gap-2">
            <Clock size={14} className="text-primary" /> Tin nhắn tự động
          </Button>
        </div>
      </div>

      {/* CHAT LIST */}
      <section className="flex flex-col gap-2">
        <div className="flex justify-between items-end px-1">
          <h3 className="text-[15px] font-black text-text">Hộp thư đến (Inbox)</h3>
          <span className="text-[11px] font-bold text-[#ec4899] cursor-pointer">Lọc Zalo/SMS</span>
        </div>
        
        <div className="bg-card border border-border rounded-[14px] shadow-sm flex flex-col divide-y divide-border overflow-hidden">
          {chats.map((chat) => (
            <div key={chat.id} className="flex items-center gap-3 p-3 hover:bg-black/5 active:bg-black/10 transition-colors cursor-pointer group">
              {/* Avatar */}
              <div className="relative">
                <div className="w-[42px] h-[42px] rounded-full bg-gradient-to-br from-purple-100 to-pink-100 border border-border flex items-center justify-center text-[16px] font-black text-pink-600">
                  {chat.name.charAt(0)}
                </div>
                {chat.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-card rounded-full"></div>}
              </div>
              
              {/* Info */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[14px] font-bold text-text truncate pr-2">{chat.name} <span className="text-[12px] font-medium text-muted">({chat.room})</span></span>
                  <span className={`text-[10px] shrink-0 ${chat.unread > 0 ? 'text-[#ec4899] font-black' : 'text-muted font-medium'}`}>{chat.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-[13px] truncate pr-2 ${chat.unread > 0 ? 'font-bold text-text' : 'font-medium text-muted'}`}>
                    {chat.lastMsg}
                  </span>
                  {chat.unread > 0 && (
                    <div className="w-5 h-5 rounded-full bg-[#ec4899] text-white flex items-center justify-center text-[10px] font-black shrink-0">
                      {chat.unread}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
