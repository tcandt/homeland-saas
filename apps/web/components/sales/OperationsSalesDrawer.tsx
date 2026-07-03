"use client";

import React, { useState } from "react";
import { X, User, Phone, Mail, MapPin, Building, Briefcase, Calendar, MessageSquare, CreditCard, FileSignature, CheckCircle2, XCircle, Edit, MoreVertical, Eye, Zap } from "lucide-react";

export default function OperationsSalesDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  // For testing UI, assume it's opened when clicked anywhere later, but we render it hidden by default
  // Just for the verification loop, we can force it open when needed or provide a global state.
  // Actually, let's keep it closed and I'll instruct the subagent to open it by clicking a LeadCard.
  // Wait, I didn't add onClick to OperationsSalesLeadCard. I will just make the Drawer open conditionally or mock it open for now.
  // Let's add an onClick handler on the LeadCard later, or we can use a global state. To keep it simple, I'll export a global event or just mock it open in Dev mode if URL has ?drawer=1
  
  if (typeof window !== "undefined" && window.location.search.includes("drawer=1")) {
    if (!isOpen) setIsOpen(true);
  }

  // To allow opening, let's add a global listener
  React.useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-sales-drawer", handleOpen);
    return () => window.removeEventListener("open-sales-drawer", handleOpen);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998] animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-[860px] bg-card shadow-2xl z-[9999] animate-in slide-in-from-right duration-300 flex flex-col border-l border-border">
        
        {/* Sticky Header */}
        <div className="h-[70px] border-b border-border flex items-center justify-between px-[24px] shrink-0 bg-card z-10">
          <div className="flex items-center gap-[16px]">
            <img src="https://i.pravatar.cc/150?u=1" alt="Avatar" className="w-[40px] h-[40px] rounded-full object-cover border border-border" />
            <div className="flex flex-col">
              <div className="flex items-center gap-[8px]">
                <h2 className="font-black text-[18px] text-text">Nguyễn Văn A</h2>
                <span className="text-[11px] font-bold px-[6px] py-[2px] rounded-[4px] text-[#f97316] bg-[#f97316]/10 border border-[#f97316]/20 uppercase">Hot Lead</span>
              </div>
              <span className="text-[13px] font-medium text-muted">ID: L-2401 • Nguồn: Facebook Ads</span>
            </div>
          </div>
          <div className="flex items-center gap-[12px]">
            <button className="h-[36px] px-[16px] rounded-[10px] bg-background border border-border text-text text-[13px] font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-[6px]">
              <Edit size={14} /> Chỉnh sửa
            </button>
            <button className="w-[36px] h-[36px] flex items-center justify-center rounded-[10px] hover:bg-black/5 dark:hover:bg-white/5 text-muted transition-colors">
              <MoreVertical size={16} />
            </button>
            <div className="w-[1px] h-[20px] bg-border mx-[4px]" />
            <button 
              onClick={() => setIsOpen(false)}
              className="w-[36px] h-[36px] flex items-center justify-center rounded-[10px] bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-[24px] flex flex-col gap-[24px] bg-background">
          
          {/* Status Tracker */}
          <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
            <h3 className="font-black text-[15px] text-text mb-[16px]">Quy Trình (Pipeline)</h3>
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-border z-0" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[60%] h-[2px] bg-[#6366f1] z-0" />
              
              <Step active={true} done={true} label="Lead" />
              <Step active={true} done={true} label="Liên hệ" />
              <Step active={true} done={true} label="Tư vấn" />
              <Step active={true} done={true} label="Xem phòng" />
              <Step active={true} done={false} label="Thương lượng" />
              <Step active={false} done={false} label="Đặt cọc" />
              <Step active={false} done={false} label="Chốt" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-[24px]">
            {/* Left Column - 2 spans */}
            <div className="col-span-2 flex flex-col gap-[24px]">
              
              {/* Lead Information */}
              <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
                <h3 className="font-black text-[15px] text-text">Thông tin khách hàng</h3>
                <div className="grid grid-cols-2 gap-y-[16px] gap-x-[24px]">
                  <DetailItem icon={<Phone size={14} />} label="Số điện thoại" value="0901234567" highlight />
                  <DetailItem icon={<Mail size={14} />} label="Email" value="nguyenvana@gmail.com" />
                  <DetailItem icon={<Briefcase size={14} />} label="Nghề nghiệp" value="IT Manager" />
                  <DetailItem icon={<MapPin size={14} />} label="Khu vực hiện tại" value="Quận 7, TP.HCM" />
                </div>
              </div>

              {/* Nhu cầu & Quotation */}
              <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
                <h3 className="font-black text-[15px] text-text">Nhu cầu & Báo giá</h3>
                <div className="grid grid-cols-2 gap-y-[16px] gap-x-[24px]">
                  <DetailItem icon={<Building size={14} />} label="Dự án quan tâm" value="HomeLand Center" />
                  <DetailItem icon={<Building size={14} />} label="Loại phòng" value="Căn hộ 1PN, ban công" />
                  <DetailItem icon={<CreditCard size={14} />} label="Ngân sách" value="8,000,000 - 10,000,000 VNĐ" highlight />
                  <DetailItem icon={<Calendar size={14} />} label="Dự kiến chuyển vào" value="Tháng 07/2026" />
                </div>
              </div>

              {/* Notes */}
              <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[12px]">
                <h3 className="font-black text-[15px] text-text">Ghi chú (Notes)</h3>
                <div className="p-[12px] bg-yellow-500/10 border border-yellow-500/20 rounded-[8px] text-[13px] text-text leading-relaxed">
                  Khách hàng làm việc remote, cần không gian yên tĩnh và wifi mạnh. Rất quan tâm đến view ban công. Sẽ chuyển vào cùng bạn gái. Đã gửi 3 option phòng 1PN.
                </div>
              </div>

            </div>

            {/* Right Column - 1 span */}
            <div className="col-span-1 flex flex-col gap-[24px]">
              
              {/* Sales Info */}
              <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
                <h3 className="font-black text-[15px] text-text">Phụ trách</h3>
                <div className="flex items-center gap-[12px]">
                  <div className="w-[36px] h-[36px] bg-purple-500/10 rounded-full flex items-center justify-center text-purple-500 font-bold text-[14px]">
                    T
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-[13px] text-text">Tuấn Đạt</span>
                    <span className="text-[11px] font-medium text-muted">Senior Sales</span>
                  </div>
                </div>
                <div className="flex flex-col gap-[4px] mt-2">
                  <span className="text-[11px] font-medium text-muted">Doanh thu dự kiến</span>
                  <span className="font-black text-[16px] text-[#10b981]">10,000,000 VNĐ</span>
                </div>
              </div>

              {/* Activity Timeline */}
              <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px] flex-1">
                <h3 className="font-black text-[15px] text-text">Hoạt động (Activities)</h3>
                
                <div className="flex flex-col gap-[16px] relative">
                  <div className="absolute left-[15px] top-[10px] bottom-0 w-[2px] bg-border z-0" />
                  
                  <TimelineItem icon={<Eye size={12} />} title="Đã xem phòng 102, 105" time="Hôm nay, 09:30" color="bg-purple-500 text-white" />
                  <TimelineItem icon={<Phone size={12} />} title="Gọi điện tư vấn (5p)" time="Hôm qua, 14:00" color="bg-blue-500 text-white" />
                  <TimelineItem icon={<MessageSquare size={12} />} title="Gửi báo giá qua Zalo" time="Hôm qua, 09:15" color="bg-[#0ea5e9] text-white" />
                  <TimelineItem icon={<User size={12} />} title="Lead tạo từ Facebook" time="25/06/2026, 08:00" color="bg-background text-muted border-2 border-border" />
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="h-[80px] border-t border-border bg-card shrink-0 px-[24px] flex items-center justify-between z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-[12px]">
            <ActionButton icon={<Phone size={16} />} label="Gọi điện" color="bg-blue-500" />
            <ActionButton icon={<MessageSquare size={16} />} label="Chat Zalo" color="bg-[#0ea5e9]" />
            <ActionButton icon={<Calendar size={16} />} label="Đặt lịch xem" color="bg-background text-text border border-border hover:bg-black/5" />
          </div>
          
          <div className="flex items-center gap-[12px]">
            <ActionButton icon={<XCircle size={16} />} label="Khách hủy" color="bg-background text-rose-500 border border-rose-500/20 hover:bg-rose-500/10" />
            <div className="w-[1px] h-[24px] bg-border mx-[4px]" />
            <ActionButton icon={<CreditCard size={16} />} label="Thu tiền cọc" color="bg-rose-500" />
            <ActionButton icon={<FileSignature size={16} />} label="Chuyển Hợp Đồng" color="bg-[#10b981]" />
          </div>
        </div>

      </div>
    </>
  );
}

