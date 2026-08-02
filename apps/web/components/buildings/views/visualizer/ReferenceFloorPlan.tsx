"use client";

import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  BedDouble,
  Bath,
  Bike,
  Maximize2,
  Minimize2,
  Minus,
  PanelsTopLeft,
  Plus,
  Ruler,
  ShowerHead,
  Rows3,
} from "lucide-react";
import type { Floor, Room } from "../../building.types";
import { getFloorDisplayName, getRoomDisplayName } from "../../building-labels";

interface ReferenceFloorPlanProps {
  buildingCode: string;
  floor: Floor;
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
}

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const GROUND_CROP: CropBox = { x: 150, y: 280, width: 660, height: 290 };
const UPPER_CROP: CropBox = { x: 145, y: 250, width: 835, height: 330 };

function cropForZoom(crop: CropBox, zoom: number): CropBox {
  const factor = zoom / 100;
  const width = crop.width / factor;
  const height = crop.height / factor;
  return {
    x: crop.x + (crop.width - width) / 2,
    y: crop.y + (crop.height - height) / 2,
    width,
    height,
  };
}

function Hotspot({
  points,
  room,
  selected,
  onSelect,
}: {
  points: string;
  room: Room;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <polygon
      points={points}
      role="button"
      tabIndex={0}
      aria-label={`Xem thông tin ${getRoomDisplayName(room)}`}
      aria-pressed={selected}
      fill={selected ? "rgba(99,102,241,0.16)" : "transparent"}
      stroke={selected ? "#6366f1" : "transparent"}
      strokeWidth="3"
      className="cursor-pointer outline-none transition-colors hover:fill-indigo-500/10 focus-visible:stroke-indigo-600 motion-reduce:transition-none"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    />
  );
}

function Amenity({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-bold text-muted">{label}</span>
        <span className="mt-0.5 block truncate text-[11px] font-black text-text">{value}</span>
      </span>
    </div>
  );
}

