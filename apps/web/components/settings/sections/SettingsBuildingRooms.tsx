"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { Plus, ClipboardList } from "lucide-react";

export default function SettingsBuildingRooms() {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-[15px] text-text">Loại phòng (Room Types)</h3>
          <Button className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 flex items-center gap-[6px] transition-colors" disabled>
            <Plus size={14} /> Thêm loại phòng
          </Button>
        </div>
        <div className="rounded-[12px] border border-dashed border-border bg-background p-[28px] text-center">
          <ClipboardList size={20} className="mx-auto text-muted" />
          <div className="mt-[10px] font-black text-text">Chưa có loại phòng trong DB</div>
          <div className="mt-[6px] text-[13px] font-medium text-muted">
            Studio, phòng ngủ, diện tích, sức chứa và đặt cọc sẽ lấy từ dữ liệu cấu hình thật.
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text">Cài đặt vận hành</h3>
        <div className="rounded-[12px] border border-dashed border-border bg-background p-[28px] text-center text-muted font-medium">
          Chưa có cài đặt vận hành phòng trong DB.
        </div>
      </div>
    </div>
  );
}
