"use client";

import React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Card } from "@/components/ui/Card";
import { Search, SlidersHorizontal, ClipboardList } from "lucide-react";

export default function SettingsAuditLogs() {
  return (
    <div className="flex flex-col gap-[20px]">
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text">Nhật ký hoạt động (Audit Logs)</h3>

        <div className="flex flex-wrap items-center gap-[8px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
            <Input placeholder="Tìm theo user, hành động, module..." className="w-full h-[38px] pl-[36px] pr-[12px] bg-background border border-border rounded-[10px] text-[13px] text-text focus:outline-none focus:border-primary transition-all" />
          </div>
          {["Người dùng", "Module", "Hành động", "Thời gian"].map((filter) => (
            <div key={filter} className="w-[120px]">
              <Select options={[{ label: filter, value: filter }]} defaultValue={filter} disabled />
            </div>
          ))}
          <Button className="h-[38px] px-[12px] rounded-[10px] bg-background border border-border flex items-center gap-[6px] text-[12px] font-bold text-text hover:bg-black/5 dark:hover:bg-card/5 transition-colors" disabled>
            <SlidersHorizontal size={13} className="text-muted" /> Lọc nâng cao
          </Button>
        </div>

        <div className="rounded-[14px] border border-dashed border-border bg-background px-[20px] py-[32px] text-center">
          <div className="mx-auto mb-[10px] flex h-[42px] w-[42px] items-center justify-center rounded-full bg-card text-muted">
            <ClipboardList size={18} />
          </div>
          <div className="font-black text-text">Chưa có nhật ký hoạt động trong DB</div>
          <div className="mt-[6px] text-[13px] font-medium text-muted">
            Bảng này sẽ hiển thị dữ liệu thật khi backend audit log được kết nối.
          </div>
        </div>
      </Card>
    </div>
  );
}
