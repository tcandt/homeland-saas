"use client";

import React, { useEffect } from "react";
import useSWR from "swr";
import { ArrowRight, Bolt, CheckCircle2, FileText, MoreHorizontal, Pencil, Wrench, X } from "lucide-react";
import type { CockpitFloorSpec, CockpitRoomSpec } from "./building-cockpit.types";
import { formatVnd, getStatusLabel, getStatusTone } from "./building-cockpit-metrics";
import { hunonicApi } from "@/lib/api/hunonic.api";

interface RoomInspectorDrawerProps {
  floor: CockpitFloorSpec;
  room: CockpitRoomSpec;
  selectedSpaceId: string | null;
  onClose: () => void;
  onOpenRoomModal?: (roomId: string, tab?: string) => void;
}

function row(label: string, value: React.ReactNode) {
  return (
    <div className="grid w-full grid-cols-[minmax(96px,0.85fr)_minmax(0,1.15fr)] items-start gap-3 rounded-lg px-1 py-1.5 text-[13px] leading-5">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 text-right font-bold text-text break-words" title={typeof value === "string" || typeof value === "number" ? String(value) : undefined}>{value}</span>
    </div>
  );
}

export default function RoomInspectorDrawer({ floor, room, selectedSpaceId, onClose, onOpenRoomModal }: RoomInspectorDrawerProps) {
  const tone = getStatusTone(room.status);
  const selectedSpace = room.childSpaces?.find((space) => space.id === selectedSpaceId);
  const sourceRoomId = room.sourceRoom?.id;
  const hasOperationalData = Boolean(sourceRoomId);
  const electricityQuery = useSWR(sourceRoomId ? ["hunonic-room-electricity", sourceRoomId] : null, () => hunonicApi.roomElectricity(sourceRoomId!), {
    revalidateOnFocus: false,
    refreshInterval: 60 * 60 * 1000,
  });
  const electricity = electricityQuery.data as any;
  const statusLabel = hasOperationalData ? getStatusLabel(room.status) : "Chưa đồng bộ";
  const hasActiveRent = room.status !== "vacant" && Boolean(room.monthlyRent);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside
      role="dialog"
      className="fixed inset-x-3 bottom-3 z-[10002] max-h-[82vh] overflow-auto rounded-[16px] border border-border/40 dark:border-white/5 bg-card p-3.5 shadow-2xl min-[1536px]:relative min-[1536px]:inset-auto min-[1536px]:z-auto min-[1536px]:flex min-[1536px]:h-full min-[1536px]:max-h-full min-[1536px]:w-full min-[1536px]:min-w-0 min-[1536px]:max-w-none min-[1536px]:shrink min-[1536px]:flex-col min-[1536px]:overflow-hidden min-[1536px]:shadow-[0_16px_36px_rgb(var(--shadow-color)/0.075)] transition-colors"
      aria-label={`Thông tin phòng ${room.code}`}
    >
      <div className="sticky top-0 z-10 -mx-3.5 -mt-3.5 mb-4 flex shrink-0 items-start justify-between gap-4 border-b border-border/40 bg-card/95 px-3.5 pb-3.5 pt-3.5 backdrop-blur">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-black tracking-tight text-text truncate">{room.code}</h2>
            <span className="rounded-full px-2.5 py-1 text-[12px] font-black shrink-0 border border-black/5 dark:border-white/5" style={hasOperationalData ? { background: tone.bg, color: tone.text } : { background: "var(--muted-bg, rgba(255,255,255,0.05))", color: "var(--muted-foreground, #94a3b8)" }}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-semibold text-muted truncate">
            {floor.label}{selectedSpace ? ` • ${selectedSpace.name}` : ""}
          </p>
          {hasOperationalData && room.status === "vacant" && <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-bold text-emerald-600"><CheckCircle2 size={14} />Sẵn sàng khai thác</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng thông tin phòng" className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-950 dark:hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <X size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto pr-1 pt-0.5">
      <section className="shrink-0 rounded-[14px] border border-border/30 bg-black/5 dark:bg-white/5 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
        <h3 className="mb-2.5 text-[12px] font-black uppercase tracking-wide text-text">Thông tin phòng</h3>
        <div className="w-full divide-y divide-border/30">
          {row("Loại phòng", room.type)}
          {row("Ký hiệu phòng", room.code)}
          {row("Vị trí", floor.label)}
          {row("Diện tích ước tính", `~${room.estimatedArea.toFixed(1)} m²`)}
          {row("Tình trạng", <span style={{ color: hasOperationalData ? tone.text : "var(--muted-foreground, #94a3b8)" }}>{statusLabel}</span>)}
          {row("Cửa ra vào", `${room.entryDoorCount} cửa`)}
          {row("Giá thuê", hasActiveRent ? formatVnd(room.monthlyRent) : "Thiết lập khi khách vào ở")}
        </div>
      </section>

      <section className="shrink-0 rounded-[14px] border border-emerald-500/20 bg-emerald-500/[0.035] p-3.5 shadow-[0_8px_20px_rgb(var(--shadow-color)/0.03)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[12px] font-black uppercase tracking-wide text-text">
            <Bolt size={14} className="text-emerald-600" /> Điện Hunonic
          </h3>
          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] font-black text-emerald-700">
            Sync 1 giờ
          </span>
        </div>
        {electricity ? (
          <div className="w-full divide-y divide-emerald-500/15 rounded-xl bg-card/75 px-2">
            {row("Công tơ", electricity.deviceName || electricity.displayName)}
            {row("Tháng này", `${Number(electricity.energyMonthKwh || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} kWh`)}
            {row("Tiền điện", formatVnd(Number(electricity.moneyMonthVnd || 0)))}
            {row("Cập nhật", electricity.lastSyncedAt ? new Date(electricity.lastSyncedAt).toLocaleString("vi-VN") : "Chưa có dữ liệu")}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-emerald-500/25 bg-card/70 px-3 py-3 text-[12px] font-semibold text-muted">
            {electricityQuery.isLoading ? "Đang tải dữ liệu công tơ..." : "Phòng này chưa có dữ liệu Hunonic. Hãy kiểm tra mapping trong Settings > Hunonic Electricity."}
          </div>
        )}
      </section>

      {room.contract && (
        <section className="shrink-0 rounded-[14px] border border-primary/15 bg-primary/[0.025] p-3.5 shadow-[0_8px_20px_rgb(var(--shadow-color)/0.035)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[12px] font-black uppercase tracking-wide text-text">Hợp đồng</h3>
            <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-black text-primary">Đang theo dõi</span>
          </div>
          <div className="w-full divide-y divide-primary/10 rounded-xl bg-card/75 px-2">
            {row("Mã hợp đồng", room.contract.code)}
            {row("Tiền cọc", formatVnd(room.contract.deposit))}
            {row("Ngày hết hạn", room.contract.endDate)}
          </div>
        </section>
      )}

      <section className="shrink-0 rounded-[14px] border border-border/30 bg-card p-3.5 shadow-[0_8px_20px_rgb(var(--shadow-color)/0.03)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[12px] font-black uppercase tracking-wide text-text">Lịch sử hoạt động</h3>
          <button type="button" className="text-[12px] font-black text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Xem tất cả
          </button>
        </div>
        <ol className="space-y-2">
          {[
            { date: "24/05/2025 10:15", title: `Cập nhật trạng thái: ${statusLabel}`, icon: CheckCircle2, tone: "emerald" },
            { date: "20/05/2025 09:45", title: "Kết thúc hợp đồng", icon: FileText, tone: "blue" },
            { date: "01/05/2025 14:20", title: "Tạo hợp đồng mới", icon: FileText, tone: "blue" },
          ].map((item, index, items) => {
            const Icon = item.icon;
            return (
              <li key={`${item.date}-${item.title}`} className="grid grid-cols-[24px_minmax(0,1fr)_auto] gap-2 rounded-xl border border-border/25 bg-surface/45 px-2.5 py-2">
                <div className="relative flex justify-center">
                  <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-1 ring-white ${item.tone === "emerald" ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"}`}>
                    <Icon size={12} aria-hidden />
                  </span>
                </div>
                <div className="min-w-0">
                  <time className="block text-[12px] font-semibold leading-4 text-muted">{item.date}</time>
                  <p className="mt-0.5 text-[12px] font-black leading-5 text-text line-clamp-2">{item.title}</p>
                </div>
                <span className="pt-0.5 text-right text-[11px] font-semibold text-muted">System Admin</span>
              </li>
            );
          })}
        </ol>
      </section>
      </div>

      {sourceRoomId && onOpenRoomModal ? (
        <div className="sticky bottom-0 z-10 -mx-3.5 -mb-3.5 mt-2 grid shrink-0 grid-cols-[1fr_auto_auto] gap-2 border-t border-border/40 bg-card/95 px-3.5 pb-3.5 pt-3 backdrop-blur">
          <button type="button" onClick={() => onOpenRoomModal(sourceRoomId, "overview")} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-[12px] font-black text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Mở hồ sơ phòng <ArrowRight size={15} />
          </button>
          <button type="button" onClick={() => onOpenRoomModal(sourceRoomId, "overview")} aria-label="Chỉnh sửa phòng" title="Chỉnh sửa" className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Pencil size={16} />
          </button>
          <details className="group relative">
            <summary aria-label="Mở thêm tác vụ" title="Thêm tác vụ" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl border border-border/40 dark:border-white/5 text-text transition-colors hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><MoreHorizontal size={18} /></summary>
            <div className="absolute bottom-[calc(100%+8px)] right-0 z-50 w-44 rounded-xl border border-border/40 dark:border-white/5 bg-card p-1.5 shadow-xl">
              <button type="button" className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[12px] font-bold text-text hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><FileText size={15} />Hợp đồng</button>
              <button type="button" className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[12px] font-bold text-text hover:bg-black/5 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><Wrench size={15} />Bảo trì</button>
            </div>
          </details>
        </div>
      ) : (
        <p className="mt-2 rounded-xl border border-dashed border-border/40 dark:border-white/5 px-3 py-2.5 text-center text-[12px] font-semibold text-muted">Phòng chưa được đồng bộ hồ sơ vận hành.</p>
      )}
    </aside>
  );
}
