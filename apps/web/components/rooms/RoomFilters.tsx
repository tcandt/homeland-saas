"use client";

import React, { useState } from "react";
import { Search, SlidersHorizontal, X, ArrowUpDown } from "lucide-react";
import { useRoomsStore } from "../../lib/hooks/useRoomsStore";
import { useBuildingsQuery } from "../../lib/queries/buildings.queries";
import { Select } from "../ui/Select";

interface RoomFilterActions {
  setSearch: (value: string) => void;
  setBuildingId: (value: string) => void;
  setFloorId: (value: string) => void;
  setStatus: (value: string) => void;
  setType: (value: string) => void;
}

export function resetRoomFilters(actions: RoomFilterActions) {
  actions.setSearch("");
  actions.setBuildingId("");
  actions.setFloorId("");
  actions.setStatus("");
  actions.setType("");
}

const roomStatusOptions = [
  { label: "Tất cả trạng thái", value: "" },
  { label: "Trống", value: "AVAILABLE" },
  { label: "Đã đặt chỗ", value: "RESERVED" },
  { label: "Đang thuê", value: "OCCUPIED" },
  { label: "Bảo trì", value: "MAINTENANCE" },
  { label: "Đang dọn", value: "CLEANING" },
  { label: "Ngưng sử dụng", value: "INACTIVE" },
];

const roomTypeOptions = [
  { label: "Tất cả loại phòng", value: "" },
  { label: "1 phòng ngủ", value: "1PN" },
  { label: "2 phòng ngủ", value: "2PN" },
  { label: "Studio", value: "Studio" },
  { label: "Văn phòng", value: "Office" },
  { label: "Ký túc xá", value: "Dorm" },
];

export default function RoomFilters() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const {
    search,
    setSearch,
    buildingId,
    setBuildingId,
    floorId,
    setFloorId,
    status,
    setStatus,
    type,
    setType,
  } = useRoomsStore();
  const { data: buildings = [] } = useBuildingsQuery({ limit: 100 });
  const selectedBuilding = buildings.find((building: any) => building.id === buildingId);
  const buildingOptions = [
    { label: "Tất cả tòa nhà", value: "" },
    ...buildings.map((building: any) => ({ label: building.name, value: building.id })),
  ];
  const floorOptions = [
    { label: buildingId ? "Tất cả tầng" : "Chọn tòa nhà trước", value: "" },
    ...((selectedBuilding?.floors || []).map((floor: any) => ({
      label: `Tầng ${floor.number}`,
      value: floor.id,
    }))),
  ];

  const handleBuildingChange = (nextBuildingId: string) => {
    setBuildingId(nextBuildingId);
    setFloorId("");
  };

  const handleReset = () => {
    resetRoomFilters({ setSearch, setBuildingId, setFloorId, setStatus, setType });
  };
  
  return (
    <div className={`flex items-center gap-[6px] md:gap-[12px] bg-card border border-border rounded-[12px] md:rounded-[16px] h-[50px] md:h-[56px] p-[6px] md:px-[6px] md:py-0 shadow-sm w-full relative overflow-visible ${isFilterOpen ? 'z-[150]' : 'z-20'}`}>
      
      {/* Search - integrated into the bar */}
      <div className="flex items-center gap-[6px] px-[10px] md:px-[14px] h-full flex-1 bg-black/5 dark:bg-white/5 md:bg-transparent rounded-[8px] md:rounded-none">
        <Search size={16} className="text-muted shrink-0" />
        <input 
          type="text" 
          placeholder="Tìm phòng, khách..." 
          className="bg-transparent border-none outline-none w-full text-[13px] font-medium text-text placeholder:text-muted/70"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Mobile Actions */}
      <div className="flex md:hidden items-center gap-[4px] shrink-0 h-full">
        <button className="flex items-center justify-center gap-[4px] h-full px-[10px] bg-black/5 dark:bg-white/5 rounded-[8px] text-text font-bold text-[12px]">
          <ArrowUpDown size={14} className="text-muted" />
          <span className="hidden sm:inline">Sắp xếp</span>
        </button>
        <button onClick={() => setIsFilterOpen(true)} className="flex items-center justify-center gap-[4px] h-full px-[10px] bg-black/5 dark:bg-white/5 rounded-[8px] text-text font-bold text-[12px]">
          <SlidersHorizontal size={14} className="text-muted" />
          <span>Lọc</span>
        </button>
      </div>

      {/* Desktop Actions */}
      <div className="hidden md:flex items-center gap-[6px] px-[6px] h-full shrink-0">
        <button className="flex items-center justify-center gap-[6px] h-[36px] px-[16px] bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-[10px] text-text font-bold text-[13px] transition-colors">
          <ArrowUpDown size={14} className="text-muted" />
          <span>Sắp xếp</span>
        </button>
        <button onClick={() => setIsFilterOpen(true)} className="flex items-center justify-center gap-[6px] h-[36px] px-[16px] bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-[10px] font-bold text-[13px] shadow-sm transition-all shadow-[#6366f1]/20">
          <SlidersHorizontal size={14} className="text-white/80" />
          <span>Bộ lọc</span>
        </button>
      </div>

      {/* Filter Modal / Bottom Sheet */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)}>
          <div 
            className="w-full md:w-[420px] bg-card rounded-t-[24px] md:rounded-[24px] p-[20px] pb-[40px] md:pb-[20px] shadow-2xl animate-in fade-in slide-in-from-bottom-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-[20px]">
              <h3 className="font-black text-[20px] text-text tracking-tight">Bộ lọc phòng</h3>
              <button onClick={() => setIsFilterOpen(false)} className="w-[32px] h-[32px] flex items-center justify-center bg-black/5 dark:bg-white/5 rounded-full text-muted hover:text-text transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 gap-[12px]">
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-muted" htmlFor="room-filter-building">
                Tòa nhà
                <Select
                  id="room-filter-building"
                  data-testid="room-filter-building"
                  aria-label="Lọc theo tòa nhà"
                  options={buildingOptions}
                  value={buildingId}
                  onChange={(event) => handleBuildingChange(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-muted" htmlFor="room-filter-floor">
                Tầng
                <Select
                  id="room-filter-floor"
                  data-testid="room-filter-floor"
                  aria-label="Lọc theo tầng"
                  options={floorOptions}
                  value={floorId}
                  disabled={!buildingId || floorOptions.length === 1}
                  onChange={(event) => setFloorId(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-muted" htmlFor="room-filter-status">
                Trạng thái
                <Select
                  id="room-filter-status"
                  data-testid="room-filter-status"
                  aria-label="Lọc theo trạng thái"
                  options={roomStatusOptions}
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12px] font-bold text-muted" htmlFor="room-filter-type">
                Loại phòng
                <Select
                  id="room-filter-type"
                  data-testid="room-filter-type"
                  aria-label="Lọc theo loại phòng"
                  options={roomTypeOptions}
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                />
              </label>
            </div>

            <div className="mt-[20px] grid grid-cols-2 gap-[10px]">
              <button
                type="button"
                data-testid="room-filter-reset"
                onClick={handleReset}
                className="h-[44px] rounded-[12px] border border-border font-bold text-[14px] text-text transition-colors hover:bg-surface"
              >
                Đặt lại
              </button>
              <button
                type="button"
                onClick={() => setIsFilterOpen(false)}
                className="h-[44px] bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-[12px] font-bold text-[14px] transition-all duration-200 shadow-lg shadow-[#6366f1]/30 hover:shadow-xl hover:-translate-y-[2px]"
              >
                Áp dụng bộ lọc
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
