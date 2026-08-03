"use client";

import React, { memo, useMemo, useState } from "react";
import { BedDouble, CarFront, Layers3, Sofa } from "lucide-react";
import type { Building, Floor, Room, RoomStatus } from "../../building.types";
import { getFloorDisplayName, getRoomDisplayName } from "../../building-labels";

interface ReferenceBuilding3DProps {
  building: Building;
  activeFloorId: string | null;
  activeRoomId: string | null;
  onSelectFloor: (floorId: string) => void;
  onSelectRoom: (floorId: string, roomId: string) => void;
}

interface FloorGeometry {
  floor: Floor;
  floorPoints: string;
  primaryRoomPoints: string;
  secondaryRoomPoints?: string;
}

const REFERENCE_GEOMETRY = [
  {
    floorPoints: "263,229 543,201 589,295 289,331 263,308",
    primaryRoomPoints: "266,232 421,216 442,313 289,329 266,307",
    secondaryRoomPoints: "476,210 543,203 586,294 479,307",
  },
  {
    floorPoints: "264,351 552,320 589,413 289,448 264,425",
    primaryRoomPoints: "267,353 422,337 442,430 289,446 266,424",
    secondaryRoomPoints: "479,329 552,322 587,412 479,426",
  },
  {
    floorPoints: "264,466 552,435 590,530 290,562 265,543",
    primaryRoomPoints: "267,468 423,452 443,545 290,559 267,541",
    secondaryRoomPoints: "479,444 552,437 588,529 479,542",
  },
  {
    floorPoints: "270,571 551,543 590,660 315,695 235,652 270,620",
    primaryRoomPoints: "472,554 552,546 588,658 474,668",
  },
];

const STATUS: Record<RoomStatus, { color: string; background: string; label: string }> = {
  occupied: { color: "#16a34a", background: "#dcfce7", label: "Đã thuê" },
  expiring_soon: { color: "#f97316", background: "#ffedd5", label: "Sắp hết hạn" },
  vacant: { color: "#64748b", background: "#f1f5f9", label: "Trống" },
  deposited: { color: "#0284c7", background: "#e0f2fe", label: "Đặt cọc" },
  maintenance: { color: "#dc2626", background: "#fee2e2", label: "Bảo trì" },
};

function get3DStatusThemeColor(status: RoomStatus) {
  switch (status) {
    case "occupied":
      return {
        fill: "rgba(34, 197, 94, 0.32)",
        fillActive: "rgba(34, 197, 94, 0.52)",
        stroke: "rgba(34, 197, 94, 0.75)",
        strokeActive: "#22c55e",
      };
    case "expiring_soon":
      return {
        fill: "rgba(249, 115, 22, 0.32)",
        fillActive: "rgba(249, 115, 22, 0.52)",
        stroke: "rgba(249, 115, 22, 0.75)",
        strokeActive: "#f97316",
      };
    case "deposited":
      return {
        fill: "rgba(14, 165, 233, 0.32)",
        fillActive: "rgba(14, 165, 233, 0.52)",
        stroke: "rgba(14, 165, 233, 0.75)",
        strokeActive: "#0ea5e9",
      };
    case "maintenance":
      return {
        fill: "rgba(239, 68, 68, 0.32)",
        fillActive: "rgba(239, 68, 68, 0.52)",
        stroke: "rgba(239, 68, 68, 0.75)",
        strokeActive: "#ef4444",
      };
    default:
      return {
        fill: "rgba(148, 163, 184, 0.18)",
        fillActive: "rgba(148, 163, 184, 0.38)",
        stroke: "rgba(148, 163, 184, 0.55)",
        strokeActive: "#64748b",
      };
  }
}

function RoomRow({
  floor,
  room,
  selected,
  onSelect,
}: {
  floor: Floor;
  room: Room;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = STATUS[room.status];
  const Icon = floor.number === 1 ? CarFront : room.type === "2PN" ? Sofa : BedDouble;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex min-h-10 w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${
        selected ? "border-primary/40 bg-primary/[0.06]" : "border-transparent hover:border-border/70 hover:bg-slate-50"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ color: status.color, background: status.background }}>
        <Icon size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-black text-text">{getRoomDisplayName(room)}</span>
        <span className="block truncate text-[9px] font-semibold text-muted">
          {room.type === "2PN" ? "Suite 2PN mini" : floor.number === 1 ? "Phòng + khu để xe" : "1 giường đơn"}
        </span>
      </span>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: status.color }} aria-hidden="true" />
      <span className="sr-only">{status.label}</span>
    </button>
  );
}

