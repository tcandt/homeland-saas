"use client";

import Image from "next/image";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Eye, EyeOff, Move, RotateCcw } from "lucide-react";
import type { CockpitFloorSpec, CockpitRoomSpec, RoomImageMap } from "./building-cockpit.types";
import { formatVnd, getStatusLabel } from "./building-cockpit-metrics";

interface FloorPlanCanvasProps {
  floor: CockpitFloorSpec;
  selectedRoomCode: string | null;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onSelectRoom: (room: CockpitRoomSpec) => void;
  debugMode: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface TooltipState {
  room: CockpitRoomSpec;
  x: number;
  y: number;
}

interface DragState {
  roomId: string;
  pathIndex: number;
  pointIndex: number;
}

function normalizeRoomCode(value: string) {
  return value.trim().replace(/\s+/g, "-").toUpperCase();
}

function parseViewBox(viewBox: string) {
  const values = viewBox.split(/\s+/).map(Number);
  return { width: values[2] || 1, height: values[3] || 1 };
}

function parsePathPoints(path: string): Point[] {
  const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  const points: Point[] = [];
  for (let index = 0; index < numbers.length - 1; index += 2) {
    points.push({ x: numbers[index], y: numbers[index + 1] });
  }
  return points;
}

function pointsToPath(points: Point[]) {
  if (!points.length) return "";
  return `${points.map((point, index) => `${index === 0 ? "M" : "L"} ${Math.round(point.x)} ${Math.round(point.y)}`).join(" ")} Z`;
}

function cloneMaps(rooms: RoomImageMap[]) {
  return rooms.map((room) => ({ ...room, paths: [...room.paths], labelPosition: { ...room.labelPosition } }));
}

function RoomTooltip({ tooltip }: { tooltip: TooltipState }) {
  return (
    <div
      className="pointer-events-none absolute z-30 w-[230px] -translate-y-[calc(100%+14px)] rounded-xl border border-white/60 bg-slate-950/92 px-3 py-2.5 text-white shadow-xl backdrop-blur"
      style={{ left: tooltip.x, top: tooltip.y }}
      role="status"
    >
      <strong className="block text-[13px] font-black">{tooltip.room.code}</strong>
      <span className="mt-1 block text-[11px] leading-4 text-slate-200">{tooltip.room.type}</span>
      <span className="mt-1.5 flex items-center justify-between text-[11px] text-slate-300">
        <span>{getStatusLabel(tooltip.room.status)} · {tooltip.room.occupants}/{tooltip.room.capacity} người</span>
        <b className="text-white">{tooltip.room.monthlyRent ? formatVnd(tooltip.room.monthlyRent) : "—"}</b>
      </span>
    </div>
  );
}

function FloorPlanCanvas({ floor, selectedRoomCode, zoom, onZoomChange, onSelectRoom, debugMode }: FloorPlanCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const panStartRef = useRef<{ pointer: Point; pan: Point } | null>(null);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [debugCursor, setDebugCursor] = useState<Point | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hiddenRoomIds, setHiddenRoomIds] = useState<Set<string>>(new Set());
  const [draftMaps, setDraftMaps] = useState(() => cloneMaps(floor.imageMap.rooms));
  const [copied, setCopied] = useState(false);
  const dimensions = useMemo(() => parseViewBox(floor.imageMap.viewBox), [floor.imageMap.viewBox]);
  const roomsByCode = useMemo(
    () => new Map(floor.rooms.map((room) => [normalizeRoomCode(room.urlCode), room])),
    [floor.rooms],
  );

  useEffect(() => {
    setImageLoaded(false);
    setPan({ x: 0, y: 0 });
    setDraftMaps(cloneMaps(floor.imageMap.rooms));
    setHiddenRoomIds(new Set());
    setTooltip(null);
  }, [floor.id, floor.imageMap.rooms]);

  useEffect(() => {
    if (zoom <= 100) setPan({ x: 0, y: 0 });
  }, [zoom]);

