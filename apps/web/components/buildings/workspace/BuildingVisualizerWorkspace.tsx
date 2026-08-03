"use client";

import React, { useState } from "react";
import { ViewMode } from "./useBuildingsWorkspace";
import type { Building, Floor, Room } from "../building.types";
import BuildingOverview from "../views/visualizer/BuildingOverview";
import RoomCardV7 from "../views/RoomCardV7";
import { Info, Compass, Maximize2, ShieldAlert, ZoomIn, ZoomOut } from "lucide-react";
import { getRoomDisplayName, getFloorDisplayName } from "../building-labels";
import { resolveFloorLayoutSpec, resolveVisualizationProfile } from "./building-profiles";
import FloorPlan2D from "../views/visualizer/FloorPlan2D";
import ReferenceFloorPlan from "../views/visualizer/ReferenceFloorPlan";

interface BuildingVisualizerWorkspaceProps {
  building: Building;
  activeView: ViewMode;
  activeFloor: Floor | null;
  activeRoom: Room | null;
  onSelectFloor: (floorId: string) => void;
  onSelectRoom: (roomId: string) => void;
  onSelectFloorRoom: (floorId: string, roomId: string) => void;
  onOpenRoomModal: (roomId: string, tab?: string) => void;
  selectedFloorFilter: string;
  selectedStatusFilter: string;
}

