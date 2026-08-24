"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import { AlertTriangle, Clock3, RefreshCw, Search, Send, XCircle } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "QUEUED", label: "Chờ gửi" },
  { value: "SENDING", label: "Đang gửi" },
  { value: "FAILED", label: "Lỗi tạm thời" },
  { value: "DEAD_LETTER", label: "Dead letter" },
  { value: "DELIVERED", label: "Đã gửi" },
];

const CHANNEL_OPTIONS = [
  { value: "", label: "Tất cả kênh" },
  { value: "ZALO", label: "Zalo" },
  { value: "EMAIL", label: "Email" },
  { value: "TELEGRAM", label: "Telegram" },
  { value: "IN_APP", label: "In-app" },
  { value: "CONSOLE", label: "Console" },
];

const getAuthToken = () => {
  if (typeof window === "undefined") return "";
  try {
    const authStore = localStorage.getItem("auth-storage");
    if (!authStore) return "";
    const parsed = JSON.parse(authStore);
    return parsed?.state?.accessToken || "";
  } catch {
    return "";
  }
};

const buildQueueUrl = (status: string, channel: string, search: string) => {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (channel) params.set("channel", channel);
  if (search.trim()) params.set("search", search.trim());
  params.set("limit", "120");
  return `/api/v1/notifications/queue?${params.toString()}`;
};

const fetcher = async (url: string) => {
  const token = getAuthToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Không tải được hàng đợi thông báo.");
  const json = await res.json();
  return json.data || json;
};

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "-");

function statusVariant(status?: string): "success" | "warning" | "error" | "neutral" | "primary" {
  if (status === "DELIVERED") return "success";
  if (status === "FAILED" || status === "DEAD_LETTER") return "error";
  if (status === "SENDING") return "warning";
  if (status === "QUEUED") return "primary";
  return "neutral";
}

