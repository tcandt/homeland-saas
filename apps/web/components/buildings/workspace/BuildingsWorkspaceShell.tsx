"use client";

import React, { useState, useEffect } from "react";
import type { Building } from "../building.types";
import { useBuildingsWorkspace } from "./useBuildingsWorkspace";
import BuildingSwitcher from "./BuildingSwitcher";
import BuildingViewModeTabs from "./BuildingViewModeTabs";
import BuildingKpiRow from "./BuildingKpiRow";
import BuildingVisualizerWorkspace from "./BuildingVisualizerWorkspace";
import BuildingOperationalSidebar from "./BuildingOperationalSidebar";
import RoomDetailDrawer from "../views/visualizer/RoomDetailDrawer";
import { Button } from "../../ui/Button";
import { ArrowLeft, Settings } from "lucide-react";
import { getFloorDisplayName } from "../building-labels";

interface BuildingsWorkspaceShellProps {
  buildings: Building[];
  onOpenRoomModal: (roomId: string, tab?: string) => void;
  onEditBuilding: () => void;
  onAddFloor: () => void;
  onAddRoomQuick: () => void;
  onAddRoom: (floorId: string) => void;
  onEditRoom: (roomId: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onEditFloor: (floorId: string) => void;
  onDeleteFloor: (floorId: string) => void;
  canCreateFloor: boolean;
  canUpdateBuilding: boolean;
}

export default function BuildingsWorkspaceShell({
  buildings,
  onOpenRoomModal,
  onEditBuilding,
  onAddFloor,
  onAddRoomQuick,
  onAddRoom,
  onEditRoom,
  onDeleteRoom,
  onEditFloor,
  onDeleteFloor,
  canCreateFloor,
  canUpdateBuilding
}: BuildingsWorkspaceShellProps) {
  
  const {
    adaptedBuildings,
    activeBuilding,
    activeView,
    activeFloor,
    activeRoom,
    selectBuilding,
    selectViewMode,
    selectFloor,
    selectRoom,
    selectFloorRoom,
    closeRoomDrawer,
    goBackToOverview
  } = useBuildingsWorkspace(buildings);

  // States for room list filtering (Contextual to Rooms View)
  const [selectedFloorFilter, setSelectedFloorFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");

  // Reset filters when building or view mode changes
  useEffect(() => {
    setSelectedFloorFilter("all");
    setSelectedStatusFilter("all");
  }, [activeBuilding?.id, activeView]);

  if (!activeBuilding) {
    return <div className="p-8 text-center text-muted">Không có tòa nhà nào được tìm thấy.</div>;
  }

  return (
    <div className="flex flex-col w-full h-full gap-5 select-none pb-12 animate-in fade-in duration-500" key={activeBuilding.id}>
      
      {/* 1. Header Cockpit Area (Compact & clean, title on left, switchers on right) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="font-black text-2xl text-text tracking-tight">
              {activeBuilding.code || activeBuilding.name}
              {activeView === "floor-2d" && activeFloor ? ` — ${getFloorDisplayName(activeFloor.number, activeBuilding.code)}` : ""}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">
              Đang hoạt động
            </span>
          </div>
          <p className="text-[11px] text-muted font-bold tracking-tight">
            Địa chỉ: {activeBuilding.address}
          </p>
        </div>

        {/* Compact Switchers and View tabs */}
        <div className="flex flex-wrap items-center gap-3">
          {activeView === "overview" ? (
            <BuildingSwitcher
              buildings={adaptedBuildings}
              activeBuildingId={activeBuilding.id}
              onSelectBuilding={selectBuilding}
            />
          ) : (
            <button
              type="button"
              onClick={goBackToOverview}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-border/60 bg-card px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
            >
              <ArrowLeft size={14} /> Toàn bộ tòa nhà
            </button>
          )}

          <BuildingViewModeTabs
            activeView={activeView}
            onSelectViewMode={selectViewMode}
          />

          <div className="flex items-center gap-2 border-l border-border/45 pl-3">
            {canUpdateBuilding && (
              <Button variant="outline" onClick={onEditBuilding} className="flex items-center gap-1.5 text-xs font-bold py-2 rounded-xl">
                <Settings size={13} /> Cấu hình
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Full-Width KPI Row (spanning above visualizer split panels) */}
      {activeView === "overview" && <BuildingKpiRow building={activeBuilding} />}

      {/* 3. Main Split Panels Layout */}
      <div className="flex flex-col lg:flex-row gap-5 w-full items-start">
        {/* Left side: Visualizer Canvas (74% width) */}
        <BuildingVisualizerWorkspace
          building={activeBuilding}
          activeView={activeView}
          activeFloor={activeFloor}
          activeRoom={activeRoom}
          onSelectFloor={selectFloor}
          onSelectRoom={selectRoom}
          onSelectFloorRoom={selectFloorRoom}
          onOpenRoomModal={onOpenRoomModal}
          selectedFloorFilter={selectedFloorFilter}
          selectedStatusFilter={selectedStatusFilter}
        />

        {/* Right side: Operational Panel (26% width) */}
        <BuildingOperationalSidebar
          building={activeBuilding}
          activeView={activeView}
          activeFloor={activeFloor}
          activeRoom={activeRoom}
          onSelectFloor={selectFloor}
          onSelectRoom={selectRoom}
          onAddFloor={onAddFloor}
          canCreateFloor={canCreateFloor}
          onCloseRoom={closeRoomDrawer}
          selectedFloorFilter={selectedFloorFilter}
          setSelectedFloorFilter={setSelectedFloorFilter}
          selectedStatusFilter={selectedStatusFilter}
          setSelectedStatusFilter={setSelectedStatusFilter}
        />
      </div>

      {/* 4. Active Room Details Overlay Drawer (Only for list/grid view to avoid covering model visualizers) */}
      {activeRoom && activeView === "rooms" && (
        <RoomDetailDrawer
          roomId={activeRoom.id}
          onClose={closeRoomDrawer}
          onOpenRoomModal={onOpenRoomModal}
          onDeleteRoom={onDeleteRoom}
        />
      )}
    </div>
  );
}
