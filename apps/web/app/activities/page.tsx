"use client";

import React, { useState, useMemo } from "react";
import useSWR from "swr";
import {
  ClipboardList,
  Search,
  RefreshCw,
  Activity,
  PlusCircle,
  Edit3,
  Trash2,
  XCircle,
  LogIn,
  LogOut,
  Eye,
  Clock,
  Shield,
  Layers,
  FileText,
  Home,
  Bookmark,
  Receipt,
  Users,
  CheckCircle2,
  AlertCircle,
  Code,
  ShieldCheck,
  Zap,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { auditApi, AuditLogItem } from "@/lib/api/audit.api";

const actionConfigs: Record<
  string,
  { label: string; icon: any; color: string }
> = {
  CREATE: { label: "Tạo mới", icon: PlusCircle, color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  UPDATE: { label: "Cập nhật", icon: Edit3, color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20" },
  DELETE: { label: "Xóa dữ liệu", icon: Trash2, color: "text-rose-600 bg-rose-500/10 border-rose-500/20" },
  CANCEL: { label: "Hủy bỏ", icon: XCircle, color: "text-rose-600 bg-rose-500/10 border-rose-500/20" },
  COLLECT: { label: "Thu tiền", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  REFUND: { label: "Hoàn cọc", icon: AlertCircle, color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
  CONVERT_CONTRACT: { label: "Chuyển HĐ", icon: FileText, color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20" },
  LOGIN_SUCCESS: { label: "Đăng nhập", icon: LogIn, color: "text-sky-600 bg-sky-500/10 border-sky-500/20" },
  LOGIN_FAILED: { label: "Đăng nhập lỗi", icon: AlertCircle, color: "text-rose-600 bg-rose-500/10 border-rose-500/20" },
  LOGOUT_SUCCESS: { label: "Đăng xuất", icon: LogOut, color: "text-slate-600 bg-slate-500/10 border-slate-500/20" },
};

const moduleLabels: Record<string, { label: string; icon: any }> = {
  Contracts: { label: "Hợp đồng", icon: FileText },
  Contract: { label: "Hợp đồng", icon: FileText },
  Deposits: { label: "Đặt cọc", icon: Bookmark },
  Deposit: { label: "Đặt cọc", icon: Bookmark },
  Invoices: { label: "Hóa đơn", icon: Receipt },
  Invoice: { label: "Hóa đơn", icon: Receipt },
  Customers: { label: "Khách thuê", icon: Users },
  Customer: { label: "Khách thuê", icon: Users },
  Rooms: { label: "Phòng", icon: Home },
  Room: { label: "Phòng", icon: Home },
  Buildings: { label: "Tòa nhà", icon: Layers },
  Building: { label: "Tòa nhà", icon: Layers },
  Settings: { label: "Cài đặt", icon: Shield },
  Auth: { label: "Xác thực & Bảo mật", icon: ShieldCheck },
};

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("vi-VN");
}

function getRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "Vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

export default function ActivitiesPage() {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [timeFilter, setTimeFilter] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const { data, error, isLoading, mutate, isValidating } = useSWR(
    ["activities-audit-logs"],
    () => auditApi.logs({ limit: 300 }),
    { revalidateOnFocus: false },
  );

  const logs: AuditLogItem[] = useMemo(() => {
    return Array.isArray(data) ? data : [];
  }, [data]);

  const availableModules = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.module).filter(Boolean))).sort() as string[];
  }, [logs]);

  const availableActions = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.action).filter(Boolean))).sort() as string[];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = new Date();

    return logs.filter((log) => {
      if (term) {
        const userMatch =
          log.user?.fullName?.toLowerCase().includes(term) ||
          log.user?.email?.toLowerCase().includes(term) ||
          log.userId?.toLowerCase().includes(term);
        const actionMatch = log.action?.toLowerCase().includes(term);
        const moduleMatch = log.module?.toLowerCase().includes(term);
        const entityMatch = log.entity?.toLowerCase().includes(term) || log.entityId?.toLowerCase().includes(term);
        const ipMatch = log.ip?.toLowerCase().includes(term);

        if (!userMatch && !actionMatch && !moduleMatch && !entityMatch && !ipMatch) {
          return false;
        }
      }

      if (moduleFilter !== "ALL" && log.module !== moduleFilter) {
        return false;
      }

      if (actionFilter !== "ALL" && log.action !== actionFilter) {
        return false;
      }

      if (timeFilter !== "ALL") {
        const logDate = new Date(log.createdAt);
        if (timeFilter === "TODAY") {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (logDate < startOfToday) return false;
        } else if (timeFilter === "7DAYS") {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (logDate < sevenDaysAgo) return false;
        } else if (timeFilter === "30DAYS") {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (logDate < thirtyDaysAgo) return false;
        }
      }

      return true;
    });
  }, [logs, search, moduleFilter, actionFilter, timeFilter]);

  const stats = useMemo(() => {
    let total = logs.length;
    let createUpdateCount = 0;
    let deleteCancelCount = 0;
    let authCount = 0;

    for (const log of logs) {
      if (log.action === "CREATE" || log.action === "UPDATE" || log.action === "COLLECT" || log.action === "CONVERT_CONTRACT") {
        createUpdateCount++;
      } else if (log.action === "DELETE" || log.action === "CANCEL" || log.action === "REFUND") {
        deleteCancelCount++;
      } else if (log.action?.startsWith("LOGIN") || log.action?.startsWith("LOGOUT")) {
        authCount++;
      }
    }

    return { total, createUpdateCount, deleteCancelCount, authCount };
  }, [logs]);

  return (
    <AppShell>
      <div className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:h-[calc(100dvh-80px)] p-2.5 md:p-3 flex flex-col gap-2.5">
        {/* 1. 4-CARD COMPACT KPI GRID (Matching homeland design tokens) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-2.5 shrink-0">
          <KpiCard
            title="Tổng lượt thao tác"
            value={stats.total.toLocaleString("vi-VN")}
            subtext="Toàn bộ lịch sử vận hành"
            icon={<Activity size={16} className="text-indigo-600 dark:text-indigo-400" />}
            iconBg="bg-indigo-500/10 border border-indigo-500/20"
          />
          <KpiCard
            title="Tạo mới & Cập nhật"
            value={stats.createUpdateCount.toLocaleString("vi-VN")}
            subtext="Thao tác ghi nhận dữ liệu"
            icon={<PlusCircle size={16} className="text-emerald-600 dark:text-emerald-400" />}
            iconBg="bg-emerald-500/10 border border-emerald-500/20"
          />
          <KpiCard
            title="Xóa, hủy & hoàn tiền"
            value={stats.deleteCancelCount.toLocaleString("vi-VN")}
            subtext="Thao tác điều chỉnh / hủy"
            icon={<Trash2 size={16} className="text-rose-600 dark:text-rose-400" />}
            iconBg="bg-rose-500/10 border border-rose-500/20"
          />
          <KpiCard
            title="Xác thực & Đăng nhập"
            value={stats.authCount.toLocaleString("vi-VN")}
            subtext="Lịch sử truy cập tài khoản"
            icon={<ShieldCheck size={16} className="text-sky-600 dark:text-sky-400" />}
            iconBg="bg-sky-500/10 border border-sky-500/20"
          />
        </div>

        {/* 2. UNIFIED SLIM FILTER & SEARCH BAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
          {/* Left search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo người dùng, email, mã đối tượng, IP..."
              className="h-9 w-full rounded-xl border border-border/70 bg-card pl-8 pr-7 text-xs font-semibold text-text placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text p-0.5"
              >
                <XCircle size={13} />
              </button>
            )}
          </div>

          {/* Right dropdown filters & Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="h-9 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-bold text-text outline-none cursor-pointer hover:border-primary/50 transition-colors shadow-2xs"
            >
              <option value="ALL">Tất cả module</option>
              {availableModules.map((m) => (
                <option key={m} value={m}>
                  {moduleLabels[m]?.label || m}
                </option>
              ))}
            </select>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="h-9 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-bold text-text outline-none cursor-pointer hover:border-primary/50 transition-colors shadow-2xs"
            >
              <option value="ALL">Tất cả hành động</option>
              {availableActions.map((a) => (
                <option key={a} value={a}>
                  {actionConfigs[a]?.label || a}
                </option>
              ))}
            </select>

            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="h-9 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-bold text-text outline-none cursor-pointer hover:border-primary/50 transition-colors shadow-2xs"
            >
              <option value="ALL">Mọi thời điểm</option>
              <option value="TODAY">Hôm nay</option>
              <option value="7DAYS">7 ngày qua</option>
              <option value="30DAYS">30 ngày qua</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => mutate()}
              disabled={isValidating}
              className="h-9 rounded-xl border-border/70 bg-card hover:bg-muted/10 text-xs font-bold shadow-2xs"
            >
              <RefreshCw size={13} className={`mr-1.5 ${isValidating ? "animate-spin text-primary" : "text-muted"}`} />
              Làm mới
            </Button>
          </div>
        </div>

        {/* 3. HIGH-DENSITY AUDIT TABLE LIST (Full main workspace) */}
        <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xs flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-card border-b border-border/70 text-[10px] font-black uppercase tracking-wider text-muted select-none">
                <tr>
                  <th className="py-2.5 px-3.5 w-[170px]">Thời điểm</th>
                  <th className="py-2.5 px-3.5">Người thao tác</th>
                  <th className="py-2.5 px-3.5 w-[160px]">Phân hệ (Module)</th>
                  <th className="py-2.5 px-3.5 w-[140px]">Hành động</th>
                  <th className="py-2.5 px-3.5">Đối tượng thao tác</th>
                  <th className="py-2.5 px-3.5 w-[60px] text-center">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-muted font-bold">
                      <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-primary" />
                      Đang tải dữ liệu nhật ký hoạt động...
                    </td>
                  </tr>
                )}

                {!isLoading && error && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-rose-500 font-bold">
                      <AlertCircle size={20} className="mx-auto mb-2" />
                      Không thể tải nhật ký hoạt động. Vui lòng thử lại sau.
                    </td>
                  </tr>
                )}

                {!isLoading && !error && filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-muted font-semibold">
                      <ClipboardList size={28} className="mx-auto mb-2 text-muted/30" />
                      Không tìm thấy nhật ký hoạt động phù hợp bộ lọc.
                    </td>
                  </tr>
                )}

                {filteredLogs.map((log) => {
                  const actionCfg = actionConfigs[log.action] || {
                    label: log.action,
                    icon: Activity,
                    color: "text-muted bg-muted/10 border-border/60",
                  };
                  const modCfg = moduleLabels[log.module || ""] || {
                    label: log.module || "Hệ thống",
                    icon: Layers,
                  };

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="group cursor-pointer hover:bg-muted/10 transition-colors"
                    >
                      {/* Thời điểm */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="font-bold text-text flex items-center gap-1.5 leading-tight">
                          <Clock size={11} className="text-primary shrink-0" />
                          {formatDateTime(log.createdAt)}
                        </div>
                        <div className="text-[10px] text-muted mt-0.5 font-medium">
                          {getRelativeTime(log.createdAt)}
                        </div>
                      </td>

                      {/* Người thao tác */}
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary font-black text-[11px]">
                            {log.user?.fullName ? log.user.fullName.slice(0, 1).toUpperCase() : "U"}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-text truncate max-w-[170px] leading-tight">
                              {log.user?.fullName || "System Admin"}
                            </div>
                            <div className="text-[10px] text-muted truncate max-w-[170px]">
                              {log.user?.email || log.userId || "system"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Module */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-background border border-border/70 text-[11px] font-bold text-text shadow-2xs">
                          <modCfg.icon size={12} className="text-primary" />
                          {modCfg.label}
                        </span>
                      </td>

                      {/* Hành động */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase ${actionCfg.color}`}>
                          <actionCfg.icon size={11} />
                          {actionCfg.label}
                        </span>
                      </td>

                      {/* Đối tượng */}
                      <td className="py-2.5 px-3.5 max-w-[220px]">
                        <div className="font-bold text-text truncate leading-tight">
                          {log.entity || "--"}
                        </div>
                        <div className="text-[10px] font-mono text-muted truncate mt-0.5">
                          {log.entityId || "--"}
                        </div>
                      </td>

                      {/* Chi tiết */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                          }}
                          className="h-7 w-7 p-0 rounded-lg text-muted group-hover:text-primary group-hover:bg-primary/10 transition-all"
                        >
                          <Eye size={13} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer table info */}
          <div className="px-3.5 py-2 border-t border-border/60 bg-muted/5 flex items-center justify-between text-[11px] text-muted font-medium shrink-0">
            <span>Hiển thị <b>{filteredLogs.length}</b> / {logs.length} sự kiện gần nhất</span>
            <span className="font-mono text-[10px]">Auto Audit Tracing v1.0</span>
          </div>
        </div>
      </div>

      {/* 4. AUDIT LOG DETAIL MODAL */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          maxWidth="max-w-3xl"
          title={
            <div className="flex items-center gap-2.5">
              <span className="text-base font-black text-text">Chi tiết nhật ký thao tác</span>
              <div className="px-2 py-0.5 bg-primary/10 border border-primary/20 rounded-md">
                <span className="font-mono font-bold text-[11px] text-primary">{selectedLog.id.slice(0, 8)}...</span>
              </div>
            </div>
          }
          footer={
            <div className="flex items-center justify-end w-full">
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Đóng
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3.5 text-xs">
            {/* Overview Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-muted/5 border border-border/60">
              <div>
                <span className="text-[10px] font-bold text-muted uppercase block">Người thao tác</span>
                <span className="font-bold text-text mt-0.5 block">{selectedLog.user?.fullName || "System Admin"}</span>
                <span className="text-[10px] text-muted font-mono">{selectedLog.user?.email || selectedLog.userId || "system"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted uppercase block">Thời điểm ghi nhận</span>
                <span className="font-bold text-text mt-0.5 block">{formatDateTime(selectedLog.createdAt)}</span>
                <span className="text-[10px] text-muted">{getRelativeTime(selectedLog.createdAt)}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted uppercase block">IP kết nối</span>
                <span className="font-mono font-bold text-text mt-0.5 block">{selectedLog.ip || "Localhost"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted uppercase block">Phân hệ (Module)</span>
                <span className="font-bold text-primary mt-0.5 block">{selectedLog.module || "Hệ thống"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted uppercase block">Hành động</span>
                <span className="font-black text-text mt-0.5 block">{selectedLog.action}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted uppercase block">Đối tượng / Mã ID</span>
                <span className="font-mono font-bold text-text mt-0.5 block truncate">{selectedLog.entity}: {selectedLog.entityId || "--"}</span>
              </div>
            </div>

            {/* Data Diff: Before & After */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-muted">
                <Code size={13} className="text-primary" /> Dữ liệu chi tiết thay đổi (Payload Audit)
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* Before */}
                <div className="rounded-xl border border-border/60 bg-card p-2.5 flex flex-col">
                  <div className="text-[10px] font-black uppercase text-muted mb-1.5 pb-1 border-b border-border/50 flex items-center justify-between">
                    <span>Trước thay đổi (Before)</span>
                    <span className="text-[9px] font-mono text-muted">{selectedLog.before ? "Có dữ liệu" : "Trống"}</span>
                  </div>
                  <pre className="flex-1 max-h-[240px] overflow-auto rounded-lg bg-background p-2 font-mono text-[10px] text-muted leading-relaxed whitespace-pre-wrap">
                    {selectedLog.before ? JSON.stringify(selectedLog.before, null, 2) : "Không có dữ liệu trước thay đổi (Tạo mới)."}
                  </pre>
                </div>

                {/* After */}
                <div className="rounded-xl border border-border/60 bg-card p-2.5 flex flex-col">
                  <div className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1.5 pb-1 border-b border-border/50 flex items-center justify-between">
                    <span>Sau thay đổi (After)</span>
                    <span className="text-[9px] font-mono text-muted">{selectedLog.after ? "Có dữ liệu" : "Trống"}</span>
                  </div>
                  <pre className="flex-1 max-h-[240px] overflow-auto rounded-lg bg-background p-2 font-mono text-[10px] text-text leading-relaxed whitespace-pre-wrap">
                    {selectedLog.after ? JSON.stringify(selectedLog.after, null, 2) : "Không có dữ liệu sau thay đổi (Đã xóa)."}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

function KpiCard({
  title,
  value,
  subtext,
  icon,
  iconBg,
}: {
  title: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5 shadow-2xs transition-all hover:border-primary/30">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[10px] md:text-[11px] font-bold text-muted uppercase tracking-wider truncate leading-tight mb-0.5">
          {title}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono font-black text-[16px] md:text-[18px] text-text leading-none">
            {value}
          </span>
        </div>
        {subtext && (
          <span className="text-[10px] md:text-[11px] font-medium truncate block mt-0.5 text-muted">
            {subtext}
          </span>
        )}
      </div>
    </Card>
  );
}
