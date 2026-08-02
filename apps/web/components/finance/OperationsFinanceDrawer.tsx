"use client";

import React, { useEffect } from "react";
import { X, FileText, Send, Wallet, CheckCircle2, History, Paperclip, AlertTriangle, Printer, Banknote, Building2, User, Phone } from "lucide-react";
import { TxnData } from "./OperationsFinanceLedgerRow";

export default function OperationsFinanceDrawer({ txn, onClose }: { txn: TxnData | null, onClose: () => void }) {
  const [isOpen, setIsOpen] = React.useState(false);

  useEffect(() => {
    if (txn) {
      setIsOpen(true);
      document.body.style.overflow = "hidden";
    } else {
      setIsOpen(false);
      document.body.style.overflow = "auto";
    }
    
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [txn, onClose]);

  if (!txn) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`} 
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className={`relative w-full max-w-[840px] bg-background h-full shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header */}
        <div className="h-[64px] border-b border-border flex items-center justify-between px-[24px] bg-card shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-[12px]">
            <div className="w-[32px] h-[32px] rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
              <FileText size={16} className="text-text" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-[8px]">
                <h3 className="font-black text-[16px] text-text">Chi tiết Giao dịch</h3>
                <span className={`text-[10px] font-black uppercase px-[8px] py-[2px] rounded-[6px] border ${txn.type === 'Income' ? 'text-[#8b5cf6] border-[#8b5cf6]/20 bg-[#8b5cf6]/10' : txn.type === 'Expense' ? 'text-rose-500 border-rose-500/20 bg-rose-500/10' : 'text-[#f97316] border-[#f97316]/20 bg-[#f97316]/10'}`}>
                  {txn.type === 'Income' ? 'Phiếu thu' : txn.type === 'Expense' ? 'Phiếu chi' : 'Điều chỉnh'}
                </span>
                <span className="font-bold text-[13px] text-muted">· {txn.id}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-[32px] h-[32px] rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
          >
            <X size={18} className="text-muted" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto bg-[#f8fafc] dark:bg-[#0f172a] p-[24px] flex flex-col gap-[24px]">
          
          {/* Section 1: Overview */}
          <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
            <h4 className="font-black text-[15px] text-text flex items-center gap-2 border-b border-border/50 pb-3"><Wallet size={16} className="text-[#6366f1]" /> Tổng quan</h4>
            
            <div className="grid grid-cols-2 gap-y-[20px] gap-x-[16px] mt-4">
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-bold text-muted uppercase tracking-wider">Số tiền</span>
                <span className={`text-[24px] font-black leading-none ${txn.type === 'Income' ? 'text-[#8b5cf6]' : txn.type === 'Expense' ? 'text-rose-500' : 'text-[#f97316]'}`}>{txn.amount} VNĐ</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[12px] font-bold text-muted uppercase tracking-wider">Trạng thái đối soát</span>
                <div className={`flex items-center gap-[6px] ${txn.status === 'Verified' ? 'text-[#0ea5e9]' : 'text-[#f97316]'}`}>
                  {txn.status === 'Verified' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span className="font-black text-[14px]">{txn.status === 'Verified' ? 'Đã đối soát' : 'Chờ đối soát'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <span className="text-[12px] font-bold text-muted uppercase tracking-wider">Nội dung ghi chú</span>
                <span className="text-[14px] font-medium text-text bg-black/5 dark:bg-white/5 p-3 rounded-[8px]">{txn.content}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Accounting Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
            <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
              <h4 className="font-black text-[15px] text-text flex items-center gap-2 border-b border-border/50 pb-3"><Banknote size={16} className="text-[#8b5cf6]" /> Hạch toán (Accounting)</h4>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex justify-between items-center pb-2 border-b border-border/30">
                  <span className="text-[13px] font-bold text-muted">Hạng mục thu/chi</span>
                  <span className="text-[14px] font-black text-text">{txn.category}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border/30">
                  <span className="text-[13px] font-bold text-muted">Phương thức TT</span>
                  <span className="text-[14px] font-bold text-text">{txn.method}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border/30">
                  <span className="text-[13px] font-bold text-muted">Ngày thực tế</span>
                  <span className="text-[14px] font-bold text-text">{txn.date}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-bold text-muted">Người tạo/Ghi nhận</span>
                  <span className="text-[14px] font-bold text-text">{txn.creator}</span>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
              <h4 className="font-black text-[15px] text-text flex items-center gap-2 border-b border-border/50 pb-3"><Building2 size={16} className="text-[#0ea5e9]" /> Đối tượng liên quan</h4>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex justify-between items-center pb-2 border-b border-border/30">
                  <span className="text-[13px] font-bold text-muted">Tòa nhà</span>
                  <span className="text-[14px] font-black text-text">{txn.building}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border/30">
                  <span className="text-[13px] font-bold text-muted">Phòng</span>
                  <span className="text-[14px] font-black text-text bg-[#0ea5e9]/10 text-[#0ea5e9] px-2 py-0.5 rounded-[4px]">{txn.room}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-bold text-muted">Người giao dịch</span>
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-muted" />
                    <span className="text-[14px] font-bold text-text">{txn.party}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Documents */}
          <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
            <h4 className="font-black text-[15px] text-text flex items-center gap-2 border-b border-border/50 pb-3"><Paperclip size={16} className="text-[#8b5cf6]" /> Chứng từ đính kèm</h4>
            
            {txn.hasDocs ? (
              <div className="flex gap-4 mt-4 overflow-x-auto pb-2">
                <div className="w-[120px] h-[160px] rounded-[8px] bg-black/5 dark:bg-white/5 border border-border flex items-center justify-center cursor-pointer hover:bg-black/10 transition-colors">
                  <FileText size={32} className="text-muted/50" />
                </div>
                <div className="w-[120px] h-[160px] rounded-[8px] bg-black/5 dark:bg-white/5 border border-border flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-[#8b5cf6]/10 hover:text-[#8b5cf6] hover:border-[#8b5cf6]/30 transition-all text-muted">
                  <div className="w-[32px] h-[32px] rounded-full bg-black/5 flex items-center justify-center"><Paperclip size={16} /></div>
                  <span className="text-[12px] font-bold">Thêm File</span>
                </div>
              </div>
            ) : (
              <div className="w-full py-8 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-rose-500/30 rounded-[12px] mt-4 bg-rose-500/5">
                <AlertTriangle size={32} className="text-rose-500/50" />
                <span className="font-bold text-[14px] text-rose-500">Chưa có chứng từ đính kèm</span>
                <span className="text-[12px] text-muted">Vui lòng đính kèm bill chuyển khoản hoặc phiếu thu tay để đối soát.</span>
                <button className="mt-2 h-[32px] px-4 bg-rose-500 text-white font-bold text-[12px] rounded-[6px] shadow-sm hover:bg-rose-600 transition-colors">Tải lên chứng từ</button>
              </div>
            )}
          </div>

          {/* Section 4: Activity */}
          <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm mb-4">
            <h4 className="font-black text-[15px] text-text flex items-center gap-2 border-b border-border/50 pb-3"><History size={16} className="text-[#a855f7]" /> Lịch sử hoạt động</h4>
            
            <div className="flex flex-col gap-0 mt-4 relative">
              <div className="absolute left-[15px] top-[24px] bottom-[24px] w-[2px] bg-border/50" />
              
              <div className="flex items-start gap-[16px] py-[12px] relative z-10">
                <div className="w-[32px] h-[32px] rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0 border-[4px] border-card">
                  <CheckCircle2 size={14} className="text-muted" />
                </div>
                <div className="flex flex-col gap-1 pt-1">
                  <span className="text-[13px] font-bold text-text">Hệ thống tạo phiếu tự động từ hóa đơn</span>
                  <span className="text-[12px] text-muted">21/06/2026 14:32</span>
                </div>
              </div>
              
              {txn.status === 'Verified' && (
                <div className="flex items-start gap-[16px] py-[12px] relative z-10">
                  <div className="w-[32px] h-[32px] rounded-full bg-[#0ea5e9]/10 flex items-center justify-center shrink-0 border-[4px] border-card">
                    <CheckCircle2 size={14} className="text-[#0ea5e9]" />
                  </div>
                  <div className="flex flex-col gap-1 pt-1">
                    <span className="text-[13px] font-bold text-text">{txn.creator} đã xác nhận đối soát giao dịch</span>
                    <span className="text-[12px] text-muted">21/06/2026 15:10</span>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="h-[72px] border-t border-border flex items-center justify-between px-[24px] bg-card shrink-0 sticky bottom-0 z-10">
          <div className="flex items-center gap-2">
            <button className="h-[40px] px-4 rounded-[10px] hover:bg-rose-500/10 text-rose-500 font-bold text-[13px] transition-colors">
              Hủy / Xóa
            </button>
            <button className="h-[40px] px-4 rounded-[10px] hover:bg-black/5 dark:hover:bg-white/5 text-text font-bold text-[13px] transition-colors">
              Chỉnh sửa
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button className="h-[40px] px-4 bg-black/5 dark:bg-white/5 hover:bg-black/10 text-text font-bold text-[13px] rounded-[10px] transition-colors flex items-center gap-2">
              <Printer size={16} /> In phiếu
            </button>
            {txn.status === 'Pending' && (
              <button className="h-[40px] px-6 bg-[#0ea5e9] hover:bg-[#0284c7] text-white font-bold text-[13px] rounded-[10px] shadow-sm shadow-[#0ea5e9]/20 transition-all flex items-center gap-2">
                <CheckCircle2 size={16} /> Đối soát
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
