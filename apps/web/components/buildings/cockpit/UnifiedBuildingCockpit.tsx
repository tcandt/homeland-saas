"use client";

import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Eye,
  FileText,
  Layers3,
  MapPin,
  Pencil,
  RotateCcw,
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
import { getOverviewFloorHotspots, getOverviewRoomHotspots } from "./building-image-maps";
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



type OverviewRoomSide = "left" | "middle" | "right";
type OverviewPoint = { x: number; y: number };
type OverviewRoomHotspotDraft = Partial<Record<CockpitFloorId, Partial<Record<OverviewRoomSide, string>>>>;
type OverviewDragState =
  | { kind: "floor"; floorId: CockpitFloorId; pointIndex: number }
  | { kind: "room"; floorId: CockpitFloorId; side: OverviewRoomSide; pointIndex: number };

function parseOverviewPolygon(points: string): OverviewPoint[] {
  return points
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x, y };
    })
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function pointsToOverviewPolygon(points: OverviewPoint[]) {
  return points.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(" ");
}

function cloneOverviewFloorHotspots(points: Record<CockpitFloorId, string>) {
  return { ...points };
}

function cloneOverviewRoomHotspots(points: OverviewRoomHotspotDraft): OverviewRoomHotspotDraft {
  return Object.fromEntries(
    Object.entries(points).map(([floorId, sides]) => [floorId, { ...(sides || {}) }]),
  ) as OverviewRoomHotspotDraft;
}

