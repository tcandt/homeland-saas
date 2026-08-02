"use client";

import React, { useMemo } from "react";
import type { Building } from "../../building.types";
import { SelectedNode } from "../../MasterDetailBuildings";
import { useBuildingVisualizer } from "./useBuildingVisualizer";
import BuildingOperationalHeader from "./BuildingOperationalHeader";
import BuildingOverview from "./BuildingOverview";
import FloorPlanView from "./FloorPlanView";
import RoomDetailDrawer from "./RoomDetailDrawer";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Info, HelpCircle } from "lucide-react";
import dayjs from "dayjs";

interface Props {
  building: Building;
  buildings: Building[];
  onSelectNode: (node: SelectedNode) => void;
  onEditBuilding: () => void;
  onAddFloor: () => void;
  onAddRoom: (floorId: string) => void;
  onOpenRoomModal: (roomId: string, tab?: string) => void;
  onEditFloor: (floorId: string) => void;
  onDeleteFloor: (floorId: string) => void;
  onDeleteRoom: (roomId: string) => void;
}

export default function BuildingOperationalView({
  building,
  buildings,
  onSelectNode,
  onEditBuilding,
  onAddFloor,
  onAddRoom,
  onOpenRoomModal,
  onEditFloor,
  onDeleteFloor,
  onDeleteRoom
}: Props) {
  const permissions = usePermissions();

  // URL state synchronization using hook
  const {
    activeFloorId,
    activeRoomId,
    hoveredRoomId,
    setHoveredRoomId,
    hoveredFloorId,
    setHoveredFloorId,
    selectFloor,
    selectRoom,
    closeRoomDrawer,
    goBackToOverview
  } = useBuildingVisualizer();

  // Parse active floor and active room from URL safely
  // Guardrail #5: Validate floor and room against active building model
  const activeFloor = useMemo(() => {
    if (!activeFloorId) return null;
    return building.floors.find(f => f.id === activeFloorId) || null;
  }, [building.floors, activeFloorId]);

  const activeRoom = useMemo(() => {
    if (!activeRoomId || !activeFloor) return null;
    return activeFloor.rooms.find(r => r.id === activeRoomId) || null;
  }, [activeFloor, activeRoomId]);

  const activeFloorName = useMemo(() => {
    if (!activeFloor) return null;
    const num = activeFloor.number;
    return num === 1 ? "Tầng trệt" : `Tầng ${num - 1}`;
  }, [activeFloor]);

  // Handle building switcher changes
  const handleSelectBuilding = (id: string) => {
    onSelectNode({
      type: "building",
      buildingId: id
    });
  };

  // Calculate building-wide operational metrics dynamically (guardrail #5)
  const stats = useMemo(() => {
    let totalRooms = 0;
    let occupiedRooms = 0;
    let vacantRooms = 0;
    let depositedRooms = 0;
    let maintenanceRooms = 0;
    let expiringRooms = 0;
    let totalRevenue = 0;
    let residentCount = 0;
    let totalResidentsWithResidence = 0;

    building.floors.forEach(f => {
      f.rooms.forEach(r => {
        totalRooms++;
        if (r.status === "occupied") occupiedRooms++;
        else if (r.status === "vacant") vacantRooms++;
        else if (r.status === "deposited") depositedRooms++;
        else if (r.status === "maintenance") maintenanceRooms++;

        // Calculate revenue & occupants
        if (r.rentalType === "whole") {
          if (r.contract) totalRevenue += r.contract.rentPrice || r.monthlyPrice || 0;
          if (r.tenant) {
            residentCount += 1 + (r.roommates?.length || 0);
            if (r.tenant.tempResidence) totalResidentsWithResidence++;
            (r.roommates || []).forEach(rm => {
              if (rm.tempResidence) totalResidentsWithResidence++;
            });
          }
        } else if (r.rentalType === "shared") {
          (r.sharedTenants || []).forEach(st => {
            totalRevenue += st.rentPrice || 0;
            residentCount++;
            if (st.tempResidence) totalResidentsWithResidence++;
          });
        }

        // Check expiring contract soon (<= 30 days) (guardrail #6)
        if (r.contract?.endDate) {
          const end = dayjs(r.contract.endDate).startOf("day");
          const diff = end.diff(dayjs().startOf("day"), "day");
          if (diff >= 0 && diff <= 30) expiringRooms++;
        }
      });
    });

    const tempResidencePercent = residentCount > 0 ? Math.round((totalResidentsWithResidence / residentCount) * 100) : 100;

    return {
      totalRooms,
      occupiedRooms,
      vacantRooms,
      depositedRooms,
      maintenanceRooms,
      expiringRooms,
      totalRevenue,
      residentCount,
      tempResidencePercent
    };
  }, [building]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="flex flex-col w-full h-full relative select-none">
      
      {/* 1. Header cockpit panel */}
      <BuildingOperationalHeader
        building={building}
        buildings={buildings}
        onSelectBuilding={handleSelectBuilding}
        onEditBuilding={onEditBuilding}
        onAddFloor={onAddFloor}
        permissions={{
          canUpdateBuilding: permissions.canUpdateBuilding,
          canCreateFloor: permissions.canCreateFloor
        }}
        activeFloorName={activeFloorName}
        onBackToOverview={goBackToOverview}
      />

      {/* 2. Premium KPI Summary Row - Sized & styled without excessive uppercase (guardrail #4) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-card border border-border/60 rounded-[16px] p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-[90px]">
          <span className="text-[12px] font-semibold text-muted">Doanh thu dự kiến</span>
          <span className="block text-[22px] font-semibold text-primary truncate mt-1">
            {formatMoney(stats.totalRevenue)}
          </span>
        </div>
        <div className="bg-card border border-border/60 rounded-[16px] p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-[90px]">
          <span className="text-[12px] font-semibold text-muted">Phòng đã thuê</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[22px] font-semibold text-emerald-500">{stats.occupiedRooms}</span>
            <span className="text-[12px] text-muted font-medium">/ {stats.totalRooms} phòng</span>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-[16px] p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-[90px]">
          <span className="text-[12px] font-semibold text-muted">Phòng trống</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[22px] font-semibold text-text">{stats.vacantRooms}</span>
            <span className="text-[12px] text-muted font-medium">/ {stats.totalRooms} phòng</span>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-[16px] p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-[90px]">
          <span className="text-[12px] font-semibold text-muted">Hợp đồng sắp hết hạn</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-[22px] font-semibold ${stats.expiringRooms > 0 ? "text-orange-500" : "text-text"}`}>
              {stats.expiringRooms}
            </span>
            <span className="text-[12px] text-muted font-medium">phòng</span>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-[16px] p-4 shadow-sm relative overflow-hidden flex flex-col justify-between h-[90px] col-span-2 sm:col-span-1">
          <span className="text-[12px] font-semibold text-muted">Khai báo tạm trú</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[22px] font-semibold text-indigo-500">{stats.tempResidencePercent}%</span>
            <span className="text-[12px] text-muted font-medium">cư dân</span>
          </div>
        </div>
      </div>

      {/* 3. Main content viewport containing breakpoints */}
      <div className="flex-1 flex flex-col w-full">
        {activeFloor ? (
          // View Mode 2: Floor Map View (Sơ đồ tầng)
          <FloorPlanView
            floor={activeFloor}
            activeRoomId={activeRoomId}
            onSelectRoom={selectRoom}
            hoveredRoomId={hoveredRoomId}
            onHoverRoom={setHoveredRoomId}
            onAddRoom={onAddRoom}
            onEditFloor={onEditFloor}
            onDeleteFloor={onDeleteFloor}
            permissions={{
              canCreateRoom: permissions.canCreateRoom,
              canUpdateFloor: permissions.canUpdateFloor,
              canDeleteFloor: permissions.canDeleteFloor
            }}
          />
        ) : (
          // View Mode 1: 3D Building Overview (Isometric Stack)
          // Hides the 3D stack on smaller viewports (< 1024px) for responsive clarity (guardrail #6)
          <div className="w-full flex flex-col">
            {/* Desktop and Tablet full cockpit (>= 1024px) */}
            <div className="hidden md:block w-full">
              <BuildingOverview
                building={building}
                activeFloorId={activeFloorId}
                hoveredFloorId={hoveredFloorId}
                onSelectFloor={selectFloor}
                onHoverFloor={setHoveredFloorId}
                onOpenRoomModal={onOpenRoomModal}
              />
            </div>

            {/* Mobile / Compact view (< 768px): Card list layout fallback */}
            <div className="block md:hidden flex flex-col gap-4">
              <div className="p-4 bg-blue-500/[0.03] border border-blue-500/10 rounded-xl text-muted text-[13px] flex items-start gap-2.5 mb-2">
                <Info size={16} className="text-primary mt-0.5 shrink-0" />
                <span>Màn hình nhỏ. Hiển thị danh sách các tầng dạng thẻ trực quan.</span>
              </div>
              
              <div className="flex flex-col gap-3">
                {building.floors.map((floor) => {
                  const num = floor.number;
                  const name = num === 1 ? "Tầng trệt" : `Tầng ${num - 1}`;
                  return (
                    <button
                      key={floor.id}
                      type="button"
                      onClick={() => selectFloor(floor.id)}
                      className="w-full text-left p-4 bg-card border border-border/80 rounded-2xl flex justify-between items-center hover:border-primary transition-all"
                    >
                      <div className="flex flex-col">
                        <span className="font-black text-[15px] text-text">{name}</span>
                        <span className="text-[12px] text-muted font-semibold">{floor.rooms.length} phòng</span>
                      </div>
                      <span className="text-[12px] font-black text-primary uppercase">Xem sơ đồ &rarr;</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. View Mode 3: Right drawer room details HUD overlay */}
      {activeRoomId && (
        <RoomDetailDrawer
          roomId={activeRoomId}
          onClose={closeRoomDrawer}
          onOpenRoomModal={onOpenRoomModal}
          onDeleteRoom={onDeleteRoom}
        />
      )}

    </div>
  );
}
