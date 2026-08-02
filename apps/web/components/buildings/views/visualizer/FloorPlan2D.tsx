"use client";

import React, { memo, useMemo } from "react";
import type { Room, RoomStatus } from "../../building.types";
import type {
  DoorOpening,
  FloorLayoutSpec,
  FurnitureItemSpec,
  Point2D,
  SpaceSpec,
  WallSegment,
} from "./geometry/floor-layout.types";

interface FloorPlan2DProps {
  layout: FloorLayoutSpec;
  rooms: Room[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  zoom?: number;
}

const SCALE = 32;
const ORIGIN_X = 50;
const ORIGIN_Y = 50;
const VIEW_WIDTH = 740;
const VIEW_HEIGHT = 260;

const SPACE_LABELS: Record<SpaceSpec["type"], string> = {
  "mini-bedroom": "Phòng ngủ mini",
  "living-room": "Phòng khách",
  "single-bedroom": "Phòng ngủ",
  bathroom: "WC / Tắm",
  kitchen: "Bếp",
  "stair-core": "Cầu thang",
  corridor: "Hành lang",
  utility: "Giặt / rửa",
  parking: "Để xe",
};

const STATUS_FILL: Record<RoomStatus, string> = {
  vacant: "#eef2ff",
  occupied: "#ecfdf5",
  expiring_soon: "#fffbeb",
  deposited: "#eff6ff",
  maintenance: "#fff1f2",
};

function project(point: Point2D) {
  return { x: ORIGIN_X + point.y * SCALE, y: ORIGIN_Y + point.x * SCALE };
}

function polygonPoints(boundary: Point2D[]) {
  return boundary.map((point) => {
    const projected = project(point);
    return `${projected.x},${projected.y}`;
  }).join(" ");
}

function centroid(boundary: Point2D[]) {
  const total = boundary.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return project({ x: total.x / boundary.length, y: total.y / boundary.length });
}

function pointAlongWall(wall: WallSegment, distance: number): Point2D {
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const length = Math.hypot(dx, dy);
  return { x: wall.start.x + (dx / length) * distance, y: wall.start.y + (dy / length) * distance };
}

function wallLength(wall: WallSegment) {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

function WallWithOpenings({ wall, doors }: { wall: WallSegment; doors: DoorOpening[] }) {
  const cuts = doors
    .map((door) => ({ start: door.offset, end: door.offset + door.width }))
    .sort((a, b) => a.start - b.start);
  const segments: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const cut of cuts) {
    if (cut.start > cursor) segments.push({ start: cursor, end: cut.start });
    cursor = Math.max(cursor, cut.end);
  }
  const length = wallLength(wall);
  if (cursor < length) segments.push({ start: cursor, end: length });

  return segments.map((segment, index) => {
    const start = project(pointAlongWall(wall, segment.start));
    const end = project(pointAlongWall(wall, segment.end));
    return (
      <line
        key={`${wall.id}-${index}`}
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="#172033"
        strokeWidth={wall.thickness * SCALE}
        strokeLinecap="square"
      />
    );
  });
}

function DoorSymbol({ door, wall }: { door: DoorOpening; wall: WallSegment }) {
  const hingeDistance = door.hinge === "start" ? door.offset : door.offset + door.width;
  const closedDistance = door.hinge === "start" ? door.offset + door.width : door.offset;
  const hinge = project(pointAlongWall(wall, hingeDistance));
  const closed = project(pointAlongWall(wall, closedDistance));
  const radius = door.width * SCALE;
  const wallDx = closed.x - hinge.x;
  const wallDy = closed.y - hinge.y;
  const direction = door.swingDirection === "clockwise" ? 1 : -1;
  const open = {
    x: hinge.x - direction * wallDy,
    y: hinge.y + direction * wallDx,
  };
  const sweep = door.swingDirection === "clockwise" ? 1 : 0;

  return (
    <g data-door-id={door.id}>
      <line x1={hinge.x} y1={hinge.y} x2={open.x} y2={open.y} stroke="#475569" strokeWidth="2" />
      <path
        d={`M ${closed.x} ${closed.y} A ${radius} ${radius} 0 0 ${sweep} ${open.x} ${open.y}`}
        fill="none"
        stroke="#94a3b8"
        strokeWidth="1.2"
        strokeDasharray="3 2"
      />
      <circle cx={hinge.x} cy={hinge.y} r="2" fill="#475569" />
    </g>
  );
}

function Furniture({ item }: { item: FurnitureItemSpec }) {
  const center = project(item);
  const rotation = 90 - item.rotation;
  const common = { fill: "#f8fafc", stroke: "#64748b", strokeWidth: 1.15 };

  return (
    <g transform={`translate(${center.x} ${center.y}) rotate(${rotation})`} data-furniture-id={item.id}>
      {item.type === "single-bed" || item.type === "double-bed" ? (
        <g>
          <rect x="-27" y="-13" width="54" height="26" rx="3" {...common} />
          <rect x="-23" y="-10" width="14" height="20" rx="4" fill="#dbeafe" stroke="#64748b" />
          <path d="M -5 -12 V 12 M 5 -12 V 12" stroke="#cbd5e1" />
          <path d="M 15 -12 V 12" stroke="#94a3b8" strokeDasharray="2 2" />
        </g>
      ) : item.type === "sofa" ? (
        <g>
          <rect x="-24" y="-12" width="48" height="24" rx="7" fill="#dbeafe" stroke="#64748b" />
          <rect x="-27" y="-13" width="7" height="26" rx="3" fill="#bfdbfe" stroke="#64748b" />
          <rect x="20" y="-13" width="7" height="26" rx="3" fill="#bfdbfe" stroke="#64748b" />
          <path d="M 0 -10 V 10" stroke="#64748b" />
        </g>
      ) : item.type === "coffee-table" ? (
        <g><rect x="-13" y="-8" width="26" height="16" rx="5" {...common} /><circle cx="-9" cy="-5" r="1.5" fill="#64748b" /><circle cx="9" cy="5" r="1.5" fill="#64748b" /></g>
      ) : item.type === "kitchen-counter" ? (
        <g>
          <rect x="-31" y="-10" width="62" height="20" rx="2" fill="#e2e8f0" stroke="#64748b" />
          <rect x="-28" y="-7" width="18" height="14" rx="2" fill="#f8fafc" stroke="#64748b" />
          <path d="M -25 0 H -13 M -19 -5 V 5" stroke="#94a3b8" />
          <circle cx="2" cy="-4" r="3" fill="none" stroke="#64748b" /><circle cx="10" cy="-4" r="3" fill="none" stroke="#64748b" />
          <circle cx="2" cy="4" r="3" fill="none" stroke="#64748b" /><circle cx="10" cy="4" r="3" fill="none" stroke="#64748b" />
          <rect x="20" y="-9" width="11" height="18" fill="#cbd5e1" stroke="#64748b" />
          <path d="M 25 -7 V 7" stroke="#94a3b8" />
        </g>
      ) : item.type === "toilet" ? (
        <g><rect x="-8" y="-12" width="16" height="7" rx="2" {...common} /><ellipse cx="0" cy="3" rx="9" ry="12" {...common} /><ellipse cx="0" cy="3" rx="5" ry="7" fill="none" stroke="#94a3b8" /></g>
      ) : item.type === "sink" ? (
        <g><ellipse cx="0" cy="0" rx="11" ry="8" {...common} /><ellipse cx="0" cy="1" rx="7" ry="4" fill="none" stroke="#94a3b8" /><path d="M 0 -8 V -12 Q 6 -12 6 -6" fill="none" stroke="#64748b" /></g>
      ) : item.type === "desk" ? (
        <g><rect x="-20" y="-9" width="40" height="18" rx="2" {...common} /><rect x="-6" y="-7" width="12" height="7" fill="#cbd5e1" stroke="#64748b" /><circle cx="0" cy="17" r="7" fill="#dbeafe" stroke="#64748b" /></g>
      ) : item.type === "washer" ? (
        <g><rect x="-10" y="-11" width="20" height="22" rx="2" fill="#e2e8f0" stroke="#64748b" /><circle cx="0" cy="1" r="7" fill="#f8fafc" stroke="#64748b" /><circle cx="6" cy="-7" r="1.5" fill="#64748b" /></g>
      ) : item.type === "wardrobe" ? (
        <g><rect x="-22" y="-8" width="44" height="16" rx="1" fill="#f1f5f9" stroke="#64748b" /><path d="M 0 -8 V 8 M -4 0 H 4" stroke="#94a3b8" /></g>
      ) : item.type === "refrigerator" ? (
        <g><rect x="-10" y="-14" width="20" height="28" rx="2" fill="#e2e8f0" stroke="#64748b" /><path d="M -10 -3 H 10 M 6 -10 V -5 M 6 1 V 8" stroke="#64748b" /></g>
      ) : null}
    </g>
  );
}

function Shower({ space }: { space: SpaceSpec }) {
  const bounds = space.boundary;
  const minX = Math.min(...bounds.map((point) => point.x));
  const minY = Math.min(...bounds.map((point) => point.y));
  const anchor = project({ x: minX + 0.35, y: minY + 0.35 });
  return (
    <g transform={`translate(${anchor.x} ${anchor.y})`} aria-label="Khu tắm">
      <rect x="-9" y="-9" width="18" height="18" fill="url(#shower-grid)" stroke="#64748b" />
      <circle cx="0" cy="0" r="2.5" fill="none" stroke="#64748b" />
      <path d="M -7 -7 L 7 7 M 7 -7 L -7 7" stroke="#cbd5e1" />
    </g>
  );
}

function StairCore({ space }: { space: SpaceSpec }) {
  const xs = space.boundary.map((point) => point.x);
  const ys = space.boundary.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const flightStartY = minY + 0.35;
  const landingStartY = maxY - 0.55;
  const upperFlight = { minX: minX + 0.35, maxX: minX + 2.15 };
  const lowerFlight = { minX: maxX - 2.15, maxX: maxX - 0.35 };
  const steps = Array.from(
    { length: 9 },
    (_, index) => flightStartY + ((landingStartY - flightStartY) * index) / 8,
  );
  const landingTopLeft = project({ x: upperFlight.minX, y: landingStartY });
  const landingBottomRight = project({ x: lowerFlight.maxX, y: maxY - 0.18 });
  const upperArrowStart = project({ x: (upperFlight.minX + upperFlight.maxX) / 2, y: flightStartY + 0.15 });
  const upperArrowEnd = project({ x: (upperFlight.minX + upperFlight.maxX) / 2, y: landingStartY - 0.12 });
  const lowerArrowStart = project({ x: (lowerFlight.minX + lowerFlight.maxX) / 2, y: landingStartY - 0.12 });
  const lowerArrowEnd = project({ x: (lowerFlight.minX + lowerFlight.maxX) / 2, y: flightStartY + 0.15 });
  return (
    <g data-space-id={space.id} pointerEvents="none">
      <rect
        x={landingTopLeft.x}
        y={landingTopLeft.y}
        width={landingBottomRight.x - landingTopLeft.x}
        height={landingBottomRight.y - landingTopLeft.y}
        fill="#f1f5f9"
        stroke="#64748b"
        strokeWidth="1.1"
      />
      {steps.flatMap((y, index) => {
        const upperStart = project({ x: upperFlight.minX, y });
        const upperEnd = project({ x: upperFlight.maxX, y });
        const lowerStart = project({ x: lowerFlight.minX, y });
        const lowerEnd = project({ x: lowerFlight.maxX, y });
        return [
          <line key={`upper-${index}`} x1={upperStart.x} y1={upperStart.y} x2={upperEnd.x} y2={upperEnd.y} stroke="#94a3b8" strokeWidth="1" />,
          <line key={`lower-${index}`} x1={lowerStart.x} y1={lowerStart.y} x2={lowerEnd.x} y2={lowerEnd.y} stroke="#94a3b8" strokeWidth="1" />,
        ];
      })}
      <line x1={upperArrowStart.x} y1={upperArrowStart.y} x2={upperArrowEnd.x} y2={upperArrowEnd.y} stroke="#475569" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <line x1={lowerArrowStart.x} y1={lowerArrowStart.y} x2={lowerArrowEnd.x} y2={lowerArrowEnd.y} stroke="#475569" strokeWidth="1.2" markerEnd="url(#arrow)" />
      <line
        x1={project({ x: upperFlight.maxX, y: flightStartY }).x}
        y1={project({ x: upperFlight.maxX, y: flightStartY }).y}
        x2={project({ x: upperFlight.maxX, y: landingStartY }).x}
        y2={project({ x: upperFlight.maxX, y: landingStartY }).y}
        stroke="#64748b"
        strokeWidth="1.2"
      />
      <line
        x1={project({ x: lowerFlight.minX, y: flightStartY }).x}
        y1={project({ x: lowerFlight.minX, y: flightStartY }).y}
        x2={project({ x: lowerFlight.minX, y: landingStartY }).x}
        y2={project({ x: lowerFlight.minX, y: landingStartY }).y}
        stroke="#64748b"
        strokeWidth="1.2"
      />
    </g>
  );
}

function FloorPlan2D({ layout, rooms, selectedRoomId, onSelectRoom, zoom = 100 }: FloorPlan2DProps) {
  const unitBySpaceId = useMemo(() => new Map(layout.units.flatMap((unit) => unit.spaceIds.map((spaceId) => [spaceId, unit]))), [layout]);
  const roomByCode = useMemo(() => new Map(rooms.map((room) => [room.code.trim().toUpperCase(), room])), [rooms]);
  const doorsByWall = useMemo(() => {
    const result = new Map<string, DoorOpening[]>();
    for (const door of layout.doors) result.set(door.wallId, [...(result.get(door.wallId) || []), door]);
    return result;
  }, [layout]);

  return (
    <div className="relative flex min-h-[520px] flex-1 items-center justify-center overflow-auto rounded-2xl border border-slate-200 bg-[#f7f8fa] p-2 sm:p-4" data-testid="floor-plan-2d">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full min-h-[500px] max-w-none shrink-0 transition-[width] duration-200 motion-reduce:transition-none"
        style={{ width: `${zoom}%` }}
        role="img"
        aria-labelledby="floor-plan-title floor-plan-description"
      >
        <title id="floor-plan-title">Mặt bằng 2D AutoCAD Tầng {layout.floorNumber}, tòa LK01-31</title>
        <desc id="floor-plan-description">Mặt tiền ở bên trái, {layout.units[0]?.roomCode}, cầu thang hai vế có chiếu nghỉ, {layout.units[1]?.roomCode} và mặt sau ở bên phải.</desc>
        <defs>
          <pattern id="tile-grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M 12 0 L 0 0 0 12" fill="none" stroke="#e2e8f0" strokeWidth="0.6" /></pattern>
          <pattern id="shower-grid" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M 0 4 L 4 0" stroke="#dbeafe" strokeWidth="1" /></pattern>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" /></marker>
          <marker id="dimension-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 10 0 L 0 5 L 10 10" fill="none" stroke="#64748b" strokeWidth="1.5" /></marker>
        </defs>

        <g id="room-status-fills">
          {layout.spaces.map((space) => {
            const unit = unitBySpaceId.get(space.id);
            const room = unit ? roomByCode.get(unit.roomCode.toUpperCase()) : null;
            const fill = room ? STATUS_FILL[room.status] : space.type === "stair-core" || space.type === "corridor" ? "#f1f5f9" : "#f8fafc";
            return <polygon key={space.id} points={polygonPoints(space.boundary)} fill={fill} stroke="#d9e0e8" strokeWidth="0.8" />;
          })}
        </g>
        <rect x={ORIGIN_X} y={ORIGIN_Y} width={layout.length * SCALE} height={layout.width * SCALE} fill="url(#tile-grid)" opacity="0.45" pointerEvents="none" />

        <g id="furniture">
          {layout.spaces.flatMap((space) => space.furniture.map((item) => <Furniture key={item.id} item={item} />))}
          {layout.spaces.filter((space) => space.type === "bathroom").map((space) => <Shower key={`${space.id}-shower`} space={space} />)}
          {layout.spaces.filter((space) => space.type === "stair-core").map((space) => <StairCore key={space.id} space={space} />)}
        </g>

        <g id="walls">
          {layout.walls.map((wall) => <WallWithOpenings key={wall.id} wall={wall} doors={doorsByWall.get(wall.id) || []} />)}
        </g>
        <g id="doors">
          {layout.doors.map((door) => {
            const wall = layout.walls.find((candidate) => candidate.id === door.wallId);
            return wall ? <DoorSymbol key={door.id} door={door} wall={wall} /> : null;
          })}
        </g>

        <g id="labels" pointerEvents="none">
          {layout.units.map((unit) => {
            const center = centroid(unit.boundary);
            return <text key={unit.id} x={center.x} y={center.y - 16} textAnchor="middle" fontSize="10" fontWeight="800" fill="#334155">{unit.roomCode}</text>;
          })}
          {layout.spaces.map((space) => {
            const center = centroid(space.boundary);
            return <text key={space.id} x={center.x} y={center.y + 4} textAnchor="middle" fontSize="6.5" fontWeight="650" fill="#64748b">{SPACE_LABELS[space.type]}</text>;
          })}
          <text x={ORIGIN_X - 4} y={ORIGIN_Y - 12} textAnchor="start" fontSize="7" fontWeight="800" fill="#475569">MẶT TIỀN</text>
          <text x={ORIGIN_X + layout.length * SCALE + 4} y={ORIGIN_Y - 12} textAnchor="end" fontSize="7" fontWeight="800" fill="#475569">MẶT SAU</text>
        </g>

        <g id="hotspots">
          {layout.spaces.map((space) => {
            const unit = unitBySpaceId.get(space.id);
            const room = unit ? roomByCode.get(unit.roomCode.toUpperCase()) : null;
            if (!unit || !room) return null;
            const label = `${SPACE_LABELS[space.type]} thuộc ${unit.roomCode}`;
            return (
              <polygon
                key={space.id}
                points={polygonPoints(space.boundary)}
                role="button"
                tabIndex={0}
                aria-label={`Chọn ${label}`}
                aria-pressed={selectedRoomId === room.id}
                data-space-id={space.id}
                data-room-id={room.id}
                className="cursor-pointer fill-transparent stroke-transparent transition-colors duration-200 hover:fill-indigo-500/10 focus:fill-indigo-500/15 focus:stroke-indigo-500 focus:outline-none motion-reduce:transition-none"
                onClick={() => onSelectRoom(room.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectRoom(room.id);
                  }
                }}
              />
            );
          })}
        </g>

        <g id="selection" pointerEvents="none">
          {layout.spaces.map((space) => {
            const unit = unitBySpaceId.get(space.id);
            const room = unit ? roomByCode.get(unit.roomCode.toUpperCase()) : null;
            return room && room.id === selectedRoomId ? <polygon key={space.id} points={polygonPoints(space.boundary)} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" /> : null;
          })}
        </g>

        <g id="dimensions" fill="none" stroke="#64748b" strokeWidth="1">
          <line x1={ORIGIN_X} y1="28" x2={ORIGIN_X + layout.length * SCALE} y2="28" markerStart="url(#dimension-arrow)" markerEnd="url(#dimension-arrow)" />
          <line x1={ORIGIN_X} y1="34" x2={ORIGIN_X} y2={ORIGIN_Y - 2} />
          <line x1={ORIGIN_X + layout.length * SCALE} y1="34" x2={ORIGIN_X + layout.length * SCALE} y2={ORIGIN_Y - 2} />
          <text x={ORIGIN_X + (layout.length * SCALE) / 2} y="23" fill="#475569" stroke="none" textAnchor="middle" fontSize="8" fontWeight="800">20.00m</text>
          <line x1="28" y1={ORIGIN_Y} x2="28" y2={ORIGIN_Y + layout.width * SCALE} markerStart="url(#dimension-arrow)" markerEnd="url(#dimension-arrow)" />
          <line x1="34" y1={ORIGIN_Y} x2={ORIGIN_X - 2} y2={ORIGIN_Y} />
          <line x1="34" y1={ORIGIN_Y + layout.width * SCALE} x2={ORIGIN_X - 2} y2={ORIGIN_Y + layout.width * SCALE} />
          <text x="19" y={ORIGIN_Y + (layout.width * SCALE) / 2} fill="#475569" stroke="none" textAnchor="middle" fontSize="8" fontWeight="800" transform={`rotate(-90 19 ${ORIGIN_Y + (layout.width * SCALE) / 2})`}>5.00m</text>
        </g>
      </svg>
    </div>
  );
}

export default memo(FloorPlan2D);
