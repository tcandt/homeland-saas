"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Car,
  ChevronDown,
  ClipboardCheck,
  DollarSign,
  Expand,
  FileWarning,
  ImageIcon,
  Layers3,
  MapPin,
  Maximize2,
  Pencil,
  RefreshCw,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Building } from "../building.types";
import {
  createLk0131CockpitSpec,
  findRoomFloor,
  resolveFloorSpec,
  resolveRoomSpec,
} from "./building-cockpit-data";
import type { CockpitBuildingSpec, CockpitFloorId, CockpitFloorSpec, CockpitRoomSpec } from "./building-cockpit.types";
import { formatVnd, getBuildingMetrics, getFloorOccupancy, getStatusLabel, getStatusTone } from "./building-cockpit-metrics";
import { overviewFloorHotspots } from "./building-image-maps";
import FloorPlanCanvas from "./FloorPlanCanvas";
import RoomInspectorDrawer from "./RoomInspectorDrawer";

interface BuildingCockpitProps {
  buildings: Building[];
  onEditBuilding?: () => void;
  onOpenRoomModal?: (roomId: string, tab?: string) => void;
}

const FLOOR_PARAM_VALUES = new Set(["ground", "1", "2", "3"]);

function cx(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
}

function getFloorParam(searchParams: URLSearchParams) {
  const value = searchParams.get("floor");
  return value && FLOOR_PARAM_VALUES.has(value) ? value as CockpitFloorId : null;
}

function getBasePath(pathname: string, building: CockpitBuildingSpec) {
  return pathname.startsWith(`/buildings/${building.code}`) ? pathname : `/buildings/${building.code}`;
}

function StatCard({ icon, label, value, hint, tone = "violet", compact = false }: { icon: React.ReactNode; label: string; value: string; hint: string; tone?: "violet" | "green" | "orange" | "blue" | "slate"; compact?: boolean }) {
  const colors = {
    violet: "bg-[#5b35f5]/10 text-[#5b35f5]",
    green: "bg-emerald-500/10 text-emerald-600",
    orange: "bg-orange-500/10 text-orange-600",
    blue: "bg-sky-500/10 text-sky-600",
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <article className={cx("rounded-[12px] border border-[#e8e7f3] bg-white shadow-[0_14px_40px_rgba(17,24,39,0.035)]", compact ? "min-h-[78px] p-2.5" : "min-h-[78px] p-2.5")}>
      <div className="flex items-start gap-2.5">
        <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]", colors[tone])}>{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-[12px] font-bold text-slate-500">{label}</p>
          <strong className={cx("block font-black tracking-tight text-slate-950", compact ? "mt-1 text-[17px]" : "mt-1 text-[18px]")}>{value}</strong>
          <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-500">{hint}</span>
        </div>
      </div>
    </article>
  );
}

function FloorLabelRail({ floors, activeFloorId, onSelectFloor, onHoverFloor }: { floors: CockpitFloorSpec[]; activeFloorId: string | null; onSelectFloor: (floorId: CockpitFloorId) => void; onHoverFloor: (floorId: CockpitFloorId | null) => void }) {
  const ordered = [...floors].reverse();
  return (
    <div className="pointer-events-none relative hidden h-full w-[108px] xl:block 2xl:w-[126px]">
      <span className="absolute bottom-[10%] right-0 top-[11%] border-l border-[#5b35f5]/20" aria-hidden />
      {ordered.map((floor, index) => (
        <button
          key={floor.id}
          type="button"
          onClick={() => onSelectFloor(floor.id)}
          onMouseEnter={() => onHoverFloor(floor.id)}
          onMouseLeave={() => onHoverFloor(null)}
          onFocus={() => onHoverFloor(floor.id)}
          onBlur={() => onHoverFloor(null)}
          className={cx(
            "pointer-events-auto absolute left-1 flex min-h-[58px] w-[94px] -translate-y-1/2 flex-col justify-center rounded-[11px] border bg-white px-2.5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5] motion-reduce:transition-none 2xl:w-[112px] 2xl:px-3",
            activeFloorId === floor.id ? "border-[#5b35f5]/50 bg-[#faf9ff] text-[#5b35f5]" : "border-[#e6e4f4] text-slate-950 hover:border-[#5b35f5]/35 hover:bg-[#fcfbff]",
          )}
          style={{ top: `${12 + index * 25.5}%` }}
          aria-label={`Mở ${floor.label}`}
        >
          <span className="text-[13px] font-black">{floor.label}</span>
          <span className="mt-1 truncate text-[10px] font-bold text-[#5b35f5]">{floor.roomCodes.join(", ")}</span>
          <span className="absolute left-full top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#5b35f5] shadow-[0_0_0_3px_rgba(91,53,245,0.08)]" />
          <span className="absolute left-[calc(100%+8px)] top-1/2 w-7 border-t border-[#5b35f5]/35" />
        </button>
      ))}
    </div>
  );
}