export default function NotificationQueuePage() {
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const url = useMemo(() => buildQueueUrl(status, channel, search), [status, channel, search]);
  const { data, mutate, isLoading, error } = useSWR(url, fetcher, { refreshInterval: 5000 });
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const summary = data?.summary || {};
  const selectedRow = rows.find((row: any) => row.id === selectedId) || rows[0] || null;

  const runAction = async (id: string, action: "retry" | "cancel") => {
    try {
      setBusyAction(`${action}:${id}`);
      const token = getAuthToken();
      const res = await fetch(`/api/v1/notifications/queue/${id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(action === "retry" ? "Không thể retry queue item." : "Không thể hủy queue item.");
      }
      await mutate();
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <AppShell>
      <div data-testid="notification-queue-root" className="mx-auto flex max-w-[1680px] flex-col gap-4 text-text">
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">Notification operations</div>
              <h1 className="mt-1 text-[24px] font-black">Hàng đợi thông báo</h1>
              <p className="mt-1 text-sm font-medium text-muted">
                Theo dõi trạng thái gửi Zalo, Email, Telegram và thao tác lại các item lỗi hoặc dead letter.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5 md:min-w-[760px]">
              <Metric label="Tổng" value={summary.total || 0} />
              <Metric label="Chờ gửi" value={summary.queued || 0} tone="primary" />
              <Metric label="Đang gửi" value={summary.sending || 0} tone="warning" />
              <Metric label="Đã gửi" value={summary.delivered || 0} tone="success" />
              <Metric label="Lỗi/DLQ" value={(summary.failed || 0) + (summary.deadLetter || 0)} tone="danger" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo template, recipient, lỗi hoặc nội dung"
                className="pl-9"
              />
            </div>
            <Select value={status} onChange={(event) => setStatus(event.target.value)} options={STATUS_OPTIONS} />
            <Select value={channel} onChange={(event) => setChannel(event.target.value)} options={CHANNEL_OPTIONS} />
            <Button variant="outline" onClick={() => mutate()} className="gap-2">
              <RefreshCw size={15} />
              Làm mới
            </Button>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
          <div data-testid="notification-queue-table" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="border-b border-border bg-surface text-[11px] uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3 font-black">Queue item</th>
                    <th className="px-4 py-3 font-black">Kênh</th>
                    <th className="px-4 py-3 font-black">Template / recipient</th>
                    <th className="px-4 py-3 font-black">Trạng thái</th>
                    <th className="px-4 py-3 font-black">Retry</th>
                    <th className="px-4 py-3 font-black">Retry tiếp</th>
                    <th className="px-4 py-3 text-right font-black">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm font-semibold text-muted">
                        Không có queue item phù hợp bộ lọc.
                      </td>
                    </tr>
                  )}
                  {rows.map((row: any) => {
                    const isSelected = selectedRow?.id === row.id;
                    const canAct = row.status !== "DELIVERED";
                    return (
                      <tr
                        key={row.id}
                        data-testid="notification-queue-row"
                        className={`border-t border-border ${isSelected ? "bg-primary/5" : "hover:bg-surface/70"} cursor-pointer`}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs font-bold text-text">{row.id.slice(-10)}</div>
                          <div className="mt-1 text-[11px] text-muted">{formatDateTime(row.createdAt)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="neutral">{row.channel}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-text">{row.templateCode || row.payloadTitle || "-"}</div>
                          <div className="mt-1 text-[11px] text-muted">{row.recipient || "Chưa có recipient"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div data-testid="notification-queue-status-badge">
                            <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                          </div>
                          {row.error ? <div className="mt-1 line-clamp-1 text-[11px] font-medium text-danger">{row.error}</div> : null}
                        </td>
                        <td className="px-4 py-3 font-semibold text-text">{row.retryCount || 0}</td>
                        <td className="px-4 py-3 text-[12px] font-medium text-muted">{formatDateTime(row.nextRetryAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              data-testid="notification-queue-retry-button"
                              variant="outline"
                              size="sm"
                              disabled={!canAct}
                              isLoading={busyAction === `retry:${row.id}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                void runAction(row.id, "retry");
                              }}
                            >
                              <RefreshCw size={14} className="mr-1.5" />
                              Retry
                            </Button>
                            <Button
                              data-testid="notification-queue-cancel-button"
                              variant="outline"
                              size="sm"
                              disabled={!canAct}
                              isLoading={busyAction === `cancel:${row.id}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                void runAction(row.id, "cancel");
                              }}
                            >
                              <XCircle size={14} className="mr-1.5" />
                              Hủy
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {isLoading ? <div className="border-t border-border px-4 py-3 text-sm font-medium text-muted">Đang tải queue...</div> : null}
            {error ? <div className="border-t border-border px-4 py-3 text-sm font-medium text-danger">Không tải được hàng đợi thông báo.</div> : null}
          </div>

          <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-warning/10 p-2 text-warning">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h2 className="text-base font-black">Chi tiết queue item</h2>
                <p className="mt-1 text-sm font-medium text-muted">
                  Xem payload, lỗi provider, thời điểm retry tiếp theo và metadata gốc.
                </p>
              </div>
            </div>

            {selectedRow ? (
              <div className="mt-5 space-y-4">
                <Detail label="Template" value={selectedRow.templateCode || selectedRow.payloadTitle || "-"} />
                <Detail label="Recipient" value={selectedRow.recipient || "-"} />
                <Detail label="Trạng thái" value={<Badge variant={statusVariant(selectedRow.status)}>{selectedRow.status}</Badge>} />
                <Detail label="Tạo lúc" value={formatDateTime(selectedRow.createdAt)} />
                <Detail label="Retry tiếp" value={formatDateTime(selectedRow.nextRetryAt)} />
                <Detail label="Retry count" value={String(selectedRow.retryCount || 0)} />
                <Detail label="Tiêu đề" value={selectedRow.payloadTitle || selectedRow.notification?.title || "-"} />
                <Detail label="Nội dung" value={selectedRow.payloadMessage || selectedRow.notification?.message || "-"} />

                {selectedRow.error ? (
                  <div className="rounded-xl border border-danger/20 bg-danger/5 p-3">
                    <div className="mb-1 text-[11px] font-black uppercase tracking-wide text-danger">Provider error</div>
                    <div className="text-sm font-medium text-danger">{selectedRow.error}</div>
                  </div>
                ) : null}

                <div>
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-muted">
                    <Send size={14} />
                    Payload
                  </div>
                  <pre className="overflow-x-auto rounded-xl border border-border bg-surface p-3 text-[11px] font-medium text-muted">
                    {JSON.stringify(selectedRow.payload || {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="mt-6 flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-border text-sm font-semibold text-muted">
                Chọn một queue item để xem chi tiết.
              </div>
            )}

            <div className="mt-5 rounded-xl border border-border bg-surface p-3 text-[12px] font-medium text-muted">
              <div className="flex items-center gap-2 font-black text-text">
                <Clock3 size={14} />
                Ghi chú vận hành
              </div>
              <ul className="mt-2 space-y-1">
                <li>`Retry` sẽ đưa item về `QUEUED` và gọi lại provider ngay.</li>
                <li>`Hủy` sẽ chuyển item sang `DEAD_LETTER` để scheduler không tự nhặt lại.</li>
              </ul>
            </div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "primary" | "warning" | "success" | "danger" }) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : tone === "danger"
            ? "text-danger"
            : "text-text";

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-[20px] font-black ${toneClass}`}>{value}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm font-medium text-text">{value}</div>
    </div>
  );
}
