"use client";

import React, { useMemo } from "react";
import type { Building, Floor, Room } from "../building.types";
import { Layers, AlertTriangle, ShieldAlert, X, Filter } from "lucide-react";
import { getRoomDisplayName, getFloorDisplayName } from "../building-labels";

interface BuildingOperationalSidebarProps {
  building: Building;
  activeView: "overview" | "floor-3d" | "floor-2d" | "rooms";
  activeFloor: Floor | null;
  activeRoom?: Room | null;
  onSelectFloor: (floorId: string) => void;
  onSelectRoom: (roomId: string) => void;
  onAddFloor: () => void;
  canCreateFloor: boolean;
  onCloseRoom?: () => void;
  
  // Rooms filters props (optional)
  selectedFloorFilter?: string;
  setSelectedFloorFilter?: (fId: string) => void;
  selectedStatusFilter?: string;
  setSelectedStatusFilter?: (status: string) => void;
}

export default function BuildingOperationalSidebar({
  building,
  activeView,
  activeFloor,
  activeRoom = null,
  onSelectFloor,
  onSelectRoom,
  onAddFloor,
  canCreateFloor,
  onCloseRoom,
  selectedFloorFilter = "all",
  setSelectedFloorFilter,
  selectedStatusFilter = "all",
  setSelectedStatusFilter
}: BuildingOperationalSidebarProps) {

  // Calculate active floor stats dynamically
  const floorStats = useMemo(() => {
    if (!activeFloor) return null;
    let occupied = 0;
    let vacant = 0;
    let deposited = 0;
    let maintenance = 0;
    activeFloor.rooms.forEach(r => {
      if (r.status === "occupied" || r.status === "expiring_soon") occupied++;
      else if (r.status === "vacant") vacant++;
      else if (r.status === "deposited") deposited++;
      else if (r.status === "maintenance") maintenance++;
    });
    return { occupied, vacant, deposited, maintenance, total: activeFloor.rooms.length };
  }, [activeFloor]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="w-full lg:w-[26%] shrink-0 flex flex-col gap-5 select-none bg-card border border-border/60 rounded-[20px] p-5 shadow-sm min-h-[580px]">
      
      {/* -------------------- ACTIVE ROOM SELECTED PANEL (Matching Image 2) -------------------- */}
      {activeRoom ? (
        <div className="flex flex-col gap-4 text-xs font-semibold text-text">
          <div className="flex justify-between items-center border-b border-border/40 pb-2 mb-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-primary uppercase">P.{getRoomDisplayName(activeRoom)}</h3>
              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                activeRoom.status === "occupied" || activeRoom.status === "expiring_soon"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-rose-500/10 text-rose-500"
              }`}>
                {activeRoom.status === "occupied" || activeRoom.status === "expiring_soon" ? "Đang thuê" : "Đang trống"}
              </span>
            </div>
            {onCloseRoom && (
              <button 
                onClick={onCloseRoom}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                title="Đóng chi tiết"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            
            {/* THÔNG TIN PHÒNG */}
            <div>
              <h4 className="text-[9px] font-black uppercase text-muted tracking-widest mb-2">Thông tin phòng</h4>
              <div className="flex flex-col gap-1.5 leading-relaxed">
                <div className="flex justify-between border-b border-border/10 pb-1.5">
                  <span className="text-muted">Loại phòng:</span>
                  <span>{activeRoom.type === "2PN" ? "Căn hộ Suite lớn" : "Căn hộ đơn (Single)"}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1.5">
                  <span className="text-muted">Ký hiệu phòng:</span>
                  <span>{getRoomDisplayName(activeRoom)}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1.5">
                  <span className="text-muted">Vị trí:</span>
                  <span>{getFloorDisplayName(activeFloor?.number || 1, building.code)}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1.5">
                  <span className="text-muted">Diện tích ước tính:</span>
                  <span>{activeRoom.type === "2PN" ? "~50.0 m²" : "~25.0 m²"}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1.5">
                  <span className="text-muted">Tình trạng:</span>
                  <span>{activeRoom.status === "occupied" || activeRoom.status === "expiring_soon" ? "Đang thuê" : "Đang trống"}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1.5">
                  <span className="text-muted">Cửa ra vào:</span>
                  <span>1 cửa (từ sảnh chung)</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1.5">
                  <span className="text-muted">Cửa sổ:</span>
                  <span>{activeRoom.type === "2PN" ? "2 cửa sổ (mặt trước & bên)" : "1 cửa sổ (mặt sau)"}</span>
                </div>
              </div>
            </div>

            {/* MÔ TẢ BỐ TRÍ */}
            <div>
              <h4 className="text-[9px] font-black uppercase text-muted tracking-widest mb-1.5">Mô tả bố trí</h4>
              <p className="text-[11px] text-text font-bold bg-slate-50 dark:bg-white/5 p-2 rounded-lg border border-border/40 leading-relaxed">
                {activeRoom.type === "2PN" 
                  ? "2 phòng ngủ mini kín + 1 phòng khách + 1 bếp + 1 WC"
                  : "1 khu ngủ + bàn LV + bếp + 1 WC/Tắm"}
              </p>
            </div>

            {/* TIỆN ÍCH PHÒNG */}
            <div>
              <h4 className="text-[9px] font-black uppercase text-muted tracking-widest mb-1.5">Tiện ích phòng</h4>
              <div className="flex flex-col gap-1 text-[11px] text-muted-foreground font-semibold leading-relaxed">
                {activeRoom.type === "2PN" ? (
                  <>
                    <span>• 2 giường đơn (trong 2 PN mini)</span>
                    <span>• 1 bàn làm việc / trang điểm</span>
                    <span>• Khu bếp (bếp, chậu rửa, tủ lạnh)</span>
                    <span>• 1 phòng khách (sofa, bàn trà)</span>
                    <span>• 1 phòng tắm & WC riêng</span>
                  </>
                ) : (
                  <>
                    <span>• 1 giường đơn</span>
                    <span>• 1 bàn làm việc (BÀN LV)</span>
                    <span>• Khu bếp (bếp, chậu rửa, tủ lạnh)</span>
                    <span>• 1 phòng tắm (TẮM)</span>
                    <span>• 1 chậu rửa lavabo</span>
                  </>
                )}
              </div>
            </div>

            {/* THÔNG TIN TÒA NHÀ */}
            <div>
              <h4 className="text-[9px] font-black uppercase text-muted tracking-widest mb-2">Thông tin tòa nhà</h4>
              <div className="flex flex-col gap-1.5 leading-relaxed text-[11px]">
                <div className="flex justify-between border-b border-border/10 pb-1.5">
                  <span className="text-muted">Mã tòa nhà:</span>
                  <span>{building.code}</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1.5">
                  <span className="text-muted">Loại hình:</span>
                  <span>Nhà phố (Shop-house)</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1.5">
                  <span className="text-muted">Số tầng:</span>
                  <span>4 tầng + Tầng trệt</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1.5">
                  <span className="text-muted">Diện tích xây dựng:</span>
                  <span>5m x 20m</span>
                </div>
                <div className="flex justify-between border-b border-border/10 pb-1.5">
                  <span className="text-muted">Tổng diện tích sàn:</span>
                  <span>~400.0 m²</span>
                </div>
              </div>
            </div>

            {/* Xem thông tin tòa nhà action */}
            <button 
              onClick={() => alert("Chuyển sang xem hồ sơ tòa nhà tại Gate C.")}
              className="w-full py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-center text-xs font-black transition-colors uppercase tracking-wider mt-2"
            >
              Xem thông tin tòa nhà
            </button>

          </div>
        </div>
      ) : (
        /* Standard View Modes Sidebar */
        <div className="flex flex-col gap-5">
          {/* -------------------- OVERVIEW VIEW MODE -------------------- */}
          {activeView === "overview" && (
            <div className="flex flex-col gap-5">
              {/* Building Details */}
              <div>
                <h4 className="text-[10px] font-black uppercase text-muted tracking-widest border-b border-border/40 pb-2 mb-3">Thông tin tòa nhà</h4>
                <div className="flex flex-col gap-2 text-xs font-semibold text-text">
                  <div className="flex justify-between">
                    <span className="text-muted">Tổng số tầng:</span>
                    <span>{building.floors.length} tầng</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Tổng số phòng:</span>
                    <span>{building.floors.reduce((acc, f) => acc + f.rooms.length, 0)} phòng</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Trạng thái:</span>
                    <span className="text-emerald-500 font-extrabold">Đang vận hành</span>
                  </div>
                </div>
              </div>

              {/* Alerts Section */}
              <div>
                <h4 className="text-[10px] font-black uppercase text-muted tracking-widest border-b border-border/40 pb-2 mb-3">Cảnh báo vận hành</h4>
                <div className="flex flex-col gap-2.5">
                  <div className="flex gap-2.5 p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl">
                    <AlertTriangle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col leading-snug">
                      <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">Trễ hạn đóng tiền</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">3 phòng đang bị trễ hạn đóng tiền quá hạn.</span>
                    </div>
                  </div>
                  <div className="flex gap-2.5 p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl">
                    <ShieldAlert size={15} className="text-orange-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col leading-snug">
                      <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400">Chưa khai báo tạm trú</span>
                      <span className="text-[10px] text-muted-foreground mt-0.5">Một số khách thuê chưa nộp CT07 tạm trú.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Floor Selector List */}
              <div>
                <h4 className="text-[10px] font-black uppercase text-muted tracking-widest border-b border-border/40 pb-2 mb-3">Danh sách tầng</h4>
                <div className="flex flex-col gap-1.5">
                  {building.floors.map((floor) => {
                    const floorName = getFloorDisplayName(floor.number, building.code);
                    return (
                      <button
                        key={floor.id}
                        type="button"
                        onClick={() => onSelectFloor(floor.id)}
                        className="w-full text-left p-3 rounded-xl border border-border/40 text-text hover:border-primary/40 hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between transition-all duration-300"
                      >
                        <div className="flex items-center gap-2">
                          <Layers size={13} className="text-muted" />
                          <span className="text-xs font-bold">{floorName}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-semibold bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded">
                          {floor.rooms.length} phòng
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* -------------------- FLOOR VIEW MODE (3D / 2D) -------------------- */}
          {(activeView === "floor-3d" || activeView === "floor-2d") && activeFloor && (
            <div className="flex flex-col gap-5">
              {/* Active Floor Summary */}
              <div>
                <h4 className="text-[10px] font-black uppercase text-muted tracking-widest border-b border-border/40 pb-2 mb-3">
                  Mặt bằng {getFloorDisplayName(activeFloor.number, building.code)}
                </h4>
                {floorStats && (
                  <div className="grid grid-cols-2 gap-2 text-center text-xs mb-3">
                    <div className="bg-[#0f172a]/5 dark:bg-white/[0.02] border border-border/30 rounded-lg p-2 flex flex-col justify-center">
                      <span className="text-[9px] font-black text-muted uppercase">Đang thuê</span>
                      <span className="text-sm font-extrabold text-emerald-500 mt-0.5">{floorStats.occupied} phòng</span>
                    </div>
                    <div className="bg-[#0f172a]/5 dark:bg-white/[0.02] border border-border/30 rounded-lg p-2 flex flex-col justify-center">
                      <span className="text-[9px] font-black text-muted uppercase">Còn trống</span>
                      <span className="text-sm font-extrabold text-text mt-0.5">{floorStats.vacant} phòng</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Rooms on this Floor */}
              <div>
                <h4 className="text-[10px] font-black uppercase text-muted tracking-widest border-b border-border/40 pb-2 mb-3">Phòng thuộc tầng</h4>
                <div className="flex flex-col gap-2">
                  {activeFloor.rooms.map(room => {
                    const isSuite = room.type === "2PN";
                    
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => onSelectRoom(room.id)}
                        className="flex min-h-14 w-full items-center justify-between rounded-xl border border-border/40 bg-[#0f172a]/5 p-3 text-left transition-colors hover:border-primary/35 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-white/[0.02] motion-reduce:transition-none"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-text">P.{getRoomDisplayName(room)}</span>
                          <span className="text-[9px] text-muted-foreground font-semibold mt-0.5">
                            {isSuite ? "Suite lớn • 50m²" : "Phòng đơn • 25m²"}
                          </span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide ${
                          room.status === "occupied" || room.status === "expiring_soon"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-slate-100 dark:bg-white/5 text-muted-foreground"
                        }`}>
                          {room.status === "occupied" || room.status === "expiring_soon" ? "Đang thuê" : "Trống"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Level Switcher (Floors Selector) */}
              <div>
                <h4 className="text-[10px] font-black uppercase text-muted tracking-widest border-b border-border/40 pb-2 mb-3">Chuyển tầng nhanh</h4>
                <div className="flex flex-col gap-1.5">
                  {building.floors.map((floor) => {
                    const isCurrent = floor.id === activeFloor.id;
                    const floorName = getFloorDisplayName(floor.number, building.code);
                    return (
                      <button
                        key={floor.id}
                        type="button"
                        onClick={() => onSelectFloor(floor.id)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all duration-300 ${
                          isCurrent
                            ? "bg-primary/5 border-primary/40 text-primary font-bold shadow-[inset_0_2px_4px_rgba(79,70,229,0.06)]"
                            : "bg-transparent border-border/40 text-text hover:border-primary/40 hover:bg-black/5 dark:hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Layers size={12} className={isCurrent ? "text-primary" : "text-muted"} />
                          <span>{floorName}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* -------------------- ROOMS GRID FILTER MODE -------------------- */}
          {activeView === "rooms" && (
            <div className="flex flex-col gap-5">
              {/* Rooms filter fields */}
              <div>
                <h4 className="text-[10px] font-black uppercase text-muted tracking-widest border-b border-border/40 pb-2 mb-3 flex items-center gap-1.5">
                  <Filter size={12} /> Bộ lọc phòng
                </h4>
                
                <div className="flex flex-col gap-4">
                  {/* Floor filter select */}
                  {setSelectedFloorFilter && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-muted uppercase">Lọc theo Tầng</label>
                      <select
                        value={selectedFloorFilter}
                        onChange={(e) => setSelectedFloorFilter(e.target.value)}
                        className="w-full text-xs font-bold bg-transparent border border-border/60 rounded-xl px-3 py-2.5 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="all">Tất cả tầng</option>
                        {building.floors.map(f => (
                          <option key={f.id} value={f.id}>
                            {getFloorDisplayName(f.number, building.code)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Status filter select */}
                  {setSelectedStatusFilter && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-muted uppercase">Lọc Trạng Thái</label>
                      <select
                        value={selectedStatusFilter}
                        onChange={(e) => setSelectedStatusFilter(e.target.value)}
                        className="w-full text-xs font-bold bg-transparent border border-border/60 rounded-xl px-3 py-2.5 text-text focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="all">Tất cả trạng thái</option>
                        <option value="vacant">Phòng trống</option>
                        <option value="occupied">Đang thuê</option>
                        <option value="deposited">Đã đặt cọc</option>
                        <option value="maintenance">Bảo trì</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats summary */}
              <div>
                <h4 className="text-[10px] font-black uppercase text-muted tracking-widest border-b border-border/40 pb-2 mb-3">Tổng hợp</h4>
                <div className="flex flex-col gap-2 text-xs font-semibold text-text">
                  <div className="flex justify-between">
                    <span className="text-muted">Đang lọc hiển thị:</span>
                    <span>
                      {building.floors.reduce((acc, f) => {
                        const matchF = selectedFloorFilter === "all" || f.id === selectedFloorFilter;
                        if (!matchF) return acc;
                        const matchedR = f.rooms.filter(r => {
                          const matchStatus = selectedStatusFilter === "all" || r.status === selectedStatusFilter || (selectedStatusFilter === "occupied" && r.status === "expiring_soon");
                          return matchStatus;
                        });
                        return acc + matchedR.length;
                      }, 0)} phòng
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
