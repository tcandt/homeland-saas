"use client";

import React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";

export default function SettingsAccounting() {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-[15px] text-text">Chart of Accounts</h3>
            <p className="text-[12px] font-medium text-muted mt-[2px]">Chưa có dữ liệu sổ cái thực tế. Tích hợp MISA/FAST khi backend sẵn sàng.</p>
          </div>
          <Button className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 flex items-center gap-[6px] transition-colors">
            <Plus size={14} /> Thêm tài khoản
          </Button>
        </div>
        <div className="rounded-[12px] border border-dashed border-border bg-background p-[20px] text-center text-muted font-medium">
          Chưa có tài khoản kế toán nào được đồng bộ.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
          <Input placeholder="TK MISA mapping..." className="h-[30px] px-[8px] bg-background border border-border rounded-[8px] text-[11px] focus:outline-none focus:border-primary" />
          <Input placeholder="Mã tài khoản..." className="h-[30px] px-[8px] bg-background border border-border rounded-[8px] text-[11px] focus:outline-none focus:border-primary" />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-[14px]">
          <div className="flex gap-[8px]">
            <Button className="h-[36px] px-[14px] rounded-[10px] bg-background border border-border text-[12px] font-bold text-text hover:bg-black/5 dark:hover:bg-card/5 transition-colors">Xuất MISA XML</Button>
            <Button className="h-[36px] px-[14px] rounded-[10px] bg-background border border-border text-[12px] font-bold text-text hover:bg-black/5 dark:hover:bg-card/5 transition-colors">Xuất FAST Excel</Button>
          </div>
          <Button className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 transition-colors">Lưu cấu hình kế toán</Button>
        </div>
      </div>
    </div>
  );
}