function FloorCard({
  floor,
  building,
  activeFloorId,
  activeRoomId,
  onSelectFloor,
  onSelectRoom,
}: {
  floor: Floor;
  building: Building;
  activeFloorId: string | null;
  activeRoomId: string | null;
  onSelectFloor: (floorId: string) => void;
  onSelectRoom: (floorId: string, roomId: string) => void;
}) {
  const active = activeFloorId === floor.id;
  return (
    <article className={`flex h-full flex-col rounded-2xl border bg-card p-2.5 shadow-sm transition-colors motion-reduce:transition-none ${active ? "border-primary/45" : "border-border/40 dark:border-white/5 hover:border-primary/25"}`}>
      <button
        type="button"
        onClick={() => onSelectFloor(floor.id)}
        aria-pressed={active}
        className="flex min-h-10 w-full items-center justify-between rounded-lg border-b border-border/20 dark:border-white/5 pb-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="flex items-center gap-2 text-xs font-black text-text"><Layers3 size={15} className={active ? "text-primary" : "text-muted"} />{getFloorDisplayName(floor.number, building.code)}</span>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-[9px] font-black text-primary">{floor.rooms.length} phòng</span>
      </button>
      <div className="mt-1.5 flex flex-col gap-0.5">
        {floor.rooms.map((room) => (
          <RoomRow key={room.id} floor={floor} room={room} selected={activeRoomId === room.id} onSelect={() => onSelectRoom(floor.id, room.id)} />
        ))}
      </div>
    </article>
  );
}

