"use client";

import React from "react";
import type { FloorOperationalViewModel } from "./building-view.types";
import { PRIMARY_STATUS_CONFIG } from "./status-config";

interface Props {
  floorVM: FloorOperationalViewModel;
  isActive: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onOpenRoomModal: (roomId: string) => void;
  hoveredRoomId: string | null;
  onHoverRoom: (roomId: string | null) => void;
}

export default function IsometricFloorSlab({
  floorVM,
  isActive,
  isHovered,
  onSelect,
  onMouseEnter,
  onMouseLeave,
  onOpenRoomModal,
  hoveredRoomId,
  onHoverRoom
}: Props) {
  const { floor, rooms } = floorVM;
  const isGroundFloor = floor.number === 1;

  // Colors based on floor status
  const strokeColor = isActive ? "#6366f1" : isHovered ? "#94a3b8" : "var(--border)";
  const strokeWidth = isActive ? 2.5 : isHovered ? 1.5 : 1;
  
  // Custom glowing filter for selected slab
  const shadowGlow = isActive 
    ? "drop-shadow(0 8px 24px rgba(99,102,241,0.35)) drop-shadow(0 0 10px rgba(99,102,241,0.3))" 
    : isHovered 
    ? "drop-shadow(0 6px 12px rgba(0,0,0,0.12))" 
    : "drop-shadow(0 2px 4px rgba(0,0,0,0.06))";

  // Coordinates for the main isometric floor diamond slab (width=280, height=130)
  const slabPathTop = "M 140 10 L 280 70 L 140 130 L 0 70 Z";
  const slabPathLeftThickness = "M 0 70 L 140 130 L 140 146 L 0 86 Z";
  const slabPathRightThickness = "M 140 130 L 280 70 L 280 86 L 140 146 Z";

  // Stair/lift core block coordinate at the back of each slab (base center: (140, 10))
  // Rendered as a vertical solid block extending downwards
  const coreTop = "M 125 -15 L 155 -15 L 140 -8 L 110 -8 Z";
  const coreLeft = "M 110 -8 L 140 -8 L 140 15 L 110 15 Z";
  const coreRight = "M 140 -8 L 155 -15 L 155 8 L 140 15 Z";

  // Outer wall boundary line offset inside the slab (perimeters)
  const perimeterPath = "M 140 16 L 266 70 L 140 124 L 14 70 Z";

  // Ground floor doorway coordinates on the front-left thickness face near (140, 130)
  const doorPath = "M 128 125 L 128 111 L 138 115 L 138 129 Z";

  // Handle keyboard interaction for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Sơ đồ ${floor.number === 1 ? "Tầng trệt" : `Tầng ${floor.number - 1}`}, lấp đầy ${floorVM.occupancyRate}%`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="outline-none cursor-pointer select-none transition-all duration-300 focus:outline-none"
      style={{
        filter: shadowGlow,
      }}
    >
      {/* A. Stair/Lift Core Block at the back of the slab (render first to appear behind) */}
      <g className="transition-all duration-300">
        <path
          d={coreLeft}
          fill="var(--card)"
          stroke={strokeColor}
          strokeWidth={0.8}
          className="opacity-80 dark:opacity-60"
        />
        <path
          d={coreRight}
          fill="var(--card)"
          stroke={strokeColor}
          strokeWidth={0.8}
          className="opacity-70 dark:opacity-50"
        />
        <path
          d={coreTop}
          fill="var(--card)"
          stroke={strokeColor}
          strokeWidth={0.8}
          className="opacity-95"
        />
        {/* Core lift doors details */}
        <line x1="125" y1="3" x2="125" y2="10" stroke={strokeColor} strokeWidth={0.5} className="opacity-40" />
      </g>

      {/* B. Slab Thickness: Bottom Shadow Sides */}
      <path
        d={slabPathLeftThickness}
        fill={isActive ? "#4f46e5" : "var(--card)"}
        className="opacity-85 dark:opacity-65 transition-colors duration-300"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />
      <path
        d={slabPathRightThickness}
        fill={isActive ? "#4338ca" : "var(--card)"}
        className="opacity-75 dark:opacity-55 transition-colors duration-300"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />

      {/* C. Ground Floor Door Accent (Entrance door shape) */}
      {isGroundFloor && (
        <path
          d={doorPath}
          fill="#f59e0b"
          stroke="#d97706"
          strokeWidth={0.5}
          className="animate-pulse"
        />
      )}

      {/* D. Slab Top Face: Floor grid plane (differentiated color for ground floor) */}
      <path
        d={slabPathTop}
        fill={
          isActive 
            ? "rgba(99,102,241,0.08)" 
            : isGroundFloor 
            ? "rgba(251,191,36,0.03)" // warm golden hint for ground floor marble
            : "var(--card)"
        }
        className="transition-colors duration-300"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />

      {/* E. Architectural Wall Boundaries & Corridor Outlines */}
      <path
        d={perimeterPath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={0.5}
        strokeDasharray="2,2"
        className="opacity-25 pointer-events-none"
      />
      {/* Central Corridor lines running left to right */}
      <line x1="40" y1="52" x2="240" y2="52" stroke={strokeColor} strokeWidth={0.5} strokeDasharray="3,3" className="opacity-20 pointer-events-none" />
      <line x1="40" y1="88" x2="240" y2="88" stroke={strokeColor} strokeWidth={0.5} strokeDasharray="3,3" className="opacity-20 pointer-events-none" />

      {/* F. Render rooms dynamically inside the slab plane */}
      {rooms.map((roomVM, index) => {
        const { room, primaryStatus } = roomVM;
        const statusConfig = PRIMARY_STATUS_CONFIG[primaryStatus] || PRIMARY_STATUS_CONFIG.unknown;
        const isRoomHovered = hoveredRoomId === room.id;

        // Distribute room cubes dynamically along the floor center axis
        const roomCount = rooms.length;
        const ratio = roomCount > 1 ? index / (roomCount - 1) : 0.5;
        
        // Compute isometric center (rx, ry) for room cube
        const rx = 55 + ratio * 170;
        const ry = 70 + (ratio - 0.5) * 45;

        // Room cubes: width=28, height=14, thickness=12px
        const h = isRoomHovered ? 18 : 12; // lift on hover
        const yOffset = isRoomHovered ? -4 : 0; // vertical raise

        const rTop = `M ${rx} ${ry - 6 + yOffset} L ${rx + 14} ${ry + yOffset} L ${rx} ${ry + 6 + yOffset} L ${rx - 14} ${ry + yOffset} Z`;
        const rLeft = `M ${rx - 14} ${ry + yOffset} L ${rx} ${ry + 6 + yOffset} L ${rx} ${ry + 6 + h + yOffset} L ${rx - 14} ${ry + h + yOffset} Z`;
        const rRight = `M ${rx} ${ry + 6 + yOffset} L ${rx + 14} ${ry + yOffset} L ${rx + 14} ${ry + h + yOffset} L ${rx} ${ry + 6 + h + yOffset} Z`;

        return (
          <g
            key={room.id}
            onMouseEnter={(e) => {
              e.stopPropagation();
              onHoverRoom(room.id);
            }}
            onMouseLeave={(e) => {
              e.stopPropagation();
              onHoverRoom(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenRoomModal(room.id);
            }}
            className="transition-all duration-300"
          >
            {/* Room Left Face */}
            <path
              d={rLeft}
              fill={statusConfig.color}
              className="opacity-75 transition-all duration-300"
              stroke="#ffffff"
              strokeWidth={0.5}
              strokeOpacity={0.4}
            />
            {/* Room Right Face */}
            <path
              d={rRight}
              fill={statusConfig.color}
              className="opacity-60 transition-all duration-300"
              stroke="#ffffff"
              strokeWidth={0.5}
              strokeOpacity={0.4}
            />
            {/* Room Top Face */}
            <path
              d={rTop}
              fill={statusConfig.color}
              className="opacity-95 transition-all duration-300"
              stroke="#ffffff"
              strokeWidth={0.5}
              strokeOpacity={0.5}
            />

            {/* Room code label on top (extremely small, readable at high zooms) */}
            {isRoomHovered && (
              <text
                x={rx}
                y={ry - 9}
                textAnchor="middle"
                fill="var(--text)"
                className="text-[8px] font-black pointer-events-none select-none bg-card px-1 rounded shadow animate-in fade-in duration-200"
              >
                P.{room.name || room.number}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
