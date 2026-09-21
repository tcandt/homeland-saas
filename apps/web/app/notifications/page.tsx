"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileSignature,
  Inbox,
  Info,
  WalletCards,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiClient } from "@/lib/api/client";

function normalizeNotifications(value: unknown) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const candidates = [record.data, record.items, record.notifications, record.result, record.rows];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

const notificationGroups = [
  { id: "all", label: "Tất cả", icon: Inbox },
  { id: "unread", label: "Chưa đọc", icon: Bell },
  { id: "payments", label: "Thanh toán", icon: WalletCards },
  { id: "contracts", label: "Hợp đồng", icon: FileSignature },
  { id: "issues", label: "Cảnh báo", icon: AlertTriangle },
] as const;

function getNotificationGroup(type = "") {
  if (type === "PAYMENT_RECEIVED") return "payments";
  if (type === "CONTRACT_EXPIRING") return "contracts";
  if (type === "INVOICE_OVERDUE" || type === "INVOICE_DUE_SOON") return "payments";
  if (type === "OPERATIONAL_ISSUE" || type === "NOTIFICATION_DELIVERY_ISSUE") return "issues";
  return "all";
}

function getNotificationVisual(type = "") {
  if (type === "PAYMENT_RECEIVED") {
    return { icon: WalletCards, tone: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", label: "Thanh toán" };
  }
  if (type === "CONTRACT_EXPIRING") {
    return { icon: FileSignature, tone: "text-sky-600 bg-sky-500/10 border-sky-500/20", label: "Hợp đồng" };
  }
  if (type === "INVOICE_OVERDUE" || type === "INVOICE_DUE_SOON") {
    return { icon: Clock3, tone: "text-amber-600 bg-amber-500/10 border-amber-500/20", label: "Công nợ" };
  }
  if (type === "OPERATIONAL_ISSUE" || type === "NOTIFICATION_DELIVERY_ISSUE") {
    return { icon: AlertTriangle, tone: "text-rose-600 bg-rose-500/10 border-rose-500/20", label: "Cảnh báo" };
  }
  return { icon: Info, tone: "text-primary bg-primary/10 border-primary/20", label: "Hệ thống" };
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function InboxCenter() {
  const [activeTab, setActiveTab] = useState<(typeof notificationGroups)[number]["id"]>("all");
  const [selectedNotification, setSelectedNotification] = useState<any>(null);

  const { data: notifications, mutate } = useSWR(
    "notifications-list",
    async () => {
      const response: any = await apiClient.fetch("/notifications");
      return response?.data || response;
    },
    { refreshInterval: 15000 },
  );
  const notificationItems = useMemo(
    () => normalizeNotifications(notifications).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notifications],
  );
  const unreadCount = notificationItems.filter((item: any) => item.status !== "READ").length;
  const paymentCount = notificationItems.filter((item: any) => getNotificationGroup(item.type) === "payments").length;
  const issueCount = notificationItems.filter((item: any) => getNotificationGroup(item.type) === "issues").length;

  const filteredNotifications = notificationItems.filter((item: any) => {
    if (activeTab === "unread") return item.status !== "READ";
    if (activeTab === "all") return true;
    return getNotificationGroup(item.type) === activeTab;
  });

  const markAsRead = async (id: string) => {
    try {
      await apiClient.fetch(`/notifications/${id}/read`, { method: "PATCH" });
      await mutate();
    } catch {
      // Keep the inbox usable when the request is interrupted.
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiClient.fetch("/notifications/read-all", { method: "PATCH" });
      await mutate();
    } catch {
      // Keep the inbox usable when the request is interrupted.
    }
  };

  return (
    <AppShell>
      <div data-testid="notifications-root" className="min-h-[calc(100vh-4rem)] bg-background px-3 py-4 md:px-6 md:py-6">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-primary"><Bell size={14} /> Trung tâm thông báo</div>
              <h1 className="text-2xl font-black tracking-tight text-text md:text-3xl">Thông báo & việc cần xử lý</h1>
              <p className="mt-1 text-sm font-medium text-muted">Theo dõi dòng tiền, hợp đồng, công nợ và các cảnh báo vận hành.</p>
            </div>
            <Button data-testid="notification-mark-read" variant="outline" size="sm" onClick={markAllAsRead} className="gap-2 self-start rounded-xl md:self-auto"><CheckCircle2 size={15} /> Đánh dấu tất cả đã đọc</Button>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard icon={<Bell size={17} />} label="Tổng thông báo" value={notificationItems.length} tone="primary" />
            <SummaryCard icon={<span className="text-lg font-black">!</span>} label="Chưa đọc" value={unreadCount} tone="rose" />
            <SummaryCard icon={<WalletCards size={17} />} label="Thanh toán & công nợ" value={paymentCount} tone="emerald" />
            <SummaryCard icon={<AlertTriangle size={17} />} label="Cảnh báo" value={issueCount} tone="amber" />
          </div>

          <div className="grid min-h-[620px] overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm lg:grid-cols-[220px_minmax(0,1fr)_330px]">
            <aside data-testid="notifications-sidebar" className="border-b border-border bg-surface/70 p-3 lg:border-b-0 lg:border-r">
              <div className="mb-3 px-2 text-[11px] font-black uppercase tracking-wider text-muted">Bộ lọc</div>
              <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
                {notificationGroups.map((group) => {
                  const Icon = group.icon;
                  const count = group.id === "unread"
                    ? unreadCount
                    : group.id === "payments"
                      ? paymentCount
                      : group.id === "issues"
                        ? issueCount
                        : group.id === "all"
                          ? notificationItems.length
                          : notificationItems.filter((item: any) => getNotificationGroup(item.type) === group.id).length;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setActiveTab(group.id)}
                      className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-left text-xs font-black transition-colors lg:w-full ${activeTab === group.id ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-background hover:text-text"}`}
                    >
                      <Icon size={15} /><span className="flex-1">{group.label}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeTab === group.id ? "bg-white/20 text-white" : "bg-background text-muted"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section data-testid="notifications-list" className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div><h2 className="text-sm font-black text-text">{notificationGroups.find((item) => item.id === activeTab)?.label}</h2><p className="mt-0.5 text-[11px] font-medium text-muted">{filteredNotifications.length} mục trong hộp thư</p></div>
                <Badge variant={unreadCount ? "error" : "success"}>{unreadCount ? `${unreadCount} chưa đọc` : "Đã cập nhật"}</Badge>
              </div>

              <div className="max-h-[680px] overflow-y-auto">
                {filteredNotifications.map((notification: any) => {
                  const isUnread = notification.status !== "READ";
                  const visual = getNotificationVisual(notification.type);
                  const Icon = visual.icon;
                  return (
                    <button
                      key={notification.id}
                      type="button"
                      data-testid="notification-item"
                      onClick={() => {
                        setSelectedNotification(notification);
                        if (isUnread) void markAsRead(notification.id);
                      }}
                      className={`group flex w-full gap-3 border-b border-border/70 px-4 py-4 text-left transition-colors hover:bg-background ${selectedNotification?.id === notification.id ? "bg-primary/5" : ""} ${isUnread ? "bg-primary/[0.025]" : ""}`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${visual.tone}`}><Icon size={16} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className={`line-clamp-2 text-[13px] leading-5 ${isUnread ? "font-black text-text" : "font-bold text-muted"}`}>{notification.title || "Thông báo"}{isUnread && <span data-testid="notification-read-badge" className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}</span>
                          <span className="shrink-0 text-[10px] font-semibold text-muted">{formatNotificationDate(notification.createdAt)}</span>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-[12px] font-medium leading-5 text-muted">{notification.message}</span>
                        <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-muted">{visual.label} <ChevronRight size={11} /></span>
                      </span>
                    </button>
                  );
                })}
                {filteredNotifications.length === 0 && <div data-testid="notifications-empty-state" className="p-8"><EmptyState title="Chưa có thông báo" message="Các thông báo mới sẽ xuất hiện tại đây." icon={<Inbox size={44} />} /></div>}
              </div>
            </section>

            <aside data-testid="notification-detail" className="hidden bg-surface/50 p-5 lg:block">
              {selectedNotification ? <NotificationDetail notification={selectedNotification} /> : <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Inbox size={21} /></span><div className="text-sm font-black text-text">Chọn một thông báo</div><div className="mt-1 max-w-[210px] text-xs font-medium leading-5 text-muted">Xem chi tiết, thời gian và dữ liệu liên quan của thông báo.</div></div>}
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "primary" | "rose" | "emerald" | "amber" }) {
  const tones = {
    primary: "bg-primary/10 text-primary border-primary/20",
    rose: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  };
  return <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3.5 shadow-sm"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${tones[tone]}`}>{icon}</span><span className="min-w-0"><span className="block truncate text-[10px] font-black uppercase tracking-wider text-muted">{label}</span><span className="mt-0.5 block text-xl font-black leading-none text-text">{value}</span></span></div>;
}

function NotificationDetail({ notification }: { notification: any }) {
  const visual = getNotificationVisual(notification.type);
  const Icon = visual.icon;
  return <div><div className="mb-5 flex items-start justify-between gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${visual.tone}`}><Icon size={19} /></span>{notification.status === "READ" ? <Badge variant="success"><Check size={12} /> Đã đọc</Badge> : <Badge variant="primary">Mới</Badge>}</div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">{visual.label}</div><h2 className="mt-2 text-xl font-black leading-tight text-text">{notification.title || "Thông báo"}</h2><div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-muted"><Clock3 size={14} /> {formatNotificationDate(notification.createdAt)}</div><div className="mt-5 rounded-2xl border border-border/70 bg-card p-4 text-sm font-medium leading-6 text-text shadow-sm">{notification.message}</div>{notification.metadata && <div className="mt-5"><div className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted">Thông tin liên quan</div><pre className="max-h-52 overflow-auto rounded-xl border border-border/70 bg-background p-3 text-[10px] leading-5 text-muted">{JSON.stringify(notification.metadata, null, 2)}</pre></div>}</div>;
}
