"use client";

import React, { memo, useMemo, useState } from "react";
import {
  BedDouble,
  CarFront,
  Home,
  Layers3,
  RotateCcw,
  RotateCw,
  Sofa,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Building, Floor, Room, RoomStatus } from "../../building.types";
import { getFloorDisplayName, getRoomDisplayName } from "../../building-labels";
import { resolveFloorLayoutSpec } from "../../workspace/building-profiles";
import type {
  DoorOpening,
  FloorLayoutSpec,
  FurnitureItemSpec,
  Point2D,
  WallSegment,
} from "./geometry/floor-layout.types";

interface InteractiveBuilding3DProps {
  building: Building;
  activeFloorId: string | null;
  activeRoomId: string | null;
  onSelectFloor: (floorId: string) => void;
  onSelectRoom: (floorId: string, roomId: string) => void;
}

type QuarterTurn = 0 | 1 | 2 | 3;

interface ProjectionSettings {
  rotation: QuarterTurn;
  zoom: number;
}

const VIEW_WIDTH = 760;
const VIEW_HEIGHT = 610;
const MODEL_CENTER_X = 360;
const MODEL_GROUND_Y = 520;
const PLAN_SCALE = 16;
const DEPTH_SCALE = 6.1;
const HEIGHT_SCALE = 30;
const FLOOR_HEIGHT = 1.05;

const STATUS_COLORS: Record<RoomStatus, { fill: string; strong: string; label: string }> = {
  occupied: { fill: "#dcfce7", strong: "#16a34a", label: "Đã thuê" },
  expiring_soon: { fill: "#ffedd5", strong: "#f97316", label: "Sắp hết hạn" },
  vacant: { fill: "#eef2ff", strong: "#6366f1", label: "Trống" },
  deposited: { fill: "#e0f2fe", strong: "#0284c7", label: "Đặt cọc" },
  maintenance: { fill: "#ffe4e6", strong: "#e11d48", label: "Bảo trì" },
};

const FURNITURE_SIZE: Record<FurnitureItemSpec["type"], { width: number; length: number; fill: string }> = {
  "single-bed": { width: 0.95, length: 1.9, fill: "#dbeafe" },
  "double-bed": { width: 1.55, length: 2, fill: "#dbeafe" },
  sofa: { width: 0.72, length: 2, fill: "#bfdbfe" },
  "coffee-table": { width: 0.7, length: 1, fill: "#e2e8f0" },
  desk: { width: 0.6, length: 1.1, fill: "#fed7aa" },
  toilet: { width: 0.5, length: 0.75, fill: "#f8fafc" },
  sink: { width: 0.48, length: 0.65, fill: "#f8fafc" },
  "kitchen-counter": { width: 0.62, length: 2.25, fill: "#cbd5e1" },
  washer: { width: 0.62, length: 0.62, fill: "#e2e8f0" },
  wardrobe: { width: 0.5, length: 1.65, fill: "#fde68a" },
  refrigerator: { width: 0.68, length: 0.72, fill: "#cbd5e1" },
  motorbike: { width: 0.5, length: 1.5, fill: "#334155" },
};

const rect = (minX: number, minY: number, maxX: number, maxY: number): Point2D[] => [
  { x: minX, y: minY },
  { x: maxX, y: minY },
  { x: maxX, y: maxY },
  { x: minX, y: maxY },
];

function rotatePlanPoint(point: Point2D, rotation: QuarterTurn) {
  let u = point.y - 10;
  let v = point.x - 2.5;
  for (let index = 0; index < rotation; index += 1) {
    [u, v] = [-v, u];
  }
  return { u, v };
}

function project(point: Point2D, z: number, settings: ProjectionSettings) {
  const { u, v } = rotatePlanPoint(point, settings.rotation);
  const zoom = settings.zoom / 100;
  return {
    x: MODEL_CENTER_X + (u - v) * PLAN_SCALE * zoom,
    y: MODEL_GROUND_Y + (u + v) * DEPTH_SCALE * zoom - z * HEIGHT_SCALE,
  };
}

function points(boundary: Point2D[], z: number, settings: ProjectionSettings) {
  return boundary.map((point) => {
    const result = project(point, z, settings);
    return `${result.x},${result.y}`;
  }).join(" ");
}

function centroid(boundary: Point2D[]) {
  return boundary.reduce(
    (result, point) => ({ x: result.x + point.x / boundary.length, y: result.y + point.y / boundary.length }),
    { x: 0, y: 0 },
  );
}

