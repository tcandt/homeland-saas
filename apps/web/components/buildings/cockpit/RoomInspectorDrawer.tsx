"use client";

import React, { useEffect } from "react";
import useSWR from "swr";
import { ArrowRight, Bolt, CheckCircle2, Pencil, X } from "lucide-react";
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
      className="fixed inset-x-3 bottom-3 z-[10002] max-h-[82vh] overflow-auto rounded-[16px] border border-border/40 dark:border-white/5 bg-card p-3.5 shadow-2xl xl:relative xl:inset-auto xl:z-auto xl:flex xl:h-full xl:max-h-full xl:w-full xl:min-w-0 xl:max-w-none xl:shrink xl:flex-col xl:overflow-hidden xl:shadow-[0_16px_36px_rgb(var(--shadow-color)/0.075)] transition-colors"
      aria-label={`Thông tin phòng ${room.code}`}
    >
      <div className="sticky top-0 z-10 -mx-3.5 -mt-3.5 mb-3 flex shrink-0 items-start justify-between gap-3 border-b border-border/40 bg-card/95 px-3.5 pb-3 pt-3.5 backdrop-blur">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-black tracking-tight text-text truncate">{room.code}</h2>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-black shrink-0 border border-black/5 dark:border-white/5" style={hasOperationalData ? { background: tone.bg, color: tone.text } : { background: "var(--muted-bg, rgba(255,255,255,0.05))", color: "var(--muted-foreground, #94a3b8)" }}>
              {statusLabel}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] font-semibold text-muted truncate">
            {floor.label}{selectedSpace ? ` • ${selectedSpace.name}` : ""}
          </p>
          {hasOperationalData && room.status === "vacant" && <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-600"><CheckCircle2 size={13} />Sẵn sàng khai thác</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng thông tin phòng" className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-950 dark:hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5 pt-0.5">
      {/* THÔNG TIN PHÒNG - 2 CỘT GỌN GÀNG */}
      <section className="shrink-0 rounded-[14px] border border-border/30 bg-black/5 dark:bg-white/5 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
        <h3 className="mb-2 text-[11px] font-black uppercase tracking-wider text-muted">Thông tin phòng</h3>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="flex flex-col min-w-0 bg-card/75 rounded-lg p-2 border border-border/20">
            <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Loại phòng</span>
            <span className="font-bold text-text truncate mt-0.5" title={room.type}>{room.type}</span>
          </div>
          <div className="flex flex-col min-w-0 bg-card/75 rounded-lg p-2 border border-border/20">
            <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Ký hiệu phòng</span>
            <span className="font-bold text-text truncate mt-0.5" title={room.code}>{room.code}</span>
          </div>
          <div className="flex flex-col min-w-0 bg-card/75 rounded-lg p-2 border border-border/20">
            <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Vị trí</span>
            <span className="font-bold text-text truncate mt-0.5" title={floor.label}>{floor.label}</span>
          </div>
          <div className="flex flex-col min-w-0 bg-card/75 rounded-lg p-2 border border-border/20">
            <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Diện tích</span>
            <span className="font-bold text-text truncate mt-0.5">~{room.estimatedArea.toFixed(1)} m²</span>
          </div>
          <div className="flex flex-col min-w-0 bg-card/75 rounded-lg p-2 border border-border/20">
            <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Tình trạng</span>
            <span className="font-bold truncate mt-0.5" style={{ color: hasOperationalData ? tone.text : "var(--muted-foreground, #94a3b8)" }}>
              {statusLabel}
            </span>
          </div>
          <div className="flex flex-col min-w-0 bg-card/75 rounded-lg p-2 border border-border/20">
            <span className="text-[9px] font-bold text-muted uppercase tracking-wider">Cửa ra vào</span>
            <span className="font-bold text-text truncate mt-0.5">{room.entryDoorCount} cửa</span>
          </div>
          <div className="col-span-2 flex items-center justify-between min-w-0 bg-card/75 rounded-lg p-2 border border-border/20">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Giá thuê</span>
            <span className="font-black text-primary text-[12px] truncate">
              {hasActiveRent ? formatVnd(room.monthlyRent) : "Thiết lập khi khách vào ở"}
            </span>
          </div>
        </div>
      </section>

      {/* ĐIỆN HUNONIC - GỌN GÀNG KHÔNG QUÁ TO THỪA THÔ */}
      <section className="shrink-0 rounded-[14px] border border-emerald-500/20 bg-emerald-500/[0.03] p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-text">
            <Bolt size={13} className="text-emerald-500" /> Điện Hunonic
          </h3>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            Sync 1 giờ
          </span>
        </div>
        {electricity ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="rounded-lg border border-emerald-500/15 bg-card/90 p-1.5 min-w-0">
                <div className="text-[9px] font-bold uppercase text-muted truncate">W hiện tại</div>
                <div className="mt-0.5 text-[12px] font-black text-text truncate">{Number(electricity.powerCurrentW || 0).toLocaleString("vi-VN")} W</div>
              </div>
              <div className="rounded-lg border border-emerald-500/15 bg-card/90 p-1.5 min-w-0">
                <div className="text-[9px] font-bold uppercase text-muted truncate">kWh tháng</div>
                <div className="mt-0.5 text-[12px] font-black text-text truncate">{Number(electricity.energyMonthKwh || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}</div>
              </div>
              <div className="rounded-lg border border-emerald-500/15 bg-card/90 p-1.5 min-w-0">
                <div className="text-[9px] font-bold uppercase text-muted truncate">Tiền tháng</div>
                <div className="mt-0.5 text-[12px] font-black text-emerald-600 dark:text-emerald-400 truncate">{formatVnd(Number(electricity.moneyMonthVnd || 0))}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-card/75 p-2 text-[11px] border border-emerald-500/10">
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-bold text-muted uppercase">Công tơ</span>
                <span className="font-bold text-text truncate" title={electricity.deviceName || electricity.displayName}>
                  {electricity.deviceName || electricity.displayName}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] font-bold text-muted uppercase">Cập nhật</span>
                <span className="font-bold text-text truncate" title={electricity.lastSyncedAt ? new Date(electricity.lastSyncedAt).toLocaleString("vi-VN") : "Chưa có dữ liệu"}>
                  {electricity.lastSyncedAt ? new Date(electricity.lastSyncedAt).toLocaleString("vi-VN") : "Chưa có dữ liệu"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-emerald-500/25 bg-card/70 p-2.5 text-[11px] font-semibold text-muted">
            {electricityQuery.isLoading ? "Đang tải dữ liệu công tơ..." : "Chưa có dữ liệu điện tháng này."}
          </div>
        )}
      </section>

      {room.contract && (
        <section className="shrink-0 rounded-[14px] border border-primary/15 bg-primary/[0.025] p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-text">Hợp đồng</h3>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Đang theo dõi</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-card/75 p-2 text-[11px] border border-primary/10">
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-bold text-muted uppercase">Mã HĐ</span>
              <span className="font-bold text-text truncate">{room.contract.code}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-bold text-muted uppercase">Tiền cọc</span>
              <span className="font-bold text-text truncate">{formatVnd(room.contract.deposit)}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[9px] font-bold text-muted uppercase">Hết hạn</span>
              <span className="font-bold text-text truncate">{room.contract.endDate}</span>
            </div>
          </div>
        </section>
      )}

      </div>

      {sourceRoomId && onOpenRoomModal ? (
        <div className="sticky bottom-0 z-10 -mx-3.5 -mb-3.5 mt-2 grid shrink-0 grid-cols-[1fr_auto] gap-2 border-t border-border/40 bg-card/95 px-3.5 pb-3.5 pt-2.5 backdrop-blur">
          <button type="button" onClick={() => onOpenRoomModal(sourceRoomId, "overview")} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-[12px] font-black text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Mở hồ sơ phòng <ArrowRight size={14} />
          </button>
          <button type="button" onClick={() => onOpenRoomModal(sourceRoomId, "overview")} aria-label="Chỉnh sửa phòng" title="Chỉnh sửa" className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Pencil size={15} />
          </button>
        </div>
      ) : (
        <p className="mt-2 rounded-xl border border-dashed border-border/40 dark:border-white/5 px-3 py-2 text-center text-[11px] font-semibold text-muted">Phòng chưa được đồng bộ hồ sơ vận hành.</p>
      )}
    </aside>
  );
}