function ReferenceBuilding3D({ building, activeFloorId, activeRoomId, onSelectFloor, onSelectRoom }: ReferenceBuilding3DProps) {
  const [hoveredFloorId, setHoveredFloorId] = useState<string | null>(null);
  const floorsDescending = useMemo(() => [...building.floors].sort((a, b) => b.number - a.number), [building.floors]);
  const floorGeometry = useMemo<FloorGeometry[]>(() => {
    return floorsDescending.map((floor, index) => ({
      floor,
      ...(REFERENCE_GEOMETRY[index] || REFERENCE_GEOMETRY[REFERENCE_GEOMETRY.length - 1]),
    }));
  }, [floorsDescending]);

  return (
    <section className="flex min-h-[700px] w-full flex-col" aria-label="Mô hình 3D tòa nhà LK01-31">
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-border/40 pb-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.14em] text-text">Tổng quan tòa nhà 3D</h2>
          <p className="mt-1 text-[10px] font-semibold text-muted">Chọn tầng để mở mặt bằng · chọn phòng để xem thông tin</p>
        </div>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase text-emerald-600">Cutaway nội thất</span>
      </div>

      <div className="grid flex-1 gap-4 xl:grid-cols-[100px_minmax(360px,1fr)_210px]">
        <div className="relative hidden min-h-[620px] xl:block" aria-label="Chọn tầng">
          {floorGeometry.map(({ floor }, index) => {
            const active = floor.id === activeFloorId || floor.id === hoveredFloorId;
            const BUTTON_TOPS = ["14.3%", "37.9%", "60.7%", "78.6%"];
            return (
              <button
                key={floor.id}
                type="button"
                onClick={() => onSelectFloor(floor.id)}
                onMouseEnter={() => setHoveredFloorId(floor.id)}
                onMouseLeave={() => setHoveredFloorId(null)}
                className={`absolute left-0 flex min-h-14 w-full -translate-y-1/2 flex-col justify-center rounded-xl border bg-card px-3 text-left shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${active ? "border-primary/45 text-primary scale-[1.02]" : "border-border/40 dark:border-white/5 text-text hover:border-primary/30"}`}
                style={{ top: BUTTON_TOPS[index] || "13%" }}
              >
                <span className="text-[11px] font-black">{getFloorDisplayName(floor.number, building.code)}</span>
                <span className="mt-0.5 truncate text-[8px] font-semibold text-muted">{floor.rooms.map((room) => room.code.replace("PN ", "")).join(", ")}</span>
                <span className={`absolute left-full top-1/2 w-8 border-t transition-colors duration-300 ${active ? "border-[#0ea5e9] border-solid stroke-[2px]" : "border-border/30 border-dashed dark:border-white/10"}`} />
              </button>
            );
          })}
        </div>

        <div className="relative min-h-[620px] overflow-hidden rounded-2xl border border-border/40 dark:border-white/5 bg-[radial-gradient(circle_at_50%_30%,#ffffff_0%,#f8fafc_62%,#eef2f7_100%)] shadow-inner">
          <svg viewBox="228 195 366 509" preserveAspectRatio="xMidYMid meet" className="h-full min-h-[620px] w-full" role="group" aria-labelledby="reference-building-title reference-building-desc">
            <title id="reference-building-title">Tòa nhà LK01-31 dạng cutaway có nội thất</title>
            <desc id="reference-building-desc">Bốn tầng hiển thị tách rời. Có thể chọn từng tầng hoặc từng phòng trên mô hình.</desc>
            <defs>
              <clipPath id="reference-building-crop"><rect x="228" y="195" width="366" height="509" /></clipPath>
            </defs>
            <g clipPath="url(#reference-building-crop)">
              <image href="/media__1785578495387.jpg" x="0" y="0" width="1024" height="768" preserveAspectRatio="none" pointerEvents="none" />

              {/* Dynamic Guide Lines pointing to Floor slabs */}
              {floorGeometry.map(({ floor }, index) => {
                const active = floor.id === activeFloorId;
                const hovered = floor.id === hoveredFloorId;
                const targets = [
                  { x: 263, y: 268 }, // Tầng 4
                  { x: 264, y: 388 }, // Tầng 3
                  { x: 264, y: 504 }, // Tầng 2
                  { x: 270, y: 595 }  // Tầng trệt
                ];
                const target = targets[index] || { x: 264, y: 300 };
                return (
                  <g key={`guide-line-${floor.id}`} className="pointer-events-none">
                    <line
                      x1={228}
                      y1={target.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={active ? "#0ea5e9" : hovered ? "rgba(14,165,233,0.6)" : "rgba(148,163,184,0.3)"}
                      strokeWidth={active ? 2.5 : 1.5}
                      strokeDasharray={active ? "none" : "3,3"}
                      className="transition-all duration-300"
                    />
                    <circle
                      cx={target.x}
                      cy={target.y}
                      r={active ? 4.5 : hovered ? 3.5 : 2}
                      fill={active ? "#0ea5e9" : hovered ? "rgba(14,165,233,0.8)" : "rgba(148,163,184,0.6)"}
                      stroke={active ? "#ffffff" : "transparent"}
                      strokeWidth={active ? 1 : 0}
                      className="transition-all duration-300"
                    />
                  </g>
                );
              })}

              {floorGeometry.map(({ floor, floorPoints, primaryRoomPoints, secondaryRoomPoints }) => {
              const active = floor.id === activeFloorId;
              const hovered = floor.id === hoveredFloorId;
              const primaryRoom = floor.rooms.find((room) => room.type === "2PN") || floor.rooms[0];
              const secondaryRoom = floor.rooms.find((room) => room.id !== primaryRoom?.id);
              return (
                <g key={floor.id}>
                  <polygon
                    points={floorPoints}
                    fill={active || hovered ? "rgba(99,102,241,0.10)" : "transparent"}
                    stroke={active || hovered ? "#6366f1" : "transparent"}
                    strokeWidth="2"
                    role="button"
                    tabIndex={0}
                    aria-label={`Mở mặt bằng ${getFloorDisplayName(floor.number, building.code)}`}
                    className="cursor-pointer outline-none focus-visible:stroke-indigo-600 transition-all duration-300"
                    onClick={() => onSelectFloor(floor.id)}
                    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectFloor(floor.id); } }}
                  />
                  {primaryRoom && (() => {
                    const colors = get3DStatusThemeColor(primaryRoom.status);
                    const selected = activeRoomId === primaryRoom.id;
                    return (
                      <polygon
                        points={primaryRoomPoints}
                        fill={selected ? colors.fillActive : colors.fill}
                        stroke={selected ? colors.strokeActive : colors.stroke}
                        strokeWidth={selected ? 2.5 : 1.25}
                        role="button" tabIndex={0}
                        aria-label={`Xem thông tin ${getRoomDisplayName(primaryRoom)}`}
                        className="cursor-pointer outline-none transition-all duration-300"
                        onClick={(event) => { event.stopPropagation(); onSelectRoom(floor.id, primaryRoom.id); }}
                        onFocus={() => setHoveredFloorId(floor.id)}
                        onBlur={() => setHoveredFloorId(null)}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onSelectRoom(floor.id, primaryRoom.id); } }}
                      />
                    );
                  })()}
                  {secondaryRoom && secondaryRoomPoints && (() => {
                    const colors = get3DStatusThemeColor(secondaryRoom.status);
                    const selected = activeRoomId === secondaryRoom.id;
                    return (
                      <polygon
                        points={secondaryRoomPoints}
                        fill={selected ? colors.fillActive : colors.fill}
                        stroke={selected ? colors.strokeActive : colors.stroke}
                        strokeWidth={selected ? 2.5 : 1.25}
                        role="button" tabIndex={0}
                        aria-label={`Xem thông tin ${getRoomDisplayName(secondaryRoom)}`}
                        className="cursor-pointer outline-none transition-all duration-300"
                        onClick={(event) => { event.stopPropagation(); onSelectRoom(floor.id, secondaryRoom.id); }}
                        onFocus={() => setHoveredFloorId(floor.id)}
                        onBlur={() => setHoveredFloorId(null)}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onSelectRoom(floor.id, secondaryRoom.id); } }}
                      />
                    );
                  })()}
                </g>
              );
              })}
            </g>
          </svg>
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-4 rounded-xl border border-border/40 dark:border-white/5 bg-card/95 px-4 py-2 text-[9px] font-bold text-muted shadow-sm backdrop-blur">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />Đã thuê</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-slate-400" />Trống</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-orange-500" />Sắp hết hạn</span>
          </div>
        </div>

        <div className="grid min-h-[620px] grid-rows-4 gap-2" aria-label="Danh sách tầng và phòng">
          {floorsDescending.map((floor) => (
            <FloorCard key={floor.id} floor={floor} building={building} activeFloorId={activeFloorId} activeRoomId={activeRoomId} onSelectFloor={onSelectFloor} onSelectRoom={onSelectRoom} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default memo(ReferenceBuilding3D);