function wallLength(wall: WallSegment) {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

function pointAlongWall(wall: WallSegment, distance: number): Point2D {
  const length = wallLength(wall);
  const ratio = length === 0 ? 0 : distance / length;
  return {
    x: wall.start.x + (wall.end.x - wall.start.x) * ratio,
    y: wall.start.y + (wall.end.y - wall.start.y) * ratio,
  };
}

function visibleWallSegments(wall: WallSegment, doors: DoorOpening[]) {
  const cuts = doors
    .map((door) => ({ start: door.offset, end: door.offset + door.width }))
    .sort((a, b) => a.start - b.start);
  const result: Array<{ start: Point2D; end: Point2D }> = [];
  let cursor = 0;
  for (const cut of cuts) {
    if (cut.start > cursor) result.push({ start: pointAlongWall(wall, cursor), end: pointAlongWall(wall, cut.start) });
    cursor = Math.max(cursor, cut.end);
  }
  const length = wallLength(wall);
  if (cursor < length) result.push({ start: pointAlongWall(wall, cursor), end: pointAlongWall(wall, length) });
  return result;
}

function furnitureBoundary(item: FurnitureItemSpec) {
  const size = FURNITURE_SIZE[item.type];
  const radians = (item.rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [
    { x: -size.width / 2, y: -size.length / 2 },
    { x: size.width / 2, y: -size.length / 2 },
    { x: size.width / 2, y: size.length / 2 },
    { x: -size.width / 2, y: size.length / 2 },
  ].map((point) => ({
    x: item.x + point.x * cosine - point.y * sine,
    y: item.y + point.x * sine + point.y * cosine,
  }));
}

function FloorFurniture({ layout, baseZ, settings }: { layout: FloorLayoutSpec; baseZ: number; settings: ProjectionSettings }) {
  return (
    <g pointerEvents="none" aria-hidden="true">
      {layout.spaces.flatMap((space) => space.furniture).map((item) => {
        const size = FURNITURE_SIZE[item.type];
        const boundary = furnitureBoundary(item);
        const center = project({ x: item.x, y: item.y }, baseZ + 0.2, settings);
        return (
          <g key={item.id}>
            <polygon points={points(boundary, baseZ + 0.18, settings)} fill={size.fill} stroke="#64748b" strokeWidth="0.75" />
            {(item.type === "single-bed" || item.type === "double-bed") && (
              <ellipse cx={center.x} cy={center.y} rx="5" ry="2.7" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.6" />
            )}
            {item.type === "motorbike" && <circle cx={center.x} cy={center.y} r="2.3" fill="#f97316" />}
          </g>
        );
      })}
    </g>
  );
}

function StairFlights({ baseZ, settings }: { baseZ: number; settings: ProjectionSettings }) {
  const startY = 11.68;
  const endY = 14.28;
  const treads = Array.from({ length: 8 }, (_, index) => startY + ((endY - startY) * index) / 7);
  return (
    <g pointerEvents="none" aria-hidden="true" stroke="#64748b" strokeWidth="0.75">
      {treads.flatMap((y, index) => [
        <line key={`a-${index}`} {...lineProps({ x: 0.35, y }, { x: 2.15, y }, baseZ + 0.21, settings)} />,
        <line key={`b-${index}`} {...lineProps({ x: 2.85, y }, { x: 4.65, y }, baseZ + 0.21, settings)} />,
      ])}
      <polygon points={points(rect(0.35, 14.28, 4.65, 14.62), baseZ + 0.2, settings)} fill="#e2e8f0" />
    </g>
  );
}

function lineProps(start: Point2D, end: Point2D, z: number, settings: ProjectionSettings) {
  const a = project(start, z, settings);
  const b = project(end, z, settings);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}

function GroundFloorModel({
  floor,
  baseZ,
  settings,
  isActive,
  activeRoomId,
  onSelectFloor,
  onSelectRoom,
}: {
  floor: Floor;
  baseZ: number;
  settings: ProjectionSettings;
  isActive: boolean;
  activeRoomId: string | null;
  onSelectFloor: () => void;
  onSelectRoom: (roomId: string) => void;
}) {
  const room = floor.rooms[0];
  const roomBoundary = rect(0, 14.83, 5, 20);
  const parkingBoundary = rect(0, 0, 5, 11.33);
  const status = room ? STATUS_COLORS[room.status] : STATUS_COLORS.vacant;
  const walls: WallSegment[] = [
    { id: "g-front", start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, thickness: 0.15, height: 1.2 },
    { id: "g-left", start: { x: 0, y: 0 }, end: { x: 0, y: 20 }, thickness: 0.15, height: 1.2 },
    { id: "g-right", start: { x: 5, y: 0 }, end: { x: 5, y: 20 }, thickness: 0.15, height: 1.2 },
    { id: "g-back", start: { x: 0, y: 20 }, end: { x: 5, y: 20 }, thickness: 0.15, height: 1.2 },
    { id: "g-room", start: { x: 0, y: 14.83 }, end: { x: 5, y: 14.83 }, thickness: 0.15, height: 1.2 },
  ];
  const bikes: FurnitureItemSpec[] = [1.2, 2.5, 3.8].map((x, index) => ({ id: `bike-${index}`, type: "motorbike", x, y: 5.5, rotation: 0 }));
  return (
    <g>
      <polygon points={points(parkingBoundary, baseZ + 0.04, settings)} fill="#f8fafc" stroke="#cbd5e1" />
      <polygon
        points={points(roomBoundary, baseZ + 0.05, settings)}
        fill={status.fill}
        stroke={activeRoomId === room?.id ? status.strong : "#cbd5e1"}
        strokeWidth={activeRoomId === room?.id ? 2.3 : 1}
        role={room ? "button" : undefined}
        tabIndex={room ? 0 : undefined}
        aria-label={room ? `Xem thông tin ${getRoomDisplayName(room)}` : undefined}
        className={room ? "cursor-pointer outline-none focus-visible:stroke-indigo-600" : undefined}
        onClick={(event) => { if (room) { event.stopPropagation(); onSelectRoom(room.id); } }}
        onKeyDown={(event) => {
          if (room && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onSelectRoom(room.id);
          }
        }}
      />
      {bikes.map((item) => <polygon key={item.id} points={points(furnitureBoundary(item), baseZ + 0.18, settings)} fill="#334155" stroke="#f97316" strokeWidth="0.8" pointerEvents="none" />)}
      {walls.map((wall) => <WallLine key={wall.id} wall={wall} doors={[]} baseZ={baseZ} settings={settings} active={isActive} />)}
      <StairFlights baseZ={baseZ} settings={settings} />
      <text {...textPoint({ x: 2.5, y: 5.5 }, baseZ + 0.25, settings)} className="fill-slate-500 text-[8px] font-bold" textAnchor="middle" pointerEvents="none">KHU ĐỂ XE</text>
      {room && <text {...textPoint({ x: 2.5, y: 17.5 }, baseZ + 0.28, settings)} className="fill-slate-700 text-[8px] font-black" textAnchor="middle" pointerEvents="none">{room.code}</text>}
      <polygon
        points={points(rect(0, 11.33, 5, 14.83), baseZ + 0.02, settings)}
        fill="transparent"
        role="button"
        tabIndex={0}
        aria-label={`Chọn ${getFloorDisplayName(floor.number, "LK01-31")}`}
        className="cursor-pointer outline-none focus-visible:stroke-indigo-600"
        onClick={onSelectFloor}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectFloor(); } }}
      />
    </g>
  );
}

