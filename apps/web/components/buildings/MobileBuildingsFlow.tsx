"use client";

import React, { useState } from "react";
import type { Building, Floor, Room } from "./building.types";
import { ArrowDown, ArrowUp, Map, AlertTriangle, Layers, ChevronDown, ChevronRight, X, Edit2, Trash2, MoreVertical, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useDeleteBuildingMutation, useMoveBuildingMutation } from "@/lib/mutations/buildings.mutations";

const ActionMenu = ({
  onEdit,
  onDelete,
  itemName,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
}: {
  onEdit: () => void;
  onDelete: () => void;
  itemName: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const canMove = Boolean(onMoveUp || onMoveDown);
  return (
    <div className="relative">
      <button 
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} 
        className="p-1 -mr-1 rounded-full text-muted hover:text-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-center shrink-0"
      >
        <MoreVertical size={16} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-[90]" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} />
          <div className="absolute right-0 top-full mt-1 z-[100] w-[142px] bg-card border border-border shadow-lg rounded-[8px] py-1 animate-in fade-in zoom-in-95 duration-100">
            {canMove && (
              <>
                <button
                  disabled={!onMoveUp || disableMoveUp}
                  onClick={(e) => { e.stopPropagation(); setIsOpen(false); onMoveUp?.(); }}
                  className="w-full text-left px-3 py-2 text-[13px] font-medium text-text hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ArrowUp size={14} className="text-muted" /> Đưa lên
                </button>
                <button
                  disabled={!onMoveDown || disableMoveDown}
                  onClick={(e) => { e.stopPropagation(); setIsOpen(false); onMoveDown?.(); }}
                  className="w-full text-left px-3 py-2 text-[13px] font-medium text-text hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ArrowDown size={14} className="text-muted" /> Đưa xuống
                </button>
                <div className="h-[1px] w-full bg-border/50 my-0.5" />
              </>
            )}
            <button 
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); onEdit(); }} 
              className="w-full text-left px-3 py-2 text-[13px] font-medium text-text hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2 transition-colors"
            >
              <Edit2 size={14} className="text-muted" /> Sửa
            </button>
            <div className="h-[1px] w-full bg-border/50 my-0.5" />
            <button 
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); onDelete(); }} 
              className="w-full text-left px-3 py-2 text-[13px] font-medium text-rose-500 hover:bg-rose-500/10 flex items-center gap-2 transition-colors"
            >
              <Trash2 size={14} className="text-rose-500" /> Xóa
            </button>
          </div>
        </>
      )}
    </div>
  );
};

interface Props {
  buildings: Building[];
  onOpenRoomModal: (roomId: string, initialTab?: string) => void;
}

