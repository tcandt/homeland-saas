"use client";
import React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Table } from "@/components/ui/Table";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Search, SlidersHorizontal, ChevronDown, CheckCircle2, AlertTriangle } from "lucide-react";
import { Column } from "@/components/ui/Table";

type AuditLog = {
  id: number;
  time: string;
  user: string;
  module: string;
  action: string;
  before: string;
  after: string;
  ip: string;
  device: string;
  browser: string;
  location: string;
  status: string;
};

const logs: AuditLog[] = [
  { id: 1, time: "25/06 08:15", user: "Văn Thể Phan", module: "Settings", action: "Cập nhật phân quyền", before: "Manager: View", after: "Manager: View+Edit", ip: "123.20.1.45", device: "MacBook Pro", browser: "Chrome 120", location: "TP.HCM", status: "ok" },
  { id: 2, time: "25/06 07:32", user: "Minh Trang", module: "Invoices", action: "Duyệt hóa đơn #1245", before: "Chờ duyệt", after: "Đã duyệt", ip: "14.160.22.5", device: "iPhone 15", browser: "Safari", location: "TP.HCM", status: "ok" },
  { id: 3, time: "24/06 16:00", user: "Tuấn Đạt", module: "Contracts", action: "Ký hợp đồng HĐ-2024-06", before: "Nháp", after: "Hiệu lực", ip: "123.20.1.45", device: "Chrome PC", browser: "Chrome 120", location: "TP.HCM", status: "ok" },
  { id: 4, time: "24/06 14:45", user: "System", action: "Sao lưu tự động", module: "System", before: "—", after: "backup_20260624.zip", ip: "127.0.0.1", device: "Server", browser: "—", location: "Local", status: "ok" },
  { id: 5, time: "23/06 09:12", user: "Unknown", module: "Auth", action: "Đăng nhập thất bại (3 lần)", before: "—", after: "IP bị khóa tạm thời", ip: "14.161.22.189", device: "Unknown", browser: "Chrome", location: "Hà Nội", status: "error" },
  { id: 6, time: "22/06 11:30", user: "Hoàng Long", module: "Finance", action: "Xuất báo cáo tháng 5", before: "—", after: "finance_may2026.xlsx", ip: "123.20.1.45", device: "Windows PC", browser: "Edge 120", location: "TP.HCM", status: "ok" },
];

export default function SettingsAuditLogs() {
  const columns: Column<AuditLog>[] = [
    { header: "Thời gian", accessor: "time", className: "font-mono text-[10px] text-muted whitespace-nowrap" },
    { header: "Người dùng", accessor: "user", className: "font-bold text-text whitespace-nowrap" },
    { header: "Module", accessor: (row: AuditLog) => <Badge variant="primary" className="text-[10px]">{row.module}</Badge> },
    { header: "Hành động", accessor: "action", className: "font-medium text-text whitespace-nowrap" },
    { header: "Trước", accessor: (row: AuditLog) => <span className="text-muted font-medium truncate max-w-[100px] block" title={row.before}>{row.before}</span> },
    { header: "Sau", accessor: (row: AuditLog) => <span className="text-success font-medium truncate max-w-[100px] block" title={row.after}>{row.after}</span> },
    { header: "IP", accessor: "ip", className: "font-mono text-[10px] text-muted" },
    { header: "Thiết bị", accessor: "device", className: "text-muted whitespace-nowrap" },
    { header: "Browser", accessor: "browser", className: "text-muted whitespace-nowrap" },
    { header: "Địa điểm", accessor: "location", className: "text-muted whitespace-nowrap" },
    { header: "Trạng thái", accessor: (row: AuditLog) => row.status === "ok" ? <CheckCircle2 size={14} className="text-success" /> : <AlertTriangle size={14} className="text-danger" /> }
  ];
  return (
    <div className="flex flex-col gap-[20px]">
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text">Nhật ký hoạt động (Audit Logs)</h3>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-[8px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
            <Input placeholder="Tìm theo user, hành động, module..." className="w-full h-[38px] pl-[36px] pr-[12px] bg-background border border-border rounded-[10px] text-[13px] text-text focus:outline-none focus:border-primary transition-all" />
          </div>
          {["Người dùng", "Module", "Hành động", "Thời gian"].map(f => (
            <div key={f} className="w-[120px]">
              <Select options={[{label: f, value: f}]} defaultValue={f} />
            </div>
          ))}
          <Button className="h-[38px] px-[12px] rounded-[10px] bg-background border border-border flex items-center gap-[6px] text-[12px] font-bold text-text hover:bg-black/5 dark:hover:bg-card/5 transition-colors">
            <SlidersHorizontal size={13} className="text-muted" /> Lọc nâng cao
          </Button>
        </div>

        {/* Table */}
        <Table columns={columns} data={logs} />
      </Card>
    </div>
  );
}