function ReferenceFloorPlan({ buildingCode, floor, selectedRoomId, onSelectRoom }: ReferenceFloorPlanProps) {
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const ground = floor.number === 1;
  const crop = ground ? GROUND_CROP : UPPER_CROP;
  const source = ground ? "/media__1785578496439.jpg" : "/media__1785572193471.jpg";
  const rooms = floor.rooms;
  const suiteRoom = rooms.find((room) => room.type === "2PN") || rooms[0];
  const singleRoom = rooms.find((room) => room.id !== suiteRoom?.id);
  const visibleCrop = useMemo(() => cropForZoom(crop, zoom), [crop, zoom]);
  const currentViewBox = `${visibleCrop.x} ${visibleCrop.y} ${visibleCrop.width} ${visibleCrop.height}`;
  const cropId = `reference-plan-crop-${floor.id}`;
  const floorLabel = getFloorDisplayName(floor.number, buildingCode);

  useEffect(() => {
    if (!fullscreen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    fullscreenButtonRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [fullscreen]);

  const body = (
    <div className={`flex h-full min-h-[620px] flex-col rounded-2xl border border-border/60 bg-card p-4 shadow-sm ${fullscreen ? "rounded-none border-0 p-6" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
        <div>
          <h2 className="text-[12px] font-black uppercase tracking-wide text-text">Sơ đồ mặt bằng {floorLabel}</h2>
          <p className="mt-1 text-[10px] font-semibold text-muted">Mặt bằng nội thất · khung đất 5 m × 20 m</p>
        </div>
        <div className="flex items-center gap-2" aria-label="Điều khiển mặt bằng">
          <button type="button" onClick={() => setZoom((value) => Math.max(100, value - 10))} disabled={zoom <= 100} aria-label="Thu nhỏ mặt bằng" className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 motion-reduce:transition-none"><Minus size={16} /></button>
          <span className="min-w-12 text-center text-[11px] font-black text-muted" aria-live="polite">{zoom}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(130, value + 10))} disabled={zoom >= 130} aria-label="Phóng to mặt bằng" className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 motion-reduce:transition-none"><Plus size={16} /></button>
          <button ref={fullscreenButtonRef} type="button" onClick={() => setFullscreen((value) => !value)} aria-label={fullscreen ? "Thoát toàn màn hình" : "Xem toàn màn hình"} aria-pressed={fullscreen} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none">{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
        </div>
      </div>

      <div className="relative flex min-h-[370px] flex-1 items-center justify-center overflow-hidden rounded-xl bg-[#fbfbfa]">
        <svg viewBox={currentViewBox} preserveAspectRatio="xMidYMid meet" className="h-full min-h-[360px] w-full" role="group" aria-labelledby="reference-plan-title reference-plan-desc">
          <title id="reference-plan-title">Mặt bằng nội thất {floorLabel}</title>
          <desc id="reference-plan-desc">Mặt bằng nhìn từ trên xuống, có thể chọn từng phòng để xem thông tin.</desc>
          <defs><clipPath id={cropId}><rect x={visibleCrop.x} y={visibleCrop.y} width={visibleCrop.width} height={visibleCrop.height} /></clipPath></defs>
          <g clipPath={`url(#${cropId})`}>
            <image href={source} x="0" y="0" width="1024" height="768" preserveAspectRatio="none" pointerEvents="none" />
            {!ground && <rect x="145" y="250" width="125" height="20" fill="#fbfbfa" pointerEvents="none" />}

          {ground && suiteRoom && (
            <Hotspot
              room={suiteRoom}
              selected={selectedRoomId === suiteRoom.id}
              points="573,306 784,306 784,505 590,505 590,458 573,458"
              onSelect={() => onSelectRoom(suiteRoom.id)}
            />
          )}

          {!ground && suiteRoom && (
            <Hotspot
              room={suiteRoom}
              selected={selectedRoomId === suiteRoom.id}
              points="165,274 580,253 598,541 570,570 160,575"
              onSelect={() => onSelectRoom(suiteRoom.id)}
            />
          )}
          {!ground && singleRoom && (
            <Hotspot
              room={singleRoom}
              selected={selectedRoomId === singleRoom.id}
              points="704,270 918,251 970,548 711,570 711,490 684,470 704,448"
              onSelect={() => onSelectRoom(singleRoom.id)}
            />
          )}

            {!ground && suiteRoom && (
              <g pointerEvents="none">
                <rect x="255" y="550" width="124" height="24" rx="12" fill="#ffffff" stroke="#c7d2fe" />
                <text x="317" y="566" textAnchor="middle" fontSize="11" fontWeight="800" fill="#4f46e5">{suiteRoom.code}</text>
                {singleRoom && <><rect x="780" y="550" width="124" height="24" rx="12" fill="#ffffff" stroke="#bbf7d0" /><text x="842" y="566" textAnchor="middle" fontSize="11" fontWeight="800" fill="#15803d">{singleRoom.code}</text></>}
              </g>
            )}
          </g>
        </svg>
      </div>

      <div className={`mt-4 grid gap-3 ${ground ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4"}`}>
        {ground ? (
          <>
            <Amenity icon={<Bike size={18} />} label="Khu vực để xe" value="~7 xe máy" />
            <Amenity icon={<Bath size={18} />} label="WC chung" value="1 phòng" />
            <Amenity icon={<Rows3 size={18} />} label="Cầu thang" value="1 khu" />
            <Amenity icon={<BedDouble size={18} />} label={suiteRoom?.code || "Phòng"} value="1 giường đơn" />
            <Amenity icon={<ShowerHead size={18} />} label="Tắm" value="1 phòng" />
          </>
        ) : (
          <>
            <Amenity icon={<BedDouble size={18} />} label={suiteRoom?.code || "Suite"} value="2 PN mini + 1 PK" />
            <Amenity icon={<Rows3 size={18} />} label="Cầu thang" value="2 vế + chiếu nghỉ" />
            <Amenity icon={<BedDouble size={18} />} label={singleRoom?.code || "Phòng đơn"} value="1 giường đơn" />
            <Amenity icon={<ShowerHead size={18} />} label="WC / Tắm" value="2 khu" />
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-primary/10 bg-primary/[0.035] p-4 sm:grid-cols-3">
        <div className="flex items-center gap-3"><Ruler size={19} className="text-primary" /><span><b className="block text-[10px] text-muted">Diện tích xây dựng</b><strong className="text-xs text-text">5 m × 20 m</strong></span></div>
        <div className="flex items-center gap-3"><PanelsTopLeft size={19} className="text-primary" /><span><b className="block text-[10px] text-muted">Diện tích sàn</b><strong className="text-xs text-text">100 m²</strong></span></div>
        <div className="flex items-center gap-3"><Ruler size={19} className="rotate-90 text-primary" /><span><b className="block text-[10px] text-muted">Chiều cao tầng</b><strong className="text-xs text-text">3,6 m</strong></span></div>
      </div>
    </div>
  );

  if (fullscreen) return <div className="fixed inset-0 z-[90] bg-background" role="dialog" aria-modal="true" aria-label={`Mặt bằng toàn màn hình ${floorLabel}`}>{body}</div>;
  return body;
}

export default memo(ReferenceFloorPlan);