function textPoint(point: Point2D, z: number, settings: ProjectionSettings) {
  const result = project(point, z, settings);
  return { x: result.x, y: result.y };
}

function WallLine({
  wall,
  doors,
  baseZ,
  settings,
  active,
}: {
  wall: WallSegment;
  doors: DoorOpening[];
  baseZ: number;
  settings: ProjectionSettings;
  active: boolean;
}) {
  return (
    <g pointerEvents="none" aria-hidden="true">
      {visibleWallSegments(wall, doors).map((segment, index) => {
        const top = lineProps(segment.start, segment.end, baseZ + FLOOR_HEIGHT, settings);
        const startBottom = project(segment.start, baseZ + 0.08, settings);
        const startTop = project(segment.start, baseZ + FLOOR_HEIGHT, settings);
        const endBottom = project(segment.end, baseZ + 0.08, settings);
        const endTop = project(segment.end, baseZ + FLOOR_HEIGHT, settings);
        return (
          <g key={`${wall.id}-${index}`}>
            <line {...top} stroke={active ? "#475569" : "#64748b"} strokeWidth={wall.thickness >= 0.15 ? 3.1 : 2.15} strokeLinecap="square" />
            <line x1={startBottom.x} y1={startBottom.y} x2={startTop.x} y2={startTop.y} stroke="#94a3b8" strokeWidth="1" />
            <line x1={endBottom.x} y1={endBottom.y} x2={endTop.x} y2={endTop.y} stroke="#94a3b8" strokeWidth="1" />
          </g>
        );
      })}
    </g>
  );
}

