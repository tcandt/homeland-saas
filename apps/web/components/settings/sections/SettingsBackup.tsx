"use client";
import React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Database, Download, Upload, RefreshCcw, Clock, HardDrive, Calendar, CheckCircle2, AlertTriangle } from "lucide-react";

const backups = [
  { name: "auto_backup_20260625.zip", date: "25/06/2026 02:00", size: "48.2 MB", type: "Auto", status: "ok" },
  { name: "auto_backup_20260624.zip", date: "24/06/2026 02:00", size: "47.8 MB", type: "Auto", status: "ok" },
  { name: "manual_backup_20260620.zip", date: "20/06/2026 14:30", size: "46.1 MB", type: "Manual", status: "ok" },
  { name: "auto_backup_20260623.zip", date: "23/06/2026 02:00", size: "47.1 MB", type: "Auto", status: "ok" },
  { name: "auto_backup_20260622.zip", date: "22/06/2026 02:00", size: "0 MB", type: "Auto", status: "error" },
];

export default function SettingsBackup() {
  return (
    <div className="flex flex-col gap-[20px]">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-[12px]">
        {[
          { icon: <Clock size={16} />, label: "Sao lưu gần nhất", value: "2 ngày trước", color: "text-primary bg-primary/10" },
          { icon: <HardDrive size={16} />, label: "Dung lượng dữ liệu", value: "48.2 MB", color: "text-warning bg-warning/10" },
          { icon: <Database size={16} />, label: "Số bản sao lưu", value: "14", color: "text-success bg-success/10" },
          { icon: <Calendar size={16} />, label: "Lịch tự động", value: "Hàng ngày 02:00", color: "text-primary bg-primary/10" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-[16px] p-[16px] shadow-sm flex flex-col gap-[10px]">
            <div className={`w-[32px] h-[32px] rounded-[10px] flex items-center justify-center ${s.color}`}>{s.icon}</div>
            <div className="font-black text-[16px] text-text leading-none">{s.value}</div>
            <div className="text-[11px] font-bold text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text">Hành động nhanh</h3>
        <div className="grid grid-cols-2 gap-[12px]">
          <Button className="flex items-center gap-[12px] p-[16px] rounded-[12px] bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors group">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-primary flex items-center justify-center shrink-0">
              <Database size={18} className="text-white" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-black text-[14px] text-text group-hover:text-primary transition-colors">Sao lưu ngay</span>
              <span className="text-[11px] font-medium text-muted">Tạo bản sao lưu thủ công</span>
            </div>
          </Button>
          <Button className="flex items-center gap-[12px] p-[16px] rounded-[12px] bg-success/10 border border-success/20 hover:bg-success/20 transition-colors group">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-success flex items-center justify-center shrink-0">
              <Download size={18} className="text-white" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-black text-[14px] text-text group-hover:text-success transition-colors">Tải về</span>
              <span className="text-[11px] font-medium text-muted">Tải bản sao lưu gần nhất</span>
            </div>
          </Button>
          <Button className="flex items-center gap-[12px] p-[16px] rounded-[12px] bg-warning/10 border border-warning/20 hover:bg-warning/20 transition-colors group">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-warning flex items-center justify-center shrink-0">
              <Upload size={18} className="text-white" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-black text-[14px] text-text group-hover:text-warning transition-colors">Nhập dữ liệu</span>
              <span className="text-[11px] font-medium text-muted">Import từ file backup</span>
            </div>
          </Button>
          <Button className="flex items-center gap-[12px] p-[16px] rounded-[12px] bg-danger/10 border border-danger/20 hover:bg-danger/20 transition-colors group">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-danger flex items-center justify-center shrink-0">
              <RefreshCcw size={18} className="text-white" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-black text-[14px] text-text group-hover:text-danger transition-colors">Khôi phục</span>
              <span className="text-[11px] font-medium text-muted">Restore từ bản sao lưu</span>
            </div>
          </Button>
        </div>
      </div>

      {/* Auto Backup Schedule */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text">Lịch sao lưu tự động</h3>
        <div className="grid grid-cols-3 gap-[10px]">
          {[
            { label: "Hàng ngày", desc: "Lúc 02:00 sáng", active: true },
            { label: "Hàng tuần", desc: "Thứ Hai 02:00", active: false },
            { label: "Hàng tháng", desc: "Ngày 1 mỗi tháng", active: false },
          ].map((s, i) => (
            <div key={i} className={`flex flex-col gap-[8px] p-[14px] rounded-[12px] border-2 cursor-pointer transition-all
              ${s.active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40"}`}>
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

      {/* Backup History */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[14px]">
        <h3 className="font-black text-[15px] text-text">Lịch sử sao lưu</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-background">
                {["Tên file", "Thời gian", "Dung lượng", "Loại", "Trạng thái", ""].map(h => (
                  <th key={h} className="text-left py-[8px] px-[12px] font-black text-muted uppercase tracking-wide text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {backups.map((b, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-black/[0.02] dark:hover:bg-card/[0.02] transition-colors">
                  <td className="py-[10px] px-[12px] font-mono text-[11px] text-text">{b.name}</td>
                  <td className="py-[10px] px-[12px] text-muted">{b.date}</td>
                  <td className="py-[10px] px-[12px] font-medium text-text">{b.size}</td>
                  <td className="py-[10px] px-[12px]">
                    <span className={`text-[10px] font-bold px-[8px] py-[3px] rounded-full ${b.type === "Auto" ? "text-primary bg-primary/10" : "text-warning bg-warning/10"}`}>{b.type}</span>
                  </td>
                  <td className="py-[10px] px-[12px]">
                    {b.status === "ok"
                      ? <span className="flex items-center gap-[4px] text-success font-bold text-[11px]"><CheckCircle2 size={12} /> OK</span>
                      : <span className="flex items-center gap-[4px] text-danger font-bold text-[11px]"><AlertTriangle size={12} /> Lỗi</span>
                    }
                  </td>
                  <td className="py-[10px] px-[12px]">
                    <Button className="text-[11px] font-bold text-primary hover:underline flex items-center gap-[4px]">
                      <Download size={11} /> Tải
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