  const pointerToViewBox = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * dimensions.width,
      y: ((clientY - rect.top) / rect.height) * dimensions.height,
    };
  }, [dimensions.height, dimensions.width]);

  const updatePointerPosition = useCallback((clientX: number, clientY: number, roomIdOverride?: string) => {
    const viewport = viewportRef.current;
    const activeRoomId = roomIdOverride || hoveredRoomId;
    if (viewport && activeRoomId) {
      const rect = viewport.getBoundingClientRect();
      const room = roomsByCode.get(normalizeRoomCode(activeRoomId));
      if (room) {
        setTooltip({
          room,
          x: Math.min(Math.max(clientX - rect.left + 14, 12), Math.max(12, rect.width - 242)),
          y: Math.max(clientY - rect.top, 96),
        });
      }
    }
    if (debugMode) setDebugCursor(pointerToViewBox(clientX, clientY));
  }, [debugMode, hoveredRoomId, pointerToViewBox, roomsByCode]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    updatePointerPosition(event.clientX, event.clientY);
    if (dragState) {
      const point = pointerToViewBox(event.clientX, event.clientY);
      if (!point) return;
      setDraftMaps((current) => current.map((roomMap) => {
        if (roomMap.roomId !== dragState.roomId) return roomMap;
        const paths = [...roomMap.paths];
        const points = parsePathPoints(paths[dragState.pathIndex]);
        points[dragState.pointIndex] = point;
        paths[dragState.pathIndex] = pointsToPath(points);
        return { ...roomMap, paths };
      }));
      return;
    }
    const panStart = panStartRef.current;
    if (!panStart || zoom <= 100) return;
    setPan({
      x: panStart.pan.x + event.clientX - panStart.pointer.x,
      y: panStart.pan.y + event.clientY - panStart.pointer.y,
    });
  }, [dragState, pointerToViewBox, updatePointerPosition, zoom]);

  const stopDragging = useCallback(() => {
    panStartRef.current = null;
    setDragState(null);
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (zoom <= 100 || target.closest("[data-room-hotspot]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panStartRef.current = { pointer: { x: event.clientX, y: event.clientY }, pan };
  }, [pan, zoom]);

  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    onZoomChange(Math.min(250, Math.max(60, zoom + (event.deltaY > 0 ? -10 : 10))));
  }, [onZoomChange, zoom]);

  const selectRoom = useCallback((roomId: string) => {
    const room = roomsByCode.get(normalizeRoomCode(roomId));
    if (room) onSelectRoom(room);
  }, [onSelectRoom, roomsByCode]);

  const copyDebugJson = useCallback(async () => {
    await navigator.clipboard.writeText(JSON.stringify(draftMaps, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }, [draftMaps]);

  return (
    <div className={`flex h-full min-h-0 flex-col ${debugMode ? "gap-3" : ""}`}>
      <div
        ref={viewportRef}
        id="floor-plan-viewport"
        data-testid="floor-plan-canvas"
        className="relative flex min-h-[300px] w-full flex-1 items-center justify-center overflow-hidden rounded-[14px] border border-[#e7e7f2] bg-white p-2 shadow-inner sm:p-3 fullscreen:min-h-screen fullscreen:rounded-none fullscreen:border-0 fullscreen:p-8"
        style={{ cursor: zoom > 100 ? (panStartRef.current ? "grabbing" : "grab") : "default", touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onPointerLeave={() => { if (!panStartRef.current) { setHoveredRoomId(null); setTooltip(null); } }}
        onWheel={onWheel}
      >
        {!imageLoaded && <div className="absolute inset-6 animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none" aria-label="Đang tải ảnh mặt bằng" />}
        <div
          className="relative w-full max-w-[1600px] origin-center select-none transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{
            aspectRatio: `${floor.imageMap.width} / ${floor.imageMap.height}`,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom / 100})`,
          }}
        >
          <Image
            src={floor.imageMap.src}
            alt={`Ảnh render mặt bằng 3D ${floor.label} của tòa nhà LK01-31`}
            width={floor.imageMap.width}
            height={floor.imageMap.height}
            sizes="(max-width: 1024px) 100vw, 1100px"
            className="block h-full w-full object-contain"
            draggable={false}
            priority
            onLoad={() => setImageLoaded(true)}
          />

          <svg
            ref={svgRef}
            viewBox={floor.imageMap.viewBox}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-label={`Vùng chọn phòng trên ${floor.label}`}
          >
            {debugMode && (
              <defs>
                <pattern id="hotspot-debug-grid-small" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#2563eb" strokeOpacity="0.22" strokeWidth="1" />
                </pattern>
              </defs>
            )}
            {debugMode && <rect width="100%" height="100%" fill="url(#hotspot-debug-grid-small)" pointerEvents="none" />}

            {draftMaps.map((roomMap) => {
              if (hiddenRoomIds.has(roomMap.roomId)) return null;
              const selected = normalizeRoomCode(selectedRoomCode || "") === normalizeRoomCode(roomMap.roomId);
              const hovered = hoveredRoomId === roomMap.roomId;
              return (
                <g
                  key={roomMap.roomId}
                  data-room-hotspot
                  data-room-id={roomMap.roomId}
                  data-selected={selected}
                  onMouseEnter={(event) => {
                    setHoveredRoomId(roomMap.roomId);
                    updatePointerPosition(event.clientX, event.clientY, roomMap.roomId);
                  }}
                  onMouseLeave={() => { setHoveredRoomId(null); setTooltip(null); }}
                  onClick={(event) => { event.stopPropagation(); selectRoom(roomMap.roomId); }}
                >
                  {roomMap.paths.map((path, pathIndex) => (
                    <path
                      key={`${roomMap.roomId}-${pathIndex}`}
                      d={path}
                      role="button"
                      tabIndex={pathIndex === 0 ? 0 : -1}
                      aria-label={`Chọn toàn bộ phòng ${roomMap.label}`}
                      aria-pressed={selected}
                      fill={selected ? "rgba(91,53,245,0.11)" : hovered || debugMode ? "rgba(91,53,245,0.075)" : "rgba(91,53,245,0)"}
                      stroke={selected ? "#6347f5" : hovered || debugMode ? "rgba(99,71,245,0.78)" : "transparent"}
                      strokeWidth={selected ? 3 : 2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                      className="cursor-pointer outline-none transition-[fill,stroke,filter] duration-200 focus-visible:stroke-[#5b35f5] motion-reduce:transition-none"
                      style={{ filter: selected ? "drop-shadow(0 1px 3px rgba(91,53,245,.22))" : undefined, pointerEvents: "all" }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectRoom(roomMap.roomId);
                        }
                      }}
                    />
                  ))}
                  {(selected || hovered || debugMode) && (
                    <g pointerEvents="none">
                      <rect x={roomMap.labelPosition.x - 53} y={roomMap.labelPosition.y - 18} width="106" height="32" rx="9" fill="#ffffff" fillOpacity="0.94" stroke="#5b35f5" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                      <text x={roomMap.labelPosition.x} y={roomMap.labelPosition.y + 3} textAnchor="middle" fontSize="15" fontWeight="800" fill="#4c28df">{roomMap.label}</text>
                    </g>
                  )}
                  {debugMode && roomMap.paths.flatMap((path, pathIndex) => parsePathPoints(path).map((point, pointIndex) => (
                    <circle
                      key={`${roomMap.roomId}-${pathIndex}-${pointIndex}`}
                      cx={point.x}
                      cy={point.y}
                      r="7"
                      fill="#ffffff"
                      stroke="#2563eb"
                      strokeWidth="3"
                      vectorEffect="non-scaling-stroke"
                      className="cursor-move"
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        (event.currentTarget as SVGCircleElement).setPointerCapture(event.pointerId);
                        setDragState({ roomId: roomMap.roomId, pathIndex, pointIndex });
                      }}
                    />
                  )))}
                </g>
              );
            })}
          </svg>
        </div>

        {tooltip && !debugMode && <RoomTooltip tooltip={tooltip} />}
        {debugMode && debugCursor && (
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-blue-600 px-2.5 py-1.5 font-mono text-[11px] font-bold text-white shadow-lg">
            x: {Math.round(debugCursor.x)} · y: {Math.round(debugCursor.y)}
          </div>
        )}
        {zoom > 100 && (
          <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm backdrop-blur">
            <Move size={13} /> Kéo để di chuyển
          </div>
        )}
      </div>

      {debugMode && (
        <aside className="rounded-xl border border-blue-200 bg-blue-50 p-3" aria-label="Công cụ hiệu chỉnh hotspot">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <strong className="block text-[13px] font-black text-blue-950">Hotspot Debug Editor</strong>
              <span className="text-[11px] font-semibold text-blue-700">Kéo các đỉnh màu xanh để căn theo tường ảnh render.</span>
            </div>
            <button type="button" onClick={copyDebugJson} className="flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[12px] font-black text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Đã sao chép" : "Copy JSON"}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {draftMaps.map((roomMap) => {
              const hidden = hiddenRoomIds.has(roomMap.roomId);
              return (
                <button
                  key={roomMap.roomId}
                  type="button"
                  onClick={() => setHiddenRoomIds((current) => {
                    const next = new Set(current);
                    if (next.has(roomMap.roomId)) next.delete(roomMap.roomId);
                    else next.add(roomMap.roomId);
                    return next;
                  })}
                  className="flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-[12px] font-black text-blue-900 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  {hidden ? <EyeOff size={14} /> : <Eye size={14} />} {roomMap.roomId}
                </button>
              );
            })}
            <button type="button" onClick={() => setDraftMaps(cloneMaps(floor.imageMap.rooms))} className="flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 text-[12px] font-black text-blue-900 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
              <RotateCcw size={14} /> Khôi phục
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

export default memo(FloorPlanCanvas);
