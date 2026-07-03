"use client";

import React, { useState } from "react";
import { Users, Shield, Monitor, Database, CheckCircle2, AlertTriangle, Clock, Zap, Server, Cpu, HardDrive, Mail, MessageSquare, Wifi, Search, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
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

const auditLogs: AuditLog[] = [
  { id: 1, time: "25/06 08:15", user: "Văn Thể Phan", module: "Settings", action: "Cập nhật phân quyền", before: "Manager: View", after: "Manager: View+Edit", ip: "123.20.1.45", device: "MacBook Pro", browser: "Chrome 120", location: "TP.HCM", status: "ok" },
  { id: 2, time: "25/06 07:32", user: "Minh Trang", module: "Invoices", action: "Duyệt hóa đơn #1245", before: "Chờ duyệt", after: "Đã duyệt", ip: "14.160.22.5", device: "iPhone 15", browser: "Safari", location: "TP.HCM", status: "ok" },
  { id: 3, time: "24/06 16:00", user: "Tuấn Đạt", module: "Contracts", action: "Ký hợp đồng HĐ-2024-06", before: "Nháp", after: "Hiệu lực", ip: "123.20.1.45", device: "Chrome PC", browser: "Chrome 120", location: "TP.HCM", status: "ok" },
  { id: 4, time: "24/06 14:45", user: "System", action: "Sao lưu tự động", module: "System", before: "—", after: "backup_20260624.zip", ip: "127.0.0.1", device: "Server", browser: "—", location: "Local", status: "ok" },
  { id: 5, time: "23/06 09:12", user: "Unknown", module: "Auth", action: "Đăng nhập thất bại (3 lần)", before: "—", after: "IP bị khóa tạm thời", ip: "14.161.22.189", device: "Unknown", browser: "Chrome", location: "Hà Nội", status: "error" },
  { id: 6, time: "22/06 11:30", user: "Hoàng Long", module: "Finance", action: "Xuất báo cáo tháng 5", before: "—", after: "finance_may2026.xlsx", ip: "123.20.1.45", device: "Windows PC", browser: "Edge 120", location: "TP.HCM", status: "ok" },
];

export default function SettingsOverview() {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 5;
  const kpis = [
    { label: "Người dùng", value: "8", icon: <Users size={14} />, color: "text-primary bg-primary/10" },
    { label: "Vai trò", value: "5", icon: <Shield size={14} />, color: "text-info bg-info/10" },
    { label: "Thiết bị đăng nhập", value: "3", icon: <Monitor size={14} />, color: "text-warning bg-warning/10" },
    { label: "Thông báo bật", value: "12", icon: <Zap size={14} />, color: "text-warning bg-warning/10" },
    { label: "Tích hợp active", value: "4", icon: <Wifi size={14} />, color: "text-success bg-success/10" },
    { label: "Sao lưu gần nhất", value: "2 ngày", icon: <Database size={14} />, color: "text-primary bg-primary/10" },
  ];

  const systemHealth = [
    { label: "Database", status: "Hoạt động", ok: true, icon: <Server size={14} /> },
    { label: "Email SMTP", status: "Hoạt động", ok: true, icon: <Mail size={14} /> },
    { label: "Bảo mật (2FA)", status: "Đã bật", ok: true, icon: <Shield size={14} /> },
    { label: "Zalo OA", status: "Chưa cấu hình", ok: false, icon: <MessageSquare size={14} /> },
    { label: "Telegram Bot", status: "Chưa cấu hình", ok: false, icon: <MessageSquare size={14} /> },
    { label: "SMS Gateway", status: "Chưa cấu hình", ok: false, icon: <MessageSquare size={14} /> },
    { label: "Redis Cache", status: "Hoạt động", ok: true, icon: <HardDrive size={14} /> },
    { label: "Sao lưu tự động", status: "Hoạt động", ok: true, icon: <Database size={14} /> },
  ];

  const systemStats = [
    { label: "CPU", value: "23%", bar: 23, color: "bg-success" },
    { label: "Memory", value: "62%", bar: 62, color: "bg-primary" },
    { label: "Disk", value: "41%", bar: 41, color: "bg-warning" },
  ];

  const recentActivity = [
    { user: "Văn Thể Phan", action: "Đổi mật khẩu", time: "10 phút trước", icon: <Shield size={12} /> },
    { user: "Minh Trang", action: "Thêm người dùng mới", time: "2 giờ trước", icon: <Users size={12} /> },
    { user: "Tuấn Đạt", action: "Cập nhật phân quyền", time: "Hôm qua", icon: <Shield size={12} /> },
    { user: "System", action: "Sao lưu tự động", time: "2 ngày trước", icon: <Database size={12} /> },
  ];

  const columns: Column<AuditLog>[] = [
    { header: "Thời gian", accessor: "time", className: "font-mono text-[10px] text-muted whitespace-nowrap" },
    { header: "Người dùng", accessor: "user", className: "font-bold whitespace-nowrap" },
    { header: "Module", accessor: (row: AuditLog) => <Badge variant="primary" className="text-[10px]">{row.module}</Badge> },
    { header: "Hành động", accessor: "action", className: "whitespace-nowrap" },
    { header: "Trước", accessor: (row: AuditLog) => <span className="text-muted truncate max-w-[100px] block" title={row.before}>{row.before}</span> },
    { header: "Sau", accessor: (row: AuditLog) => <span className="text-success truncate max-w-[100px] block" title={row.after}>{row.after}</span> },
    { header: "IP", accessor: "ip", className: "font-mono text-[10px] text-muted whitespace-nowrap" },
    { header: "Thiết bị", accessor: "device", className: "text-muted whitespace-nowrap" },
    { header: "Browser", accessor: "browser", className: "text-muted whitespace-nowrap" },
    { header: "Trạng thái", accessor: (row: AuditLog) => row.status === "ok" ? <CheckCircle2 size={14} className="text-success" /> : <AlertTriangle size={14} className="text-error" /> },
  ];

  return (
    <div className="flex flex-col gap-[24px]">
      {/* KPIs */}
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-[12px]">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-card border border-border rounded-[16px] p-[16px] shadow-sm flex flex-col gap-[8px]">
            <div className={`w-[28px] h-[28px] rounded-[8px] flex items-center justify-center ${kpi.color}`}>
              {kpi.icon}
            </div>
            <div className="text-[22px] font-black text-text leading-none">{kpi.value}</div>
            <div className="text-[11px] font-bold text-muted">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-[24px]">
        {/* System Health */}
        <div className="xl:col-span-2 bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
          <div className="flex items-center justify-between mb-[16px]">
            <h3 className="font-black text-[15px] text-text">System Health</h3>
            <Badge variant="success">5/8 Healthy</Badge>
          </div>
          <div className="grid grid-cols-2 gap-[10px]">
            {systemHealth.map((item, i) => (
              <div key={i} className={`flex items-center gap-[10px] p-[12px] rounded-[10px] border ${item.ok ? "border-success/20 bg-success/5" : "border-warning/20 bg-warning/5"}`}>
                <div className={`shrink-0 ${item.ok ? "text-success" : "text-warning"}`}>{item.icon}</div>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[12px] font-bold text-text truncate">{item.label}</span>
                  <span className={`text-[11px] font-medium ${item.ok ? "text-success" : "text-warning"}`}>{item.status}</span>
                </div>
                {item.ok ? <CheckCircle2 size={14} className="text-success shrink-0" /> : <AlertTriangle size={14} className="text-warning shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-[16px]">
          {/* System Resources */}
          <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
            <div className="flex items-center gap-[8px] mb-[16px]">
              <Cpu size={16} className="text-primary" />
              <h3 className="font-black text-[15px] text-text">System Resources</h3>
            </div>
            <div className="flex flex-col gap-[12px]">
              {systemStats.map((s, i) => (
                <div key={i} className="flex flex-col gap-[6px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold text-text">{s.label}</span>
                    <span className="text-[12px] font-bold text-muted">{s.value}</span>
                  </div>
                  <div className="w-full h-[6px] bg-border rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.color}`} style={{ width: s.value }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm">
            <div className="flex items-center gap-[8px] mb-[16px]">
              <Clock size={16} className="text-warning" />
              <h3 className="font-black text-[15px] text-text">Hoạt động gần đây</h3>
            </div>
            <div className="flex flex-col gap-[12px]">
              {recentActivity.map((a, i) => (
                <div key={i} className="flex items-start gap-[10px]">
                  <div className="w-[24px] h-[24px] rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-[2px]">
                    {a.icon}
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-[12px] font-bold text-text">{a.user}</span>
                    <span className="text-[11px] font-medium text-muted truncate">{a.action}</span>
                  </div>
                  <span className="text-[10px] font-medium text-muted shrink-0">{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text">Nhật ký hoạt động (Audit Logs)</h3>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[200px]">
            <SearchInput placeholder="Tìm theo user, hành động, module..." />
          </div>
          {["Người dùng", "Module", "Hành động", "Thời gian"].map(f => (
            <div key={f} className="w-[120px]">
              <Select options={[{label: f, value: f}]} />
            </div>
          ))}
          <Button variant="outline" className="gap-2">
            <SlidersHorizontal size={14} /> Lọc nâng cao
          </Button>
        </div>

        {/* Table */}
        <Table data={auditLogs} columns={columns} />
        
        {/* Pagination */}
        <div className="flex items-center justify-between pt-[10px] border-t border-border">
          <span className="text-[12px] font-medium text-muted">Hiển thị 1 - 6 trên 156 bản ghi</span>
          <div className="flex items-center gap-[4px]">
            <Button 
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-[32px] h-[32px]"
            >
              <ChevronLeft size={14} />
            </Button>
            {[1, 2, 3, "...", totalPages].map((page, idx) => (
              <Button 
                key={idx}
                variant={page === currentPage ? "primary" : "outline"}
                size={page === "..." ? "sm" : "icon"}
                onClick={() => typeof page === 'number' && setCurrentPage(page)}
                disabled={page === "..."}
                className={`w-[32px] h-[32px] text-xs font-bold ${page === "..." ? "border-none bg-transparent hover:bg-transparent text-muted" : ""}`}
              >
                {page}
              </Button>
            ))}
            <Button 
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="w-[32px] h-[32px]"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
