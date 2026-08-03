"use client";

import React, { useEffect } from "react";
import { ArrowRight, CheckCircle2, FileText, Pencil, Wrench, X } from "lucide-react";
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
    <div className="flex items-center justify-between gap-4 text-[12px] leading-5">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-bold text-slate-900">{value}</span>
    </div>
  );
}

export default function RoomInspectorDrawer({ floor, room, selectedSpaceId, onClose, onOpenRoomModal }: RoomInspectorDrawerProps) {
  const tone = getStatusTone(room.status);
  const selectedSpace = room.childSpaces?.find((space) => space.id === selectedSpaceId);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside className="fixed inset-x-3 bottom-3 z-40 max-h-[82vh] overflow-auto rounded-[16px] border border-[#e7e7f2] bg-white p-3.5 shadow-2xl lg:relative lg:inset-auto lg:flex lg:h-full lg:max-h-full lg:w-[352px] lg:shrink-0 lg:flex-col lg:overflow-hidden lg:shadow-sm" aria-label={`Thông tin phòng ${room.code}`}>
      <div className="mb-2.5 flex shrink-0 items-start justify-between gap-4 border-b border-[#ececf6] pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-black tracking-tight text-slate-950">{room.code}</h2>
            <span className="rounded-full px-2.5 py-1 text-[10px] font-black" style={{ background: tone.bg, color: tone.text }}>
              {getStatusLabel(room.status)}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-semibold text-slate-500">
            {floor.label}{selectedSpace ? ` • ${selectedSpace.name}` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng thông tin phòng" className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">
          <X size={18} />
        </button>
      </div>

      <section className="shrink-0 rounded-[14px] border border-[#ececf6] bg-[#fbfbfd] p-3">
        <h3 className="mb-2.5 text-[12px] font-black uppercase tracking-wide text-slate-950">Thông tin phòng</h3>
        <div className="space-y-1.5">
          {row("Loại phòng", room.type)}
          {row("Ký hiệu phòng", room.code)}
          {row("Vị trí", floor.label)}
          {row("Diện tích ước tính", `~${room.estimatedArea.toFixed(1)} m²`)}
          {row("Tình trạng", <span style={{ color: tone.text }}>{getStatusLabel(room.status)}</span>)}
          {row("Cửa ra vào", "1 cửa")}
          {row("Cửa sổ", room.type.includes("2PN") ? "2 cửa sổ" : "1 cửa sổ")}
          {row("Giá thuê", room.monthlyRent ? formatVnd(room.monthlyRent) : "Chưa đặt")}
        </div>
      </section>

      <section className="mt-2 shrink-0 rounded-[14px] border border-[#ececf6] bg-white p-3">
        <h3 className="mb-2 text-[12px] font-black uppercase tracking-wide text-slate-950">Mô tả bố trí</h3>
        <p className="text-[12px] leading-5 text-slate-600">
          {room.type.includes("2PN")
            ? "2 phòng ngủ mini riêng biệt + phòng khách + bếp + WC/Tắm. Toàn bộ các khu vực này thuộc cùng một phòng và được chọn bằng một hotspot thống nhất."
            : room.floorId === "ground"
              ? "Khu ngủ + bàn làm việc + bếp + WC/Tắm riêng, kết nối với khu để xe và WC chung tầng trệt."
              : "1 khu ngủ + bàn làm việc + bếp + WC/Tắm riêng."}
        </p>
      </section>

      <section className="mt-2 shrink-0 rounded-[14px] border border-[#ececf6] bg-white p-3">
        <h3 className="mb-2 text-[12px] font-black uppercase tracking-wide text-slate-950">Tiện ích phòng</h3>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {room.amenities.map((amenity) => (
            <div key={amenity} className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold leading-4 text-slate-600">
              <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
              {amenity}
            </div>
          ))}
        </div>
      </section>

      {room.contract && (
        <section className="mt-2 shrink-0 rounded-[14px] border border-[#ececf6] bg-white p-3">
          <h3 className="mb-2 text-[12px] font-black uppercase tracking-wide text-slate-950">Hợp đồng</h3>
          <div className="space-y-1.5">
            {row("Mã hợp đồng", room.contract.code)}
            {row("Tiền cọc", formatVnd(room.contract.deposit))}
            {row("Ngày hết hạn", room.contract.endDate)}
          </div>
        </section>
      )}

      <div className="mt-2 grid shrink-0 grid-cols-4 gap-1.5">
        <button type="button" onClick={() => onOpenRoomModal?.(room.id, "overview")} className="flex min-h-10 items-center justify-center gap-1 rounded-xl bg-[#5b35f5] px-2 text-[11px] font-black text-white transition-colors hover:bg-[#4b28db] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">
          Chi tiết <ArrowRight size={15} />
        </button>
        <button type="button" onClick={() => onOpenRoomModal?.(room.id, "overview")} className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-[#e2defd] px-2 text-[11px] font-black text-[#5b35f5] transition-colors hover:bg-[#f5f2ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">
          <Pencil size={15} /> Sửa
        </button>
        <button type="button" className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-[#ececf6] px-2 text-[11px] font-black text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">
          <FileText size={15} /> Hợp đồng
        </button>
        <button type="button" className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-[#ececf6] px-2 text-[11px] font-black text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">
          <Wrench size={15} /> Bảo trì
        </button>
      </div>
    </aside>
  );
}