function Step({ active, done, label }: any) {
  return (
    <div className="flex flex-col items-center gap-[8px] z-10">
      <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center border-2 transition-colors
        ${done ? 'bg-[#6366f1] border-[#6366f1] text-white' : active ? 'bg-card border-[#6366f1] text-[#6366f1]' : 'bg-card border-border text-border'}
      `}>
        {done && <CheckCircle2 size={14} />}
        {!done && active && <div className="w-[8px] h-[8px] rounded-full bg-[#6366f1]" />}
      </div>
      <span className={`text-[11px] font-bold ${active || done ? 'text-text' : 'text-muted'}`}>{label}</span>
    </div>
  );
}

function DetailItem({ icon, label, value, highlight = false }: any) {
  return (
    <div className="flex flex-col gap-[4px]">
      <div className="flex items-center gap-[6px] text-muted">
        {icon}
        <span className="text-[12px] font-medium">{label}</span>
      </div>
      <span className={`text-[14px] font-bold ${highlight ? 'text-[#6366f1]' : 'text-text'}`}>{value}</span>
    </div>
  );
}

function TimelineItem({ icon, title, time, color }: any) {
  return (
    <div className="flex gap-[16px] relative z-10">
      <div className={`w-[32px] h-[32px] rounded-full flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="flex flex-col pt-[6px]">
        <span className="text-[13px] font-bold text-text leading-none mb-[4px]">{title}</span>
        <span className="text-[11px] font-medium text-muted">{time}</span>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, color }: any) {
  return (
    <button className={`h-[44px] px-[20px] rounded-[12px] flex items-center gap-[8px] text-[14px] font-bold transition-transform active:scale-95 shadow-sm
      ${color.includes('bg-background') ? color : `${color} text-white hover:opacity-90`}
    `}>
      {icon}
      {label}
    </button>
  );
}
