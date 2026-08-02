"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";

export default function SettingsTemplates() {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-[15px] text-text">Mẫu biểu (Templates)</h3>
          <Button className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 flex items-center gap-[6px] transition-colors">
            <Plus size={14} /> Thêm mẫu
          </Button>
        </div>
        <div className="rounded-[12px] border border-dashed border-border bg-background p-[20px] text-center text-muted font-medium">
          Chưa có mẫu biểu nào được lưu.
        </div>
      </div>

      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text">Logo & Chữ ký</h3>
        <div className="grid grid-cols-2 gap-[14px]">
          {["Logo công ty", "Chữ ký điện tử"].map((label) => (
            <div key={label} className="flex flex-col gap-[8px]">
              <label className="text-[12px] font-bold text-muted uppercase tracking-wide">{label}</label>
              <div className="h-[100px] rounded-[12px] border-2 border-dashed border-border bg-background flex flex-col items-center justify-center gap-[6px] cursor-pointer hover:border-primary transition-colors group">
                <span className="text-[24px]">{label === "Logo công ty" ? "⬆" : "✍"}</span>
                <span className="text-[12px] font-bold text-muted group-hover:text-primary transition-colors">Tải lên {label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
