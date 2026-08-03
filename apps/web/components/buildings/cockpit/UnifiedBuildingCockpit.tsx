"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Expand,
  Layers3,
  MapPin,
  Maximize2,
  Pencil,
  RefreshCw,
  ZoomIn,
  ZoomOut,
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
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
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

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card text-muted transition-colors duration-200 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
    >
      {children}
    </button>
  );
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

function BuildingModelViewer({
  building,
  floor,
  onSelectFloor,
  onEditBuilding,
}: {
  building: CockpitBuildingSpec;
  floor: CockpitFloorSpec;
  onSelectFloor: (floorId: CockpitFloorId) => void;
  onEditBuilding?: (buildingCode: string) => void;
}) {
  const orderedFloors = useMemo(() => [...building.floors].reverse(), [building.floors]);
  const [hoveredFloorId, setHoveredFloorId] = useState<CockpitFloorId | null>(null);
  const [scale, setScale] = useState(1);
  const activeFloorId = hoveredFloorId || floor.id;

  return (
    <article data-testid="building-model-viewer" className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_32px_rgb(var(--shadow-color)/0.06)]">
      <header className="flex min-h-[68px] items-start justify-between gap-3 border-b border-border px-3.5 py-3">
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border text-muted transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Pencil size={15} aria-hidden />
          </button>
        )}
      </header>

      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <div>
          <h3 className="text-[13px] font-black uppercase tracking-wide text-text">Mô hình tòa nhà</h3>
          <p className="mt-0.5 text-[12px] font-semibold text-muted">Chọn tầng trực tiếp trên mô hình</p>
        </div>
        <div className="flex items-center gap-1.5">
          <IconButton label="Đặt lại góc nhìn" onClick={() => setScale(1)}><RefreshCw size={15} /></IconButton>
          <IconButton label="Thu nhỏ mô hình" onClick={() => setScale((value) => Math.max(0.84, value - 0.08))}><ZoomOut size={15} /></IconButton>
          <IconButton label="Phóng to mô hình" onClick={() => setScale((value) => Math.min(1.16, value + 0.08))}><ZoomIn size={15} /></IconButton>
        </div>
      </div>

      <div className="building-model-stage relative h-[410px] overflow-hidden border-y border-border min-[1366px]:h-[500px]">
        <div className="pointer-events-none absolute inset-y-0 left-2 z-20 w-[94px]">
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
                "pointer-events-auto absolute left-0 w-[88px] -translate-y-1/2 rounded-[10px] border bg-card/95 px-2.5 py-2 text-left shadow-sm backdrop-blur transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none",
                activeFloorId === item.id ? "border-primary text-primary" : "border-border text-text hover:border-primary/40",
              )}
              style={{ top: `${11 + index * 26}%` }}
            >
              <strong className="block text-[12px] font-black">{item.label}</strong>
              <span className="mt-0.5 block text-[12px] font-semibold text-muted">{item.rooms.length} phòng</span>
              <i className="absolute left-full top-1/2 w-5 border-t border-primary/35" aria-hidden />
            </button>
          ))}
        </div>

        <div className="absolute inset-3 left-[78px] flex items-center justify-center">
          <div
            className="relative h-[94%] max-w-full origin-center transition-transform duration-200 motion-reduce:transition-none"
            style={{ aspectRatio: `${building.overviewImage.width} / ${building.overviewImage.height}`, transform: `scale(${scale})` }}
          >
            <Image
              src={building.overviewImage.src}
              alt={`Ảnh render kiến trúc tách tầng của tòa nhà ${building.code}`}
              width={building.overviewImage.width}
              height={building.overviewImage.height}
              sizes="(max-width: 1365px) 45vw, 430px"
              className="h-full w-full object-contain drop-shadow-[0_20px_28px_rgba(15,23,42,0.13)]"
              priority
            />
            <svg
              viewBox={`0 0 ${building.overviewImage.width} ${building.overviewImage.height}`}
              className="absolute inset-0 h-full w-full"
              aria-label={`Chọn tầng của tòa nhà ${building.code}`}
            >
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
                    fill={active ? "rgba(91,53,245,0.075)" : "transparent"}
                    stroke={active ? "rgba(91,53,245,0.92)" : "transparent"}
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                    className="cursor-pointer outline-none transition-[fill,stroke,filter] duration-200 hover:fill-[rgba(91,53,245,0.055)] focus-visible:stroke-[#5b35f5] motion-reduce:transition-none"
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
        <div key={label} className="rounded-xl border border-border bg-surface/60 p-3">
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
  zoom,
  setZoom,
  debugMode,
  highlightedRoomCode,
  onHighlightRoom,
  onSelectFloor,
  onSelectRoom,
}: {
  building: CockpitBuildingSpec;
  floor: CockpitFloorSpec;
  room: CockpitRoomSpec | null;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  debugMode: boolean;
  highlightedRoomCode: string | null;
  onHighlightRoom: (roomCode: string | null) => void;
  onSelectFloor: (floorId: CockpitFloorId) => void;
  onSelectRoom: (room: CockpitRoomSpec) => void;
}) {
  const [tab, setTab] = useState<"rooms" | "floor">("rooms");
  const panelRef = useRef<HTMLElement>(null);

  return (
    <section ref={panelRef} data-testid="floor-workspace-panel" className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_32px_rgb(var(--shadow-color)/0.06)]">
      <header className="border-b border-border px-3.5 py-3">
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
          <div className="flex items-center gap-1.5">
            <IconButton label="Thu nhỏ mặt bằng" onClick={() => setZoom((value) => Math.max(60, value - 10))}><ZoomOut size={15} /></IconButton>
            <span className="min-w-11 text-center text-[12px] font-black tabular-nums text-muted">{zoom}%</span>
            <IconButton label="Phóng to mặt bằng" onClick={() => setZoom((value) => Math.min(250, value + 10))}><ZoomIn size={15} /></IconButton>
            <IconButton label="Đưa mặt bằng vừa khung" onClick={() => setZoom(100)}><Expand size={15} /></IconButton>
            <IconButton label="Toàn màn hình mặt bằng" onClick={() => panelRef.current?.requestFullscreen?.()}><Maximize2 size={15} /></IconButton>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {building.floors.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === floor.id}
              onClick={() => onSelectFloor(item.id)}
              className={cx(
                "min-h-8 shrink-0 rounded-[9px] px-3 text-[12px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none",
                item.id === floor.id ? "bg-primary text-white" : "border border-border bg-card text-muted hover:bg-primary/5 hover:text-primary",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-3">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[12px] font-black uppercase tracking-wide text-text">Sơ đồ mặt bằng {floor.label}</h3>
          <StatusLegend />
        </div>
        <div className="h-[340px] min-[1366px]:h-[390px]">
          <FloorPlanCanvas
            floor={floor}
            buildingCode={building.code}
            selectedRoomCode={room?.urlCode || null}
            highlightedRoomCode={highlightedRoomCode}
            zoom={zoom}
            onZoomChange={setZoom}
            onSelectRoom={onSelectRoom}
            onHoverRoom={onHighlightRoom}
            debugMode={debugMode}
          />
        </div>

        <div className="mt-3 border-t border-border pt-3">
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

  return (
    <aside className="hidden min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_32px_rgb(var(--shadow-color)/0.06)] min-[1366px]:block" aria-label={`Thông tin ${floor.label}`}>
      <header className="border-b border-border px-4 py-3.5">
        <h2 className="text-[16px] font-black text-text">Thông tin tầng</h2>
        <p className="mt-1 text-[12px] font-semibold text-muted">{floor.label} · {operationalRooms.length ? `${occupied}/${operationalRooms.length} phòng đã thuê` : "chưa có dữ liệu vận hành"}</p>
      </header>
      <div className="space-y-2.5 p-3">
        {floor.rooms.map((item) => {
          const available = Boolean(item.sourceRoom);
          const tone = getStatusTone(item.status);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectRoom(item)}
              className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left transition-[border-color,background-color] duration-200 hover:border-primary/35 hover:bg-primary/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
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
      <div className="border-t border-border p-4">
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
  zoom,
  setZoom,
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
        <div className="grid min-w-0 items-start gap-3 lg:grid-cols-2 min-[1366px]:grid-cols-[minmax(270px,0.65fr)_minmax(500px,1.35fr)_minmax(286px,300px)]">
          <BuildingModelViewer building={building} floor={floor} onSelectFloor={onSelectFloor} onEditBuilding={onEditBuilding} />
          <FloorPlanPanel
            building={building}
            floor={floor}
            room={room}
            zoom={zoom}
            setZoom={setZoom}
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
