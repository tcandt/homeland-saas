"use client";

import React from "react";
import type { RoomOperationalViewModel } from "./building-view.types";
import RoomMapCard from "./RoomMapCard";
import { Plus } from "lucide-react";

interface Props {
  roomsVM: RoomOperationalViewModel[];
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  hoveredRoomId: string | null;
  onHoverRoom: (roomId: string | null) => void;
  onAddRoom: () => void;
  permissions: {
    canCreateRoom: boolean;
  };
}

export default function FloorPlanCanvas({
  roomsVM,
  activeRoomId,
  onSelectRoom,
  hoveredRoomId,
  onHoverRoom,
  onAddRoom,
  permissions
}: Props) {
  // Check if any room has custom absolute layout coordinates
  const hasLayoutCoordinates = roomsVM.some(r => r.room.layout);
  const isDrawerOpen = activeRoomId !== null;

  // Determine grid template dynamically (guardrail #5)
  let gridClass = "grid gap-5 flex-1 items-start ";
  let itemWidthClass = "w-full";
  if (roomsVM.length <= 2) {
    gridClass = "flex flex-wrap justify-center gap-5 flex-1 items-start";
    itemWidthClass = "w-full sm:w-[300px]";
  } else if (roomsVM.length <= 6) {
    gridClass += "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  } else {
    gridClass += "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  }

  return (
    <div className="flex flex-col flex-1 gap-4">
      {/* Layout Status Badge Indicator */}
      <div className="flex items-center justify-between border-b border-border/30 pb-3 mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase text-muted tracking-wider">
            Mặt bằng thiết kế
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
            hasLayoutCoordinates 
              ? "bg-indigo-500/10 text-primary border border-primary/20" 
              : "bg-slate-100 dark:bg-white/5 text-muted border border-border/50"
          }`}>
            {hasLayoutCoordinates ? "Floor Plan Thiết Kế" : "Bố cục tự động / Chưa cấu hình mặt bằng thực tế"}
          </span>
        </div>
        {!hasLayoutCoordinates && (
          <button
            type="button"
            className="text-[11px] font-bold text-primary hover:underline focus:outline-none"
            onClick={() => alert("Chức năng thiết kế mặt bằng đang được phát triển.")}
          >
            [Cấu hình sơ đồ]
          </button>
        )}
      </div>

      {/* Blueprint Canvas Container */}
      <div className="relative flex-1 bg-slate-950/[0.01] dark:bg-white/[0.01] rounded-2xl border border-border/30 p-6 min-h-[380px] flex flex-col">
        {hasLayoutCoordinates ? (
          // absolute positioning floor plan
          <div className="relative flex-1 w-full h-full min-h-[340px]">
            {roomsVM.map((roomVM) => {
              const layout = roomVM.room.layout as any; // NormalizedRoomLayout
              const isSelected = activeRoomId === roomVM.room.id;
              
              return (
                <div
                  key={roomVM.room.id}
                  className="absolute"
                  style={{
                    left: `${layout.x * 100}%`,
                    top: `${layout.y * 100}%`,
                    width: `${layout.width * 100}%`,
                    height: `${layout.height * 100}%`
                  }}
                >
                  <RoomMapCard
                    roomVM={roomVM}
                    isSelected={isSelected}
                    onSelect={() => onSelectRoom(roomVM.room.id)}
                    onMouseEnter={() => onHoverRoom(roomVM.room.id)}
                    onMouseLeave={() => onHoverRoom(null)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          // Grid layout fallback (adaptive columns)
          <div className={gridClass}>
            {roomsVM.map((roomVM) => {
              const isSelected = activeRoomId === roomVM.room.id;
              return (
                <div key={roomVM.room.id} className={itemWidthClass}>
                  <RoomMapCard
                    roomVM={roomVM}
                    isSelected={isSelected}
                    onSelect={() => onSelectRoom(roomVM.room.id)}
                    onMouseEnter={() => onHoverRoom(roomVM.room.id)}
                    onMouseLeave={() => onHoverRoom(null)}
                  />
                </div>
              );
            })}

            {/* Quick Add Room Card shortcut - hidden when drawer is open (guardrail #6) */}
            {!isDrawerOpen && permissions.canCreateRoom && (
              <div className={itemWidthClass}>
                <button
                  type="button"
                  onClick={onAddRoom}
                  className="border border-dashed border-border/80 hover:border-primary/50 hover:bg-primary/[0.01] rounded-[16px] h-[60px] w-full flex items-center justify-center text-muted hover:text-primary transition-all focus:ring-2 focus:ring-primary focus:outline-none"
                  aria-label="Thêm phòng mới vào tầng"
                >
                  <Plus size={16} className="mr-1.5" />
                  <span className="font-semibold text-[13px]">Thêm phòng mới</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
