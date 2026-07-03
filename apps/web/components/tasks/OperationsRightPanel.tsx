import React from "react";
import { MessageSquare, CalendarClock, History, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function OperationsRightPanel() {
  return (
    <div className="w-[380px] shrink-0 hidden lg:flex flex-col gap-[20px]">
      <div className="sticky top-[24px] flex flex-col gap-[20px] max-h-[calc(100vh-48px)] overflow-y-auto no-scrollbar pb-[40px]">
        
        {/* Inbox Khách Thuê */}
        <div className="bg-card border border-border rounded-[20px] p-[20px] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-[16px] text-text flex items-center gap-2">
              <MessageSquare size={16} className="text-primary" />
              Inbox Khách Thuê
            </h3>
            <span className="bg-primary/10 text-primary text-[11px] font-bold px-2 py-0.5 rounded-full">3 mới</span>
          </div>
          <div className="flex flex-col gap-[12px]">
            <InboxItem name="Lê Thị C" room="P.105" message="Điều hòa phòng tôi không mát, kêu to quá!" time="10 phút trước" unread />
            <InboxItem name="Trần Văn D" room="P.302" message="Anh ơi tháng này tiền điện bị tính sai ạ." time="1 giờ trước" unread />
            <InboxItem name="Nguyễn A" room="P.401" message="Bao giờ thì có người đến sửa vòi nước thế shop?" time="Hôm qua" />
          </div>
          <Button variant="ghost" className="w-full mt-4 text-primary hover:text-primary hover:bg-primary/5">
            Xem tất cả tin nhắn <ChevronRight size={14} className="ml-1" />
          </Button>
        </div>

        {/* Lịch bảo trì */}
        <div className="bg-card border border-border rounded-[20px] p-[20px] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-[16px] text-text flex items-center gap-2">
              <CalendarClock size={16} className="text-warning" />
              Lịch Bảo Trì
            </h3>
          </div>
          <div className="flex flex-col gap-[12px]">
            <ScheduleItem title="Bảo trì thang máy định kỳ" date="Hôm nay, 14:00" desc="Tòa nhà Alpha" urgent />
            <ScheduleItem title="Vệ sinh bể nước ngầm" date="Ngày mai, 08:00" desc="Tòa nhà Beta" />
            <ScheduleItem title="Kiểm tra PCCC" date="28/06/2026" desc="Toàn bộ hệ thống" />
          </div>
        </div>

        {/* Hoạt động gần đây */}
        <div className="bg-card border border-border rounded-[20px] p-[20px] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-[16px]">
            <h3 className="font-black text-[16px] text-text flex items-center gap-[8px]">
              <History size={16} className="text-muted" />
              Hoạt động gần đây
            </h3>
          </div>
          <div className="flex flex-col gap-[16px] relative before:absolute before:left-[11px] before:top-[8px] before:bottom-[8px] before:w-[2px] before:bg-border">
            <ActivityItem text={<span><b>KTV Tuấn</b> đã hoàn thành ticket <b>Sửa rò rỉ nước P.201</b></span>} time="5 phút trước" />
            <ActivityItem text={<span><b>Hệ thống</b> tự động tạo ticket <b>Vệ sinh hành lang T2</b></span>} time="1 giờ trước" />
            <ActivityItem text={<span><b>Khách Lê B</b> phản hồi: &quot;Dịch vụ rất tốt, cảm ơn!&quot;</span>} time="3 giờ trước" />
          </div>
        </div>

      </div>
    </div>
  );
}

function InboxItem({ name, room, message, time, unread }: any) {
  return (
    <div className="flex items-start gap-3 p-2 -mx-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group">
      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
        <span className="font-bold text-[12px] text-primary">{name.charAt(0)}</span>
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={`text-[13px] ${unread ? 'font-black text-text' : 'font-bold text-text/80'}`}>{name} <span className="text-muted font-medium ml-1">· {room}</span></span>
          <span className="text-[10px] font-medium text-muted">{time}</span>
        </div>
        <p className={`text-[12px] truncate ${unread ? 'font-medium text-text' : 'text-muted'}`}>{message}</p>
      </div>
      {unread && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
    </div>
  );
}

function ScheduleItem({ title, date, desc, urgent }: any) {
  return (
    <div className={`flex flex-col gap-1 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border-l-[3px] transition-colors hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer ${urgent ? 'border-warning' : 'border-success'}`}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-[13px] text-text">{title}</span>
        {urgent && <span className="text-[9px] font-black uppercase text-warning bg-warning/10 px-1.5 py-0.5 rounded">Khẩn</span>}
      </div>
      <div className="flex items-center gap-[6px] text-[11px] font-medium text-muted">
        <span>{date}</span>
        <span className="w-1 h-1 rounded-full bg-border" />
        <span>{desc}</span>
      </div>
    </div>
  );
}

function ActivityItem({ text, time }: any) {
  return (
    <div className="flex gap-[12px] relative z-10">
      <div className="w-[24px] h-[24px] rounded-full bg-background border-2 border-border flex items-center justify-center shrink-0 mt-[2px]" />
      <div className="flex flex-col">
        <span className="text-[12px] text-text/90 leading-snug">{text}</span>
        <span className="text-[10px] font-medium text-muted mt-[2px]">{time}</span>
      </div>
    </div>
  );
}