export default function MobileBuildingsFlow({ buildings, onOpenRoomModal }: Props) {
  const permissions = usePermissions();
  const deleteBuilding = useDeleteBuildingMutation();
  const moveBuilding = useMoveBuildingMutation();
  const [expandedBuildingId, setExpandedBuildingId] = useState<string | null>(null);
  const [expandedFloorIds, setExpandedFloorIds] = useState<Record<string, boolean>>({});
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isAddRoomModalOpen, setIsAddRoomModalOpen] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [isAddFloorModalOpen, setIsAddFloorModalOpen] = useState(false);
  const [deleteConfirmBuilding, setDeleteConfirmBuilding] = useState<Building | null>(null);
  const [deleteBuildingError, setDeleteBuildingError] = useState<string | null>(null);
  const { showToast } = useToast();

  const handleSaveBuilding = () => {
    setIsAddModalOpen(false);
    setEditingBuilding(null);
    showToast("Lưu thông tin tòa nhà thành công!", "success");
  };

  const handleSaveRoom = () => {
    setIsAddRoomModalOpen(false);
    setEditingRoom(null);
    showToast("Lưu thông tin phòng thành công!", "success");
  };

  const handleSaveFloor = () => {
    setIsAddFloorModalOpen(false);
    setEditingFloor(null);
    showToast("Lưu thông tin tầng thành công!", "success");
  };

  const toggleBuilding = (id: string) => {
    setExpandedBuildingId(prev => prev === id ? null : id);
  };

  const toggleFloor = (id: string) => {
    setExpandedFloorIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDeleteBuilding = (building: Building) => {
    setDeleteBuildingError(null);
    setDeleteConfirmBuilding(building);
  };

  const confirmDeleteBuilding = () => {
    if (!deleteConfirmBuilding) return;

    deleteBuilding.mutate({ id: deleteConfirmBuilding.id, suppressToast: true }, {
      onSuccess: () => {
        if (expandedBuildingId === deleteConfirmBuilding.id) setExpandedBuildingId(null);
        setDeleteConfirmBuilding(null);
        setDeleteBuildingError(null);
      },
      onError: (error: any) => {
        setDeleteBuildingError(error?.message || "Không thể xóa tòa nhà. Vui lòng kiểm tra lại dữ liệu hợp đồng.");
      },
    });
  };

  const formatCompactMoney = (amount: number) => {
    if (amount >= 1000000) {
      return (amount / 1000000).toLocaleString("en-US", { maximumFractionDigits: 2 }) + "M";
    }
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  return (
    <div 
      className="flex flex-col w-full max-w-full box-border pb-[20px]"
    >
      <div className="flex flex-col gap-[16px] w-full box-border max-w-full m-0 p-0">
        {buildings.length === 0 && (
          <div data-testid="empty-buildings-state" className="p-4 text-center text-sm text-muted italic bg-card rounded-[14px] border border-border">
            Chưa có tòa nhà nào
          </div>
        )}
        {buildings.map((b, buildingIndex) => {
          let totalRooms = 0;
          let occupiedRooms = 0;
          let revenue = 0;
          let debt = 0;
          let alertsCount = 0;

          b.floors.forEach(f => {
            f.rooms.forEach(r => {
              totalRooms++;
              if (r.status === "occupied" || r.status === "expiring_soon") occupiedRooms++;
              if (r.rentalType === "whole") {
                if (r.contract) revenue += r.contract.rentPrice;
                if (r.debt) debt += r.debt;
                if (r.tenant && !r.tenant.tempResidence) alertsCount++;
              } else {
                r.sharedTenants?.forEach(st => {
                  revenue += st.rentPrice;
                  if (st.debt) debt += st.debt;
                  if (!st.tempResidence) alertsCount++;
                });
              }
            });
          });

          const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
          const occupancyTone = totalRooms === 0
            ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
            : occupancyRate >= 100
              ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20"
              : occupancyRate >= 80
                ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20"
                : "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20";
          const isExpanded = expandedBuildingId === b.id;

          return (
            <div key={b.id} className="flex flex-col gap-2 w-full box-border max-w-full min-w-0">
              {/* Building Card */}
              <div 
                onClick={() => toggleBuilding(b.id)}
                className={`bg-card border rounded-[14px] md:rounded-[20px] p-4 md:p-5 flex flex-col transition-colors cursor-pointer w-full box-border max-w-full min-w-0 ${isExpanded ? 'border-[#6366f1] shadow-md' : 'border-border shadow-sm hover:border-border'}`}
              >
                <div className="flex justify-between items-start mb-3 md:mb-4 gap-2">
                  <div className="flex-1 min-w-0 pr-2 overflow-hidden">
                    <h3 className="min-w-0 font-[800] text-[14px] md:text-[16px] text-text truncate leading-[20px] md:leading-[22px]">
                      {b.name}
                    </h3>
                    <p className="text-[11px] md:text-[12px] leading-[16px] md:leading-[18px] text-muted flex items-center gap-1 mt-1 truncate max-w-full font-medium">
                      <Map size={12} className="shrink-0 md:w-[14px] md:h-[14px]" /> 
                      <span className="truncate">{b.address}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] md:text-[11px] leading-[14px] font-[800] tabular-nums ${occupancyTone}`}>
                      {occupiedRooms}/{totalRooms} phòng
                    </span>
                    <ActionMenu 
                      onEdit={() => setEditingBuilding(b)} 
                      onDelete={() => handleDeleteBuilding(b)} 
                      onMoveUp={permissions.canUpdateBuilding ? () => moveBuilding.mutate({ id: b.id, direction: 'up' }) : undefined}
                      onMoveDown={permissions.canUpdateBuilding ? () => moveBuilding.mutate({ id: b.id, direction: 'down' }) : undefined}
                      disableMoveUp={buildingIndex === 0 || moveBuilding.isPending}
                      disableMoveDown={buildingIndex === buildings.length - 1 || moveBuilding.isPending}
                      itemName="tòa nhà" 
                    />
                    {isExpanded ? <ChevronDown size={20} className="text-[#6366f1]" /> : <ChevronRight size={20} className="text-muted" />}
                  </div>
                </div>

                <div
                  className="mb-3 h-[5px] w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
                  aria-label={`${occupiedRooms}/${totalRooms} phòng đang sử dụng`}
                >
                  <div
                    className={`h-full rounded-full transition-all ${occupancyRate >= 100 ? "bg-rose-500" : occupancyRate >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${occupancyRate}%` }}
                  />
                </div>

                {/* Grid for Building KPIs */}
                <div className="grid grid-cols-2 min-[430px]:grid-cols-4 gap-y-[12px] gap-x-[16px] pt-3 border-t border-border/50 w-full box-border">
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="text-[10px] leading-[14px] tracking-[0.04em] text-muted font-[700] uppercase truncate">Doanh thu</span>
                    <span className="text-[13px] md:text-[14px] leading-[18px] md:leading-[20px] font-[800] text-indigo-500 truncate">{formatCompactMoney(revenue)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="text-[10px] leading-[14px] tracking-[0.04em] text-muted font-[700] uppercase truncate">Công nợ</span>
                    <span className="text-[13px] md:text-[14px] leading-[18px] md:leading-[20px] font-[800] text-rose-500 truncate">{debt > 0 ? formatCompactMoney(debt) : '0'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="text-[10px] leading-[14px] tracking-[0.04em] text-muted font-[700] uppercase truncate">Lấp đầy</span>
                    <span className="text-[13px] md:text-[14px] leading-[18px] md:leading-[20px] font-[800] text-text truncate">{occupancyRate}%</span>
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    <span className="text-[10px] leading-[14px] tracking-[0.04em] text-muted font-[700] uppercase truncate">Cảnh báo</span>
                    <span className={`text-[13px] md:text-[14px] leading-[18px] md:leading-[20px] font-[800] truncate ${alertsCount > 0 ? "text-orange-500" : "text-text"}`}>{alertsCount > 0 ? `${alertsCount} Lỗi` : 'Không'}</span>
                  </div>
                </div>
              </div>

              {/* Floors Accordion */}
              {isExpanded && (
                <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200 w-full box-border max-w-full min-w-0 mt-[12px]">
                  {b.floors.map(f => {
                    const isFloorExpanded = expandedFloorIds[f.id];
                    return (
                      <div key={f.id} className="flex flex-col gap-2 w-full box-border max-w-full min-w-0">
                        <div 
                          onClick={() => toggleFloor(f.id)}
                          className="flex items-center justify-between px-3 py-2 h-[64px] bg-black/[0.02] dark:bg-white/[0.02] rounded-[8px] border border-border/50 cursor-pointer w-full box-border"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-[36px] h-[36px] flex items-center justify-center bg-card rounded-[8px] shrink-0 border border-border/50">
                              <Layers size={16} className="text-muted" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-black text-[13px] md:text-[14px] text-text leading-tight truncate">Tầng {f.number}</span>
                              <span className="text-[10px] md:text-[11px] text-muted font-medium truncate">{f.rooms.length} phòng</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <ActionMenu 
                              onEdit={() => setEditingFloor(f)} 
                              onDelete={() => showToast("Đã xóa tầng thành công", "success")} 
                              itemName="tầng" 
                            />
                            {isFloorExpanded ? <ChevronDown size={18} className="text-muted" /> : <ChevronRight size={18} className="text-muted" />}
                          </div>
                        </div>

                        {/* Rooms List */}
                        {isFloorExpanded && (
                          <div className="flex flex-col gap-2 mt-0.5">
                            <div className="grid grid-cols-2 min-[400px]:grid-cols-3 gap-2 animate-in fade-in duration-200 w-full box-border max-w-full min-w-0">
                              {f.rooms.map(r => {
                                let statusText = "Trống";
                                let statusColor = "text-slate-500";
                                let bgStatus = "bg-slate-500/5 dark:bg-slate-500/10 border-border/80";

                                switch (r.status) {
                                  case "occupied":
                                    statusText = "Đang thuê";
                                    statusColor = "text-indigo-600 dark:text-indigo-400";
                                    bgStatus = "bg-indigo-500/10 border-indigo-500/20";
                                    break;
                                  case "deposited":
                                    statusText = "Đã cọc";
                                    statusColor = "text-blue-600 dark:text-blue-400";
                                    bgStatus = "bg-blue-500/10 border-blue-500/20";
                                    break;
                                  case "maintenance":
                                    statusText = "Bảo trì";
                                    statusColor = "text-rose-600 dark:text-rose-400";
                                    bgStatus = "bg-rose-500/10 border-rose-500/20";
                                    break;
                                  case "expiring_soon":
                                    statusText = "Sắp hết hạn";
                                    statusColor = "text-amber-600 dark:text-amber-400";
                                    bgStatus = "bg-amber-500/10 border-amber-500/20";
                                    break;
                                  case "vacant":
                                  default:
                                    statusText = "Trống";
                                    statusColor = "text-slate-500 dark:text-slate-400";
                                    bgStatus = "bg-card border-border/80";
                                    break;
                                }

                                return (
                                  <div 
                                    key={r.id}
                                    onClick={() => onOpenRoomModal(r.id)}
                                    className={`flex flex-col justify-between border rounded-[10px] p-2.5 h-[80px] active:scale-[0.98] transition-transform cursor-pointer shadow-sm relative group ${bgStatus}`}
                                  >
                                    <div className="flex items-start justify-between gap-1 w-full">
                                      <span className="font-black text-[13px] md:text-[14px] text-text truncate max-w-full">
                                        P.{r.number}
                                      </span>
                                      <div className="-mt-1 -mr-1">
                                        <ActionMenu 
                                          onEdit={() => setEditingRoom(r)} 
                                          onDelete={() => showToast("Đã xóa phòng thành công", "success")} 
                                          itemName="phòng" 
                                        />
                                      </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-0 mt-auto">
                                      <span className={`text-[11px] font-bold truncate ${statusColor}`}>{statusText}</span>
                                      <span className="text-[9px] text-muted font-medium truncate mt-0.5">
                                        {r.type === "Office" ? "Văn Phòng" : r.rentalType === "whole" ? "Nguyên phòng" : "Ở ghép (Dorm)"}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {deleteConfirmBuilding && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
            onClick={() => !deleteBuilding.isPending && setDeleteConfirmBuilding(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            data-testid="delete-building-confirm-modal"
            className="relative w-full max-w-[380px] overflow-hidden rounded-[18px] border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-start gap-3 border-b border-border/60 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-rose-500/10 text-rose-500">
                <Trash2 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[16px] font-black text-text">Xác nhận xóa tòa nhà</h3>
                <p className="mt-1 text-[12px] font-medium leading-5 text-muted">
                  Bạn đang xóa <span className="font-black text-text">{deleteConfirmBuilding.name}</span>. Dữ liệu sẽ được xóa mềm khỏi danh sách vận hành.
                </p>
              </div>
              <button
                type="button"
                disabled={deleteBuilding.isPending}
                onClick={() => setDeleteConfirmBuilding(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-muted hover:bg-black/5 hover:text-text disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4">
              <div className="rounded-[12px] border border-amber-500/20 bg-amber-500/10 p-3 text-[12px] font-semibold leading-5 text-amber-700 dark:text-amber-300">
                Nếu tòa nhà còn phòng đang có hợp đồng hoạt động, hệ thống sẽ không cho xóa để tránh mất dữ liệu hợp đồng.
              </div>
              {deleteBuildingError && (
                <div className="mt-3 rounded-[12px] border border-rose-500/20 bg-rose-500/10 p-3 text-[12px] font-bold leading-5 text-rose-600 dark:text-rose-300">
                  {deleteBuildingError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border/60 bg-black/[0.02] p-4 dark:bg-white/[0.02]">
              <button
                type="button"
                disabled={deleteBuilding.isPending}
                onClick={() => setDeleteConfirmBuilding(null)}
                className="h-10 rounded-[10px] border border-border px-4 text-[13px] font-bold text-muted hover:bg-black/5 hover:text-text disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={deleteBuilding.isPending}
                onClick={confirmDeleteBuilding}
                className="flex h-10 items-center justify-center rounded-[10px] bg-rose-500 px-4 text-[13px] font-bold text-white shadow-sm hover:bg-rose-600 disabled:opacity-60"
              >
                {deleteBuilding.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Trash2 size={16} className="mr-2" />}
                Xóa tòa nhà
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Building Modal */}
      {(isAddModalOpen || editingBuilding) && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" onClick={() => { setIsAddModalOpen(false); setEditingBuilding(null); }} />
          <div className="relative bg-card w-full max-w-[400px] rounded-[16px] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-[0.98] duration-200 border border-border/80">
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-black/[0.02] dark:bg-white/[0.02]">
              <h3 className="font-black text-[15px] text-text uppercase tracking-wide">
                {editingBuilding ? 'Sửa thông tin tòa nhà' : 'Thêm tòa nhà mới'}
              </h3>
              <button onClick={() => { setIsAddModalOpen(false); setEditingBuilding(null); }} className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] bg-card border border-border/50 text-muted hover:text-text hover:bg-black/5 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col p-4 gap-4 overflow-y-auto max-h-[60vh]">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">Tên tòa nhà</label>
                <input type="text" defaultValue={editingBuilding?.name || ''} placeholder="Ví dụ: LK01.31 - Riverside House" className="w-full bg-card border border-border rounded-[10px] px-3 py-2.5 text-[13px] font-bold outline-none focus:border-[#6366f1] transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">Địa chỉ</label>
                <input type="text" defaultValue={editingBuilding?.address || ''} placeholder="Ví dụ: 01 Đường Đào Trí, Quận 7" className="w-full bg-card border border-border rounded-[10px] px-3 py-2.5 text-[13px] font-bold outline-none focus:border-[#6366f1] transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">Số tầng</label>
                <input type="number" defaultValue={editingBuilding?.floors.length || 5} className="w-full bg-card border border-border rounded-[10px] px-3 py-2.5 text-[13px] font-bold outline-none focus:border-[#6366f1] transition-colors" />
              </div>
            </div>
            <div className="flex p-4 border-t border-border/50 bg-black/[0.02] dark:bg-white/[0.02] gap-3 justify-end mt-auto">
              <button onClick={() => { setIsAddModalOpen(false); setEditingBuilding(null); }} className="px-5 py-2.5 rounded-[10px] font-bold text-[13px] text-muted hover:bg-black/5 bg-transparent border border-border transition-colors">Hủy</button>
              <button onClick={() => handleSaveBuilding()} className="px-5 py-2.5 rounded-[10px] font-bold text-[13px] text-white bg-[#6366f1] hover:bg-[#4f46e5] shadow-sm transition-colors">Lưu thông tin</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Room Modal */}
      {(isAddRoomModalOpen || editingRoom) && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" onClick={() => { setIsAddRoomModalOpen(false); setEditingRoom(null); }} />
          <div className="relative bg-card w-full max-w-[400px] rounded-[16px] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-[0.98] duration-200 border border-border/80">
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-black/[0.02] dark:bg-white/[0.02]">
              <h3 className="font-black text-[15px] text-text uppercase tracking-wide">
                {editingRoom ? 'Sửa thông tin phòng' : 'Thêm phòng mới'}
              </h3>
              <button onClick={() => { setIsAddRoomModalOpen(false); setEditingRoom(null); }} className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] bg-card border border-border/50 text-muted hover:text-text hover:bg-black/5 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col p-4 gap-4 overflow-y-auto max-h-[60vh]">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">Số phòng / Tên phòng</label>
                <input type="text" defaultValue={editingRoom?.number || ''} placeholder="Ví dụ: 101" className="w-full bg-card border border-border rounded-[10px] px-3 py-2.5 text-[13px] font-bold outline-none focus:border-[#6366f1] transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-muted uppercase">Loại phòng</label>
                  <select defaultValue={editingRoom?.type || 'Studio'} className="w-full bg-card border border-border rounded-[10px] px-3 py-2.5 text-[13px] font-bold outline-none focus:border-[#6366f1] transition-colors appearance-none cursor-pointer">
                    <option value="1PN">1 Phòng ngủ</option>
                    <option value="2PN">2 Phòng ngủ</option>
                    <option value="Studio">Studio</option>
                    <option value="Dorm">Ở ghép (Dorm)</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-muted uppercase">Diện tích (m2)</label>
                  <input type="number" defaultValue={editingRoom?.area || 20} className="w-full bg-card border border-border rounded-[10px] px-3 py-2.5 text-[13px] font-bold outline-none focus:border-[#6366f1] transition-colors" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">Giá thuê (VNĐ)</label>
                <input 
                  type="text" 
                  defaultValue={editingRoom?.price ? new Intl.NumberFormat("vi-VN").format(editingRoom.price) : new Intl.NumberFormat("vi-VN").format(5000000)} 
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    e.target.value = val ? new Intl.NumberFormat("vi-VN").format(Number(val)) : "";
                  }}
                  className="w-full bg-card border border-border rounded-[10px] px-3 py-2.5 text-[13px] font-bold outline-none focus:border-[#6366f1] transition-colors" 
                />
              </div>
            </div>
            <div className="flex p-4 border-t border-border/50 bg-black/[0.02] dark:bg-white/[0.02] gap-3 justify-end mt-auto">
              <button onClick={() => { setIsAddRoomModalOpen(false); setEditingRoom(null); }} className="px-5 py-2.5 rounded-[10px] font-bold text-[13px] text-muted hover:bg-black/5 bg-transparent border border-border transition-colors">Hủy</button>
              <button onClick={() => handleSaveRoom()} className="px-5 py-2.5 rounded-[10px] font-bold text-[13px] text-white bg-[#6366f1] hover:bg-[#4f46e5] shadow-sm transition-colors">Lưu thông tin</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Floor Modal */}
      {(isAddFloorModalOpen || editingFloor) && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px]" onClick={() => { setIsAddFloorModalOpen(false); setEditingFloor(null); }} />
          <div className="relative bg-card w-full max-w-[400px] rounded-[16px] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-[0.98] duration-200 border border-border/80">
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-black/[0.02] dark:bg-white/[0.02]">
              <h3 className="font-black text-[15px] text-text uppercase tracking-wide">
                {editingFloor ? 'Sửa thông tin tầng' : 'Thêm tầng mới'}
              </h3>
              <button onClick={() => { setIsAddFloorModalOpen(false); setEditingFloor(null); }} className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] bg-card border border-border/50 text-muted hover:text-text hover:bg-black/5 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col p-4 gap-4 overflow-y-auto max-h-[60vh]">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">Tên / Số tầng</label>
                <input type="number" defaultValue={editingFloor?.number || ''} placeholder="Ví dụ: 1" className="w-full bg-card border border-border rounded-[10px] px-3 py-2.5 text-[13px] font-bold outline-none focus:border-[#6366f1] transition-colors" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">Ghi chú</label>
                <textarea defaultValue={editingFloor?.notes || ''} placeholder="Ghi chú thêm về tầng này..." className="w-full bg-card border border-border rounded-[10px] px-3 py-2.5 text-[13px] font-bold outline-none focus:border-[#6366f1] transition-colors min-h-[80px] resize-none" />
              </div>
            </div>
            <div className="flex p-4 border-t border-border/50 bg-black/[0.02] dark:bg-white/[0.02] gap-3 justify-end mt-auto">
              <button onClick={() => { setIsAddFloorModalOpen(false); setEditingFloor(null); }} className="px-5 py-2.5 rounded-[10px] font-bold text-[13px] text-muted hover:bg-black/5 bg-transparent border border-border transition-colors">Hủy</button>
              <button onClick={() => handleSaveFloor()} className="px-5 py-2.5 rounded-[10px] font-bold text-[13px] text-white bg-[#6366f1] hover:bg-[#4f46e5] shadow-sm transition-colors">Lưu thông tin</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
