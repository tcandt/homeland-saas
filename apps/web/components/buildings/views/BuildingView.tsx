"use client";

import React, { useState } from "react";
import type { Building, Room } from "../building.types";
import { SelectedNode } from "../MasterDetailBuildings";
import { ChevronRight, ChevronDown, Users, Home, Plus, MapPin, Edit, Trash2 } from "lucide-react";
import RoomCardV7 from "./RoomCardV7";
import { Button } from "../../ui/Button";
import { usePermissions } from '@/lib/hooks/usePermissions';
import BuildingOperationalView from "./visualizer/BuildingOperationalView";
import { useSearchParams } from "next/navigation";

interface Props {
  building: Building;
  buildings: Building[];
  onSelectNode: (node: SelectedNode) => void;
  onEditBuilding: () => void;
  onAddFloor: () => void;
  onAddRoomQuick: () => void;
  onOpenRoomModal: (roomId: string, initialTab?: string) => void;
  onEditFloor: (floorId: string) => void;
  onDeleteFloor: (floorId: string) => void;
  onAddRoom: (floorId: string) => void;
  onDeleteRoom: (roomId: string) => void;
}

export default function BuildingView({ 
  building, 
  buildings,
  onSelectNode, 
  onEditBuilding, 
  onAddFloor, 
  onAddRoomQuick, 
  onOpenRoomModal, 
  onEditFloor, 
  onDeleteFloor,
  onAddRoom,
  onDeleteRoom
}: Props) {
  const permissions = usePermissions();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<"3d" | "list">("3d");

  // Compute metrics dynamically from rooms
  let totalRooms = 0;
  let occupiedRooms = 0;
  let vacantRooms = 0;
  let depositedRooms = 0;
  let maintenanceRooms = 0;
  let expiringRooms = 0;
  
  let totalRevenue = 0;
  let totalDeposit = 0;

  building.floors.forEach(floor => {
    floor.rooms.forEach(room => {
      totalRooms++;
      
      if (room.status === "occupied") occupiedRooms++;
      else if (room.status === "vacant") vacantRooms++;
      else if (room.status === "deposited") depositedRooms++;
      else if (room.status === "maintenance") maintenanceRooms++;
      else if (room.status === "expiring_soon") expiringRooms++;

      if (room.rentalType === "whole") {
        if (room.contract) {
          totalRevenue += room.contract.rentPrice || room.monthlyPrice || 0;
          totalDeposit += room.contract.deposit || 0;
        }
      } else if (room.rentalType === "shared") {
        if (room.sharedTenants) {
          room.sharedTenants.forEach(st => {
            totalRevenue += st.rentPrice || 0;
            totalDeposit += st.deposit || 0;
          });
        }
      }
    });
  });

  const [expandedFloors, setExpandedFloors] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    building.floors.forEach(f => init[f.id] = true); // Expand all by default
    return init;
  });

  const toggleFloor = (floorId: string) => {
    setExpandedFloors(prev => ({ ...prev, [floorId]: !prev[floorId] }));
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="flex flex-col w-full h-full pb-10">
      
      {/* 3-Mode View Switcher Tabs (guardrail #9) */}
      <div className="flex border-b border-border/50 pb-px mb-6 select-none w-fit gap-6 text-[14px]">
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(window.location.search);
            params.delete("floor");
            params.delete("room");
            window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
            setViewMode("3d");
          }}
          className={`pb-2.5 font-bold transition-all relative ${
            viewMode === "3d" && !searchParams.get("floor")
              ? "text-primary border-b-2 border-primary"
              : "text-muted hover:text-text"
          }`}
        >
          Tổng quan tòa nhà
        </button>
        <button
          type="button"
          onClick={() => {
            const params = new URLSearchParams(window.location.search);
            if (!params.get("floor") && building.floors.length > 0) {
              params.set("floor", building.floors[0].id);
            }
            params.delete("room");
            window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
            setViewMode("3d");
          }}
          className={`pb-2.5 font-bold transition-all relative ${
            viewMode === "3d" && searchParams.get("floor")
              ? "text-primary border-b-2 border-primary"
              : "text-muted hover:text-text"
          }`}
        >
          Sơ đồ tầng
        </button>
        <button
          type="button"
          onClick={() => setViewMode("list")}
          className={`pb-2.5 font-bold transition-all relative ${
            viewMode === "list"
              ? "text-primary border-b-2 border-primary"
              : "text-muted hover:text-text"
          }`}
        >
          Danh sách phòng
        </button>
      </div>

      {viewMode === "3d" ? (
        <BuildingOperationalView
          building={building}
          buildings={buildings}
          onSelectNode={onSelectNode}
          onEditBuilding={onEditBuilding}
          onAddFloor={onAddFloor}
          onAddRoom={onAddRoom}
          onOpenRoomModal={onOpenRoomModal}
          onEditFloor={onEditFloor}
          onDeleteFloor={onDeleteFloor}
          onDeleteRoom={onDeleteRoom}
        />
      ) : (
        <div className="flex flex-col gap-6 md:gap-8">
          
          {/* Dynamic Building Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
            <div>
              <h1 className="font-semibold text-[26px] md:text-[28px] text-text tracking-tight">{building.name}</h1>
              <p className="text-[13px] text-muted font-medium flex items-center gap-1.5 mt-1"><MapPin size={14} /> {building.address}</p>
            </div>
            <div className="flex items-center gap-3">
              {permissions.canUpdateBuilding && (
                <Button variant="outline" onClick={onEditBuilding} data-testid="edit-building-button">
                  Cấu hình Tòa nhà
                </Button>
              )}
              {permissions.canCreateFloor && (
                <Button onClick={onAddFloor} data-testid="add-floor-button">
                  <Plus size={16} className="mr-1.5" /> Thêm Tầng
                </Button>
              )}
            </div>
          </div>

          {/* Building Dashboards: 4 Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-card border border-border/60 rounded-[20px] p-5 shadow-sm">
              <span className="block text-[10px] font-black uppercase text-muted tracking-wider">Doanh thu dự kiến</span>
              <span className="block text-[22px] font-semibold text-text mt-1.5">
                {formatMoney(totalRevenue)}
              </span>
            </div>

            <div className="bg-card border border-border/60 rounded-[20px] p-5 shadow-sm">
              <span className="block text-[10px] font-black uppercase text-muted tracking-wider">Phòng đang thuê</span>
              <span className="block text-[22px] font-semibold text-text mt-1.5">
                {occupiedRooms + expiringRooms} / {totalRooms} phòng
              </span>
            </div>

            <div className="bg-card border border-border/60 rounded-[20px] p-5 shadow-sm">
              <span className="block text-[10px] font-black uppercase text-muted tracking-wider">Phòng còn trống</span>
              <span className="block text-[22px] font-semibold text-text mt-1.5">
                {vacantRooms} / {totalRooms} phòng
              </span>
            </div>

            <div className="bg-card border border-border/60 rounded-[20px] p-5 shadow-sm">
              <span className="block text-[10px] font-black uppercase text-muted tracking-wider">Tổng đặt cọc</span>
              <span className="block text-[22px] font-semibold text-text mt-1.5">
                {formatMoney(totalDeposit)}
              </span>
            </div>

          </div>

          {/* Accordion Floor Layout containing Room Cards with Photos */}
          <div className="flex flex-col gap-4 mt-2">
            {building.floors.map((floor) => {
              const isFloorExpanded = expandedFloors[floor.id] ?? true;
              return (
                <div key={floor.id} className="bg-card border border-border/60 rounded-[20px] p-5 shadow-sm flex flex-col gap-4">
                  {/* Floor Header summary toggle */}
                  <div 
                    onClick={() => toggleFloor(floor.id)}
                    className="flex justify-between items-center cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2">
                      {isFloorExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      <span className="font-semibold text-[16px] text-text">
                        {floor.number === 1 ? "Tầng trệt" : `Tầng ${floor.number - 1}`}
                      </span>
                      <span className="text-[12px] font-medium text-muted">({floor.rooms.length} phòng)</span>
                    </div>

                    <div className="flex items-center gap-3">
                      {permissions.canCreateRoom && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddRoom(floor.id);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6366f1]/10 text-[#6366f1] hover:bg-[#6366f1] hover:text-white transition-all text-[11px] font-bold rounded-lg focus:outline-none"
                        >
                          <Plus size={12} /> Thêm Phòng
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Floor Rooms cards photo list */}
                  {isFloorExpanded && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
                      {floor.rooms.map((room) => (
                        <RoomCardV7
                          key={room.id}
                          room={room}
                          onOpenRoomModal={onOpenRoomModal}
                        />
                      ))}
                      {permissions.canCreateRoom && (
                        <div className="p-0.5">
                          <div 
                            onClick={() => onAddRoom(floor.id)}
                            className="border-2 border-dashed border-border hover:border-[#6366f1] rounded-[16px] min-h-[140px] flex flex-col items-center justify-center text-muted hover:text-[#6366f1] hover:bg-[#6366f1]/5 cursor-pointer transition-all"
                          >
                            <Plus size={24} className="mb-2" />
                            <span className="font-bold text-[12px]">Thêm phòng mới</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      )}

    </div>
  );
}
