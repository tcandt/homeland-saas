import React from "react";
import { ActivitySquare, CalendarClock, CalendarOff, ChevronRight, Inbox, History, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";

function EmptyCard({
  icon,
  title,
  description,
  actionLabel,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <div className="rounded-[16px] border border-dashed border-border bg-black/5 dark:bg-white/5 p-5 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-background border border-border text-muted">
        {icon}
      </div>
      <p className="mt-3 text-[13px] font-bold text-text">{title}</p>
      <p className="mt-1 text-[12px] text-muted">{description}</p>
      <Button variant="ghost" className="mt-4 text-primary hover:text-primary hover:bg-primary/5">
        {actionLabel}
        <ChevronRight size={14} className="ml-1" />
      </Button>
    </div>
  );
}

export default function OperationsRightPanel() {
  return (
    <div className="w-[380px] shrink-0 hidden lg:flex flex-col gap-[20px]">
      <div className="sticky top-[24px] flex flex-col gap-[20px] max-h-[calc(100vh-48px)] overflow-y-auto no-scrollbar pb-[40px]">
        <div className="bg-card border border-border rounded-[20px] p-[20px] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-[16px] text-text flex items-center gap-2">
              <MessageSquare size={16} className="text-primary" />
              Hộp thư
            </h3>
          </div>
          <EmptyCard
            icon={<Inbox size={20} />}
            title="Chưa có tin nhắn mới"
            description="Khi có yêu cầu từ khách thuê, hộp thư sẽ hiển thị tại đây."
            actionLabel="Mở hộp thư"
          />
        </div>

        <div className="bg-card border border-border rounded-[20px] p-[20px] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-[16px] text-text flex items-center gap-2">
              <CalendarClock size={16} className="text-warning" />
              Lịch bảo trì
            </h3>
          </div>
          <EmptyCard
            icon={<CalendarOff size={20} />}
            title="Chưa có lịch bảo trì"
            description="Lịch định kỳ sẽ xuất hiện khi có dữ liệu từ hệ thống."
            actionLabel="Xem lịch"
          />
        </div>

        <div className="bg-card border border-border rounded-[20px] p-[20px] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-[16px]">
            <h3 className="font-black text-[16px] text-text flex items-center gap-[8px]">
              <History size={16} className="text-muted" />
              Hoạt động gần đây
            </h3>
          </div>
          <EmptyCard
            icon={<ActivitySquare size={20} />}
            title="Chưa có hoạt động gần đây"
            description="Các thao tác xử lý ticket, nhắn tin hoặc bảo trì sẽ được ghi ở đây."
            actionLabel="Xem nhật ký"
          />
        </div>
      </div>
    </div>
  );
}
