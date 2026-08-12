"use client";

import React from "react";
import useSWR from "swr";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Search, ClipboardList } from "lucide-react";
import { auditApi, AuditLogItem } from "@/lib/api/audit.api";

const actionLabels: Record<string, string> = {
  CREATE: "Tạo mới",
  UPDATE: "Cập nhật",
  DELETE: "Xóa",
  CANCEL: "Hủy",
  LOGIN_SUCCESS: "Đăng nhập thành công",
  LOGIN_FAILED: "Đăng nhập thất bại",
  LOGOUT_SUCCESS: "Đăng xuất",
};

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("vi-VN");
}

export default function SettingsAuditLogs() {
  const [search, setSearch] = React.useState("");
  const [moduleFilter, setModuleFilter] = React.useState("");
  const [actionFilter, setActionFilter] = React.useState("");
  const audit = useSWR(["settings-audit-logs"], () => auditApi.logs({ limit: 100 }), { revalidateOnFocus: false });
  const rows = React.useMemo(() => {
    const term = search.trim().toLocaleLowerCase("vi-VN");
    return (Array.isArray(audit.data) ? audit.data : []).filter((log: AuditLogItem) => {
      if (moduleFilter && log.module !== moduleFilter) return false;
      if (actionFilter && log.action !== actionFilter) return false;
      if (!term) return true;
      return [log.user?.fullName, log.user?.email, log.module, log.action, log.entity, log.entityId]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("vi-VN")
        .includes(term);
    });
  }, [actionFilter, audit.data, moduleFilter, search]);
  const modules = Array.from(new Set((Array.isArray(audit.data) ? audit.data : []).map((log: AuditLogItem) => log.module).filter(Boolean))).sort();
  const actions = Array.from(new Set((Array.isArray(audit.data) ? audit.data : []).map((log: AuditLogItem) => log.action))).sort();

  return (
    <div className="flex flex-col gap-[20px]">
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <div>
          <h3 className="font-black text-[15px] text-text">Nhật ký hoạt động</h3>
          <p className="mt-1 text-[12px] font-medium text-muted">Lịch sử đăng nhập, thay đổi cài đặt và thao tác vận hành quan trọng.</p>
        </div>

        <div className="flex flex-wrap items-center gap-[8px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo user, hành động, module..." className="w-full h-[38px] pl-[36px] pr-[12px] bg-background border border-border rounded-[10px] text-[13px] text-text focus:outline-none focus:border-primary transition-all" />
          </div>
          <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)} className="h-[38px] min-w-[150px] rounded-[10px] border border-border bg-background px-[12px] text-[12px] font-bold text-text outline-none">
            <option value="">Tất cả module</option>
            {modules.map((module) => <option key={module} value={module || ""}>{module}</option>)}
          </select>
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className="h-[38px] min-w-[160px] rounded-[10px] border border-border bg-background px-[12px] text-[12px] font-bold text-text outline-none">
            <option value="">Tất cả hành động</option>
            {actions.map((action) => <option key={action} value={action}>{actionLabels[action] || action}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto rounded-[14px] border border-border bg-background">
          <table className="w-full min-w-[900px] text-left text-[12px]">
            <thead className="bg-surface/70 text-[10px] font-black uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-3">Thời điểm</th>
                <th className="px-3 py-3">Người thao tác</th>
                <th className="px-3 py-3">Module</th>
                <th className="px-3 py-3">Hành động</th>
                <th className="px-3 py-3">Đối tượng</th>
                <th className="px-3 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {audit.isLoading && <tr><td colSpan={6} className="px-4 py-10 text-center font-semibold text-muted">Đang tải nhật ký...</td></tr>}
              {!audit.isLoading && audit.error && <tr><td colSpan={6} className="px-4 py-10 text-center font-semibold text-rose-600">Không tải được nhật ký hoạt động.</td></tr>}
              {!audit.isLoading && !audit.error && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center font-semibold text-muted"><ClipboardList size={18} className="mx-auto mb-2" />Không có nhật ký phù hợp bộ lọc.</td></tr>
              )}
              {rows.map((log: AuditLogItem) => (
                <tr key={log.id} className="border-t border-border/70">
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-muted">{formatDateTime(log.createdAt)}</td>
                  <td className="px-3 py-3"><div className="font-black text-text">{log.user?.fullName || "Hệ thống"}</div><div className="mt-1 text-[11px] text-muted">{log.user?.email || "Không có user"}</div></td>
                  <td className="px-3 py-3 font-bold text-text">{log.module || "Hệ thống"}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-primary/10 px-2 py-1 font-black text-primary">{actionLabels[log.action] || log.action}</span></td>
                  <td className="max-w-[240px] px-3 py-3"><div className="truncate font-bold text-text">{log.entity}</div><div className="mt-1 truncate text-[11px] text-muted">{log.entityId || "--"}</div></td>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold text-muted">{log.ip || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
