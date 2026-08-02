"use client";

import React, { useState } from "react";
import { CalendarClock, Inbox, MessageSquare, Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/Button";

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card border border-dashed border-border rounded-[14px] p-5 text-center text-sm text-muted font-medium">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-background border border-border text-muted">
        {icon}
      </div>
      <p className="mt-3 text-[13px] font-bold text-text">{title}</p>
      <p className="mt-1 text-[12px] text-muted">{description}</p>
    </div>
  );
}

export default function OperationsMobileFlow() {
  const [activeTab, setActiveTab] = useState<"maintenance" | "crm">("crm");

  return (
    <div className="flex flex-col gap-[20px] w-full box-border pb-[100px] bg-background">
      <div className="bg-card border border-border p-1 rounded-xl flex mt-1 shadow-sm mx-1 gap-1">
        <Button
          variant="ghost"
          onClick={() => setActiveTab("crm")}
          className={`relative flex-1 h-9 text-[13px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "crm"
              ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-sm"
              : "text-muted hover:bg-black/5 dark:hover:bg-white/5"
          }`}
        >
          <MessageSquare size={16} /> Chăm sóc khách
        </Button>
        <Button
          variant="ghost"
          onClick={() => setActiveTab("maintenance")}
          className={`relative flex-1 h-9 text-[13px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "maintenance"
              ? "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary shadow-sm"
              : "text-muted hover:bg-black/5 dark:hover:bg-white/5"
          }`}
        >
          <Wrench size={16} /> Vận hành & Sửa chữa
        </Button>
      </div>

      {activeTab === "maintenance" ? <MaintenanceTab /> : <CrmTab />}
    </div>
  );
}

function MaintenanceTab() {
  return (
    <div className="flex flex-col gap-[20px]">
      <section className="flex flex-col gap-2">
        <h3 className="text-[15px] font-black text-text px-1">Tổng quan Sự cố</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="h-[80px] bg-rose-500/10 border border-rose-500/20 rounded-[12px] p-3 flex flex-col justify-between shadow-sm">
            <span className="text-[12px] font-semibold text-rose-600 uppercase">Mới / Cấp bách</span>
            <span className="text-[24px] font-black text-rose-500 leading-none">0</span>
          </div>
          <div className="h-[80px] bg-blue-500/10 border border-blue-500/20 rounded-[12px] p-3 flex flex-col justify-between shadow-sm">
            <span className="text-[12px] font-semibold text-blue-600 uppercase">Đang xử lý</span>
            <span className="text-[24px] font-black text-blue-500 leading-none">0</span>
          </div>
          <div className="h-[80px] bg-indigo-500/10 border border-indigo-500/20 rounded-[12px] p-3 flex flex-col justify-between shadow-sm">
            <span className="text-[12px] font-semibold text-indigo-600 uppercase">Đã xong</span>
            <span className="text-[24px] font-black text-indigo-500 leading-none">0</span>
          </div>
        </div>
      </section>

      <div className="flex gap-2 px-1">
        <Button variant="outline" className="flex-1 h-10 text-[12px] font-bold flex items-center justify-center gap-2">
          <Plus size={14} className="text-primary" /> Báo hỏng mới
        </Button>
        <Button variant="outline" className="flex-1 h-10 text-[12px] font-bold flex items-center justify-center gap-2">
          <CalendarClock size={14} className="text-primary" /> Lịch bảo trì
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex justify-between items-end px-1">
          <h3 className="text-[15px] font-black text-text">Danh sách Yêu cầu</h3>
          <span className="text-[11px] font-bold text-[#4f46e5] cursor-pointer">Lọc & Sắp xếp</span>
        </div>

        <EmptyState
          icon={<Wrench size={18} />}
          title="Chưa có ticket vận hành"
          description="Khi có yêu cầu mới từ API, danh sách sẽ xuất hiện tại đây."
        />
      </section>
    </div>
  );
}

function CrmTab() {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex gap-2 px-1">
        <Button variant="outline" className="flex-1 h-auto py-3 bg-primary/5 border-primary/20 text-primary hover:bg-primary/10 hover:text-primary flex flex-col items-center justify-center gap-1 rounded-xl">
          <Inbox size={20} />
          <span className="text-[13px]">Hộp thư khách thuê</span>
        </Button>
        <div className="flex-1 flex flex-col gap-2">
          <Button variant="outline" className="flex-1 h-10 text-[12px] font-bold flex items-center justify-center gap-2">
            <Plus size={14} className="text-primary" /> Mẫu tin nhắn
          </Button>
          <Button variant="outline" className="flex-1 h-10 text-[12px] font-bold flex items-center justify-center gap-2">
            <CalendarClock size={14} className="text-primary" /> Tin nhắn tự động
          </Button>
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex justify-between items-end px-1">
          <h3 className="text-[15px] font-black text-text">Hộp thư (Inbox)</h3>
          <span className="text-[11px] font-bold text-[#ec4899] cursor-pointer">Lọc Zalo/SMS</span>
        </div>

        <EmptyState
          icon={<MessageSquare size={18} />}
          title="Chưa có cuộc trò chuyện nào"
          description="Tin nhắn từ khách thuê sẽ xuất hiện ở đây khi hệ thống nhận dữ liệu."
        />
      </section>
    </div>
  );
}