export default function BuildingVisualizerWorkspace({
  building,
  activeView,
  activeFloor,
  activeRoom,
  onSelectFloor,
  onSelectRoom,
  onSelectFloorRoom,
  onOpenRoomModal,
  selectedFloorFilter,
  selectedStatusFilter
}: BuildingVisualizerWorkspaceProps) {
  const [zoomLevel, setZoomLevel] = useState(100);

  // central profile resolver
  const profile = resolveVisualizationProfile(building.code || building.name || "");
  const layoutSpec = React.useMemo(
    () => resolveFloorLayoutSpec(building, activeFloor),
    [building, activeFloor],
  );

  // Filtered rooms for the rooms list view
  const filteredRooms = React.useMemo(() => {
    const list: Room[] = [];
    building.floors.forEach(f => {
      // Filter by floor
      if (selectedFloorFilter !== "all" && f.id !== selectedFloorFilter) return;
      f.rooms.forEach(r => {
        // Filter by status
        if (selectedStatusFilter !== "all") {
          const matchStatus = r.status === selectedStatusFilter || (selectedStatusFilter === "occupied" && r.status === "expiring_soon");
          if (!matchStatus) return;
        }
        list.push(r);
      });
    });
    return list;
  }, [building, selectedFloorFilter, selectedStatusFilter]);

  const activeFloorLabel = activeFloor ? getFloorDisplayName(activeFloor.number, building.code) : "";

  // Dynamic Room Code Mapping based on Floor Number for LK01-31
  const floorRoomsMapping = React.useMemo(() => {
    if (!activeFloor) return { suiteCode: "", singleCode: "", suiteRoom: null, singleRoom: null };
    if (activeFloor.number === 1) {
      const room = activeFloor.rooms.find(r => r.code === "PN 31-01");
      return { suiteCode: "", singleCode: "PN 31-01", suiteRoom: null, singleRoom: room || activeFloor.rooms[0] };
    }
    if (activeFloor.number === 2) {
      const r2 = activeFloor.rooms.find(r => r.code === "PN 31-02");
      const r3 = activeFloor.rooms.find(r => r.code === "PN 31-03");
      return { suiteCode: "PN 31-02", singleCode: "PN 31-03", suiteRoom: r2 || null, singleRoom: r3 || null };
    }
    if (activeFloor.number === 3) {
      const r4 = activeFloor.rooms.find(r => r.code === "PN 31-04");
      const r5 = activeFloor.rooms.find(r => r.code === "PN 31-05");
      return { suiteCode: "PN 31-04", singleCode: "PN 31-05", suiteRoom: r4 || null, singleRoom: r5 || null };
    }
    if (activeFloor.number === 4) {
      const r6 = activeFloor.rooms.find(r => r.code === "PN 31-06");
      const r7 = activeFloor.rooms.find(r => r.code === "PN 31-07");
      return { suiteCode: "PN 31-06", singleCode: "PN 31-07", suiteRoom: r6 || null, singleRoom: r7 || null };
    }
    return { suiteCode: "", singleCode: "", suiteRoom: null, singleRoom: null };
  }, [activeFloor]);

  return (
    <div className="flex-1 lg:flex-[74%] flex flex-col bg-card border border-border/40 dark:border-white/5 rounded-[24px] p-6 shadow-sm min-h-[640px] justify-between relative overflow-visible transition-colors">
      {/* Visual background lights */}
      <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-primary/5 rounded-full blur-[60px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[180px] h-[180px] bg-[#8b5cf6]/5 rounded-full blur-[50px] pointer-events-none" />

      {/* View Content Switcher */}
      <div className="flex-1 flex flex-col w-full h-full justify-between">
        
        {/* 1. OVERVIEW MODE */}
        {activeView === "overview" && (
          <div className="w-full flex flex-col h-full justify-between animate-in fade-in zoom-in-95 duration-300" key="overview">
            <div className="flex-1 flex items-center justify-center">
              <BuildingOverview
                building={building}
                activeFloorId={activeFloor ? activeFloor.id : null}
                hoveredFloorId={null}
                onSelectFloor={onSelectFloor}
                onHoverFloor={() => {}}
                onOpenRoomModal={onOpenRoomModal}
                activeRoomId={activeRoom?.id || null}
                onSelectRoom={onSelectFloorRoom}
                hideSidebar={true}
              />
            </div>
          </div>
        )}

        {/* 2. FLOOR 2.5D PERSPECTIVE VIEW MODE */}
        {activeView === "floor-3d" && activeFloor && (
          <div className="w-full flex flex-col h-full justify-between animate-in fade-in zoom-in-95 duration-300" key={`floor-3d-${activeFloor.id}`}>
            {/* Sub-header inside visualizer */}
            <div className="flex items-center justify-between border-b border-border/20 dark:border-white/5 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase text-muted tracking-wider">
                  Mặt cắt phối cảnh 2.5D — {activeFloorLabel}
                </span>
                
                {profile === "lk01-31-custom" ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-orange-500/10 text-orange-500 border border-orange-500/20 uppercase tracking-tight">
                    Placeholder framing only — geometry is not rendered yet
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase tracking-tight">
                    Chưa có cấu hình
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 rounded-lg p-0.5">
                <button 
                  onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
                  className="p-1 text-muted hover:text-text rounded hover:bg-black/5"
                  title="Thu nhỏ"
                >
                  <ZoomOut size={13} />
                </button>
                <span className="text-[10px] font-black text-muted px-1">{zoomLevel}%</span>
                <button 
                  onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
                  className="p-1 text-muted hover:text-text rounded hover:bg-black/5"
                  title="Phóng to"
                >
                  <ZoomIn size={13} />
                </button>
              </div>
            </div>

            {/* Custom 2.5D model container */}
            {profile === "lk01-31-custom" ? (
              <div className="flex-1 flex flex-col items-center justify-center relative bg-card border border-border/40 dark:border-white/5 rounded-2xl p-6 min-h-[440px] overflow-hidden select-none">
                
                {/* Visualizer viewport conforming to 20:5 aspect ratio */}
                <div 
                  className="w-full max-w-[760px] aspect-[4/1] bg-[#fdfbf7] border border-border/40 dark:border-white/5 rounded-xl relative shadow-md overflow-hidden flex items-center justify-center transition-all duration-300"
                  style={{ transform: `scale(${zoomLevel / 100})` }}
                >
                  {/* Tầng trệt: parking layout cutaway */}
                  {activeFloor.number === 1 && (
                    <div className="relative w-full h-full">
                      <img 
                        src="/media__1785578496439.jpg" 
                        alt="Tầng trệt 2.5D cutaway" 
                        className="w-full h-full object-contain pointer-events-none"
                      />
                      
                      {/* SVG Hotspots */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        {/* PN 31-01 single room area click zone */}
                        <rect 
                          x="70%" y="15%" width="22%" height="70%" 
                          fill="rgba(99, 102, 241, 0)" 
                          stroke="rgba(99, 102, 241, 0)"
                          strokeWidth="1.5"
                          className="pointer-events-auto cursor-pointer hover:fill-indigo-500/10 hover:stroke-indigo-500/40 transition-all rounded"
                          onClick={() => floorRoomsMapping.singleRoom && onSelectRoom(floorRoomsMapping.singleRoom.id)}
                        />
                      </svg>
                    </div>
                  )}

                  {/* Upper floors: high-aesthetic 2.5D floor plan layouts custom vectors */}
                  {activeFloor.number > 1 && (
                    <div className="w-full h-full relative flex items-center justify-center p-3">
                      <svg viewBox="0 0 800 200" className="w-full h-full overflow-visible">
                        {/* Floor slab background */}
                        <rect x="10" y="10" width="780" height="180" rx="6" fill="#f5f2eb" stroke="#d5d0c5" strokeWidth="2" />
                        
                        {/* Walls - gray fill and lines */}
                        {/* External wall */}
                        <rect x="15" y="15" width="770" height="170" fill="none" stroke="#6b7280" strokeWidth="4" />
                        
                        {/* Partitions */}
                        {/* Front Suite area (y=0 to 8.5) -> left side, core staircase middle, single room right */}
                        {/* Staircase wall left */}
                        <line x1="330" y1="15" x2="330" y2="185" stroke="#6b7280" strokeWidth="4" />
                        {/* Staircase wall right */}
                        <line x1="430" y1="15" x2="430" y2="185" stroke="#6b7280" strokeWidth="4" />
                        
                        {/* Inside Front Suite (left 330px): 2 mini bedrooms, common living, bathroom */}
                        {/* Bedroom divider wall */}
                        <line x1="170" y1="15" x2="170" y2="120" stroke="#6b7280" strokeWidth="3" />
                        <line x1="15" y1="120" x2="330" y2="120" stroke="#6b7280" strokeWidth="3" />
                        
                        {/* Mini bedroom 1 door arc */}
                        <path d="M 125 120 A 45 45 0 0 1 170 120" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="2,2" />
                        {/* Mini bedroom 2 door arc */}
                        <path d="M 215 120 A 45 45 0 0 0 170 120" fill="none" stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="2,2" />
                        
                        {/* Stair steps graphic */}
                        <line x1="330" y1="45" x2="430" y2="45" stroke="#94a3b8" strokeWidth="1.5" />
                        <line x1="330" y1="75" x2="430" y2="75" stroke="#94a3b8" strokeWidth="1.5" />
                        <line x1="330" y1="105" x2="430" y2="105" stroke="#94a3b8" strokeWidth="1.5" />
                        <line x1="330" y1="135" x2="430" y2="135" stroke="#94a3b8" strokeWidth="1.5" />
                        <line x1="330" y1="155" x2="430" y2="155" stroke="#94a3b8" strokeWidth="1.5" />
                        
                        {/* Furniture representations */}
                        {/* Bed in mini bedroom 1 */}
                        <rect x="35" y="30" width="80" height="50" rx="3" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
                        <rect x="35" y="30" width="20" height="50" rx="1" fill="#cbd5e1" />
                        
                        {/* Bed in mini bedroom 2 */}
                        <rect x="235" y="30" width="80" height="50" rx="3" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
                        <rect x="295" y="30" width="20" height="50" rx="1" fill="#cbd5e1" />

                        {/* Living room sofa */}
                        <rect x="50" y="145" width="120" height="30" rx="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.5" />
                        <rect x="185" y="145" width="40" height="30" rx="2" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />

                        {/* Bed in Rear Single room */}
                        <rect x="675" y="30" width="80" height="50" rx="3" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.5" />
                        <rect x="735" y="30" width="20" height="50" rx="1" fill="#cbd5e1" />

                        {/* Clickable Hover Zones & Text Labels */}
                        {/* Front Suite Zone */}
                        <g 
                          className="pointer-events-auto cursor-pointer"
                          onClick={() => floorRoomsMapping.suiteRoom && onSelectRoom(floorRoomsMapping.suiteRoom.id)}
                        >
                          <rect x="20" y="20" width="305" height="160" fill="transparent" />
                          <rect x="110" y="8" width="130" height="18" rx="4" fill="#6366f1" className="opacity-90" />
                          <text x="175" y="21" fill="#ffffff" fontSize="9" fontWeight="black" textAnchor="middle">
                            {floorRoomsMapping.suiteCode} (Suite lớn)
                          </text>
                        </g>

                        {/* Core Staircase label */}
                        <text x="380" y="28" fill="#94a3b8" fontSize="8" fontWeight="black" textAnchor="middle">CORE STAIR</text>

                        {/* Rear Single Room Zone */}
                        <g 
                          className="pointer-events-auto cursor-pointer"
                          onClick={() => floorRoomsMapping.singleRoom && onSelectRoom(floorRoomsMapping.singleRoom.id)}
                        >
                          <rect x="435" y="20" width="345" height="160" fill="transparent" />
                          <rect x="545" y="8" width="130" height="18" rx="4" fill="#10b981" className="opacity-90" />
                          <text x="610" y="21" fill="#ffffff" fontSize="9" fontWeight="black" textAnchor="middle">
                            {floorRoomsMapping.singleCode} (Phòng đơn)
                          </text>
                        </g>
                      </svg>
                    </div>
                  )}

                </div>

                {/* Status info bar */}
                <div className="mt-6 flex flex-col items-center text-center max-w-md z-10">
                  <span className="text-[12px] font-black text-text tracking-tight flex items-center gap-1.5 uppercase">
                    <ShieldAlert size={14} className="text-orange-500 animate-pulse" />
                    Khung vẽ 2.5D mặt cắt Tầng 2
                  </span>
                  <p className="text-[10px] text-muted font-medium mt-1">
                    Cấu trúc gồm phòng Suite lớn phía trước (gồm 2 phòng ngủ mini kín riêng, phòng khách, WC) và phòng đơn phía sau.
                  </p>
                </div>

              </div>
            ) : (
              /* Fallback for other buildings */
              <div className="flex-1 flex flex-col items-center justify-center relative bg-card rounded-2xl border border-dashed border-border/40 dark:border-white/10 p-8 min-h-[440px] text-center select-none">
                <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4">
                  <ShieldAlert size={28} />
                </div>
                <h3 className="text-base font-black text-text tracking-tight uppercase">
                  Chưa cấu hình mặt bằng kiến trúc cho tòa nhà này
                </h3>
                <p className="text-xs text-muted max-w-md mt-2 leading-relaxed px-4">
                  Bản vẽ kỹ thuật chi tiết 2D và mô phỏng phối cảnh 3D hiện tại chỉ áp dụng cho tòa nhà **LK01-31** trong giai đoạn hiệu chuẩn hình học.
                </p>
              </div>
            )}

          </div>
        )}

        {/* 3. FLOOR 2D BLUEPRINT VIEW MODE */}
        {activeView === "floor-2d" && activeFloor && (
          profile === "lk01-31-custom" ? (
            <div className="h-full w-full animate-in fade-in zoom-in-95 duration-300" key={`floor-2d-${activeFloor.id}`}>
              <ReferenceFloorPlan
                buildingCode={building.code || building.name}
                floor={activeFloor}
                selectedRoomId={activeRoom?.id || null}
                onSelectRoom={onSelectRoom}
              />
            </div>
          ) : (
          <div className="flex h-full w-full flex-col animate-in fade-in zoom-in-95 duration-300" key={`floor-2d-${activeFloor.id}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/20 dark:border-white/5 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-muted">
                  Mặt bằng kỹ thuật 2D — {activeFloorLabel}
                </span>
                <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-tight ${
                  layoutSpec
                    ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-600"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-600"
                }`}>
                  {layoutSpec ? "FloorLayoutSpec thực" : "Chưa cấu hình"}
                </span>
              </div>
              {layoutSpec && (
                <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-card p-1" aria-label="Điều khiển thu phóng">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((value) => Math.max(80, value - 10))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-text focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="Thu nhỏ mặt bằng"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span className="min-w-10 text-center text-[10px] font-black text-muted" aria-live="polite">{zoomLevel}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((value) => Math.min(130, value + 10))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-slate-100 hover:text-text focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="Phóng to mặt bằng"
                  >
                    <ZoomIn size={14} />
                  </button>
                </div>
              )}
            </div>

            {layoutSpec ? (
              <FloorPlan2D
                layout={layoutSpec}
                rooms={activeFloor.rooms}
                selectedRoomId={activeRoom?.id || null}
                onSelectRoom={onSelectRoom}
                zoom={zoomLevel}
              />
            ) : (
              <div className="flex min-h-[520px] flex-1 select-none flex-col items-center justify-center rounded-2xl border border-dashed border-border/40 dark:border-white/5 bg-card p-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                  <ShieldAlert size={28} />
                </div>
                <h3 className="text-base font-black uppercase tracking-tight text-text">Chưa cấu hình</h3>
                <p className="mt-2 max-w-md text-xs leading-relaxed text-muted">
                  Mặt bằng AutoCAD hiện được cấu hình cho Tầng 2, Tầng 3 và Tầng 4 của tòa LK01-31.
                </p>
              </div>
            )}
          </div>
          )
        )}

        {/* 4. ROOMS LIST MODE */}
        {activeView === "rooms" && (
          <div className="w-full flex flex-col h-full justify-between animate-in fade-in zoom-in-95 duration-300" key={`rooms-${selectedFloorFilter}-${selectedStatusFilter}`}>
            <div className="flex items-center justify-between border-b border-border/20 dark:border-white/5 pb-3 mb-6">
              <div>
                <h3 className="font-bold text-[16px] text-text">
                  Danh sách phòng vận hành
                </h3>
                <p className="text-[12px] text-muted font-medium mt-0.5">
                  Đang hiển thị {filteredRooms.length} phòng theo bộ lọc tìm kiếm
                </p>
              </div>
            </div>

            {/* Grid of rooms list */}
            {filteredRooms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredRooms.map((room) => (
                  <RoomCardV7
                    key={room.id}
                    room={room}
                    onOpenRoomModal={onOpenRoomModal}
                  />
                ))}
              </div>
            ) : (
              <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-muted select-none">
                <Info size={36} className="mb-2 opacity-40" />
                <span className="text-[13px] font-bold">Không tìm thấy phòng nào khớp bộ lọc.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visual Footnote indicator */}
      <div className="border-t border-border/20 dark:border-white/5 pt-4 mt-6 flex justify-between items-center text-[10px] text-muted font-bold uppercase tracking-wider">
        <span>TÒA NHÀ: {building.name}</span>
        {profile === "lk01-31-custom" && <span>KHUNG ĐẤT: 5.0m × 20.0m</span>}
      </div>
    </div>
  );
}
