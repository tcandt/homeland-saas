"use client";

import React, { useState, useMemo } from "react";
import type { Building } from "../../building.types";
import type { FloorOperationalViewModel } from "./building-view.types";
import { toFloorOperationalViewModel } from "./buildingOperationalAdapter";
import IsometricFloorStack from "./IsometricFloorStack";
import ReferenceBuilding3D from "./ReferenceBuilding3D";
import { resolveVisualizationProfile } from "../../workspace/building-profiles";
import { getFloorDisplayName } from "../../building-labels";
import {
  Layers, Users, Home, AlertCircle, Calendar,
  AlertTriangle, ShieldAlert, TrendingUp, Info
} from "lucide-react";

interface Props {
  building: Building;
  activeFloorId: string | null;
  hoveredFloorId: string | null;
  onSelectFloor: (floorId: string) => void;
  onHoverFloor: (floorId: string | null) => void;
  onOpenRoomModal: (roomId: string) => void;
  activeRoomId?: string | null;
  onSelectRoom?: (floorId: string, roomId: string) => void;
  hideSidebar?: boolean;
}

export default function BuildingOverview({
  building,
  activeFloorId,
  hoveredFloorId,
  onSelectFloor,
  onHoverFloor,
  onOpenRoomModal,
  activeRoomId = null,
  onSelectRoom,
  hideSidebar = false
}: Props) {
  const [isExploded, setIsExploded] = useState(true);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  const profile = resolveVisualizationProfile(building.code || building.name || "");

  // 1. Convert all floors to ViewModel structure
  const floorsVM = useMemo(() => {
    return building.floors.map(floor => toFloorOperationalViewModel(floor));
  }, [building.floors]);

  // Sort floors desc for listing (top floor at top)
  const sortedFloorsDesc = useMemo(() => {
    return [...floorsVM].sort((a, b) => b.floor.number - a.floor.number);
  }, [floorsVM]);

  // 2. Compute aggregate building stats
  const buildingStats = useMemo(() => {
    let totalRooms = 0;
    let occupiedRooms = 0;
    let vacantRooms = 0;
    let depositedRooms = 0;
    let maintenanceRooms = 0;
    let residentCount = 0;
    let alertCount = 0;

    floorsVM.forEach(f => {
      totalRooms += f.totalRooms;
      occupiedRooms += f.occupiedRooms;
      vacantRooms += f.vacantRooms;
      depositedRooms += f.depositedRooms;
      maintenanceRooms += f.maintenanceRooms;
      residentCount += f.residentCount;
      alertCount += f.alertCount;
    });

    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    return {
      totalRooms,
      occupiedRooms,
      vacantRooms,
      depositedRooms,
      maintenanceRooms,
      residentCount,
      occupancyRate,
      alertCount
    };
  }, [floorsVM]);

  // 3. Scan and collect highlights/warnings from all rooms
  const activeAlerts = useMemo(() => {
    const alerts: { roomId: string; roomCode: string; message: string; type: "warning" | "danger" }[] = [];

    floorsVM.forEach(fVM => {
      fVM.rooms.forEach(rVM => {
        rVM.warnings.forEach(w => {
          alerts.push({
            roomId: rVM.room.id,
            roomCode: rVM.room.name || rVM.room.number,
            message: w.label,
            type: w.type
          });
        });
      });
    });

    return alerts.slice(0, 5); // display up to 5 warnings in overview
  }, [floorsVM]);

  const missingTempResidenceRooms = useMemo(() => {
    const list: { id: string; name: string; status: string }[] = [];
    floorsVM.forEach(fVM => {
      fVM.rooms.forEach(rVM => {
        if (rVM.tempResidenceStatus === "missing" || rVM.tempResidenceStatus === "partial") {
          list.push({
            id: rVM.room.id,
            name: rVM.room.name || rVM.room.number,
            status: rVM.tempResidenceStatus === "missing" ? "Chưa khai tạm trú" : "Khai tạm trú thiếu"
          });
        }
      });
    });
    return list;
  }, [floorsVM]);

  if (profile === "lk01-31-custom") {
    return (
      <ReferenceBuilding3D
        building={building}
        activeFloorId={activeFloorId}
        activeRoomId={activeRoomId}
        onSelectFloor={onSelectFloor}
        onSelectRoom={(floorId, roomId) => {
          if (onSelectRoom) onSelectRoom(floorId, roomId);
          else onOpenRoomModal(roomId);
        }}
      />
    );
  }

  // Legacy image-only cutaway kept temporarily for migration reference.
  if ((building.code || "") === "__LK01_31_LEGACY_CUTAWAY__") {
    // Connect floor cards to active floor selection
    const floorListOrdered = [...building.floors].sort((a, b) => b.number - a.number); // 4, 3, 2, 1

    return (
      <div className="w-full h-full flex flex-col justify-between select-none relative" style={{ minHeight: "580px" }}>

        {/* Title / Action bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-3 mb-2 shrink-0">
          <h3 className="font-black text-[13px] uppercase tracking-widest text-muted flex items-center gap-1.5">
            Sơ đồ tòa nhà trực quan
          </h3>
          <span className="text-[11px] font-bold text-emerald-500">Mô hình Cutaway 3D Premium</span>
        </div>

        {/* Explosive View Overlay Canvas Container */}
        <div className="flex-1 w-full relative flex items-center justify-center p-2 min-h-[500px]">

          {/* Exploded Building high-fidelity render image */}
          <div className="relative w-full max-w-[820px] aspect-[4/3] flex items-center justify-center">
            {/* The actual image from the public folder */}
            <img
              src="/media__1785578495387.jpg"
              alt="LK01-31 Exploded View"
              className="w-full h-full object-contain pointer-events-none rounded-xl"
            />

            {/* Left Hand Callouts pointing to levels */}
            <div className="absolute inset-0 pointer-events-none">

              {/* Floor 4 Label (Top Level) */}
              <div
                className="absolute left-[8%] top-[29%] -translate-y-1/2 pointer-events-auto flex items-center"
              >
                <button
                  onClick={() => onSelectFloor(building.floors.find(f => f.number === 4)?.id || "")}
                  className="bg-card border border-border/40 dark:border-white/5 hover:border-primary px-3 py-1.5 rounded-lg shadow-sm hover:shadow text-left transition-all duration-300 pointer-events-auto cursor-pointer"
                >
                  <div className="text-[10px] font-black text-primary uppercase">Tầng 4</div>
                  <div className="text-[9px] font-bold text-muted mt-0.5">PN 31-06, 31-07</div>
                </button>
                {/* SVG Pointer Connector Line */}
                <svg className="w-16 h-8 -mr-16 pointer-events-none overflow-visible">
                  <path d="M 0 16 L 36 16 L 46 22" fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="3,3" className="opacity-60" />
                </svg>
              </div>

              {/* Floor 3 Label */}
              <div
                className="absolute left-[8%] top-[49%] -translate-y-1/2 pointer-events-auto flex items-center"
              >
                <button
                  onClick={() => onSelectFloor(building.floors.find(f => f.number === 3)?.id || "")}
                  className="bg-card border border-border/40 dark:border-white/5 hover:border-primary px-3 py-1.5 rounded-lg shadow-sm hover:shadow text-left transition-all duration-300 pointer-events-auto cursor-pointer"
                >
                  <div className="text-[10px] font-black text-primary uppercase">Tầng 3</div>
                  <div className="text-[9px] font-bold text-muted mt-0.5">PN 31-04, 31-05</div>
                </button>
                <svg className="w-16 h-8 -mr-16 pointer-events-none overflow-visible">
                  <path d="M 0 16 L 36 16 L 46 22" fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="3,3" className="opacity-60" />
                </svg>
              </div>

              {/* Floor 2 Label */}
              <div
                className="absolute left-[8%] top-[69%] -translate-y-1/2 pointer-events-auto flex items-center"
              >
                <button
                  onClick={() => onSelectFloor(building.floors.find(f => f.number === 2)?.id || "")}
                  className="bg-card border border-border/40 dark:border-white/5 hover:border-primary px-3 py-1.5 rounded-lg shadow-sm hover:shadow text-left transition-all duration-300 pointer-events-auto cursor-pointer"
                >
                  <div className="text-[10px] font-black text-primary uppercase">Tầng 2</div>
                  <div className="text-[9px] font-bold text-muted mt-0.5">PN 31-02, 31-03</div>
                </button>
                <svg className="w-16 h-8 -mr-16 pointer-events-none overflow-visible">
                  <path d="M 0 16 L 36 16 L 46 22" fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="3,3" className="opacity-60" />
                </svg>
              </div>

              {/* Ground Floor Label */}
              <div
                className="absolute left-[8%] top-[86%] -translate-y-1/2 pointer-events-auto flex items-center"
              >
                <button
                  onClick={() => onSelectFloor(building.floors.find(f => f.number === 1)?.id || "")}
                  className="bg-card border border-border/40 dark:border-white/5 hover:border-primary px-3 py-1.5 rounded-lg shadow-sm hover:shadow text-left transition-all duration-300 pointer-events-auto cursor-pointer"
                >
                  <div className="text-[10px] font-black text-primary uppercase">Tầng trệt</div>
                  <div className="text-[9px] font-bold text-muted mt-0.5">PN 31-01</div>
                </button>
                <svg className="w-16 h-8 -mr-16 pointer-events-none overflow-visible">
                  <path d="M 0 16 L 36 16 L 46 16" fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="3,3" className="opacity-60" />
                </svg>
              </div>
            </div>

            {/* Right Hand Floor Information Cards overlay */}
            <div className="absolute right-[2%] top-0 bottom-0 w-[240px] flex flex-col justify-between py-6 pointer-events-none">

              {/* Floor 4 Card */}
              <div
                className="bg-card/95 border border-border/40 dark:border-white/5 rounded-xl p-3 shadow-md flex flex-col gap-1.5 pointer-events-auto hover:border-primary transition-all duration-300 cursor-pointer"
                onClick={() => onSelectFloor(building.floors.find(f => f.number === 4)?.id || "")}
              >
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-xs font-black text-text">Tầng 4</span>
                  <span className="text-[8px] font-bold bg-[#6366f1]/10 text-primary px-1.5 py-0.5 rounded">2 phòng</span>
                </div>
                <div className="flex flex-col gap-1 text-[10px] font-bold text-text">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    <span>PN 31-06: Phòng ngủ lớn</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    <span>PN 31-07: 1 giường đơn</span>
                  </div>
                </div>
                <span className="text-[8px] font-black text-muted mt-1 uppercase">2PN mini | 1PK | 1WC</span>
              </div>

              {/* Floor 3 Card */}
              <div
                className="bg-card/95 border border-border/40 dark:border-white/5 rounded-xl p-3 shadow-md flex flex-col gap-1.5 pointer-events-auto hover:border-primary transition-all duration-300 cursor-pointer"
                onClick={() => onSelectFloor(building.floors.find(f => f.number === 3)?.id || "")}
              >
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-xs font-black text-text">Tầng 3</span>
                  <span className="text-[8px] font-bold bg-[#6366f1]/10 text-primary px-1.5 py-0.5 rounded">2 phòng</span>
                </div>
                <div className="flex flex-col gap-1 text-[10px] font-bold text-text">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    <span>PN 31-04: Phòng ngủ lớn</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    <span>PN 31-05: 1 giường đơn</span>
                  </div>
                </div>
                <span className="text-[8px] font-black text-muted mt-1 uppercase">2PN mini | 1PK | 1WC</span>
              </div>

              {/* Floor 2 Card */}
              <div
                className="bg-card/95 border border-border/40 dark:border-white/5 rounded-xl p-3 shadow-md flex flex-col gap-1.5 pointer-events-auto hover:border-primary transition-all duration-300 cursor-pointer"
                onClick={() => onSelectFloor(building.floors.find(f => f.number === 2)?.id || "")}
              >
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-xs font-black text-text">Tầng 2</span>
                  <span className="text-[8px] font-bold bg-[#6366f1]/10 text-primary px-1.5 py-0.5 rounded">2 phòng</span>
                </div>
                <div className="flex flex-col gap-1 text-[10px] font-bold text-text">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    <span>PN 31-02: Phòng ngủ lớn</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    <span>PN 31-03: 1 giường đơn</span>
                  </div>
                </div>
                <span className="text-[8px] font-black text-muted mt-1 uppercase">2PN mini | 1PK | 1WC</span>
              </div>

              {/* Floor Ground Card */}
              <div
                className="bg-card/95 border border-border/40 dark:border-white/5 rounded-xl p-3 shadow-md flex flex-col gap-1.5 pointer-events-auto hover:border-primary transition-all duration-300 cursor-pointer"
                onClick={() => onSelectFloor(building.floors.find(f => f.number === 1)?.id || "")}
              >
                <div className="flex justify-between items-center border-b border-border/30 pb-1">
                  <span className="text-xs font-black text-text">Tầng trệt</span>
                  <span className="text-[8px] font-bold bg-[#6366f1]/10 text-primary px-1.5 py-0.5 rounded">1 phòng</span>
                </div>
                <div className="flex flex-col gap-1 text-[10px] font-bold text-text">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    <span>PN 31-01: 1 giường đơn</span>
                  </div>
                </div>
                <span className="text-[8px] font-black text-muted mt-1 uppercase">1 giường | 1WC | Khu để xe</span>
              </div>

            </div>

          </div>

        </div>

      </div>
    );
  }

  // Fallback to standard Isometric SVG Stack for other buildings
  if (hideSidebar) {
    return (
      <div className="flex flex-col w-full h-full min-h-[580px] select-none relative">
        <div className="flex-grow flex flex-col bg-card border border-border/40 dark:border-white/5 rounded-[20px] p-5 shadow-sm relative justify-between overflow-visible">
          <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-primary/5 rounded-full blur-[40px] pointer-events-none" />

          {/* Visualizer header metrics actions */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/20 dark:border-white/5 pb-3.5 mb-2">
            <div>
              <h3 className="font-black text-[13px] uppercase tracking-widest text-muted flex items-center gap-1.5">
                Sơ đồ tòa nhà
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExploded(!isExploded)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black transition-colors ${
                  isExploded
                    ? "bg-primary/10 border-primary/25 text-primary shadow-sm"
                    : "bg-background border-border text-muted hover:text-text"
                }`}
              >
                <Layers size={13} />
                Tách tầng: {isExploded ? "BẬT" : "TẮT"}
              </button>
            </div>
          </div>

          {/* 3D Stack Graphic Canvas (Visual height expanded) */}
          {floorsVM.length > 0 ? (
            <div className="flex-1 flex items-center justify-center relative py-6 overflow-visible w-full min-h-[500px]">
              <IsometricFloorStack
                floorsVM={floorsVM}
                activeFloorId={activeFloorId}
                hoveredFloorId={hoveredFloorId}
                onSelectFloor={onSelectFloor}
                onHoverFloor={onHoverFloor}
                onOpenRoomModal={onOpenRoomModal}
                hoveredRoomId={hoveredRoomId}
                onHoverRoom={setHoveredRoomId}
                isExploded={isExploded}
                buildingCode={building.code}
              />
            </div>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-muted">
              <Info size={36} className="mb-2 opacity-40" />
              <span className="text-[13px] font-bold">Tòa nhà chưa cấu hình tầng.</span>
            </div>
          )}

          {/* Status Legends */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-4 border-t border-border/20 dark:border-white/5 text-[10px] font-black uppercase text-muted tracking-wider">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-md bg-[#10b981]" /> Đã thuê</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-md bg-[#64748b]" /> Trống</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-md bg-[#0ea5e9]" /> Đặt cọc</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-md bg-[#d97706]" /> Bảo trì</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-md bg-[#f97316]" /> Sắp hết hạn</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-md bg-[#dc2626]" /> Cảnh báo</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 xl:gap-8 w-full select-none">

      {/* LEFT AREA: 3D MODEL VIEWPORT (approx 68% width on desktop) */}
      <div className="flex-grow lg:flex-[68] flex flex-col bg-card border border-border/40 dark:border-white/5 rounded-[20px] p-5 shadow-sm overflow-hidden min-h-[580px] justify-between relative">
        <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-primary/5 rounded-full blur-[40px] pointer-events-none" />

        {/* Visualizer header metrics actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/20 dark:border-white/5 pb-3.5 mb-2">
          <div>
            <h3 className="font-black text-[13px] uppercase tracking-widest text-muted flex items-center gap-1.5">
              Sơ đồ tòa nhà
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsExploded(!isExploded)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black transition-colors ${
                isExploded
                  ? "bg-primary/10 border-primary/25 text-primary shadow-sm"
                  : "bg-background border-border text-muted hover:text-text"
              }`}
            >
              <Layers size={13} />
              Tách tầng: {isExploded ? "BẬT" : "TẮT"}
            </button>
          </div>
        </div>

        {/* 3D Stack Graphic Canvas (Visual height expanded) */}
        {floorsVM.length > 0 ? (
          <div className="flex-grow flex items-center justify-center relative py-6 overflow-visible w-full min-h-[500px]">
            <IsometricFloorStack
              floorsVM={floorsVM}
              activeFloorId={activeFloorId}
              hoveredFloorId={hoveredFloorId}
              onSelectFloor={onSelectFloor}
              onHoverFloor={onHoverFloor}
              onOpenRoomModal={onOpenRoomModal}
              hoveredRoomId={hoveredRoomId}
              onHoverRoom={setHoveredRoomId}
              isExploded={isExploded}
              buildingCode={building.code}
            />
          </div>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-muted">
            <Info size={36} className="mb-2 opacity-40" />
            <span className="text-[13px] font-bold">Tòa nhà chưa cấu hình tầng.</span>
          </div>
        )}

        {/* Status Legends */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-4 border-t border-border/20 dark:border-white/5 text-[10px] font-black uppercase text-muted tracking-wider">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-md bg-[#10b981]" /> Đã thuê</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-md bg-[#64748b]" /> Trống</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-md bg-[#0ea5e9]" /> Đặt cọc</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-md bg-[#d97706]" /> Bảo trì</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-md bg-[#f97316]" /> Sắp hết hạn</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-md bg-[#dc2626]" /> Cảnh báo</div>
        </div>

      </div>

      {/* RIGHT AREA: OPERATIONAL DASHBOARD (approx 32% width on desktop) - Single Card Wrapper with dividers (guardrail #3) */}
      <div className="w-full lg:w-[32%] shrink-0 bg-card border border-border/40 dark:border-white/5 rounded-[20px] shadow-sm flex flex-col divide-y divide-border/20 dark:divide-white/5 overflow-hidden">

        {/* Sub-Panel 1: Stats summary */}
        <div className="p-5 relative overflow-hidden flex flex-col gap-4">
          <div className="absolute top-0 right-0 w-[180px] h-[180px] bg-primary/5 rounded-full blur-[40px] pointer-events-none" />

          <h3 className="font-semibold text-[14px] text-text">
            Tổng quan vận hành
          </h3>

          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center text-[13px]">
              <span className="font-medium text-muted">Tổng số phòng</span>
              <span className="font-semibold text-text">{buildingStats.totalRooms} phòng</span>
            </div>
            <div className="flex justify-between items-center text-[13px]">
              <span className="font-medium text-muted">Tổng số cư dân</span>
              <span className="font-semibold text-text">{buildingStats.residentCount} người</span>
            </div>

            <div className="flex flex-col gap-1.5 pt-2 border-t border-border/20 dark:border-white/5">
              <div className="flex justify-between items-center text-[12px] font-semibold">
                <span className="text-muted">Tỷ lệ lấp đầy</span>
                <span className="text-primary">{buildingStats.occupancyRate}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${buildingStats.occupancyRate}%` }}
                  data-testid="occupancy-rate-bar"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sub-Panel 2: Operational Highlights & Warnings */}
        <div className="p-5 flex flex-col gap-4">
          <h3 className="font-semibold text-[14px] text-text">
            Cảnh báo nổi bật ({activeAlerts.length})
          </h3>

          {activeAlerts.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              {activeAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  onClick={() => onOpenRoomModal(alert.roomId)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-[12px] font-semibold transition-all cursor-pointer ${
                    alert.type === "danger"
                      ? "bg-rose-500/[0.03] hover:bg-rose-500/10 border-rose-500/10 dark:border-rose-500/20 text-rose-600 dark:text-rose-400"
                      : "bg-amber-500/[0.03] hover:bg-amber-500/10 border-amber-500/10 dark:border-amber-500/20 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {alert.type === "danger" ? <AlertTriangle size={14} /> : <Calendar size={14} />}
                    <span className="truncate">P.{alert.roomCode}: {alert.message}</span>
                  </div>
                  <span className="text-[10px] text-muted shrink-0">&rarr;</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center text-muted select-none">
              <Home size={24} className="text-emerald-500 opacity-60 mb-2" />
              <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">Tất cả vận hành bình thường</span>
            </div>
          )}
        </div>

        {/* Sub-Panel 3: Missing Temporary declarations checklists */}
        <div className="p-5 flex flex-col gap-4">
          <h3 className="font-semibold text-[14px] text-text">
            Tạm trú chưa hoàn tất ({missingTempResidenceRooms.length})
          </h3>

          {missingTempResidenceRooms.length > 0 ? (
            <div className="flex flex-col gap-2">
              {missingTempResidenceRooms.map((r, idx) => (
                <div
                  key={idx}
                  onClick={() => onOpenRoomModal(r.id)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 dark:border-white/5 bg-background/50 hover:bg-slate-50 dark:hover:bg-white/5 text-[12px] font-semibold text-text cursor-pointer transition-all"
                >
                  <span>Phòng P.{r.name}</span>
                  <span className="text-[10px] text-rose-500 font-bold uppercase">{r.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 text-center text-muted select-none">
              <ShieldAlert size={24} className="text-emerald-500 opacity-60 mb-2" />
              <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">Đã hoàn tất khai báo tạm trú</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
