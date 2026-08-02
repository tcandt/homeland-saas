"use client";

import React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Database, Download, Upload, RefreshCcw, Clock, HardDrive, Calendar, CheckCircle2 } from "lucide-react";

export default function SettingsBackup() {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-[12px]">
        {[
          { icon: <Clock size={16} />, label: "Sao lưu gần nhất", value: "Chưa có", color: "text-primary bg-primary/10" },
          { icon: <HardDrive size={16} />, label: "Dung lượng dữ liệu", value: "0 MB", color: "text-warning bg-warning/10" },
          { icon: <Database size={16} />, label: "Số bản sao lưu", value: "0", color: "text-success bg-success/10" },
          { icon: <Calendar size={16} />, label: "Lịch tự động", value: "Chưa cấu hình", color: "text-primary bg-primary/10" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-[16px] p-[16px] shadow-sm flex flex-col gap-[10px]">
            <div className={`w-[32px] h-[32px] rounded-[10px] flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div className="font-black text-[16px] text-text leading-none">{s.value}</div>
            <div className="text-[11px] font-bold text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text">Hành động nhanh</h3>
        <div className="grid grid-cols-2 gap-[12px]">
          {[
            { icon: <Database size={18} className="text-white" />, title: "Sao lưu ngay", desc: "Tạo bản sao lưu thủ công", color: "bg-primary/10 border-primary/20", iconBg: "bg-primary" },
            { icon: <Download size={18} className="text-white" />, title: "Tải về", desc: "Tải bản sao lưu gần nhất", color: "bg-success/10 border-success/20", iconBg: "bg-success" },
            { icon: <Upload size={18} className="text-white" />, title: "Nhập dữ liệu", desc: "Import từ file backup", color: "bg-warning/10 border-warning/20", iconBg: "bg-warning" },
            { icon: <RefreshCcw size={18} className="text-white" />, title: "Khôi phục", desc: "Restore từ bản sao lưu", color: "bg-danger/10 border-danger/20", iconBg: "bg-danger" },
          ].map((item) => (
            <Button key={item.title} className={`flex items-center gap-[12px] p-[16px] rounded-[12px] border ${item.color} transition-colors group`}>
              <div className={`w-[40px] h-[40px] rounded-[10px] ${item.iconBg} flex items-center justify-center shrink-0`}>
                {item.icon}
              </div>
              <div className="flex flex-col text-left">
                <span className="font-black text-[14px] text-text group-hover:text-primary transition-colors">{item.title}</span>
                <span className="text-[11px] font-medium text-muted">{item.desc}</span>
              </div>
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text">Lịch sao lưu tự động</h3>
        <div className="grid grid-cols-3 gap-[10px]">
          {[
            { label: "Hàng ngày", desc: "Lúc 02:00 sáng", active: false },
            { label: "Hàng tuần", desc: "Thứ Hai 02:00", active: false },
            { label: "Hàng tháng", desc: "Ngày 1 mỗi tháng", active: false },
          ].map((s, i) => (
            <div key={i} className="flex flex-col gap-[8px] p-[14px] rounded-[12px] border-2 border-border bg-background">
              <div className="flex items-center justify-between">
                <span className="font-black text-[14px] text-text">{s.label}</span>
                {s.active && <CheckCircle2 size={14} className="text-primary" />}
              </div>
              <span className="text-[12px] font-medium text-muted">{s.desc}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Retention (lưu tối đa)</label>
          <div className="flex items-center gap-[10px]">
            <Input type="number" defaultValue="30" className="w-[100px] h-[40px] px-[12px] bg-background border border-border rounded-[10px] text-[13px] font-bold focus:outline-none focus:border-primary" />
            <span className="text-[13px] font-medium text-muted">bản sao lưu</span>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[14px]">
        <h3 className="font-black text-[15px] text-text">Lịch sử sao lưu</h3>
        <div className="rounded-[12px] border border-dashed border-border bg-background p-[20px] text-center text-muted font-medium">
          Chưa có bản sao lưu nào.
        </div>
      </div>
    </div>
  );
}
