import React, { useMemo } from "react";
import type { FloorOperationalViewModel } from "./building-view.types";
import IsometricFloorSlab from "./IsometricFloorSlab";
import { getFloorDisplayName } from "../../building-labels";

interface Props {
  floorsVM: FloorOperationalViewModel[];
  activeFloorId: string | null;
  hoveredFloorId: string | null;
  onSelectFloor: (floorId: string) => void;
  onHoverFloor: (floorId: string | null) => void;
  onOpenRoomModal: (roomId: string) => void;
  hoveredRoomId: string | null;
  onHoverRoom: (roomId: string | null) => void;
  isExploded: boolean;
  buildingCode?: string;
}

export default function IsometricFloorStack({
  floorsVM,
  activeFloorId,
  hoveredFloorId,
  onSelectFloor,
  onHoverFloor,
  onOpenRoomModal,
  hoveredRoomId,
  onHoverRoom,
  isExploded,
  buildingCode = ""
}: Props) {
  const totalFloors = floorsVM.length;

  // Strategy for many floors (guardrail #11)
  // Gaps and vertical scales decrease dynamically as total floors increase
  const { gap, height, slabYPositions } = useMemo(() => {
    let baseGap = isExploded ? 95 : 65; // increased gap sizes for a thicker look (guardrail #7)
    
    // Scale down spacing for high floor counts (9+ floors)
    if (totalFloors > 15) {
      baseGap = isExploded ? 55 : 40;
    } else if (totalFloors > 8) {
      baseGap = isExploded ? 75 : 55;
    }

    // Dynamic viewport height to prevent overflow
    const svgHeight = Math.max(550, totalFloors * baseGap + 180);

    // Calculate Y positions for each floor (bottom-to-top)
    const positions = floorsVM.map((floorVM, index) => {
      const isActive = floorVM.floor.id === activeFloorId;
      const isHovered = floorVM.floor.id === hoveredFloorId;
      
      let baseOffset = svgHeight - 160 - (index * baseGap);
      
      // Dynamic spacing adjustment when a floor is active / hovered
      let activeOffset = 0;
      if (isActive) {
        activeOffset = -32; // increased lift offset for a prominent exploded look (guardrail #7)
      } else if (isHovered) {
        activeOffset = -15; 
      }

      return baseOffset + activeOffset;
    });

    return { gap: baseGap, height: svgHeight, slabYPositions: positions };
  }, [floorsVM, totalFloors, activeFloorId, hoveredFloorId, isExploded]);

  return (
    <div 
      className="relative w-full flex items-center justify-between select-none max-w-[720px] mx-auto overflow-visible"
      style={{
        height: `${height}px`,
      }}
    >
      {/* Left Column: Svg stack visualizer */}
      <div className="w-[52%] h-full flex items-center justify-center relative overflow-visible">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 320 ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full max-w-[320px] transition-all duration-500 overflow-visible"
          aria-hidden="true"
        >
          {floorsVM.map((floorVM, index) => {
            const isActive = floorVM.floor.id === activeFloorId;
            const isHovered = floorVM.floor.id === hoveredFloorId;
            const yPos = slabYPositions[index];

            return (
              <g
                key={floorVM.floor.id}
                transform={`translate(10, ${yPos})`}
                className="transition-transform duration-500 ease-out"
              >
                <IsometricFloorSlab
                  floorVM={floorVM}
                  isActive={isActive}
                  isHovered={isHovered}
                  onSelect={() => onSelectFloor(floorVM.floor.id)}
                  onMouseEnter={() => onHoverFloor(floorVM.floor.id)}
                  onMouseLeave={() => onHoverFloor(null)}
                  onOpenRoomModal={onOpenRoomModal}
                  hoveredRoomId={hoveredRoomId}
                  onHoverRoom={onHoverRoom}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Right Column: HTML connected labels and statistics details (guardrail #6) */}
      <div className="absolute right-0 top-0 bottom-0 w-[46%] pointer-events-none overflow-visible">
        {floorsVM.map((floorVM, index) => {
          const isActive = floorVM.floor.id === activeFloorId;
          const isHovered = floorVM.floor.id === hoveredFloorId;
          const yPos = slabYPositions[index];

          // Center coordinate logic matching the slab center translation offset
          const cardTop = yPos + 75;

          return (
            <div
              key={floorVM.floor.id}
              className="absolute right-0 flex items-center transition-all duration-500 ease-out pointer-events-auto"
              style={{
                top: `${cardTop}px`,
                transform: "translateY(-50%)",
                width: "250px"
              }}
            >
              {/* Dashed connector line */}
              <div 
                className={`w-6 border-t border-dashed transition-colors duration-300 shrink-0 ${
                  isActive 
                    ? "border-primary" 
                    : isHovered 
                    ? "border-slate-400" 
                    : "border-border/60"
                }`} 
              />

              {/* Floor description details card trigger */}
              <button
                type="button"
                onClick={() => onSelectFloor(floorVM.floor.id)}
                onMouseEnter={() => onHoverFloor(floorVM.floor.id)}
                onMouseLeave={() => onHoverFloor(null)}
                className={`flex-1 text-left p-3 rounded-2xl border transition-all flex flex-col gap-1 focus:ring-2 focus:ring-primary focus:outline-none ${
                  isActive 
                    ? "bg-primary/[0.06] border-primary shadow-[0_4px_16px_rgba(99,102,241,0.15)] scale-[1.03]" 
                    : isHovered 
                    ? "bg-slate-50 dark:bg-white/5 border-slate-400 shadow-sm" 
                    : "bg-card border-border/80"
                }`}
                aria-label={`Mặt bằng ${getFloorDisplayName(floorVM.floor.number, buildingCode)}`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="text-[12px] font-black text-text">
                    {getFloorDisplayName(floorVM.floor.number, buildingCode)}
                  </span>
                  <span className={`text-[11px] font-black ${isActive ? 'text-primary' : 'text-muted'}`}>
                    {floorVM.occupancyRate}%
                  </span>
                </div>

                <div className="flex justify-between items-center text-[10px] font-bold text-muted w-full">
                  <span>{floorVM.occupiedRooms}/{floorVM.totalRooms} phòng • {floorVM.residentCount} khách</span>
                  {floorVM.alertCount > 0 && (
                    <span className="text-rose-500 font-black flex items-center gap-0.5">
                      ⚠ {floorVM.alertCount}
                    </span>
                  )}
                </div>

                <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mt-1.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      isActive ? "bg-primary" : "bg-slate-400"
                    }`}
                    style={{ width: `${floorVM.occupancyRate}%` }}
                  />
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
