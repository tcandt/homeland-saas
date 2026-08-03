"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Layers3,
  MapPin,
  Pencil,
} from "lucide-react";
import type {
  CockpitBuildingSpec,
  CockpitFloorId,
  CockpitFloorSpec,
  CockpitRoomSpec,
} from "./building-cockpit.types";
import {
  formatVnd,
  getFloorOccupancy,
  getStatusLabel,
  getStatusTone,
} from "./building-cockpit-metrics";
import { overviewFloorHotspots } from "./building-image-maps";
import BuildingPortfolioRail from "./BuildingPortfolioRail";
import FloorPlanCanvas from "./FloorPlanCanvas";
import FloorRoomTable from "./FloorRoomTable";
import PortfolioKpiBar from "./PortfolioKpiBar";
import RoomInspectorDrawer from "./RoomInspectorDrawer";

interface UnifiedBuildingCockpitProps {
  building: CockpitBuildingSpec;
  portfolioBuildings: readonly CockpitBuildingSpec[];
  floor: CockpitFloorSpec | null;
  room: CockpitRoomSpec | null;
  debugMode: boolean;
  onSelectBuilding: (code: string) => void;
  onSelectFloor: (floorId: CockpitFloorId) => void;
  onSelectRoom: (room: CockpitRoomSpec) => void;
  onCloseRoom: () => void;
  onAddBuilding?: () => void;
  onEditBuilding?: (buildingCode: string) => void;
  onOpenRoomModal?: (roomId: string, tab?: string) => void;
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function StatusLegend() {
  const items = [
    ["Đã thuê", "bg-emerald-500"],
    ["Trống", "bg-slate-400"],
    ["HĐ sắp hết hạn", "bg-orange-500"],
    ["Cảnh báo", "bg-rose-500"],
    ["Khai báo chưa đầy đủ", "bg-sky-500"],
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-muted" aria-label="Chú giải trạng thái phòng">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-1.5 whitespace-nowrap">
          <i className={cx("h-2 w-2 rounded-full", color)} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}



function getOverviewRoomPoints(floorId: string, side: "left" | "right"): string | null {
  const rawPoints = overviewFloorHotspots[floorId as CockpitFloorId];
  if (!rawPoints) return null;
  const coords = rawPoints.split(/\s+/).map((pair: string) => {
    const [x, y] = pair.split(",").map(Number);
    return { x, y };
  });
  if (coords.length < 4) return null;
  const [A, B, C, D] = coords;

  const getPoint = (u: number, v: number) => {
    const x = (1 - v) * ((1 - u) * A.x + u * B.x) + v * ((1 - u) * D.x + u * C.x);
    const y = (1 - v) * ((1 - u) * A.y + u * B.y) + v * ((1 - u) * D.y + u * C.y);
    return { x, y };
  };

  if (side === "left") {
    const c1 = getPoint(0.02, 0.08);
    const c2 = getPoint(0.50, 0.08);
    const c3 = getPoint(0.56, 0.90);
    const c4 = getPoint(0.02, 0.90);
    return `${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${c3.x.toFixed(1)},${c3.y.toFixed(1)} ${c4.x.toFixed(1)},${c4.y.toFixed(1)}`;
  } else {
    const c1 = getPoint(0.76, 0.08);
    const c2 = getPoint(0.98, 0.08);
    const c3 = getPoint(0.98, 0.90);
    const c4 = getPoint(0.655, 0.90);
    return `${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${c3.x.toFixed(1)},${c3.y.toFixed(1)} ${c4.x.toFixed(1)},${c4.y.toFixed(1)}`;
  }
}

function getOverviewRoomSpec(floor: CockpitFloorSpec, side: "left" | "right"): CockpitRoomSpec | undefined {
  if (floor.id === "ground") {
    return side === "right" ? floor.rooms[0] : undefined;
  }
  if (floor.id === "1") {
    return side === "left" ? floor.rooms[0] : floor.rooms[1];
  }
  if (floor.id === "2") {
    return side === "left" ? floor.rooms[0] : floor.rooms[1];
  }
  if (floor.id === "3") {
    return side === "left" ? floor.rooms[0] : floor.rooms[1];
  }
  return undefined;
}

function getOverviewStatusColor(status: string) {
  switch (status) {
    case "occupied":
      return {
        fill: "rgba(34, 197, 94, 0.32)",
        stroke: "rgba(34, 197, 94, 0.75)",
        strokeActive: "#22c55e",
      };
    case "expiring_soon":
      return {
        fill: "rgba(249, 115, 22, 0.32)",
        stroke: "rgba(249, 115, 22, 0.75)",
        strokeActive: "#f97316",
      };
    case "deposited":
      return {
        fill: "rgba(14, 165, 233, 0.32)",
        stroke: "rgba(14, 165, 233, 0.75)",
        strokeActive: "#0ea5e9",
      };
    case "maintenance":
      return {
        fill: "rgba(239, 68, 68, 0.32)",
        stroke: "rgba(239, 68, 68, 0.75)",
        strokeActive: "#ef4444",
      };
    default:
      return {
        fill: "rgba(148, 163, 184, 0.18)",
        stroke: "rgba(148, 163, 184, 0.55)",
        strokeActive: "#64748b",
      };
  }
}

function BuildingModelViewer({
  building,
  floor,
  activeRoomId,
  onSelectFloor,
  onEditBuilding,
}: {
  building: CockpitBuildingSpec;
  floor: CockpitFloorSpec;
  activeRoomId?: string | null;
  onSelectFloor: (floorId: CockpitFloorId) => void;
  onEditBuilding?: (buildingCode: string) => void;
}) {
  const orderedFloors = useMemo(() => [...building.floors].reverse(), [building.floors]);
  const [hoveredFloorId, setHoveredFloorId] = useState<CockpitFloorId | null>(null);
  const activeFloorId = hoveredFloorId || floor.id;

  return (
    <article data-testid="building-model-viewer" className="min-w-0 overflow-hidden rounded-2xl border border-border/40 dark:border-white/5 bg-card shadow-[0_16px_36px_rgb(var(--shadow-color)/0.075)]">
      <header className="flex min-h-[60px] items-start justify-between gap-3 border-b border-border/20 dark:border-white/5 px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-[18px] font-black tracking-tight text-text">{building.code}</h2>
            <span className="shrink-0 rounded-full bg-success/10 px-2 py-1 text-[12px] font-bold text-success">{building.statusLabel}</span>
          </div>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-muted">
            <MapPin size={14} className="shrink-0 text-danger" aria-hidden />
            <span className="truncate" title={building.address}>{building.address}</span>
          </p>
        </div>
        {onEditBuilding && (
          <button
            type="button"
            onClick={() => onEditBuilding(building.code)}
            aria-label={`Chỉnh sửa tòa nhà ${building.code}`}
            title="Chỉnh sửa tòa nhà"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border/40 dark:border-white/5 text-muted transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Pencil size={15} aria-hidden />
          </button>
        )}
      </header>

      <div className="relative h-[470px] overflow-hidden border-y border-border/20 dark:border-white/5 bg-[radial-gradient(circle_at_50%_30%,#ffffff_0%,#f8fafc_62%,#eef2f7_100%)] min-[1366px]:h-[585px] select-none">
        <div className="pointer-events-none absolute inset-y-0 left-2 z-20 w-[88px] min-[1366px]:left-2.5">
          {orderedFloors.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={activeFloorId === item.id}
              onClick={() => onSelectFloor(item.id)}
              onMouseEnter={() => setHoveredFloorId(item.id)}
              onMouseLeave={() => setHoveredFloorId(null)}
              onFocus={() => setHoveredFloorId(item.id)}
              onBlur={() => setHoveredFloorId(null)}
              className={cx(
                "pointer-events-auto absolute left-0 w-[84px] -translate-y-1/2 rounded-[10px] border px-2.5 py-2 text-left shadow-[0_10px_22px_rgb(var(--shadow-color)/0.08)] backdrop-blur transition-[border-color,background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0ea5e9] motion-reduce:transition-none",
                activeFloorId === item.id ? "border-2 border-[#0ea5e9] bg-[#0ea5e9]/[0.08] text-[#0ea5e9] shadow-[0_12px_26px_rgba(14,165,233,0.18)]" : "border border-border dark:border-white/10 bg-card text-text hover:border-[#0ea5e9]/40 hover:bg-[#0ea5e9]/[0.035]",
              )}
              style={{ top: `${11 + index * 26}%` }}
            >
              <strong className="block text-[12px] font-black">{item.label}</strong>
              <span className="mt-0.5 block text-[12px] font-semibold text-muted">{item.rooms.length} phòng</span>
              <i className={cx("absolute left-full top-1/2 w-5 border-t transition-colors", activeFloorId === item.id ? "border-[#0ea5e9] border-solid" : "border-border/30 border-dashed dark:border-white/10")} aria-hidden />
            </button>
          ))}
        </div>

        <div className="absolute inset-2 left-[64px] flex items-center justify-center min-[1366px]:left-[58px]">
          <div
            className="relative h-[96%] max-w-full origin-center"
            style={{ aspectRatio: `${building.overviewImage.width} / ${building.overviewImage.height}` }}
          >
            <Image
              src={building.overviewImage.src}
              alt={`Ảnh render kiến trúc tách tầng của tòa nhà ${building.code}`}
              width={building.overviewImage.width}
              height={building.overviewImage.height}
              sizes="(max-width: 1365px) 45vw, 560px"
              className="h-full w-full object-contain drop-shadow-[0_20px_28px_rgba(15,23,42,0.13)] select-none"
              draggable={false}
              priority
            />
            <svg
              viewBox={`0 0 ${building.overviewImage.width} ${building.overviewImage.height}`}
              className="absolute inset-0 h-full w-full pointer-events-none select-none"
              aria-label={`Chọn tầng của tòa nhà ${building.code}`}
            >
              {/* Vertical line connecting the buttons */}
              <line
                x1={40}
                y1={163}
                x2={40}
                y2={1322}
                stroke="rgba(148,163,184,0.25)"
                strokeWidth={1.5}
                strokeDasharray="4,4"
              />
              {/* Guidelines pointing to slabs */}
              {[
                { id: "3", buttonY: 163, target: { x: 300, y: 350 } },
                { id: "2", buttonY: 550, target: { x: 310, y: 720 } },
                { id: "1", buttonY: 936, target: { x: 310, y: 1090 } },
                { id: "ground", buttonY: 1322, target: { x: 310, y: 1430 } },
              ].map((geom) => {
                const active = activeFloorId === geom.id;
                const hovered = hoveredFloorId === geom.id;
                return (
                  <g key={`guide-line-${geom.id}`} className="pointer-events-none">
                    <line
                      x1={40}
                      y1={geom.buttonY}
                      x2={geom.target.x}
                      y2={geom.target.y}
                      stroke={active ? "#0ea5e9" : hovered ? "rgba(14,165,233,0.6)" : "rgba(148,163,184,0.35)"}
                      strokeWidth={active ? 3.5 : 1.75}
                      strokeDasharray={active ? "none" : "4,4"}
                      className="transition-all duration-300"
                    />
                    <circle
                      cx={geom.target.x}
                      cy={geom.target.y}
                      r={active ? 6 : hovered ? 4.5 : 2.5}
                      fill={active ? "#0ea5e9" : hovered ? "rgba(14,165,233,0.8)" : "rgba(148,163,184,0.6)"}
                      stroke={active ? "#ffffff" : "transparent"}
                      strokeWidth={active ? 1.5 : 0}
                      className="transition-all duration-300"
                    />
                  </g>
                );
              })}
              {/* Room highlights on the 3D overview */}
              {orderedFloors.map((floorItem) => {
                return (
                  <g key={`room-highlights-${floorItem.id}`} className="pointer-events-none">
                    {(["left", "right"] as const).map((side) => {
                      const roomSpec = getOverviewRoomSpec(floorItem, side);
                      if (!roomSpec) return null;
                      const colors = getOverviewStatusColor(roomSpec.status);
                      const points = getOverviewRoomPoints(floorItem.id, side);
                      if (!points) return null;
                      const selected = activeRoomId === roomSpec.id;
                      return (
                        <polygon
                          key={side}
                          points={points}
                          fill={colors.fill}
                          stroke={selected ? colors.strokeActive : colors.stroke}
                          strokeWidth={selected ? 2.5 : 1.25}
                          vectorEffect="non-scaling-stroke"
                        />
                      );
                    })}
                  </g>
                );
              })}

              {orderedFloors.map((item) => {
                const active = activeFloorId === item.id;
                return (
                  <polygon
                    key={item.id}
                    points={overviewFloorHotspots[item.id]}
                    role="button"
                    tabIndex={0}
                    aria-label={`Mở ${item.label}`}
                    aria-pressed={floor.id === item.id}
                    fill={active ? "rgba(14,165,233,0.075)" : "transparent"}
                    stroke={active ? "#0ea5e9" : "transparent"}
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                    className="cursor-pointer pointer-events-auto outline-none transition-[fill,stroke,filter] duration-200 select-none hover:fill-[rgba(14,165,233,0.055)] focus-visible:stroke-[#0ea5e9] motion-reduce:transition-none"
                    onClick={() => onSelectFloor(item.id)}
                    onMouseEnter={() => setHoveredFloorId(item.id)}
                    onMouseLeave={() => setHoveredFloorId(null)}
                    onFocus={() => setHoveredFloorId(item.id)}
                    onBlur={() => setHoveredFloorId(null)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectFloor(item.id);
                      }
                    }}
                  />
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      <div className="px-3.5 py-2.5"><StatusLegend /></div>
    </article>
  );
}

function FloorInformation({ floor }: { floor: CockpitFloorSpec }) {
  const operationalRooms = floor.rooms.filter((item) => item.sourceRoom);
  const occupiedRooms = operationalRooms.filter((item) => item.status === "occupied" || item.status === "expiring_soon").length;
  const occupants = operationalRooms.reduce((sum, item) => sum + item.occupants, 0);
  const capacity = operationalRooms.reduce((sum, item) => sum + item.capacity, 0);
  const revenue = operationalRooms.reduce((sum, item) => sum + ((item.status === "occupied" || item.status === "expiring_soon") ? item.monthlyRent || 0 : 0), 0);
  const values = [
    ["Phòng đã đồng bộ", `${operationalRooms.length}/${floor.rooms.length}`],
    ["Tỷ lệ lấp đầy", operationalRooms.length ? `${getFloorOccupancy({ ...floor, rooms: operationalRooms })}%` : "—"],
    ["Công suất", operationalRooms.length ? `${occupants}/${capacity}` : "—"],
    ["Doanh thu tầng", operationalRooms.length ? formatVnd(revenue) : "—"],
    ["Chiều cao tầng", `${floor.heightMeters} m`],
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {values.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border/40 dark:border-white/5 bg-surface/60 p-3">
          <span className="text-[12px] font-semibold text-muted">{label}</span>
          <strong className="mt-1 block text-[16px] font-black tabular-nums text-text">{value}</strong>
        </div>
      ))}
    </div>
  );
}