function FloorModel({
  floor,
  layout,
  baseZ,
  settings,
  isActive,
  activeRoomId,
  hoveredRoomId,
  onHoverRoom,
  onSelectFloor,
  onSelectRoom,
}: {
  floor: Floor;
  layout: FloorLayoutSpec;
  baseZ: number;
  settings: ProjectionSettings;
  isActive: boolean;
  activeRoomId: string | null;
  hoveredRoomId: string | null;
  onHoverRoom: (roomId: string | null) => void;
  onSelectFloor: () => void;
  onSelectRoom: (roomId: string) => void;
}) {
  const roomByCode = new Map(floor.rooms.map((room) => [room.code.trim().toUpperCase(), room]));
  const doorsByWall = new Map<string, DoorOpening[]>();
  layout.doors.forEach((door) => doorsByWall.set(door.wallId, [...(doorsByWall.get(door.wallId) || []), door]));
  const slabBoundary = rect(0, 0, layout.width, layout.length);
  const slabDepth = 0.22;
  const corners = slabBoundary.map((point) => ({ top: project(point, baseZ, settings), bottom: project(point, baseZ - slabDepth, settings) }));

  return (
    <g data-floor-id={floor.id}>
      <polygon points={`${corners[1].top.x},${corners[1].top.y} ${corners[2].top.x},${corners[2].top.y} ${corners[2].bottom.x},${corners[2].bottom.y} ${corners[1].bottom.x},${corners[1].bottom.y}`} fill="#cbd5e1" stroke="#94a3b8" />
      <polygon points={`${corners[2].top.x},${corners[2].top.y} ${corners[3].top.x},${corners[3].top.y} ${corners[3].bottom.x},${corners[3].bottom.y} ${corners[2].bottom.x},${corners[2].bottom.y}`} fill="#e2e8f0" stroke="#94a3b8" />
      <polygon
        points={points(slabBoundary, baseZ, settings)}
        fill={isActive ? "#ffffff" : "#f8fafc"}
        stroke={isActive ? "#6366f1" : "#cbd5e1"}
        strokeWidth={isActive ? 2.5 : 1.2}
        role="button"
        tabIndex={0}
        aria-label={`Chọn ${getFloorDisplayName(floor.number, "LK01-31")}`}
        aria-pressed={isActive}
        className="cursor-pointer outline-none focus-visible:stroke-indigo-600"
        onClick={onSelectFloor}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelectFloor(); } }}
      />

      {layout.units.map((unit) => {
        const room = roomByCode.get(unit.roomCode.toUpperCase());
        if (!room) return null;
        const status = STATUS_COLORS[room.status];
        const selected = room.id === activeRoomId;
        const hovered = room.id === hoveredRoomId;
        return (
          <polygon
            key={`${unit.id}-fill`}
            points={points(unit.boundary, baseZ + 0.035, settings)}
            fill={status.fill}
            fillOpacity={selected ? 0.96 : hovered ? 0.88 : 0.68}
            stroke={selected || hovered ? status.strong : "#d8dee9"}
            strokeWidth={selected ? 2.6 : hovered ? 1.8 : 0.8}
            pointerEvents="none"
          />
        );
      })}

      <FloorFurniture layout={layout} baseZ={baseZ} settings={settings} />
      <StairFlights baseZ={baseZ} settings={settings} />
      {layout.walls.map((wall) => <WallLine key={wall.id} wall={wall} doors={doorsByWall.get(wall.id) || []} baseZ={baseZ} settings={settings} active={isActive} />)}

      {layout.units.map((unit) => {
        const room = roomByCode.get(unit.roomCode.toUpperCase());
        if (!room) return null;
        const center = centroid(unit.boundary);
        const label = project(center, baseZ + FLOOR_HEIGHT + 0.08, settings);
        return (
          <g key={`${unit.id}-interaction`}>
            <polygon
              points={points(unit.boundary, baseZ + 0.075, settings)}
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={`Xem thông tin ${getRoomDisplayName(room)} tại ${getFloorDisplayName(floor.number, "LK01-31")}`}
              aria-pressed={room.id === activeRoomId}
              className="cursor-pointer outline-none focus-visible:stroke-indigo-600"
              onMouseEnter={() => onHoverRoom(room.id)}
              onMouseLeave={() => onHoverRoom(null)}
              onClick={(event) => { event.stopPropagation(); onSelectRoom(room.id); }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectRoom(room.id);
                }
              }}
            />
            <text x={label.x} y={label.y} textAnchor="middle" pointerEvents="none" className="fill-slate-700 text-[8px] font-black" paintOrder="stroke" stroke="#ffffff" strokeWidth="2.5">
              {room.code}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ControlButton({ label, onClick, children, disabled = false }: { label: string; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-card text-muted shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
    >
      {children}
    </button>
  );
}

function InteractiveBuilding3D({ building, activeFloorId, activeRoomId, onSelectFloor, onSelectRoom }: InteractiveBuilding3DProps) {
  const [rotation, setRotation] = useState<QuarterTurn>(0);
  const [zoom, setZoom] = useState(100);
  const [isExploded, setIsExploded] = useState(true);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  const floorsAscending = useMemo(() => [...building.floors].sort((a, b) => a.number - b.number), [building.floors]);
  const floorsDescending = useMemo(() => [...floorsAscending].reverse(), [floorsAscending]);
  const settings = useMemo(() => ({ rotation, zoom }), [rotation, zoom]);

  const floorBaseZ = (index: number, floorId: string) => {
    const spacing = isExploded ? 3.35 : 1.35;
    return index * spacing + (floorId === activeFloorId ? 0.28 : 0);
  };

  return (
    <section className="flex min-h-[590px] w-full flex-col" aria-label="Mô hình 3D tương tác tòa LK01-31">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div>
          <h3 className="text-[13px] font-black uppercase tracking-[0.16em] text-text">Mô hình 3D tách tầng</h3>
          <p className="mt-1 text-[10px] font-semibold text-muted">Click tầng để xem bố trí · click phòng để mở thông tin</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Điều khiển mô hình 3D">
          <ControlButton label="Xoay mô hình sang trái" onClick={() => setRotation((value) => ((value + 3) % 4) as QuarterTurn)}><RotateCcw size={17} /></ControlButton>
          <ControlButton label="Xoay mô hình sang phải" onClick={() => setRotation((value) => ((value + 1) % 4) as QuarterTurn)}><RotateCw size={17} /></ControlButton>
          <ControlButton label="Thu nhỏ mô hình" onClick={() => setZoom((value) => Math.max(75, value - 10))} disabled={zoom <= 75}><ZoomOut size={17} /></ControlButton>
          <span className="min-w-12 text-center text-[10px] font-black text-muted" aria-live="polite">{zoom}%</span>
          <ControlButton label="Phóng to mô hình" onClick={() => setZoom((value) => Math.min(125, value + 10))} disabled={zoom >= 125}><ZoomIn size={17} /></ControlButton>
          <button
            type="button"
            onClick={() => setIsExploded((value) => !value)}
            aria-pressed={isExploded}
            className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-[10px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${isExploded ? "border-primary/30 bg-primary/10 text-primary" : "border-border/60 bg-card text-muted hover:text-text"}`}
          >
            <Layers3 size={16} /> {isExploded ? "Đang tách tầng" : "Đang gộp tầng"}
          </button>
        </div>
      </div>

      <div className="grid min-h-[520px] flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_230px]">
        <div className="relative min-h-[500px] overflow-hidden rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_50%_20%,#ffffff_0%,#f8fafc_48%,#eef2f7_100%)]">
          <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-white/80 bg-white/85 px-3 py-2 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-700"><Home size={13} className="text-indigo-600" /> LK01-31</div>
            <div className="mt-1 text-[9px] font-semibold text-slate-500">Khung đất 5 × 20 m · hướng {rotation * 90}°</div>
          </div>
          <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="h-full min-h-[500px] w-full" role="img" aria-labelledby="interactive-3d-title interactive-3d-desc">
            <title id="interactive-3d-title">Mô hình 3D tương tác tòa LK01-31</title>
            <desc id="interactive-3d-desc">Bốn tầng được tách theo chiều đứng. Mỗi tầng và mỗi phòng đều có thể chọn bằng chuột hoặc bàn phím.</desc>
            <defs>
              <filter id="floor-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#0f172a" floodOpacity="0.14" /></filter>
            </defs>
            <ellipse cx="360" cy="548" rx="205" ry="32" fill="#94a3b8" opacity="0.16" />
            <g filter="url(#floor-shadow)" className="transition-transform duration-300 ease-out motion-reduce:transition-none">
              {floorsAscending.map((floor, index) => {
                const layout = resolveFloorLayoutSpec(building, floor);
                const baseZ = floorBaseZ(index, floor.id);
                const isActive = floor.id === activeFloorId;
                if (!layout) {
                  return (
                    <GroundFloorModel
                      key={floor.id}
                      floor={floor}
                      baseZ={baseZ}
                      settings={settings}
                      isActive={isActive}
                      activeRoomId={activeRoomId}
                      onSelectFloor={() => onSelectFloor(floor.id)}
                      onSelectRoom={(roomId) => onSelectRoom(floor.id, roomId)}
                    />
                  );
                }
                return (
                  <FloorModel
                    key={floor.id}
                    floor={floor}
                    layout={layout}
                    baseZ={baseZ}
                    settings={settings}
                    isActive={isActive}
                    activeRoomId={activeRoomId}
                    hoveredRoomId={hoveredRoomId}
                    onHoverRoom={setHoveredRoomId}
                    onSelectFloor={() => onSelectFloor(floor.id)}
                    onSelectRoom={(roomId) => onSelectRoom(floor.id, roomId)}
                  />
                );
              })}
            </g>
          </svg>
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-3 rounded-xl border border-white/80 bg-white/90 px-3 py-2 text-[9px] font-bold text-slate-600 shadow-sm backdrop-blur">
            {Object.entries(STATUS_COLORS).slice(0, 4).map(([key, status]) => <span key={key} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: status.strong }} />{status.label}</span>)}
          </div>
        </div>

        <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1" aria-label="Danh sách tầng và phòng">
          {floorsDescending.map((floor) => {
            const active = floor.id === activeFloorId;
            const occupied = floor.rooms.filter((room) => room.status === "occupied" || room.status === "expiring_soon").length;
            const occupancy = floor.rooms.length ? Math.round((occupied / floor.rooms.length) * 100) : 0;
            return (
              <article key={floor.id} className={`rounded-2xl border p-3 transition-colors motion-reduce:transition-none ${active ? "border-primary/40 bg-primary/[0.055] shadow-sm" : "border-border/60 bg-card hover:border-primary/25"}`}>
                <button type="button" onClick={() => onSelectFloor(floor.id)} className="flex min-h-11 w-full items-center justify-between rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-pressed={active}>
                  <span className="flex items-center gap-2 text-xs font-black text-text"><Layers3 size={14} className={active ? "text-primary" : "text-muted"} />{getFloorDisplayName(floor.number, building.code)}</span>
                  <span className={`text-[10px] font-black ${occupancy >= 50 ? "text-emerald-600" : "text-muted"}`}>{occupancy}%</span>
                </button>
                <div className="mt-1.5 flex flex-col gap-1.5 border-t border-border/35 pt-2">
                  {floor.rooms.map((room) => {
                    const status = STATUS_COLORS[room.status];
                    const selected = room.id === activeRoomId;
                    const RoomIcon = room.type === "2PN" ? Sofa : floor.number === 1 ? CarFront : BedDouble;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => onSelectRoom(floor.id, room.id)}
                        onMouseEnter={() => setHoveredRoomId(room.id)}
                        onMouseLeave={() => setHoveredRoomId(null)}
                        aria-pressed={selected}
                        className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none ${selected ? "border-primary/35 bg-white shadow-sm" : "border-transparent hover:border-border/60 hover:bg-slate-50"}`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: status.fill, color: status.strong }}><RoomIcon size={13} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10px] font-black text-text">{getRoomDisplayName(room)}</span>
                          <span className="block truncate text-[9px] font-semibold text-muted">{room.type === "2PN" ? "Suite 2PN mini" : floor.number === 1 ? "Phòng + khu để xe" : "Phòng đơn"}</span>
                        </span>
                        <i className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: status.strong }} aria-label={status.label} />
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default memo(InteractiveBuilding3D);