function getOverviewRoomLabelAnchor(points: string) {
  const coords = parseOverviewPolygon(points);
  if (!coords.length) return { x: 0, y: 0 };
  const minX = Math.min(...coords.map((point) => point.x));
  const maxX = Math.max(...coords.map((point) => point.x));
  const minY = Math.min(...coords.map((point) => point.y));
  const maxY = Math.max(...coords.map((point) => point.y));
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

const overviewRoomSides = ["left", "middle", "right"] as const;

function getOverviewRoomSpec(floor: CockpitFloorSpec, side: OverviewRoomSide): CockpitRoomSpec | undefined {
  if (floor.id === "ground") {
    return side === "right" ? floor.rooms[0] : undefined;
  }
  if (floor.rooms.length >= 3) {
    if (side === "right") return floor.rooms[0];
    if (side === "middle") return floor.rooms[1];
    return floor.rooms[2];
  }
  if (side === "middle") return undefined;
  return side === "left" ? floor.rooms[0] : floor.rooms[1];
}

function getOverviewStatusText(status: string) {
  switch (status) {
    case "occupied":
      return "Đã thuê";
    case "expiring_soon":
      return "Sắp hết HĐ";
    case "deposited":
      return "Đã cọc";
    case "maintenance":
      return "Cảnh báo";
    default:
      return "Trống";
  }
}

function getOverviewStatusColor(status: string) {
  switch (status) {
    case "occupied":
      return {
        fill: "rgba(34, 197, 94, 0.32)",
        stroke: "rgba(34, 197, 94, 0.75)",
        strokeActive: "#22c55e",
        labelFill: "rgba(236, 253, 245, 0.96)",
        labelText: "#047857",
      };
    case "expiring_soon":
      return {
        fill: "rgba(249, 115, 22, 0.32)",
        stroke: "rgba(249, 115, 22, 0.75)",
        strokeActive: "#f97316",
        labelFill: "rgba(255, 247, 237, 0.96)",
        labelText: "#c2410c",
      };
    case "deposited":
      return {
        fill: "rgba(14, 165, 233, 0.32)",
        stroke: "rgba(14, 165, 233, 0.75)",
        strokeActive: "#0ea5e9",
        labelFill: "rgba(240, 249, 255, 0.96)",
        labelText: "#0369a1",
      };
    case "maintenance":
      return {
        fill: "rgba(239, 68, 68, 0.32)",
        stroke: "rgba(239, 68, 68, 0.75)",
        strokeActive: "#ef4444",
        labelFill: "rgba(255, 241, 242, 0.96)",
        labelText: "#be123c",
      };
    default:
      return {
        fill: "rgba(148, 163, 184, 0.18)",
        stroke: "rgba(148, 163, 184, 0.55)",
        strokeActive: "#64748b",
        labelFill: "rgba(248, 250, 252, 0.96)",
        labelText: "#475569",
      };
  }
}

function BuildingModelViewer({
  building,
  floor,
  activeRoomId,
  debugMode,
  onSelectFloor,
  onEditBuilding,
}: {
  building: CockpitBuildingSpec;
  floor: CockpitFloorSpec;
  activeRoomId?: string | null;
  debugMode: boolean;
  onSelectFloor: (floorId: CockpitFloorId) => void;
  onEditBuilding?: (buildingCode: string) => void;
}) {
  const orderedFloors = useMemo(() => [...building.floors].reverse(), [building.floors]);
  const initialOverviewFloorPoints = useMemo(() => getOverviewFloorHotspots(building.templateId), [building.templateId]);
  const initialOverviewRoomPoints = useMemo(() => getOverviewRoomHotspots(building.templateId), [building.templateId]);
  const [debugFloorPoints, setDebugFloorPoints] = useState(() => cloneOverviewFloorHotspots(initialOverviewFloorPoints));
  const [debugRoomPoints, setDebugRoomPoints] = useState(() => cloneOverviewRoomHotspots(initialOverviewRoomPoints));
  const [overviewEditMode, setOverviewEditMode] = useState<"floors" | "rooms">("floors");
  const [overviewDragState, setOverviewDragState] = useState<OverviewDragState | null>(null);
  const [overviewCopied, setOverviewCopied] = useState(false);
  const [hoveredFloorId, setHoveredFloorId] = useState<CockpitFloorId | null>(null);
  const overviewSvgRef = useRef<SVGSVGElement>(null);
  const activeFloorId = hoveredFloorId || floor.id;
  const overviewFloorPoints = debugMode ? debugFloorPoints : initialOverviewFloorPoints;
  const overviewRoomPoints = debugMode ? debugRoomPoints : initialOverviewRoomPoints;

  useEffect(() => {
    setDebugFloorPoints(cloneOverviewFloorHotspots(initialOverviewFloorPoints));
    setDebugRoomPoints(cloneOverviewRoomHotspots(initialOverviewRoomPoints));
    setOverviewDragState(null);
    setOverviewCopied(false);
  }, [building.code, initialOverviewFloorPoints, initialOverviewRoomPoints]);

  const overviewPointerToViewBox = useCallback((clientX: number, clientY: number) => {
    const rect = overviewSvgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * building.overviewImage.width,
      y: ((clientY - rect.top) / rect.height) * building.overviewImage.height,
    };
  }, [building.overviewImage.height, building.overviewImage.width]);

  const handleOverviewPointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    if (!debugMode || !overviewDragState) return;
    const point = overviewPointerToViewBox(event.clientX, event.clientY);
    if (!point) return;
    if (overviewDragState.kind === "floor") {
      setDebugFloorPoints((current) => {
        const points = parseOverviewPolygon(current[overviewDragState.floorId]);
        points[overviewDragState.pointIndex] = point;
        return { ...current, [overviewDragState.floorId]: pointsToOverviewPolygon(points) };
      });
      return;
    }
    setDebugRoomPoints((current) => {
      const floorDraft = { ...(current[overviewDragState.floorId] || {}) };
      const points = parseOverviewPolygon(floorDraft[overviewDragState.side] || "");
      points[overviewDragState.pointIndex] = point;
      return {
        ...current,
        [overviewDragState.floorId]: {
          ...floorDraft,
          [overviewDragState.side]: pointsToOverviewPolygon(points),
        },
      };
    });
  }, [debugMode, overviewDragState, overviewPointerToViewBox]);

  const copyOverviewJson = async () => {
    const payload = {
      buildingCode: building.code,
      templateId: building.templateId,
      overviewFloorHotspots: debugFloorPoints,
      overviewRoomHotspots: debugRoomPoints,
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setOverviewCopied(true);
    window.setTimeout(() => setOverviewCopied(false), 1400);
  };

  const resetOverviewDraft = () => {
    setDebugFloorPoints(cloneOverviewFloorHotspots(initialOverviewFloorPoints));
    setDebugRoomPoints(cloneOverviewRoomHotspots(initialOverviewRoomPoints));
    setOverviewDragState(null);
  };

  return (
    <article data-testid="building-model-viewer" className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/30 dark:border-white/5 bg-card shadow-[0_10px_26px_rgb(var(--shadow-color)/0.055)]">
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

      <div className="relative min-h-[clamp(430px,58vh,560px)] flex-1 overflow-hidden border-y border-border/20 dark:border-white/5 bg-surface/50 dark:bg-card/60 min-[1536px]:min-h-[clamp(500px,62vh,640px)] select-none">
        <div className="pointer-events-none absolute inset-y-0 left-2 z-20 hidden w-[88px] min-[1536px]:block">
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

        <div className="absolute inset-2 flex items-center justify-center min-[1536px]:left-[58px]">
          <div
            className="relative h-[94%] max-w-full origin-center min-[1536px]:h-[96%]"
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
              ref={overviewSvgRef}
              viewBox={`0 0 ${building.overviewImage.width} ${building.overviewImage.height}`}
              className={cx("absolute inset-0 h-full w-full select-none", debugMode ? "pointer-events-auto touch-none" : "pointer-events-none")}
              onPointerMove={handleOverviewPointerMove}
              onPointerUp={() => setOverviewDragState(null)}
              onPointerCancel={() => setOverviewDragState(null)}
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
                    {overviewRoomSides.map((side) => {
                      const roomSpec = getOverviewRoomSpec(floorItem, side);
                      if (!roomSpec) return null;
                      const colors = getOverviewStatusColor(roomSpec.status);
                      const points = overviewRoomPoints[floorItem.id]?.[side] || null;
                      if (!points) return null;
                      const selected = activeRoomId === roomSpec.id;
                      const labelAnchor = getOverviewRoomLabelAnchor(points);
                      const statusText = getOverviewStatusText(roomSpec.status);
                      return (
                        <g key={side}>
                          <polygon
                            points={points}
                            fill={colors.fill}
                            stroke={selected ? colors.strokeActive : colors.stroke}
                            strokeWidth={selected ? 2.5 : 1.25}
                            vectorEffect="non-scaling-stroke"
                          />
                          <g transform={`translate(${labelAnchor.x} ${labelAnchor.y})`} aria-label={`${roomSpec.code}: ${statusText}`}>
                            <rect
                              x={-66}
                              y={-29}
                              width={132}
                              height={58}
                              rx={10}
                              fill={colors.labelFill}
                              stroke={selected ? colors.strokeActive : colors.stroke}
                              strokeWidth={1.25}
                              vectorEffect="non-scaling-stroke"
                            />
                            <circle cx={-45} cy={9} r={6} fill={colors.strokeActive} />
                            <text
                              x={0}
                              y={-5}
                              textAnchor="middle"
                              fill="#0f172a"
                              fontSize={21}
                              fontWeight={900}
                              letterSpacing={0}
                            >
                              {roomSpec.code.replace(/^PN\s*/, "")}
                            </text>
                            <text
                              x={10}
                              y={17}
                              textAnchor="middle"
                              fill={colors.labelText}
                              fontSize={17}
                              fontWeight={800}
                              letterSpacing={0}
                            >
                              {statusText}
                            </text>
                          </g>
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {debugMode && overviewEditMode === "rooms" && orderedFloors.flatMap((floorItem) => {
                return overviewRoomSides.flatMap((side) => {
                  const points = overviewRoomPoints[floorItem.id]?.[side];
                  if (!points) return [];
                  return parseOverviewPolygon(points).map((point, pointIndex) => (
                    <circle
                      key={`overview-room-debug-${floorItem.id}-${side}-${pointIndex}`}
                      cx={point.x}
                      cy={point.y}
                      r={7}
                      fill="#f97316"
                      stroke="#ffffff"
                      strokeWidth={2.5}
                      vectorEffect="non-scaling-stroke"
                      className="pointer-events-auto cursor-grab active:cursor-grabbing"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        event.currentTarget.setPointerCapture(event.pointerId);
                        setOverviewDragState({ kind: "room", floorId: floorItem.id, side, pointIndex });
                      }}
                    />
                  ));
                });
              })}

              {orderedFloors.map((item) => {
                const active = activeFloorId === item.id;
                return (
                  <polygon
                    key={item.id}
                    points={overviewFloorPoints[item.id]}
                    role="button"
                    tabIndex={0}
                    aria-label={`Mở ${item.label}`}
                    aria-pressed={floor.id === item.id}
                    fill={active ? "rgba(14,165,233,0.075)" : "transparent"}
                    stroke={active ? "#0ea5e9" : "transparent"}
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                    className={cx(
                      "cursor-pointer outline-none transition-[fill,stroke,filter] duration-200 select-none hover:fill-[rgba(14,165,233,0.055)] focus-visible:stroke-[#0ea5e9] motion-reduce:transition-none",
                      debugMode && overviewEditMode === "rooms" ? "pointer-events-none" : "pointer-events-auto",
                    )}
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

              {debugMode && overviewEditMode === "floors" && orderedFloors.flatMap((item) => {
                const points = parseOverviewPolygon(overviewFloorPoints[item.id]);
                return points.map((point, pointIndex) => (
                  <circle
                    key={`overview-floor-debug-${item.id}-${pointIndex}`}
                    cx={point.x}
                    cy={point.y}
                    r={7}
                    fill="#0ea5e9"
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    vectorEffect="non-scaling-stroke"
                    className="pointer-events-auto cursor-grab active:cursor-grabbing"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setOverviewDragState({ kind: "floor", floorId: item.id, pointIndex });
                    }}
                  />
                ));
              })}
            </svg>
          </div>
        </div>
      </div>

      {debugMode && (
        <div className="border-b border-border/20 dark:border-white/5 px-3.5 py-2">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-sky-300 bg-sky-50/70 p-2 text-[12px] font-bold text-slate-700">
            <span className="mr-1 text-sky-700">3D Overview Polygon Editor</span>
            <div className="flex rounded-lg border border-sky-200 bg-white p-0.5">
              {(["floors", "rooms"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setOverviewEditMode(mode)}
                  className={cx(
                    "rounded-md px-2.5 py-1 transition-colors",
                    overviewEditMode === mode ? "bg-sky-500 text-white" : "text-slate-600 hover:bg-sky-50",
                  )}
                >
                  {mode === "floors" ? "Tang" : "Phong"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={copyOverviewJson}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-sky-700 hover:bg-sky-50"
            >
              {overviewCopied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              {overviewCopied ? "Copied" : "Copy JSON"}
            </button>
            <button
              type="button"
              onClick={resetOverviewDraft}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw size={14} aria-hidden />
              Khoi phuc
            </button>
            <span className="text-slate-500">Keo cac diem tren so do tong the 3D.</span>
          </div>
        </div>
      )}

      <div className="px-3.5 py-2.5"><StatusLegend /></div>
    </article>
  );
}

function FloorInformation({ floor }: { floor: CockpitFloorSpec }) {
  const operationalRooms = floor.rooms.filter((item) => item.sourceRoom);
  const occupants = operationalRooms.reduce((sum, item) => sum + item.occupants, 0);
  const revenue = operationalRooms.reduce((sum, item) => sum + ((item.status === "occupied" || item.status === "expiring_soon") ? item.monthlyRent || 0 : 0), 0);
  const values = [
    ["Phòng đã đồng bộ", `${operationalRooms.length}/${floor.rooms.length}`],
    ["Tỷ lệ lấp đầy", `${getFloorOccupancy(floor)}%`],
    ["Tạm trú", `${occupants} người`],
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
  onOpenRoomInspector,
  onOpenRoomModal,
}: {
  building: CockpitBuildingSpec;
  floor: CockpitFloorSpec;
  room: CockpitRoomSpec | null;
  debugMode: boolean;
  highlightedRoomCode: string | null;
  onHighlightRoom: (roomCode: string | null) => void;
  onSelectFloor: (floorId: CockpitFloorId) => void;
  onSelectRoom: (room: CockpitRoomSpec) => void;
  onOpenRoomInspector: (room: CockpitRoomSpec) => void;
  onOpenRoomModal?: (roomId: string, tab?: string) => void;
}) {
  const [tab, setTab] = useState<"rooms" | "floor">("rooms");
  const panelRef = useRef<HTMLElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    room: CockpitRoomSpec;
  } | null>(null);

  const handleOpenRoomProfile = useCallback((targetRoom: CockpitRoomSpec) => {
    onSelectRoom(targetRoom);
    const targetId = targetRoom.sourceRoom?.id || targetRoom.id;
    if (onOpenRoomModal && targetId) {
      onOpenRoomModal(targetId, "overview");
    } else if (onOpenRoomInspector) {
      onOpenRoomInspector(targetRoom);
    }
  }, [onOpenRoomModal, onOpenRoomInspector, onSelectRoom]);

  const handleContextMenu = useCallback((targetRoom: CockpitRoomSpec, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onSelectRoom(targetRoom);
    const menuWidth = 230;
    const menuHeight = 180;
    const x = Math.max(12, Math.min(event.clientX, window.innerWidth - menuWidth - 16));
    const y = Math.max(12, Math.min(event.clientY, window.innerHeight - menuHeight - 16));
    setContextMenu({ x, y, room: targetRoom });
  }, [onSelectRoom]);

  useEffect(() => {
    if (!contextMenu) return;
    const handleDismiss = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("click", handleDismiss);
    window.addEventListener("contextmenu", handleDismiss);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", handleDismiss);
      window.removeEventListener("contextmenu", handleDismiss);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  return (
    <section ref={panelRef} data-testid="floor-workspace-panel" className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/30 dark:border-white/5 bg-card shadow-[0_10px_26px_rgb(var(--shadow-color)/0.055)]">
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

      <div className="flex min-h-0 flex-1 flex-col p-3">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[12px] font-black uppercase tracking-wide text-text">Sơ đồ mặt bằng {floor.label}</h3>
          <StatusLegend />
        </div>
        <div className="h-[clamp(300px,42vh,430px)] rounded-[14px] bg-surface/45 p-2 min-[1536px]:h-[clamp(360px,44vh,500px)]">
          <FloorPlanCanvas
            floor={floor}
            buildingCode={building.code}
            selectedRoomCode={room?.urlCode || null}
            highlightedRoomCode={highlightedRoomCode}
            onSelectRoom={onSelectRoom}
            onOpenRoomInspector={onOpenRoomInspector}
            onOpenRoomModal={onOpenRoomModal}
            onContextMenuRoom={handleContextMenu}
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
              onOpenRoomInspector={onOpenRoomInspector}
              onOpenRoomModal={onOpenRoomModal}
              onContextMenuRoom={handleContextMenu}
              onHoverRoom={onHighlightRoom}
            />
          ) : <FloorInformation floor={floor} />}
        </div>
      </div>

      {/* Floating Context Menu for Rooms */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-[99999] min-w-[220px] overflow-hidden rounded-2xl border border-border/70 dark:border-white/10 bg-card p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-lg animate-in fade-in zoom-in-95 duration-150 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b border-border/40 dark:border-white/5 mb-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-black text-[13px] text-text">Phòng {contextMenu.room.code}</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {getStatusLabel(contextMenu.room.status)}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-muted truncate mt-0.5">{contextMenu.room.type}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              handleOpenRoomProfile(contextMenu.room);
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-left text-[12px] font-black text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm shadow-primary/25 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FileText size={15} />
              <span>Mở hồ sơ phòng</span>
            </div>
            <ArrowRight size={13} />
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectRoom(contextMenu.room);
              onOpenRoomInspector?.(contextMenu.room);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[12px] font-bold text-text hover:bg-surface transition-colors mt-0.5 cursor-pointer"
          >
            <Eye size={15} className="text-muted" />
            <span>Xem chi tiết bên phải</span>
          </button>

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.room.code);
              setContextMenu(null);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-[12px] font-bold text-text hover:bg-surface transition-colors border-t border-border/30 dark:border-white/5 mt-1 pt-1.5 cursor-pointer"
          >
            <Copy size={14} className="text-muted" />
            <span>Sao chép mã phòng</span>
          </button>
        </div>
      )}
    </section>
  );
}

function FloorOperationsPanel({ floor, onSelectRoom }: { floor: CockpitFloorSpec; onSelectRoom: (room: CockpitRoomSpec) => void }) {
  const operationalRooms = floor.rooms.filter((item) => item.sourceRoom);
  const occupied = floor.rooms.filter((item) => item.status === "occupied" || item.status === "expiring_soon").length;
  const occupants = operationalRooms.reduce((sum, item) => sum + item.occupants, 0);

  return (
    <aside className="hidden h-full min-w-0 overflow-hidden rounded-2xl border border-border/30 dark:border-white/5 bg-card shadow-[0_10px_26px_rgb(var(--shadow-color)/0.055)] min-[1536px]:sticky min-[1536px]:top-3 min-[1536px]:flex min-[1536px]:flex-col" aria-label={`Thông tin ${floor.label}`}>
      <header className="border-b border-border/20 dark:border-white/5 px-4 py-3.5">
        <h2 className="text-[16px] font-black text-text">Thông tin tầng</h2>
        <p className="mt-1 text-[12px] font-semibold text-muted">{floor.label} · {occupied}/{floor.rooms.length} phòng đã thuê</p>
      </header>
      <div className="grid grid-cols-2 gap-2 border-b border-border/20 dark:border-white/5 p-3">
        <div className="rounded-xl bg-surface/55 p-2.5">
          <span className="text-[12px] font-semibold text-muted">Tạm trú</span>
          <strong className="mt-0.5 block text-[17px] font-black tabular-nums text-text">{occupants} người</strong>
        </div>
        <div className="rounded-xl bg-primary/[0.055] p-2.5">
          <span className="text-[12px] font-semibold text-muted">Đã thuê</span>
          <strong className="mt-0.5 block text-[17px] font-black tabular-nums text-primary">{occupied}/{floor.rooms.length}</strong>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
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
  onEditBuilding,
  onOpenRoomModal,
}: UnifiedBuildingCockpitProps) {
  const [highlightedRoomCode, setHighlightedRoomCode] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
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

  const openRoomInspector = (nextRoom: CockpitRoomSpec) => {
    selectRoom(nextRoom);
    setInspectorOpen(true);
  };

  const closeRoomInspector = () => {
    setInspectorOpen(false);
    onCloseRoom();
  };

  return (
    <div className="space-y-3">
      <BuildingPortfolioRail
        buildings={portfolioBuildings}
        activeBuildingCode={building.code}
        onSelectBuilding={onSelectBuilding}
        onConfigureBuilding={onEditBuilding}
      />
      <PortfolioKpiBar buildings={portfolioBuildings} />

      {building.layoutStatus === "pending" || !floor ? (
        <PendingLayout building={building} onEditBuilding={onEditBuilding} />
      ) : (
        <div className="grid min-w-0 items-stretch gap-3 lg:grid-cols-2 min-[1536px]:grid-cols-[minmax(260px,0.75fr)_minmax(420px,1.6fr)_minmax(260px,330px)]">
          <BuildingModelViewer building={building} floor={floor} activeRoomId={room?.id} debugMode={debugMode} onSelectFloor={onSelectFloor} onEditBuilding={onEditBuilding} />
          <FloorPlanPanel
            building={building}
            floor={floor}
            room={room}
            debugMode={debugMode}
            highlightedRoomCode={highlightedRoomCode}
            onHighlightRoom={setHighlightedRoomCode}
            onSelectFloor={onSelectFloor}
            onSelectRoom={selectRoom}
            onOpenRoomInspector={openRoomInspector}
            onOpenRoomModal={onOpenRoomModal}
          />
          {room ? (
            <>
              <button
                type="button"
                aria-label="Đóng lớp phủ thông tin phòng"
                onClick={closeRoomInspector}
                className={inspectorOpen ? "fixed inset-0 z-[10001] hidden cursor-default bg-black/45 backdrop-blur-[1px] md:block xl:hidden" : "hidden"}
              />
              <div className={inspectorOpen ? "contents" : "hidden xl:contents"}>
                <RoomInspectorDrawer
                  floor={floor}
                  room={room}
                  selectedSpaceId={null}
                  onClose={closeRoomInspector}
                  onOpenRoomModal={room.sourceRoom && onOpenRoomModal ? (roomId, tab) => {
                    closeRoomInspector();
                    onOpenRoomModal(roomId, tab);
                  } : undefined}
                />
              </div>
            </>
          ) : <FloorOperationsPanel floor={floor} onSelectRoom={selectRoom} />}
        </div>
      )}
    </div>
  );
}