function FloorPlanPanel({
  building,
  floor,
  room,
  debugMode,
  highlightedRoomCode,
  onHighlightRoom,
  onSelectFloor,
  onSelectRoom,
}: {
  building: CockpitBuildingSpec;
  floor: CockpitFloorSpec;
  room: CockpitRoomSpec | null;
  debugMode: boolean;
  highlightedRoomCode: string | null;
  onHighlightRoom: (roomCode: string | null) => void;
  onSelectFloor: (floorId: CockpitFloorId) => void;
  onSelectRoom: (room: CockpitRoomSpec) => void;
}) {
  const [tab, setTab] = useState<"rooms" | "floor">("rooms");
  const panelRef = useRef<HTMLElement>(null);

  return (
    <section ref={panelRef} data-testid="floor-workspace-panel" className="min-w-0 overflow-hidden rounded-2xl border border-border/40 dark:border-white/5 bg-card shadow-[0_16px_36px_rgb(var(--shadow-color)/0.075)]">
      <header className="border-b border-border/20 dark:border-white/5 px-3.5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-primary/10 text-primary"><Layers3 size={16} /></span>
              <div>
                <h2 className="text-[15px] font-black text-text">{floor.label}</h2>
                <p className="text-[12px] font-semibold text-muted">{floor.rooms.length} phòng · {floor.rooms.some((item) => item.sourceRoom) ? `${getFloorOccupancy({ ...floor, rooms: floor.rooms.filter((item) => item.sourceRoom) })}% lấp đầy` : "chưa có dữ liệu vận hành"}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {building.floors.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === floor.id}
                onClick={() => onSelectFloor(item.id)}
                className={cx(
                  "min-h-9 shrink-0 rounded-[10px] px-3 text-[12px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none",
                  item.id === floor.id ? "bg-primary text-white shadow-[0_8px_18px_rgb(var(--shadow-color)/0.12)]" : "border border-border/40 dark:border-white/5 bg-card text-muted hover:bg-primary/5 hover:text-primary",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="p-3">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[12px] font-black uppercase tracking-wide text-text">Sơ đồ mặt bằng {floor.label}</h3>
          <StatusLegend />
        </div>
        <div className="h-[340px] rounded-[14px] bg-surface/45 p-2 min-[1366px]:h-[390px]">
          <FloorPlanCanvas
            floor={floor}
            buildingCode={building.code}
            selectedRoomCode={room?.urlCode || null}
            highlightedRoomCode={highlightedRoomCode}
            onSelectRoom={onSelectRoom}
            onHoverRoom={onHighlightRoom}
            debugMode={debugMode}
          />
        </div>

        <div className="mt-3 border-t border-border/20 dark:border-white/5 pt-3">
          <div className="mb-2.5 flex items-center gap-1.5" role="tablist" aria-label={`Thông tin ${floor.label}`}>
            <button type="button" role="tab" aria-selected={tab === "rooms"} onClick={() => setTab("rooms")} className={cx("min-h-9 rounded-[9px] px-3 text-[12px] font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", tab === "rooms" ? "bg-primary text-white" : "text-muted hover:bg-primary/5 hover:text-primary")}>Danh sách phòng</button>
            <button type="button" role="tab" aria-selected={tab === "floor"} onClick={() => setTab("floor")} className={cx("min-h-9 rounded-[9px] px-3 text-[12px] font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary", tab === "floor" ? "bg-primary text-white" : "text-muted hover:bg-primary/5 hover:text-primary")}>Thông tin tầng</button>
          </div>
          {tab === "rooms" ? (
            <FloorRoomTable
              floor={floor}
              selectedRoomCode={room?.urlCode || null}
              highlightedRoomCode={highlightedRoomCode}
              onSelectRoom={onSelectRoom}
              onHoverRoom={onHighlightRoom}
            />
          ) : <FloorInformation floor={floor} />}
        </div>
      </div>
    </section>
  );
}

function FloorOperationsPanel({ floor, onSelectRoom }: { floor: CockpitFloorSpec; onSelectRoom: (room: CockpitRoomSpec) => void }) {
  const operationalRooms = floor.rooms.filter((item) => item.sourceRoom);
  const occupied = operationalRooms.filter((item) => item.status === "occupied" || item.status === "expiring_soon").length;
  const capacity = operationalRooms.reduce((sum, item) => sum + item.capacity, 0);
  const occupants = operationalRooms.reduce((sum, item) => sum + item.occupants, 0);

  return (
    <aside className="hidden h-fit min-w-0 overflow-hidden rounded-2xl border border-border/40 dark:border-white/5 bg-card shadow-[0_16px_36px_rgb(var(--shadow-color)/0.075)] min-[1366px]:sticky min-[1366px]:top-3 min-[1366px]:block" aria-label={`Thông tin ${floor.label}`}>
      <header className="border-b border-border/20 dark:border-white/5 px-4 py-3.5">
        <h2 className="text-[16px] font-black text-text">Thông tin tầng</h2>
        <p className="mt-1 text-[12px] font-semibold text-muted">{floor.label} · {operationalRooms.length ? `${occupied}/${operationalRooms.length} phòng đã thuê` : "chưa có dữ liệu vận hành"}</p>
      </header>
      <div className="grid grid-cols-2 gap-2 border-b border-border/20 dark:border-white/5 p-3">
        <div className="rounded-xl bg-surface/55 p-2.5">
          <span className="text-[12px] font-semibold text-muted">Công suất</span>
          <strong className="mt-0.5 block text-[17px] font-black tabular-nums text-text">{operationalRooms.length ? `${occupants}/${capacity}` : "—"}</strong>
        </div>
        <div className="rounded-xl bg-primary/[0.055] p-2.5">
          <span className="text-[12px] font-semibold text-muted">Đã thuê</span>
          <strong className="mt-0.5 block text-[17px] font-black tabular-nums text-primary">{operationalRooms.length ? `${occupied}/${operationalRooms.length}` : "—"}</strong>
        </div>
      </div>
      <div className="space-y-2.5 p-3">
        {floor.rooms.map((item) => {
          const available = Boolean(item.sourceRoom);
          const tone = getStatusTone(item.status);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectRoom(item)}
              className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-xl border border-border/40 dark:border-white/5 bg-card p-3 text-left shadow-[0_8px_18px_rgb(var(--shadow-color)/0.035)] transition-[border-color,background-color,box-shadow] duration-200 hover:border-primary/35 hover:bg-primary/[0.035] hover:shadow-[0_10px_24px_rgb(var(--shadow-color)/0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
            >
              <span className="min-w-0">
                <strong className="block text-[13px] font-black text-text">{item.code}</strong>
                <span className="mt-1 block truncate text-[12px] font-semibold text-muted" title={item.type}>{item.type}</span>
              </span>
              <span className="shrink-0 rounded-full px-2 py-1 text-[12px] font-bold" style={available ? { background: tone.bg, color: tone.text } : undefined}>
                {available ? getStatusLabel(item.status) : "Chưa đồng bộ"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-border/20 dark:border-white/5 p-4">
        <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 p-3 text-[12px] font-semibold leading-5 text-muted">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-primary" />
          Chọn một phòng trên mặt bằng hoặc trong bảng để xem hồ sơ vận hành.
        </div>
      </div>
    </aside>
  );
}

function PendingLayout({ building, onEditBuilding }: { building: CockpitBuildingSpec; onEditBuilding?: (buildingCode: string) => void }) {
  return (
    <section className="building-model-stage flex min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
      <div className="max-w-lg">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Layers3 size={27} /></span>
        <h2 className="mt-5 text-[20px] font-black text-text">Mặt bằng {building.code} đang chờ cấu hình</h2>
        <p className="mt-2 text-[13px] font-semibold leading-6 text-muted">Tòa nhà đã có trong danh mục nhưng chưa được gán mô hình, mặt bằng và dữ liệu phòng. Hệ thống không dùng tài sản của tòa khác làm dữ liệu thay thế.</p>
        {onEditBuilding && (
          <button type="button" onClick={() => onEditBuilding(building.code)} className="mt-5 min-h-11 rounded-xl bg-primary px-5 text-[13px] font-black text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            Cấu hình mặt bằng
          </button>
        )}
      </div>
    </section>
  );
}

export default function UnifiedBuildingCockpit({
  building,
  portfolioBuildings,
  floor,
  room,
  debugMode,
  onSelectBuilding,
  onSelectFloor,
  onSelectRoom,
  onCloseRoom,
  onAddBuilding,
  onEditBuilding,
  onOpenRoomModal,
}: UnifiedBuildingCockpitProps) {
  const [highlightedRoomCode, setHighlightedRoomCode] = useState<string | null>(null);
  const lastRoomTriggerRef = useRef<HTMLElement | null>(null);
  const previousRoomRef = useRef<CockpitRoomSpec | null>(room);

  useEffect(() => {
    const previousRoom = previousRoomRef.current;
    if (previousRoom && !room) {
      const fallback = document.querySelector<HTMLElement>(`[data-room-code="${previousRoom.urlCode}"] button`);
      window.requestAnimationFrame(() => (lastRoomTriggerRef.current || fallback)?.focus());
    }
    previousRoomRef.current = room;
  }, [room]);

  const selectRoom = (nextRoom: CockpitRoomSpec) => {
    lastRoomTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    onSelectRoom(nextRoom);
  };

  return (
    <div className="space-y-3">
      <BuildingPortfolioRail
        buildings={portfolioBuildings}
        activeBuildingCode={building.code}
        onSelectBuilding={onSelectBuilding}
        onConfigureBuilding={onEditBuilding}
        onAddBuilding={onAddBuilding}
      />
      <PortfolioKpiBar buildings={portfolioBuildings} />

      {building.layoutStatus === "pending" || !floor ? (
        <PendingLayout building={building} onEditBuilding={onEditBuilding} />
      ) : (
        <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2 min-[1366px]:grid-cols-[minmax(300px,0.95fr)_minmax(460px,1.62fr)_minmax(280px,0.68fr)] min-[1536px]:grid-cols-[minmax(340px,0.95fr)_minmax(560px,1.62fr)_minmax(320px,0.68fr)]">
          <BuildingModelViewer building={building} floor={floor} activeRoomId={room?.id} onSelectFloor={onSelectFloor} onEditBuilding={onEditBuilding} />
          <FloorPlanPanel
            building={building}
            floor={floor}
            room={room}
            debugMode={debugMode}
            highlightedRoomCode={highlightedRoomCode}
            onHighlightRoom={setHighlightedRoomCode}
            onSelectFloor={onSelectFloor}
            onSelectRoom={selectRoom}
          />
          {room ? (
            <>
              <button
                type="button"
                aria-label="Đóng lớp phủ thông tin phòng"
                onClick={onCloseRoom}
                className="fixed inset-0 z-[10001] hidden cursor-default bg-black/45 backdrop-blur-[1px] md:block min-[1366px]:hidden"
              />
              <RoomInspectorDrawer
                floor={floor}
                room={room}
                selectedSpaceId={null}
                onClose={onCloseRoom}
                onOpenRoomModal={room.sourceRoom && onOpenRoomModal ? (roomId, tab) => {
                  onCloseRoom();
                  onOpenRoomModal(roomId, tab);
                } : undefined}
              />
            </>
          ) : <FloorOperationsPanel floor={floor} onSelectRoom={selectRoom} />}
        </div>
      )}
    </div>
  );
}
