"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Grid, Map as MapIcon, AlertTriangle, AlertCircle, CheckCircle2, ChevronRight, X, Building2, LayoutGrid, Users, FileText, Settings, CreditCard, Clock, Activity, Search } from "lucide-react";

// Types
type ViewMode = "grid" | "map";
type HealthStatus = "healthy" | "warning" | "critical";

interface BuildingData {
  id: string;
  name: string;
  image: string;
  healthStatus: HealthStatus;
  occupancyRate: number;
  totalRooms: number;
  rentedRooms: number;
  emptyRooms: number;
  revenue: string;
  warningCount: number;
  warningText: string;
  warningAmount: string;
  address: string;
}

import { useBuildingsQuery } from "@/lib/queries/buildings.queries";
import { Loader2 } from "lucide-react";

// Drawer state types
type DrawerState = {
  isOpen: boolean;
  buildingId: string | null;
  floorId: string | null;
  roomId: string | null;
};

export default function BuildingGrid() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [drawer, setDrawer] = useState<DrawerState>({ isOpen: false, buildingId: null, floorId: null, roomId: null });

  const openBuilding = (id: string) => {
    setDrawer({ isOpen: true, buildingId: id, floorId: null, roomId: null });
  };

  const { data: realBuildings, isLoading, isError } = useBuildingsQuery();

  const buildings: BuildingData[] = realBuildings?.map((b: any) => ({
    id: b.id,
    name: b.name,
    image: b.images?.[0] || "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=150&h=150&fit=crop",
    healthStatus: "healthy",
    occupancyRate: b.kpis?.occupancyRate || 0,
    totalRooms: b.kpis?.totalRooms || 0,
    rentedRooms: b.kpis?.rentedRooms || 0,
    emptyRooms: (b.kpis?.totalRooms || 0) - (b.kpis?.rentedRooms || 0),
    revenue: `${(b.kpis?.monthlyRevenue || 0).toLocaleString()} đ`,
    warningCount: 0,
    warningText: "Hoạt động ổn định",
    warningAmount: "",
    address: b.address
  })) || [];

  const selectedBuilding = drawer.buildingId ? buildings.find(b => b.id === drawer.buildingId) : null;

  return (
    <>
      <div className="flex flex-col gap-4 mt-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-black text-[16px] text-text">Command Center</h2>
          
          {/* View Toggle */}
          <div className="hidden md:flex bg-card border border-border rounded-[10px] p-1 shadow-sm">
            <button 
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[12px] font-bold transition-colors ${viewMode === 'grid' ? 'bg-[#4f46e5]/10 text-[#4f46e5]' : 'text-muted hover:text-text'}`}
            >
              <Grid size={14} /> Grid
            </button>
            <button 
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] text-[12px] font-bold transition-colors ${viewMode === 'map' ? 'bg-[#4f46e5]/10 text-[#4f46e5]' : 'text-muted hover:text-text'}`}
            >
              <MapIcon size={14} /> Map
            </button>
          </div>
        </div>

        {/* Grid Layout: Desktop 4 cols, Tablet 2 cols, Mobile 1 col */}
        {isLoading ? (
          <div className="flex justify-center p-12">
             <Loader2 className="w-8 h-8 animate-spin text-[#4f46e5]" />
          </div>
        ) : isError ? (
          <div className="text-center p-8 text-rose-500 font-bold">Không thể tải danh sách tòa nhà</div>
        ) : buildings.length === 0 ? (
          <div className="text-center p-8 text-muted font-bold">Chưa có tòa nhà nào</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[16px] md:gap-[24px]">
            {buildings.map(b => (
              <BuildingCommandCard key={b.id} building={b} onClick={() => openBuilding(b.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Drill-down Drawer */}
      <BuildingDrawer drawer={drawer} setDrawer={setDrawer} building={selectedBuilding} />
    </>
  );
}

// -------------------------------------------------------------
// BUILDING CARD COMPONENT
// -------------------------------------------------------------
function BuildingCommandCard({ building, onClick }: { building: BuildingData, onClick: () => void }) {
  const getHealthConfig = (status: HealthStatus) => {
    switch(status) {
      case "healthy": return { text: "Stable", color: "text-[#8b5cf6]", bg: "bg-[#8b5cf6]/10", border: "border-[#8b5cf6]/30", ring: "text-[#8b5cf6]" };
      case "warning": return { text: "Warning", color: "text-[#f59e0b]", bg: "bg-[#f59e0b]/10", border: "border-[#f59e0b]/30", ring: "text-[#f59e0b]" };
      case "critical": return { text: "Critical", color: "text-[#f43f5e]", bg: "bg-[#f43f5e]/10", border: "border-[#f43f5e]/30", ring: "text-[#f43f5e]" };
    }
  };
  
  const health = getHealthConfig(building.healthStatus);

  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (building.occupancyRate / 100) * circumference;

  return (
    <div 
      onClick={onClick}
      className="group bg-card/60 backdrop-blur-xl border border-border/50 rounded-[24px] shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_rgb(255,255,255,0.04)] hover:-translate-y-1.5 transition-all duration-500 flex flex-col cursor-pointer overflow-hidden relative"
    >
      {/* Decorative top gradient */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${building.healthStatus === 'healthy' ? 'bg-gradient-to-r from-[#8b5cf6]/80 to-[#34d399]/40' : (building.healthStatus === 'warning' ? 'bg-gradient-to-r from-[#f59e0b]/80 to-[#fbbf24]/40' : 'bg-gradient-to-r from-[#f43f5e]/80 to-[#fb7185]/40')}`} />
      
      <div className="p-5 flex flex-col gap-4 flex-1">
        
        {/* Header: Avatar + Title + Status + Ring */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative">
              <img src={building.image} className="w-[60px] h-[60px] rounded-[16px] object-cover border border-border/50 shrink-0 shadow-sm" alt="" />
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card ${health.bg} ${health.ring} flex items-center justify-center`}>
                <div className={`w-2 h-2 rounded-full bg-current ${building.healthStatus !== 'healthy' ? 'animate-pulse' : ''}`} />
              </div>
            </div>
            <div className="flex flex-col min-w-0 py-0.5 justify-center">
              <h3 className="font-black text-[18px] text-text truncate group-hover:text-[#6366f1] transition-colors">{building.name}</h3>
              <span className="text-[12px] font-medium text-muted mt-0.5 truncate flex items-center gap-1">
                 {building.address.split(',')[0]}
              </span>
            </div>
          </div>
          
          {/* Occupancy Ring */}
          <div className="relative w-[52px] h-[52px] shrink-0">
            <svg className="w-full h-full transform -rotate-90 drop-shadow-md" viewBox="0 0 52 52">
              <circle cx="26" cy="26" r={radius} fill="transparent" stroke="currentColor" strokeWidth="5" className="text-border/40" />
              <circle 
                cx="26" cy="26" r={radius} fill="transparent" stroke="currentColor" strokeWidth="5" 
                className={health.ring}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[13px] font-black text-text">{building.occupancyRate}%</span>
            </div>
          </div>
        </div>

        {/* AI Warning Box */}
        {building.warningCount > 0 ? (
          <div className={`rounded-[12px] p-3 flex items-center justify-between border ${health.border} ${health.bg} backdrop-blur-sm relative overflow-hidden group/warning`}>
             <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/warning:animate-[shimmer_1.5s_infinite]`} />
            <div className="flex items-center gap-2 relative z-10">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${health.bg} ${health.border} border`}>
                 <AlertTriangle size={12} className={health.ring} />
              </div>
              <span className={`text-[12px] font-bold ${health.ring}`}>{building.warningText}</span>
            </div>
            {building.warningAmount && <span className={`text-[13px] font-black ${health.ring} relative z-10`}>{building.warningAmount}</span>}
          </div>
        ) : (
          <div className="rounded-[12px] p-3 flex items-center gap-2 border border-[#8b5cf6]/20 bg-[#8b5cf6]/5 backdrop-blur-sm">
            <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#8b5cf6]/10 border border-[#8b5cf6]/20">
               <CheckCircle2 size={12} className="text-[#8b5cf6]" />
            </div>
            <span className="text-[12px] font-bold text-[#8b5cf6]">Hoạt động ổn định</span>
          </div>
        )}

        {/* Data Stats Grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 mt-2">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-muted mb-1 uppercase tracking-wider">Tổng phòng</span>
            <div className="flex items-baseline gap-1">
              <span className="text-[18px] font-black text-text leading-none">{building.totalRooms}</span>
              <span className="text-[12px] text-muted font-medium">phòng</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold text-muted mb-1 uppercase tracking-wider">Tình trạng</span>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[18px] font-black text-[#8b5cf6]">{building.rentedRooms}</span>
              <span className="text-[12px] font-bold text-muted">/</span>
              <span className="text-[18px] font-black text-muted">{building.emptyRooms}</span>
            </div>
          </div>
          <div className="flex flex-col col-span-2 p-3 bg-black/5 dark:bg-white/5 rounded-[12px] border border-border/30">
            <span className="text-[11px] font-semibold text-muted mb-1.5 uppercase tracking-wider">Doanh thu dự kiến</span>
            <span className="text-[18px] font-black text-text leading-none">{building.revenue}</span>
          </div>
        </div>

      </div>
      
      {/* Quick Actions Footer */}
      <div className="bg-black/[0.03] dark:bg-white/[0.02] p-3 px-4 flex items-center justify-between border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <button className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] bg-white dark:bg-black border border-border/50 hover:bg-black/5 dark:hover:bg-white/5 hover:border-[#6366f1]/40 text-muted hover:text-[#6366f1] transition-all shadow-sm" title="Sơ đồ phòng">
            <LayoutGrid size={14} />
          </button>
          <button className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] bg-white dark:bg-black border border-border/50 hover:bg-black/5 dark:hover:bg-white/5 hover:border-[#6366f1]/40 text-muted hover:text-[#6366f1] transition-all shadow-sm" title="Khách thuê">
            <Users size={14} />
          </button>
          <button className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] bg-white dark:bg-black border border-border/50 hover:bg-black/5 dark:hover:bg-white/5 hover:border-[#6366f1]/40 text-muted hover:text-[#6366f1] transition-all shadow-sm" title="Hóa đơn">
            <CreditCard size={14} />
          </button>
        </div>
        <button className="text-[12px] font-bold text-[#6366f1] bg-[#6366f1]/10 hover:bg-[#6366f1]/20 px-3 py-1.5 rounded-[8px] transition-colors flex items-center gap-1">
          Chi tiết <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// COMMAND CENTER MODAL FLOW COMPONENTS
// -------------------------------------------------------------
function BuildingDrawer({ drawer, setDrawer, building }: { drawer: DrawerState, setDrawer: any, building: BuildingData | null | undefined }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (drawer.isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawer.isOpen]);

  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer({ ...drawer, isOpen: false });
    };
    if (drawer.isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [drawer]);

  if (!drawer.isOpen || !building || !mounted) return null;

  const closeDrawer = () => setDrawer({ ...drawer, isOpen: false });
  const goBack = () => {
    if (drawer.roomId) setDrawer({ ...drawer, roomId: null });
    else if (drawer.floorId) setDrawer({ ...drawer, floorId: null });
    else closeDrawer();
  };

  // Compute what level we are at
  const isRoomView = !!drawer.roomId;
  const isFloorView = !!drawer.floorId && !isRoomView;
  const isBuildingView = !drawer.floorId && !drawer.roomId;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/45 dark:bg-black/65 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={closeDrawer}
      ></div>
      
      {/* Modal Container */}
      <div className="relative z-10 bg-background md:bg-card/95 md:backdrop-blur-3xl border border-border/60 w-full h-[100dvh] md:w-[calc(100vw-64px)] md:max-w-[1280px] md:max-h-[calc(100vh-64px)] md:rounded-[24px] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-[0.98] duration-300">
        
        {/* Header */}
        <div className="p-4 md:px-6 md:py-4 border-b border-border bg-card flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={goBack} className="w-[32px] h-[32px] rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 transition-colors">
                <ChevronRight size={18} className="rotate-180" />
              </button>
              <h2 className="font-black text-[18px] md:text-[20px] text-text">Command Center</h2>
            </div>
            <button onClick={closeDrawer} className="w-[32px] h-[32px] rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center hover:bg-black/10 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-[13px] font-bold px-1 md:px-11">
            <span 
              className={`cursor-pointer transition-colors ${isBuildingView ? 'text-text' : 'text-muted hover:text-text'}`}
              onClick={() => setDrawer({ ...drawer, floorId: null, roomId: null })}
            >
              {building.name}
            </span>
            {drawer.floorId && (
              <>
                <ChevronRight size={14} className="text-muted" />
                <span 
                  className={`cursor-pointer transition-colors ${isFloorView ? 'text-text' : 'text-muted hover:text-text'}`}
                  onClick={() => setDrawer({ ...drawer, roomId: null })}
                >
                  Tầng {drawer.floorId}
                </span>
              </>
            )}
            {drawer.roomId && (
              <>
                <ChevronRight size={14} className="text-muted" />
                <span className="text-text">P.{drawer.roomId}</span>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Content Body (2 columns on desktop) */}
        <div className="flex-1 overflow-y-auto bg-background md:bg-transparent flex flex-col md:flex-row">
          {/* LEFT SECTION (Summary) */}
          <div className="w-full md:w-[380px] shrink-0 border-b md:border-b-0 md:border-r border-border/50 bg-black/[0.02] dark:bg-white/[0.02] p-6 md:p-8 flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#6366f1]/5 rounded-full blur-[60px] pointer-events-none" />
            <div className="flex items-center gap-4">
              <img src={building.image} className="w-[64px] h-[64px] rounded-[14px] object-cover border border-border" alt="" />
              <div className="flex flex-col">
                <h3 className="font-black text-[22px] text-text leading-tight">{building.name}</h3>
                <span className="text-[12px] font-medium text-muted flex items-center gap-1 mt-0.5"><MapIcon size={12}/> {building.address}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/5 dark:bg-white/5 p-3 rounded-[12px]">
                <div className="text-[11px] font-medium text-muted mb-1">Doanh thu tháng</div>
                <div className="font-black text-[15px] text-text">{building.revenue}</div>
              </div>
              <div className="bg-black/5 dark:bg-white/5 p-3 rounded-[12px]">
                <div className="text-[11px] font-medium text-muted mb-1">Công nợ / Quá hạn</div>
                <div className="font-black text-[15px] text-[#ef4444]">{building.warningAmount || '0 đ'}</div>
              </div>
              <div className="bg-black/5 dark:bg-white/5 p-3 rounded-[12px] col-span-2">
                <div className="text-[11px] font-medium text-muted mb-1 flex items-center justify-between">
                  <span>Tỷ lệ lấp đầy</span>
                  <span className="font-bold text-[#22c55e]">{building.occupancyRate}%</span>
                </div>
                <div className="w-full h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${building.occupancyRate}%` }}></div>
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px]">
                  <span className="font-bold text-text">{building.rentedRooms} đang thuê</span>
                  <span className="text-muted">{building.emptyRooms} trống</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SECTION (Lists) */}
          <div className="flex-1 p-6 md:p-8 overflow-y-auto relative">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#8b5cf6]/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
            {isBuildingView && <BuildingViewContent building={building} setDrawer={setDrawer} />}
            {isFloorView && <FloorViewContent floorId={drawer.floorId!} setDrawer={setDrawer} />}
            {isRoomView && <RoomViewContent roomId={drawer.roomId!} />}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---- LEVEL 1: BUILDING VIEW (Right Panel) ----
function BuildingViewContent({ building, setDrawer }: any) {
  const floors = [1, 2, 3, 4, 5];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between">
         <h3 className="font-black text-[18px] text-text uppercase tracking-wide flex items-center gap-2">
            <LayoutGrid size={20} className="text-[#6366f1]" /> Danh sách tầng ({floors.length})
         </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {floors.map(floor => (
          <div 
            key={floor} 
            onClick={() => setDrawer((prev: any) => ({ ...prev, floorId: String(floor) }))}
            className="group bg-card/60 backdrop-blur-md border border-border/60 rounded-[16px] p-5 flex flex-col gap-4 hover:border-[#6366f1]/50 hover:shadow-[0_8px_30px_rgb(99,102,241,0.12)] hover:-translate-y-1 cursor-pointer transition-all duration-300 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
               <ChevronRight size={20} className="text-[#6366f1]" />
            </div>
            <div className="flex items-center gap-4">
              <div className="w-[48px] h-[48px] rounded-[12px] bg-gradient-to-br from-[#6366f1]/10 to-[#6366f1]/5 border border-[#6366f1]/20 flex items-center justify-center font-black text-[18px] text-[#6366f1]">T{floor}</div>
              <div className="flex flex-col">
                <span className="font-black text-[18px] text-text group-hover:text-[#6366f1] transition-colors">Tầng {floor}</span>
                <span className="text-[13px] font-semibold text-muted mt-0.5">3/4 phòng đang thuê</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
               <div className="h-1.5 flex-1 bg-[#8b5cf6] rounded-full" />
               <div className="h-1.5 flex-1 bg-[#8b5cf6] rounded-full" />
               <div className="h-1.5 flex-1 bg-[#8b5cf6] rounded-full" />
               <div className="h-1.5 flex-1 bg-border rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- LEVEL 2: FLOOR VIEW (Right Panel) ----
function FloorViewContent({ floorId, setDrawer }: any) {
  const rooms = [
    { id: `${floorId}01`, status: "occupied", tenant: "Nguyễn Văn A", price: "5.500.000 đ" },
    { id: `${floorId}02`, status: "occupied", tenant: "Trần Thị B", price: "5.000.000 đ" },
    { id: `${floorId}03`, status: "vacant", tenant: null, price: "5.500.000 đ" },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between">
         <h3 className="font-black text-[18px] text-text uppercase tracking-wide flex items-center gap-2">
            Sơ đồ phòng - Tầng {floorId}
         </h3>
         <button className="bg-[#6366f1]/10 text-[#6366f1] hover:bg-[#6366f1]/20 font-bold text-[13px] px-4 py-2 rounded-[10px] transition-colors">
            + Thêm phòng
         </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rooms.map(room => (
          <div 
            key={room.id}
            onClick={() => setDrawer((prev: any) => ({ ...prev, roomId: room.id }))}
            className={`border rounded-[14px] p-4 cursor-pointer hover:-translate-y-1 transition-all shadow-sm ${room.status === 'occupied' ? 'bg-card border-border hover:border-[#4f46e5]' : 'bg-black/5 dark:bg-white/5 border-transparent border-dashed hover:border-muted'}`}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="font-black text-[18px] text-text">P.{room.id}</span>
              <div className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold ${room.status === 'occupied' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-muted/10 text-muted'}`}>
                {room.status === 'occupied' ? 'Đang thuê' : 'Trống'}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className={`text-[13px] font-bold truncate ${room.tenant ? 'text-text' : 'text-muted italic'}`}>
                {room.tenant || 'Chưa có khách thuê'}
              </span>
              <span className="text-[12px] font-bold text-muted">{room.price}/tháng</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- LEVEL 3: ROOM VIEW (Right Panel) ----
function RoomViewContent({ roomId }: any) {
  const isVacant = roomId.endsWith('3');

  if (isVacant) {
    return (
      <div className="animate-in fade-in duration-300">
        <div className="bg-card border border-dashed border-border rounded-[20px] p-10 text-center flex flex-col items-center justify-center">
          <div className="w-[80px] h-[80px] rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-5 text-muted">
            <LayoutGrid size={32} />
          </div>
          <h3 className="font-black text-[22px] text-text mb-2">Phòng P.{roomId} đang trống</h3>
          <p className="text-[14px] text-muted font-medium mb-8">Bạn có thể tạo hợp đồng mới ngay bây giờ.</p>
          <button className="bg-[#4f46e5] text-white px-6 py-3 rounded-[12px] font-bold text-[14px] hover:bg-[#4338ca] transition-colors shadow-sm">
            + Thêm khách thuê
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300">
      
      {/* Action Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <RoomActionButton icon={<FileText size={22} />} label="Hợp đồng" active={true} />
        <RoomActionButton icon={<CreditCard size={22} />} label="Hóa đơn" />
        <RoomActionButton icon={<AlertTriangle size={22} />} label="Sự cố" />
        <RoomActionButton icon={<Settings size={22} />} label="Cài đặt" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
        {/* Tenant Profile Mini */}
        <div className="bg-card border border-border rounded-[16px] p-5 shadow-sm">
          <div className="font-black text-[13px] uppercase tracking-wide text-muted mb-4">Khách đang thuê</div>
          <div className="flex items-center gap-4">
            <img src="https://i.pravatar.cc/150?img=11" className="w-[60px] h-[60px] rounded-full object-cover border-2 border-border" alt=""/>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-[18px] text-text leading-tight mb-1 truncate">Nguyễn Văn A</h3>
              <span className="text-[12px] font-bold text-[#22c55e] flex items-center gap-1"><CheckCircle2 size={12}/> Đã thanh toán T6</span>
            </div>
          </div>
        </div>

        {/* Contract Info */}
        <div className="bg-card border border-border rounded-[16px] p-5 shadow-sm flex flex-col justify-center">
          <div className="font-black text-[13px] uppercase tracking-wide text-muted mb-2">Tình trạng hợp đồng</div>
          <div className="font-black text-[24px] text-text mb-1">334 ngày</div>
          <div className="text-[12px] font-medium text-muted">Hết hạn vào 31/03/2026</div>
        </div>
      </div>

      {/* Details list */}
      <div className="bg-card border border-border rounded-[16px] overflow-hidden shadow-sm mt-2">
        <div className="p-4 border-b border-border bg-black/5 dark:bg-white/5 font-black text-[13px] uppercase tracking-wide">Chi tiết tài chính</div>
        <div className="flex flex-col divide-y divide-border/50">
          <DetailRow label="Giá thuê phòng" value="5.500.000 đ" valueBold />
          <DetailRow label="Phí dịch vụ" value="200.000 đ" />
          <DetailRow label="Tiền điện (Dự kiến)" value="~350.000 đ" />
          <DetailRow label="Nợ đọng" value="0 đ" valueColor="text-[#22c55e]" />
        </div>
      </div>
    </div>
  );
}

function RoomActionButton({ icon, label, active }: any) {
  return (
    <button className={`flex flex-col items-center justify-center gap-2 border rounded-[14px] p-4 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 ${active ? 'bg-[#4f46e5]/10 border-[#4f46e5]/30 text-[#4f46e5]' : 'bg-card border-border hover:bg-[#4f46e5]/5 hover:border-[#4f46e5]/30 hover:text-[#4f46e5] text-text'}`}>
      {icon}
      <span className="text-[11px] font-bold">{label}</span>
    </button>
  );
}

function DetailRow({ label, value, valueBold, valueColor }: { label: string, value: string, valueBold?: boolean, valueColor?: string }) {
  return (
    <div className="flex items-center justify-between p-4">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <span className={`text-[14px] ${valueBold ? 'font-black' : 'font-bold'} ${valueColor || 'text-text'}`}>{value}</span>
    </div>
  );
}

