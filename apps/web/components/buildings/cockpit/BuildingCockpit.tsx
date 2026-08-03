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
  CheckCircle2,
  DollarSign,
  FileWarning,
  ImageIcon,
  Layers3,
  MapPin,
  Pencil,
  RefreshCw,
  Users,
} from "lucide-react";
import type { Building } from "../building.types";
import {
  createCockpitBuildingSpec,
  findRoomFloor,
  resolveFloorSpec,
  resolveRoomSpec,
} from "./building-cockpit-data";
import { normalizeBuildingCode } from "./building-template-registry";
import { buildingTemplateRegistry } from "./building-template-registry";
import type { CockpitBuildingSpec, CockpitFloorId, CockpitFloorSpec, CockpitRoomSpec } from "./building-cockpit.types";
import { formatVnd, getBuildingMetrics, getFloorOccupancy, getStatusLabel, getStatusTone } from "./building-cockpit-metrics";
import { overviewFloorHotspots } from "./building-image-maps";
import FloorPlanCanvas from "./FloorPlanCanvas";
import RoomInspectorDrawer from "./RoomInspectorDrawer";
import BuildingSwitcher from "./BuildingSwitcher";
import UnifiedBuildingCockpit from "./UnifiedBuildingCockpit";

interface BuildingCockpitProps {
  buildings: Building[];
  onAddBuilding?: () => void;
  onEditBuilding?: (buildingCode: string) => void;
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
          <p className="truncate text-[12px] font-bold text-slate-500" title={label}>{label}</p>
          <strong className={cx("block whitespace-nowrap font-black tracking-tight text-slate-950", compact ? "mt-1 text-[17px]" : "mt-1 text-[18px]")}>{value}</strong>
          <span className="mt-0.5 block truncate text-[12px] font-semibold text-slate-500" title={hint}>{hint}</span>
        </div>
      </div>
    </article>
  );
}

