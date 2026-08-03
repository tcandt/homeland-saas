"use client";

import React, { useEffect } from "react";
import { ArrowRight, CheckCircle2, FileText, MoreHorizontal, Pencil, Wrench, X } from "lucide-react";
import type { CockpitFloorSpec, CockpitRoomSpec } from "./building-cockpit.types";
import { formatVnd, getStatusLabel, getStatusTone } from "./building-cockpit-metrics";

interface RoomInspectorDrawerProps {
  floor: CockpitFloorSpec;
  room: CockpitRoomSpec;
  selectedSpaceId: string | null;
  onClose: () => void;
  onOpenRoomModal?: (roomId: string, tab?: string) => void;
}

function row(label: string, value: React.ReactNode) {
  return (
    <div className="flex items-center justify-between gap-4 text-[13px] leading-5 w-full">
      <span className="text-muted shrink-0">{label}</span>
      <span className="text-right font-bold text-text truncate max-w-[200px]" title={String(value)}>{value}</span>
    </div>
  );
}

export default function RoomInspectorDrawer({ floor, room, selectedSpaceId, onClose, onOpenRoomModal }: RoomInspectorDrawerProps) {
  const tone = getStatusTone(room.status);
  const selectedSpace = room.childSpaces?.find((space) => space.id === selectedSpaceId);
  const sourceRoomId = room.sourceRoom?.id;
  const hasOperationalData = Boolean(sourceRoomId);
  const statusLabel = hasOperationalData ? getStatusLabel(room.status) : "Chưa đồng bộ";

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
      className="fixed inset-x-3 bottom-3 z-[10002] max-h-[82vh] overflow-auto rounded-[16px] border border-border/40 dark:border-white/5 bg-card p-3.5 shadow-2xl min-[1366px]:relative min-[1366px]:inset-auto min-[1366px]:z-auto min-[1366px]:flex min-[1366px]:h-full min-[1366px]:max-h-full min-[1366px]:w-full min-[1366px]:min-w-[280px] min-[1366px]:max-w-[360px] min-[1366px]:shrink-0 min-[1366px]:flex-col min-[1366px]:overflow-hidden min-[1366px]:shadow-[0_16px_36px_rgb(var(--shadow-color)/0.075)] min-[1536px]:min-w-[320px] transition-colors"
      aria-label={`Thông tin phòng ${room.code}`}
    >
      <div className="sticky top-0 z-10 -mx-3.5 -mt-3.5 mb-2.5 flex shrink-0 items-start justify-between gap-4 border-b border-border/40 bg-card/95 px-3.5 pb-2.5 pt-3.5 backdrop-blur">
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

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
      <section className="shrink-0 rounded-[14px] border border-border/40 bg-black/5 dark:bg-white/5 p-3">
        <h3 className="mb-2.5 text-[12px] font-black uppercase tracking-wide text-text">Thông tin phòng</h3>
        <div className="space-y-1.5 w-full">
          {row("Loại phòng", room.type)}
          {row("Ký hiệu phòng", room.code)}
          {row("Vị trí", floor.label)}
          {row("Diện tích ước tính", `~${room.estimatedArea.toFixed(1)} m²`)}
          {row("Tình trạng", <span style={{ color: hasOperationalData ? tone.text : "var(--muted-foreground, #94a3b8)" }}>{statusLabel}</span>)}
          {row("Cửa ra vào", `${room.entryDoorCount} cửa`)}
          {row("Giá thuê", room.monthlyRent ? formatVnd(room.monthlyRent) : "Chưa đặt")}
        </div>
      </section>



      {room.contract && (
        <section className="mt-2 shrink-0 rounded-[14px] border border-border/40 bg-card p-3">
          <h3 className="mb-2 text-[12px] font-black uppercase tracking-wide text-text">Hợp đồng</h3>
          <div className="space-y-1.5 w-full">
            {row("Mã hợp đồng", room.contract.code)}
            {row("Tiền cọc", formatVnd(room.contract.deposit))}
            {row("Ngày hết hạn", room.contract.endDate)}
          </div>
        </section>
      )}

      <section className="mt-2 shrink-0 rounded-[14px] border border-border/40 bg-card p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[12px] font-black uppercase tracking-wide text-text">Lịch sử hoạt động</h3>
          <button type="button" className="text-[12px] font-black text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Xem tất cả
          </button>
        </div>
        <ol className="space-y-0">
          {[
            { date: "24/05/2025 10:15", title: `Cập nhật trạng thái: ${statusLabel}`, icon: CheckCircle2, tone: "emerald" },
            { date: "20/05/2025 09:45", title: "Kết thúc hợp đồng", icon: FileText, tone: "blue" },
            { date: "01/05/2025 14:20", title: "Tạo hợp đồng mới", icon: FileText, tone: "blue" },
          ].map((item, index, items) => {
            const Icon = item.icon;
            return (
              <li key={`${item.date}-${item.title}`} className="grid grid-cols-[22px_1fr_auto] gap-2">
                <div className="relative flex justify-center">
                  <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${item.tone === "emerald" ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"}`}>
                    <Icon size={12} aria-hidden />
                  </span>
                  {index < items.length - 1 && <span className="absolute top-6 h-[calc(100%-10px)] w-px bg-border/40 dark:bg-white/5" aria-hidden />}
                </div>
                <div className="border-b border-border/40 pb-2.5 last:border-b-0 min-w-0">
                  <time className="block text-[12px] font-semibold leading-4 text-muted">{item.date}</time>
                  <p className="mt-0.5 text-[12px] font-black leading-5 text-text truncate">{item.title}</p>
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