function toOverviewClipPath(points: string, width: number, height: number) {
  const percentages = points.split(/\s+/).map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return `${((x / width) * 100).toFixed(2)}% ${((y / height) * 100).toFixed(2)}%`;
  });
  return `polygon(${percentages.join(", ")})`;
}

function ExplodedBuildingImageStack({
  building,
  activeFloorId,
  onSelectFloor,
  onHoverFloor,
}: {
  building: CockpitBuildingSpec;
  activeFloorId: string | null;
  onSelectFloor: (floorId: CockpitFloorId) => void;
  onHoverFloor: (floorId: CockpitFloorId | null) => void;
}) {
  const ordered = [...building.floors].reverse();
  return (
    <div className="relative mx-auto inline-block h-full max-h-full w-auto max-w-full shrink-0" style={{ aspectRatio: `${building.overviewImage.width} / ${building.overviewImage.height}` }}>
      <Image
        src={building.overviewImage.src}
        alt="Ảnh render kiến trúc tách tầng của tòa nhà LK01-31"
        fill
        sizes="(max-width: 1280px) 52vw, 650px"
        className="block h-full w-full object-contain drop-shadow-[0_24px_32px_rgba(15,23,42,0.12)]"
        priority
      />
      {ordered.map((floor, index) => {
        const active = floor.id === activeFloorId;
        return (
          <button
            key={floor.id}
            type="button"
            aria-label={`Mở chi tiết ${floor.label}`}
            onClick={() => onSelectFloor(floor.id)}
            onMouseEnter={() => onHoverFloor(floor.id)}
            onMouseLeave={() => onHoverFloor(null)}
            onFocus={() => onHoverFloor(floor.id)}
            onBlur={() => onHoverFloor(null)}
            className="absolute inset-0 cursor-pointer outline-none transition-[transform,filter] duration-200 ease-out hover:-translate-y-2 hover:brightness-105 hover:drop-shadow-[0_16px_14px_rgba(91,53,245,0.18)] focus-visible:-translate-y-2 focus-visible:brightness-105 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            style={{
              clipPath: toOverviewClipPath(
                overviewFloorHotspots[floor.id],
                building.overviewImage.width,
                building.overviewImage.height,
              ),
              zIndex: 10 + index,
            }}
          >
            <Image src={building.overviewImage.src} alt="" aria-hidden fill sizes="(max-width: 1280px) 52vw, 650px" className="h-full w-full object-contain" draggable={false} />
          </button>
        );
      })}
      <svg viewBox={`0 0 ${building.overviewImage.width} ${building.overviewImage.height}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {ordered.map((floor) => (
          <polygon
            key={floor.id}
            points={overviewFloorHotspots[floor.id]}
            fill={floor.id === activeFloorId ? "rgba(91,53,245,0.07)" : "transparent"}
            stroke={floor.id === activeFloorId ? "rgba(91,53,245,0.9)" : "transparent"}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

function FloorSummaryCard({ floor, active, onSelectFloor, onSelectRoom, onHoverFloor }: { floor: CockpitFloorSpec; active: boolean; onSelectFloor: (floorId: CockpitFloorId) => void; onSelectRoom: (floorId: CockpitFloorId, room: CockpitRoomSpec) => void; onHoverFloor: (floorId: CockpitFloorId | null) => void }) {
  return (
    <article
      className={cx("relative flex h-full min-h-0 flex-col justify-center overflow-hidden rounded-[14px] border bg-white p-2 shadow-[0_10px_28px_rgba(15,23,42,0.045)] transition-colors before:absolute before:-left-4 before:top-1/2 before:w-4 before:border-t before:border-[#5b35f5]/20", active ? "border-[#5b35f5]/50 bg-[#fdfcff]" : "border-[#e8e7f3] hover:border-[#5b35f5]/30")}
      onMouseEnter={() => onHoverFloor(floor.id)}
      onMouseLeave={() => onHoverFloor(null)}
    >
      <button type="button" onClick={() => onSelectFloor(floor.id)} className="mb-1 flex w-full items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#5b35f5]/10 text-[#5b35f5]"><Building2 size={15} /></span>
        <strong className="text-[16px] font-black text-slate-950">{floor.label}</strong>
      </button>
      <div className="space-y-1">
        {floor.rooms.map((room) => {
          const tone = getStatusTone(room.status);
          return (
            <button key={room.code} type="button" onClick={() => onSelectRoom(floor.id, room)} className="flex min-h-6 w-full items-center gap-2 rounded-lg px-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: tone.dot }} />
              <span className="text-[13px] font-black text-slate-950">{room.code}</span>
              <span className="truncate text-[11px] font-semibold text-slate-500">{room.type}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex items-center gap-3 border-t border-[#ececf6] pt-1 text-[10px] leading-4 font-bold text-slate-500">
        <span className="flex items-center gap-1"><BedDouble size={13} /> {floor.rooms[0]?.type.includes("2PN") ? "2PN mini" : "1 giường"}</span>
        <span className="flex items-center gap-1"><Users size={13} /> {floor.rooms.reduce((sum, room) => sum + room.capacity, 0)} người</span>
        <span className="flex items-center gap-1"><Bath size={13} /> {floor.id === "ground" ? "2VS" : "1VS"}</span>
      </div>
    </article>
  );
}

function BuildingSummaryPanel({ building }: { building: CockpitBuildingSpec }) {
  const metrics = getBuildingMetrics(building);
  return (
    <aside className="hidden h-fit max-h-full min-h-0 w-[272px] shrink-0 space-y-2 overflow-hidden xl:flex xl:flex-col">
      <section className="rounded-[14px] border border-[#e8e7f3] bg-white p-3.5 shadow-sm">
        <h3 className="mb-2 text-[13px] font-black uppercase tracking-wide text-slate-950">Tổng quan tòa nhà</h3>
        <div className="space-y-2 text-[12px]">
          <div className="flex justify-between"><span className="text-slate-500">Tổng phòng</span><strong>{metrics.totalRooms} phòng</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">Tổng số người</span><strong>{metrics.residentCount || 50} người</strong></div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-slate-500">Tỷ lệ lấp đầy</span><strong>{metrics.occupancyRate}%</strong></div>
            <div className="h-2 rounded-full bg-[#eeeafb]"><div className="h-full rounded-full bg-[#5b35f5]" style={{ width: `${metrics.occupancyRate}%` }} /></div>
          </div>
          <div className="flex justify-between"><span className="text-slate-500">Doanh thu tháng 5</span><strong>{formatVnd(metrics.monthlyRevenue)}</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">Doanh thu năm 2025</span><strong>{formatVnd(metrics.yearlyRevenue)}</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">Tiền đặt cọc</span><strong className="text-sky-600">{formatVnd(metrics.depositTotal)}</strong></div>
        </div>
      </section>

      <section className="rounded-[14px] border border-[#e8e7f3] bg-white p-3.5 shadow-sm">
        <h3 className="mb-2 text-[13px] font-black uppercase tracking-wide text-slate-950">Cảnh báo nổi bật</h3>
        <div className="space-y-1.5">
          <div className="cockpit-alert-warning flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] font-bold text-slate-600"><span className="flex items-center gap-2"><AlertCircle size={14} className="text-orange-500" />Hợp đồng sắp hết hạn</span><b className="text-rose-500">{metrics.expiringContracts}</b></div>
          <div className="cockpit-alert-danger flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] font-bold text-slate-600"><span className="flex items-center gap-2"><FileWarning size={14} className="text-rose-500" />Chưa khai báo tạm trú</span><b className="text-rose-500">{metrics.incompleteTemporaryResidence}</b></div>
          <div className="cockpit-alert-warning flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-[11px] font-bold text-slate-600"><span className="flex items-center gap-2"><DollarSign size={14} className="text-orange-500" />Thanh toán quá hạn</span><b className="text-orange-500">{metrics.overduePayments}</b></div>
        </div>
      </section>

      <section className="min-h-0 rounded-[14px] border border-[#e8e7f3] bg-white p-3 shadow-sm">
        <h3 className="mb-1 text-[13px] font-black uppercase tracking-wide text-slate-950">Chỉ số tầng</h3>
        <div className="space-y-1">
          {[...building.floors].reverse().map((floor) => (
            <div key={floor.id} className="flex items-center justify-between rounded-lg px-1.5 py-1 text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-slate-400" />{floor.label}</span>
              <span>{floor.rooms.length} phòng</span>
              <span className="text-emerald-600">{getFloorOccupancy(floor)}%</span>
            </div>
          ))}
        </div>
      </section>
      <p className="flex items-center justify-between text-[10px] font-semibold text-slate-500">Cập nhật lần cuối: <span>{building.updatedAtLabel}</span><RefreshCw size={13} /></p>
    </aside>
  );
}

function Overview({
  building,
  activeFloorId,
  onSelectFloor,
  onSelectRoom,
  onEditBuilding,
}: {
  building: CockpitBuildingSpec;
  activeFloorId: string | null;
  onSelectFloor: (floorId: CockpitFloorId) => void;
  onSelectRoom: (floorId: CockpitFloorId, room: CockpitRoomSpec) => void;
  onEditBuilding?: () => void;
}) {
  const metrics = getBuildingMetrics(building);
  const [hoveredFloorId, setHoveredFloorId] = useState<CockpitFloorId | null>(null);
  const highlightedFloorId = hoveredFloorId || activeFloorId;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-black tracking-tight text-slate-950">{building.code}</h1>
            <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-[12px] font-black text-emerald-600">{building.statusLabel}</span>
          </div>
          <p className="mt-0.5 flex items-center gap-2 text-[13px] font-semibold text-slate-500"><MapPin size={15} className="text-rose-500" />{building.address}</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onEditBuilding} className="flex min-h-11 items-center gap-2 rounded-xl border border-[#e5e4f1] bg-white px-4 text-[13px] font-black text-slate-950 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]"><Pencil size={15} />Chỉnh sửa tòa nhà</button>
          <button type="button" className="flex min-h-11 items-center gap-2 rounded-xl bg-[#5b35f5] px-4 text-[13px] font-black text-white transition-colors hover:bg-[#4b28db] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">Thao tác nhanh <ChevronDown size={15} /></button>
        </div>
      </div>

      <div className="mb-2 grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={<DollarSign size={18} />} label="Doanh thu tháng 5" value={formatVnd(metrics.monthlyRevenue)} hint="+12,6% so với tháng 4" />
        <StatCard icon={<ClipboardCheck size={18} />} label="Phòng đã thuê" value={`${metrics.occupiedRooms} / ${metrics.totalRooms}`} hint={`${metrics.occupancyRate}%`} tone="green" />
        <StatCard icon={<Users size={18} />} label="Phòng trống" value={`${metrics.vacantRooms} / ${metrics.totalRooms}`} hint="Có thể khai thác" tone="slate" />
        <StatCard icon={<CalendarDays size={18} />} label="HĐ sắp hết hạn" value={`${metrics.expiringContracts}`} hint="Trong 30 ngày tới" tone="orange" />
        <StatCard icon={<ClipboardCheck size={18} />} label="Khai báo tạm trú" value={`${metrics.temporaryResidenceRate}%`} hint="22 / 24 phòng" tone="blue" />
      </div>

      <div className="grid min-h-0 flex-1 items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_272px]">
        <main className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden rounded-[16px] bg-transparent">
          <div className="grid h-[calc(100%-36px)] min-h-0 justify-center gap-3 xl:grid-cols-[108px_minmax(300px,1fr)_220px] 2xl:grid-cols-[126px_minmax(470px,650px)_260px]">
            <FloorLabelRail floors={building.floors} activeFloorId={highlightedFloorId} onSelectFloor={onSelectFloor} onHoverFloor={setHoveredFloorId} />
            <div className="building-model-stage flex min-h-0 items-center justify-center overflow-hidden rounded-[18px]">
              <ExplodedBuildingImageStack building={building} activeFloorId={highlightedFloorId} onSelectFloor={onSelectFloor} onHoverFloor={setHoveredFloorId} />
            </div>
            <div className="grid min-h-0 grid-rows-4 gap-2 py-2">
              {[...building.floors].reverse().map((floor) => (
                <FloorSummaryCard key={floor.id} floor={floor} active={highlightedFloorId === floor.id} onSelectFloor={onSelectFloor} onSelectRoom={onSelectRoom} onHoverFloor={setHoveredFloorId} />
              ))}
            </div>
          </div>
          <div className="mx-auto mt-1 flex h-[32px] max-w-[680px] flex-wrap items-center justify-center gap-4 rounded-[12px] border border-[#e8e7f3] bg-white px-3 text-[10px] font-bold text-slate-600 shadow-sm">
            <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Đã thuê</span>
            <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-slate-400" />Trống</span>
            <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-orange-500" />HĐ sắp hết hạn</span>
            <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" />Cảnh báo</span>
            <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-sky-500" />Khai báo chưa đầy đủ</span>
          </div>
        </main>
        <BuildingSummaryPanel building={building} />
      </div>
    </div>
  );
}

function FloorWorkspace({
  building,
  floor,
  room,
  zoom,
  setZoom,
  debugMode,
  onSelectFloor,
  onSelectRoom,
  onCloseRoom,
  onOpenRoomModal,
}: {
  building: CockpitBuildingSpec;
  floor: CockpitFloorSpec;
  room: CockpitRoomSpec | null;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  debugMode: boolean;
  onSelectFloor: (floorId: CockpitFloorId | null) => void;
  onSelectRoom: (room: CockpitRoomSpec) => void;
  onCloseRoom: () => void;
  onOpenRoomModal?: (roomId: string, tab?: string) => void;
}) {
  return (
    <div className={cx("grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_352px]", debugMode && "overflow-y-auto")}>
      <main className="flex h-full min-h-0 min-w-0 flex-col rounded-[16px] border border-[#e8e7f3] bg-white p-4 shadow-sm">
        <div className="mb-3 flex shrink-0 flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[12px] font-black text-[#5b35f5]">
              <button type="button" onClick={() => onSelectFloor(null)} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">Tòa nhà</button>
              <span className="text-slate-400">/</span>
              <span>{building.code}</span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-700">{floor.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-[26px] font-black tracking-tight text-slate-950">{building.code} – {floor.label}</h1>
              <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-[12px] font-black text-emerald-600">{building.statusLabel}</span>
            </div>
            <p className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-slate-500"><MapPin size={15} />{building.address}</p>
          </div>
          <button type="button" className="flex min-h-11 items-center gap-2 rounded-xl bg-[#5b35f5] px-4 text-[13px] font-black text-white transition-colors hover:bg-[#4b28db] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">Thao tác nhanh <ChevronDown size={15} /></button>
        </div>

        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-[14px] border border-[#ececf6] p-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {["Sơ đồ mặt bằng", "Thông tin tầng", "Danh sách phòng", "Tài liệu"].map((tab, index) => (
              <button key={tab} type="button" className={cx("min-h-10 rounded-xl px-4 text-[13px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]", index === 0 ? "bg-[#5b35f5] text-white" : "text-slate-500 hover:bg-slate-50")}>{tab}</button>
            ))}
          </div>
          <span className="flex min-h-10 items-center gap-2 rounded-xl border border-[#e8e7f3] bg-slate-50 px-4 text-[13px] font-black text-slate-600"><ImageIcon size={16} />Ảnh render 3D</span>
        </div>

        <section className="flex min-h-0 flex-1 flex-col rounded-[16px] border border-[#ececf6] bg-white p-3">
          <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-black uppercase tracking-wide text-slate-950">Sơ đồ mặt bằng {floor.label}</h2>
              <AlertCircle size={15} className="text-slate-400" />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setZoom((value) => Math.max(60, value - 10))} aria-label="Thu nhỏ" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ececf6] text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]"><ZoomOut size={16} /></button>
              <span className="min-w-12 text-center text-[13px] font-black text-slate-600">{zoom}%</span>
              <button type="button" onClick={() => setZoom((value) => Math.min(250, value + 10))} aria-label="Phóng to" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ececf6] text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]"><ZoomIn size={16} /></button>
              <button type="button" onClick={() => setZoom(100)} aria-label="Fit ảnh vào màn hình" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ececf6] text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]"><Expand size={16} /></button>
              <button type="button" onClick={() => document.getElementById("floor-plan-viewport")?.requestFullscreen?.()} aria-label="Toàn màn hình" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ececf6] text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]"><Maximize2 size={16} /></button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <FloorPlanCanvas floor={floor} selectedRoomCode={room?.urlCode || null} zoom={zoom} onZoomChange={setZoom} onSelectRoom={onSelectRoom} debugMode={debugMode} />
          </div>

          <div className="mt-2.5 grid shrink-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard compact icon={<Car size={17} />} label="Khu vực để xe" value={floor.id === "ground" ? "~7 xe máy" : "Không có"} hint="Theo layout" tone="slate" />
            <StatCard compact icon={<Bath size={17} />} label="WC chung" value={floor.id === "ground" ? "1 phòng" : "0 phòng"} hint="Khu tiện ích" tone="blue" />
            <StatCard compact icon={<Layers3 size={17} />} label="Cầu thang" value="1 khu" hint="Sảnh giữa" tone="violet" />
            <StatCard compact icon={<BedDouble size={17} />} label="Danh sách phòng" value={`${floor.rooms.length} phòng`} hint={floor.roomCodes.join(", ")} tone="green" />
            <StatCard compact icon={<ClipboardCheck size={17} />} label="Chiều cao tầng" value={`${floor.heightMeters} m`} hint="Có thể cấu hình" tone="orange" />
          </div>
        </section>
      </main>

      {room ? (
        <RoomInspectorDrawer floor={floor} room={room} selectedSpaceId={null} onClose={onCloseRoom} onOpenRoomModal={onOpenRoomModal} />
      ) : (
        <aside className="hidden h-full overflow-hidden rounded-[16px] border border-[#e8e7f3] bg-white p-4 shadow-sm xl:block">
          <h2 className="mb-4 text-[16px] font-black text-slate-950">Thông tin tầng</h2>
          <div className="space-y-3">
            {floor.rooms.map((item) => {
              const tone = getStatusTone(item.status);
              return (
                <button key={item.code} type="button" onClick={() => onSelectRoom(item)} className="flex w-full items-center justify-between rounded-xl border border-[#ececf6] p-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">
                  <span><b className="block text-[13px] text-slate-950">{item.code}</b><small className="text-[11px] font-bold text-slate-500">{item.type}</small></span>
                  <span className="rounded-full px-2 py-1 text-[10px] font-black" style={{ background: tone.bg, color: tone.text }}>{getStatusLabel(item.status)}</span>
                </button>
              );
            })}
          </div>
        </aside>
      )}
    </div>
  );
}

export default function BuildingCockpit({ buildings, onEditBuilding, onOpenRoomModal }: BuildingCockpitProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [zoom, setZoom] = useState(100);
  const allowFixtureFallback = pathname.startsWith("/buildings/LK01-31");
  const building = useMemo(() => createLk0131CockpitSpec(buildings, allowFixtureFallback), [allowFixtureFallback, buildings]);

  const floorId = useMemo(() => getFloorParam(searchParams), [searchParams]);
  const roomParam = searchParams.get("room");
  const debugMode = process.env.NODE_ENV !== "production" && searchParams.get("debugHotspots") === "1";

  const floor = building ? resolveFloorSpec(building, floorId) : null;
  const room = building ? resolveRoomSpec(building, floorId, roomParam) : null;

  useEffect(() => {
    if (!building || floorId || !roomParam) return;
    const match = findRoomFloor(building, roomParam);
    if (!match) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("floor", match.floor.id);
    router.replace(`${getBasePath(pathname, building)}?${params.toString()}`);
  }, [building, floorId, pathname, roomParam, router, searchParams]);

  const updateParams = useCallback((updater: (params: URLSearchParams) => void, replace = false) => {
    if (!building) return;
    const params = new URLSearchParams(searchParams.toString());
    updater(params);
    const next = `${getBasePath(pathname, building)}?${params.toString()}`;
    if (replace) router.replace(next);
    else router.push(next);
  }, [building, pathname, router, searchParams]);

  const selectFloor = useCallback((nextFloorId: CockpitFloorId | null) => {
    updateParams((params) => {
      if (nextFloorId) params.set("floor", nextFloorId);
      else params.delete("floor");
      params.delete("room");
      params.delete("space");
      params.delete("viewMode");
    });
  }, [updateParams]);

  const selectRoom = useCallback((nextFloorId: CockpitFloorId, nextRoom: CockpitRoomSpec) => {
    updateParams((params) => {
      params.set("floor", nextFloorId);
      params.set("room", nextRoom.urlCode);
      params.delete("space");
    });
  }, [updateParams]);

  const selectCurrentFloorRoom = useCallback((nextRoom: CockpitRoomSpec) => {
    updateParams((params) => {
      params.set("floor", nextRoom.floorId);
      params.set("room", nextRoom.urlCode);
      params.delete("space");
      params.delete("viewMode");
    });
  }, [updateParams]);

  const closeRoom = useCallback(() => {
    updateParams((params) => {
      params.delete("room");
      params.delete("space");
    }, true);
  }, [updateParams]);

  if (!building) {
    return (
      <div data-testid="empty-buildings-state" className="rounded-[16px] border border-dashed border-[#e8e7f3] bg-white p-10 text-center text-sm font-bold text-slate-500">
        Không có tòa nhà LK01-31 trong dữ liệu hiện tại.
      </div>
    );
  }

  return (
    <div className="building-cockpit-theme min-h-[calc(100vh-80px)] w-full bg-background p-4 text-text xl:h-[calc(100dvh-80px)] xl:min-h-0 xl:overflow-hidden">
      <div className="h-full min-h-0 w-full">
        {floor ? (
          <FloorWorkspace
            building={building}
            floor={floor}
            room={room}
            zoom={zoom}
            setZoom={setZoom}
            debugMode={debugMode}
            onSelectFloor={selectFloor}
            onSelectRoom={selectCurrentFloorRoom}
            onCloseRoom={closeRoom}
            onOpenRoomModal={onOpenRoomModal}
          />
        ) : (
          <Overview building={building} activeFloorId={floorId} onSelectFloor={selectFloor} onSelectRoom={selectRoom} onEditBuilding={onEditBuilding} />
        )}
      </div>
    </div>
  );
}