function FloorLabelRail({ floors, activeFloorId, onSelectFloor, onHoverFloor }: { floors: CockpitFloorSpec[]; activeFloorId: string | null; onSelectFloor: (floorId: CockpitFloorId) => void; onHoverFloor: (floorId: CockpitFloorId | null) => void }) {
  const ordered = [...floors].reverse();
  return (
    <div className="pointer-events-none absolute inset-y-0 left-3 z-30 hidden w-[130px] xl:block 2xl:left-5">
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
            "pointer-events-auto absolute left-0 flex min-h-[62px] w-[124px] -translate-y-1/2 flex-col justify-center rounded-[12px] border bg-card/95 px-3 text-left shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur transition-[border-color,background-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none",
            activeFloorId === floor.id ? "border-[#0ea5e9]/50 bg-sky-500/5 text-[#0ea5e9]" : "border-border/40 dark:border-white/5 text-text hover:border-[#0ea5e9]/35 hover:bg-sky-500/5",
          )}
          style={{ top: `${12 + index * 25.5}%` }}
          aria-label={`Mở ${floor.label}`}
        >
          <span className="flex items-center justify-between gap-2 text-[13px] font-black"><span>{floor.label}</span><span className="h-2 w-2 rounded-full bg-[#0ea5e9]" /></span>
          <span className="mt-1 text-[11px] font-bold text-muted">{floor.rooms.length} phòng · {getFloorOccupancy(floor)}% lấp đầy</span>
          <span className="absolute left-full top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#0ea5e9] shadow-[0_0_0_3px_rgba(14,165,233,0.08)]" />
          <span className="absolute left-[calc(100%+8px)] top-1/2 w-6 border-t border-[#0ea5e9]/35" />
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
    <div className="relative mx-auto h-[90%] max-h-full w-auto max-w-full shrink-0 select-none" style={{ aspectRatio: `${building.overviewImage.width} / ${building.overviewImage.height}`, transform: "translateX(14px)" }}>
      <Image
        src={building.overviewImage.src}
        alt={`Ảnh render kiến trúc tách tầng của tòa nhà ${building.code}`}
        width={building.overviewImage.width}
        height={building.overviewImage.height}
        sizes="(max-width: 1280px) 52vw, 650px"
        className="block h-full w-auto max-w-full object-contain drop-shadow-[0_24px_32px_rgba(15,23,42,0.12)] select-none"
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
            <Image src={building.overviewImage.src} alt="" aria-hidden fill sizes="(max-width: 1280px) 52vw, 650px" className="h-full w-full object-contain select-none" draggable={false} />
          </button>
        );
      })}
      <svg viewBox={`0 0 ${building.overviewImage.width} ${building.overviewImage.height}`} className="pointer-events-none absolute inset-0 h-full w-full select-none" aria-hidden>
        {ordered.map((floor) => (
          <polygon
            key={floor.id}
            points={overviewFloorHotspots[floor.id]}
            fill={floor.id === activeFloorId ? "rgba(14,165,233,0.07)" : "transparent"}
            stroke={floor.id === activeFloorId ? "#0ea5e9" : "transparent"}
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
  const occupiedRooms = floor.rooms.filter((room) => room.status === "occupied").length;
  const occupants = floor.rooms.reduce((sum, room) => sum + room.occupants, 0);
  const capacity = floor.rooms.reduce((sum, room) => sum + room.capacity, 0);
  return (
    <article
      className={cx("relative flex min-h-[112px] flex-col overflow-hidden rounded-[14px] border bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.045)] transition-[border-color,background-color,box-shadow] duration-200", active ? "border-[#5b35f5]/55 bg-[#faf9ff] shadow-[0_12px_30px_rgba(91,53,245,0.10)]" : "border-[#e8e7f3] hover:border-[#5b35f5]/30")}
      onMouseEnter={() => onHoverFloor(floor.id)}
      onMouseLeave={() => onHoverFloor(null)}
    >
      <button type="button" onClick={() => onSelectFloor(floor.id)} className="mb-1.5 flex w-full items-center gap-2 text-left focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">
        <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#5b35f5]/10 text-[#5b35f5]"><Building2 size={15} /></span>
        <strong className="text-[15px] font-black text-slate-950">{floor.label}</strong>
        <span className="ml-auto text-[12px] font-bold tabular-nums text-slate-500">{occupiedRooms}/{floor.rooms.length} đã thuê</span>
      </button>
      <div className="space-y-1">
        {floor.rooms.map((room) => {
          const tone = getStatusTone(room.status);
          return (
            <button key={room.code} type="button" onClick={() => onSelectRoom(floor.id, room)} className="flex min-h-6 w-full items-center gap-2 rounded-lg px-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: tone.dot }} />
              <span className="text-[13px] font-black text-slate-950">{room.code}</span>
              <span className="truncate text-[12px] font-semibold text-slate-500" title={room.type}>{room.type}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-auto flex items-center gap-3 border-t border-[#ececf6] pt-1.5 text-[12px] leading-4 font-bold text-slate-500">
        <span>{floor.rooms.length} phòng · {getFloorOccupancy(floor)}% lấp đầy</span>
        <span className="ml-auto tabular-nums">Công suất {occupants}/{capacity}</span>
      </div>
    </article>
  );
}

function BuildingSummaryPanel({ building }: { building: CockpitBuildingSpec }) {
  const metrics = getBuildingMetrics(building);
  const hasAlerts = metrics.expiringContracts + metrics.incompleteTemporaryResidence + metrics.overduePayments > 0;
  return (
    <aside className="hidden h-fit max-h-full self-start overflow-hidden rounded-[16px] border border-[#e8e7f3] bg-white shadow-[0_14px_40px_rgba(15,23,42,0.06)] xl:flex xl:flex-col">
      <section className="p-4">
        <h3 className="mb-2 text-[13px] font-black uppercase tracking-wide text-slate-950">Tổng quan tòa nhà</h3>
        <div className="space-y-2 text-[12px]">
          <div className="flex justify-between"><span className="text-slate-500">Tổng phòng</span><strong>{metrics.totalRooms} phòng</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">Tổng số người</span><strong>{metrics.residentCount} người</strong></div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-slate-500">Tỷ lệ lấp đầy</span><strong>{metrics.occupancyRate}%</strong></div>
            <div className="h-2 rounded-full bg-[#eeeafb]"><div className="h-full rounded-full bg-[#5b35f5]" style={{ width: `${metrics.occupancyRate}%` }} /></div>
          </div>
          <div className="flex justify-between"><span className="text-slate-500">Doanh thu tháng 5</span><strong>{formatVnd(metrics.monthlyRevenue)}</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">Doanh thu dự kiến năm</span><strong>{formatVnd(metrics.yearlyRevenue)}</strong></div>
          <div className="flex justify-between"><span className="text-slate-500">Tiền đặt cọc</span><strong className="text-sky-600">{formatVnd(metrics.depositTotal)}</strong></div>
        </div>
      </section>

      <section className="border-t border-[#ececf6] p-4">
        <h3 className="mb-2 text-[13px] font-black uppercase tracking-wide text-slate-950">Cảnh báo nổi bật</h3>
        {hasAlerts ? <div className="space-y-1.5">
          {metrics.expiringContracts > 0 && <div className="cockpit-alert-warning flex items-center justify-between rounded-lg border px-2.5 py-2 text-[11px] font-bold text-slate-600"><span className="flex items-center gap-2"><AlertCircle size={14} className="text-orange-500" />Hợp đồng sắp hết hạn</span><b className="text-orange-600">{metrics.expiringContracts}</b></div>}
          {metrics.incompleteTemporaryResidence > 0 && <div className="cockpit-alert-danger flex items-center justify-between rounded-lg border px-2.5 py-2 text-[11px] font-bold text-slate-600"><span className="flex items-center gap-2"><FileWarning size={14} className="text-rose-500" />Chưa khai báo tạm trú</span><b className="text-rose-500">{metrics.incompleteTemporaryResidence}</b></div>}
          {metrics.overduePayments > 0 && <div className="cockpit-alert-warning flex items-center justify-between rounded-lg border px-2.5 py-2 text-[11px] font-bold text-slate-600"><span className="flex items-center gap-2"><DollarSign size={14} className="text-orange-500" />Thanh toán quá hạn</span><b className="text-orange-600">{metrics.overduePayments}</b></div>}
        </div> : <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/8 px-3 py-3 text-[12px] font-bold text-emerald-700"><CheckCircle2 size={17} className="shrink-0" />Không có cảnh báo cần xử lý</div>}
      </section>

      <section className="min-h-0 border-t border-[#ececf6] p-4">
        <h3 className="mb-1 text-[13px] font-black uppercase tracking-wide text-slate-950">Chỉ số tầng</h3>
        <div className="space-y-1">
          {[...building.floors].reverse().map((floor) => (
            <div key={floor.id} className="grid grid-cols-[1fr_auto_34px] items-center gap-2 rounded-lg px-1.5 py-1.5 text-[11px] font-bold text-slate-500">
              <span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-slate-400" />{floor.label}</span>
              <span>{floor.rooms.filter((room) => room.status === "occupied").length}/{floor.rooms.length} phòng</span>
              <span className="text-emerald-600">{getFloorOccupancy(floor)}%</span>
            </div>
          ))}
        </div>
      </section>
      <p className="flex items-center justify-between border-t border-[#ececf6] px-4 py-3 text-[12px] font-semibold text-slate-500"><span>Cập nhật lần cuối</span><span className="flex items-center gap-2 tabular-nums">{building.updatedAtLabel}<RefreshCw size={13} /></span></p>
    </aside>
  );
}

function Overview({
  building,
  buildings,
  activeFloorId,
  onSelectFloor,
  onSelectRoom,
  onEditBuilding,
  onSwitchBuilding,
}: {
  building: CockpitBuildingSpec;
  buildings: Building[];
  activeFloorId: string | null;
  onSelectFloor: (floorId: CockpitFloorId) => void;
  onSelectRoom: (floorId: CockpitFloorId, room: CockpitRoomSpec) => void;
  onEditBuilding?: () => void;
  onSwitchBuilding: (code: string) => void;
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
        <div className="flex items-center gap-2">
          <BuildingSwitcher buildings={buildings} activeCode={building.code} onSelect={onSwitchBuilding} />
          <button type="button" onClick={onEditBuilding} className="flex min-h-11 items-center gap-2 rounded-xl border border-[#e5e4f1] bg-white px-4 text-[13px] font-black text-slate-950 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]"><Pencil size={15} />Chỉnh sửa tòa nhà</button>
          <button type="button" className="flex min-h-11 items-center gap-2 rounded-xl bg-[#5b35f5] px-4 text-[13px] font-black text-white transition-colors hover:bg-[#4b28db] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">Thao tác nhanh <ChevronDown size={15} /></button>
        </div>
      </div>

      {building.layoutStatus === "pending" ? (
        <section className="flex min-h-0 flex-1 items-center justify-center rounded-[18px] border border-dashed border-border p-8 text-center bg-[radial-gradient(circle_at_50%_30%,#ffffff_0%,#f8fafc_62%,#eef2f7_100%)]">
          <div className="max-w-md">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Layers3 size={32} /></span>
            <h2 className="mt-5 text-2xl font-black text-text uppercase tracking-wider">Coming Soon</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-muted">Mặt bằng của {building.code} đang được thiết lập và sẽ sớm ra mắt.</p>
          </div>
        </section>
      ) : (
      <>

      <div className="mb-2 grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={<DollarSign size={18} />} label="Doanh thu tháng 5" value={formatVnd(metrics.monthlyRevenue)} hint={metrics.monthlyRevenue > 0 ? "Doanh thu đã ghi nhận" : "Chưa ghi nhận doanh thu"} />
        <StatCard icon={<ClipboardCheck size={18} />} label="Phòng đã thuê" value={`${metrics.occupiedRooms} / ${metrics.totalRooms}`} hint={`${metrics.occupancyRate}% lấp đầy`} tone="green" />
        <StatCard icon={<Users size={18} />} label="Phòng trống" value={`${metrics.vacantRooms} / ${metrics.totalRooms}`} hint={`${metrics.vacantRooms} phòng có thể khai thác`} tone="slate" />
        <StatCard icon={<CalendarDays size={18} />} label="HĐ sắp hết hạn" value={`${metrics.expiringContracts}`} hint="Trong 30 ngày tới" tone="orange" />
        <StatCard icon={<ClipboardCheck size={18} />} label="Khai báo tạm trú" value={`${metrics.temporaryResidenceRate}%`} hint={metrics.occupiedRooms > 0 ? `${metrics.declaredTemporaryResidence} / ${metrics.occupiedRooms} phòng đang thuê` : "Chưa có phòng đang thuê"} tone="blue" />
      </div>

      <div className="grid min-h-0 flex-1 items-stretch gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(250px,290px)_minmax(250px,300px)]">
        <main className="relative h-full min-h-[560px] min-w-0 overflow-hidden rounded-[16px] xl:min-h-0">
            <div className="relative flex h-full min-h-0 items-center justify-center overflow-hidden rounded-[16px] border border-border shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] bg-[radial-gradient(circle_at_50%_30%,#ffffff_0%,#f8fafc_62%,#eef2f7_100%)] select-none">
              <FloorLabelRail floors={building.floors} activeFloorId={highlightedFloorId} onSelectFloor={onSelectFloor} onHoverFloor={setHoveredFloorId} />
              <ExplodedBuildingImageStack building={building} activeFloorId={highlightedFloorId} onSelectFloor={onSelectFloor} onHoverFloor={setHoveredFloorId} />
              <div className="absolute inset-x-4 bottom-3 z-30 mx-auto flex min-h-8 max-w-[620px] flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-xl border border-border bg-card/92 px-3 text-[10px] font-bold text-muted shadow-sm backdrop-blur">
                <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Đã thuê</span>
                <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-slate-400" />Trống</span>
                <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-orange-500" />HĐ sắp hết hạn</span>
                <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-rose-500" />Cảnh báo</span>
                <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-sky-500" />Khai báo chưa đầy đủ</span>
              </div>
            </div>
        </main>
        <section aria-label="Vận hành theo tầng" className="flex min-h-0 flex-col gap-2.5 overflow-y-auto pr-0.5">
          {[...building.floors].reverse().map((floor) => (
            <FloorSummaryCard key={floor.id} floor={floor} active={highlightedFloorId === floor.id} onSelectFloor={onSelectFloor} onSelectRoom={onSelectRoom} onHoverFloor={setHoveredFloorId} />
          ))}
        </section>
        <BuildingSummaryPanel building={building} />
      </div>
      </>
      )}
    </div>
  );
}

function FloorWorkspace({
  building,
  buildings,
  floor,
  room,
  debugMode,
  onSelectFloor,
  onSelectRoom,
  onCloseRoom,
  onOpenRoomModal,
  onSwitchBuilding,
}: {
  building: CockpitBuildingSpec;
  buildings: Building[];
  floor: CockpitFloorSpec;
  room: CockpitRoomSpec | null;
  debugMode: boolean;
  onSelectFloor: (floorId: CockpitFloorId | null) => void;
  onSelectRoom: (room: CockpitRoomSpec) => void;
  onCloseRoom: () => void;
  onOpenRoomModal?: (roomId: string, tab?: string) => void;
  onSwitchBuilding: (code: string) => void;
}) {
  const occupiedRooms = floor.rooms.filter((item) => item.status === "occupied").length;
  const occupants = floor.rooms.reduce((sum, item) => sum + item.occupants, 0);
  const capacity = floor.rooms.reduce((sum, item) => sum + item.capacity, 0);
  const floorRevenue = floor.rooms.reduce((sum, item) => sum + (item.monthlyRent || 0), 0);
  return (
    <div className={cx("grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(336px,372px)]", room ? "items-stretch" : "items-start", debugMode && "overflow-y-auto")}>
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
          <div className="flex items-center gap-2">
            <BuildingSwitcher buildings={buildings} activeCode={building.code} onSelect={onSwitchBuilding} />
            <button type="button" className="flex min-h-11 items-center gap-2 rounded-xl bg-[#5b35f5] px-4 text-[13px] font-black text-white transition-colors hover:bg-[#4b28db] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5]">Thao tác nhanh <ChevronDown size={15} /></button>
          </div>
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />Đã thuê</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-slate-400" />Trống</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-orange-500" />HĐ sắp hết hạn</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-rose-500" />Cảnh báo</span>
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <FloorPlanCanvas floor={floor} selectedRoomCode={room?.urlCode || null} onSelectRoom={onSelectRoom} debugMode={debugMode} />
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
        <aside className="hidden h-fit overflow-hidden rounded-[16px] border border-[#e8e7f3] bg-white shadow-sm xl:block" aria-label={`Vận hành ${floor.label}`}>
          <div className="border-b border-[#ececf6] p-4">
            <h2 className="text-[16px] font-black text-slate-950">Vận hành {floor.label}</h2>
            <p className="mt-1 text-[12px] font-semibold text-slate-500">Tổng quan và danh sách phòng</p>
          </div>
          <section className="border-b border-[#ececf6] p-4">
            <h3 className="mb-3 text-[12px] font-black uppercase tracking-wide text-slate-950">Tổng quan tầng</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[12px] font-semibold text-slate-500">Phòng đã thuê</span><strong className="mt-1 block text-[17px] tabular-nums text-slate-950">{occupiedRooms}/{floor.rooms.length}</strong></div>
              <div className="rounded-xl bg-slate-50 p-3"><span className="block text-[12px] font-semibold text-slate-500">Công suất</span><strong className="mt-1 block text-[17px] tabular-nums text-slate-950">{occupants}/{capacity}</strong></div>
              <div className="col-span-2 rounded-xl bg-slate-50 p-3"><span className="block text-[12px] font-semibold text-slate-500">Doanh thu tầng</span><strong className="mt-1 block text-[17px] tabular-nums text-slate-950">{floorRevenue > 0 ? formatVnd(floorRevenue) : "—"}</strong><small className="text-[12px] font-semibold text-slate-500">{floorRevenue > 0 ? "Theo giá thuê đã cấu hình" : "Chưa ghi nhận doanh thu"}</small></div>
            </div>
          </section>
          <section className="p-4">
            <h3 className="mb-3 text-[12px] font-black uppercase tracking-wide text-slate-950">Danh sách phòng</h3>
            <div className="space-y-2">
            {floor.rooms.map((item) => {
              const tone = getStatusTone(item.status);
              return (
                <button key={item.code} type="button" onClick={() => onSelectRoom(item)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border border-[#ececf6] p-3 text-left transition-colors duration-200 hover:border-[#5b35f5]/30 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b35f5] motion-reduce:transition-none">
                  <span className="min-w-0"><b className="block text-[13px] text-slate-950">{item.code}</b><small className="mt-0.5 block truncate text-[12px] font-bold text-slate-500" title={item.type}>{item.type}</small><small className="mt-1 block text-[12px] font-semibold text-slate-500">Công suất {item.occupants}/{item.capacity}</small></span>
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: tone.bg, color: tone.text }}>{getStatusLabel(item.status)}</span>
                </button>
              );
            })}
            </div>
          </section>
        </aside>
      )}
    </div>
  );
}

export default function BuildingCockpit({ buildings, onAddBuilding, onEditBuilding, onOpenRoomModal }: BuildingCockpitProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pathCode = pathname.split("/buildings/")[1]?.split("/")[0];
  const [activeBuildingCode, setActiveBuildingCode] = useState(() => normalizeBuildingCode(pathCode || "LK01-31"));

  const [activeFloorId, setActiveFloorId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("floor") || "2";
    }
    return searchParams.get("floor") || "2";
  });

  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("room");
    }
    return searchParams.get("room");
  });

  // Sync with browser back/forward buttons (history popstate)
  useEffect(() => {
    const handlePopState = () => {
      const pathCode = window.location.pathname.split("/buildings/")[1]?.split("/")[0];
      const params = new URLSearchParams(window.location.search);
      if (pathCode) setActiveBuildingCode(normalizeBuildingCode(pathCode));
      setActiveFloorId(params.get("floor") || "2");
      setActiveRoomCode(params.get("room"));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Sync state if pathname/searchParams from props change initially
  useEffect(() => {
    if (pathCode) {
      setActiveBuildingCode(normalizeBuildingCode(pathCode));
    }
  }, [pathCode]);

  const requestedCode = activeBuildingCode;
  const allowFixtureFallback = process.env.NODE_ENV !== "production" && buildings.length === 0 && requestedCode === "LK01-31";
  const building = useMemo(() => createCockpitBuildingSpec(buildings, requestedCode, allowFixtureFallback), [allowFixtureFallback, buildings, requestedCode]);
  const portfolioBuildings = useMemo(() => {
    const resolved = buildingTemplateRegistry
      .map((descriptor) => createCockpitBuildingSpec(buildings, descriptor.code, false))
      .filter((item): item is CockpitBuildingSpec => Boolean(item));
    if (building && !resolved.some((item) => item.code === building.code)) resolved.unshift(building);
    return resolved;
  }, [building, buildings]);

  const debugMode = process.env.NODE_ENV !== "production" && searchParams.get("debugHotspots") === "1";

  // Resolve active floor and room
  const roomFloorMatch = building && activeRoomCode ? findRoomFloor(building, activeRoomCode) : null;
  const displayedFloorId = activeFloorId || roomFloorMatch?.floor.id || "2";
  const floor = building ? resolveFloorSpec(building, displayedFloorId) || building.floors[0] || null : null;
  const room = building && floor ? resolveRoomSpec(building, floor.id, activeRoomCode) : null;

  // Quietly update URL in browser history without triggering dynamic router reload
  const updateUrlQuietly = useCallback((buildingCode: string, floorId: string, roomCode: string | null) => {
    const params = new URLSearchParams(window.location.search);
    params.set("floor", floorId);
    if (roomCode) {
      params.set("room", roomCode);
    } else {
      params.delete("room");
    }
    params.delete("space");
    params.delete("viewMode");
    const query = params.toString();
    window.history.pushState(null, "", `/buildings/${buildingCode}${query ? `?${query}` : ""}`);
  }, []);

  const selectFloor = useCallback((nextFloorId: CockpitFloorId | null) => {
    const fId = nextFloorId || "2";
    setActiveFloorId(fId);
    setActiveRoomCode(null);
    updateUrlQuietly(activeBuildingCode, fId, null);
  }, [activeBuildingCode, updateUrlQuietly]);

  const selectRoom = useCallback((nextFloorId: CockpitFloorId, nextRoom: CockpitRoomSpec) => {
    setActiveFloorId(nextFloorId);
    setActiveRoomCode(nextRoom.urlCode);
    updateUrlQuietly(activeBuildingCode, nextFloorId, nextRoom.urlCode);
  }, [activeBuildingCode, updateUrlQuietly]);

  const selectCurrentFloorRoom = useCallback((nextRoom: CockpitRoomSpec) => {
    setActiveFloorId(nextRoom.floorId);
    setActiveRoomCode(nextRoom.urlCode);
    updateUrlQuietly(activeBuildingCode, nextRoom.floorId, nextRoom.urlCode);
  }, [activeBuildingCode, updateUrlQuietly]);

  const closeRoom = useCallback(() => {
    setActiveRoomCode(null);
    updateUrlQuietly(activeBuildingCode, activeFloorId, null);
  }, [activeBuildingCode, activeFloorId, updateUrlQuietly]);

  const switchBuilding = useCallback((code: string) => {
    const normalized = normalizeBuildingCode(code);
    setActiveBuildingCode(normalized);
    setActiveFloorId("2");
    setActiveRoomCode(null);
    window.history.pushState(null, "", `/buildings/${normalized}`);
  }, []);

  if (!building) {
    return (
      <div data-testid="empty-buildings-state" className="rounded-[16px] border border-dashed border-[#e8e7f3] bg-white p-10 text-center text-sm font-bold text-slate-500">
        Không tìm thấy tòa nhà {requestedCode} trong dữ liệu hiện tại.
      </div>
    );
  }

  return (
    <div className="building-cockpit-theme min-h-[calc(100vh-80px)] w-full min-w-0 bg-background p-3 text-text lg:p-4">
      <div className="min-h-0 w-full min-w-0">
        <UnifiedBuildingCockpit
          building={building}
          portfolioBuildings={portfolioBuildings}
          floor={floor}
          room={room}
          debugMode={debugMode}
          onSelectBuilding={switchBuilding}
          onSelectFloor={selectFloor}
          onSelectRoom={selectCurrentFloorRoom}
          onCloseRoom={closeRoom}
          onAddBuilding={onAddBuilding}
          onEditBuilding={onEditBuilding}
          onOpenRoomModal={onOpenRoomModal}
        />
      </div>
    </div>
  );
}
