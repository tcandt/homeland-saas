"use client";

import React, { useState } from "react";
import { Building, Room } from "../mockData";
import { SelectedNode } from "../MasterDetailBuildings";
import { ChevronRight, ChevronDown, Layers, Users, Home, Plus, Settings, DollarSign, AlertCircle, ShieldAlert, FileText, ClipboardList, MapPin, Edit, Trash2 } from "lucide-react";
import RoomCardV7 from "./RoomCardV7"; // We will create this component next
import { Button } from "../../ui/Button";
import { usePermissions } from '@/lib/hooks/usePermissions';

interface Props {
  building: Building;
  onSelectNode: (node: SelectedNode) => void;
  onEditBuilding: () => void;
  onAddFloor: () => void;
  onAddRoomQuick: () => void;
  onOpenRoomModal: (roomId: string, initialTab?: string) => void;
  onEditFloor: (floorId: string) => void;
  onDeleteFloor: (floorId: string) => void;
}

export default function BuildingView({ building, onSelectNode, onEditBuilding, onAddFloor, onAddRoomQuick, onOpenRoomModal, onEditFloor, onDeleteFloor }: Props) {
  const permissions = usePermissions();
  // Compute metrics dynamically from rooms
  let totalRooms = 0;
  let occupiedRooms = 0;
  let vacantRooms = 0;
  let depositedRooms = 0;
  let maintenanceRooms = 0;
  let expiringRooms = 0;
  
  let totalRevenue = 0;
  let totalDebt = 0;
  let overdueInvoicesCount = 0;
  let totalDeposit = 0;

  let missingTempResidenceCount = 0;
  let registeredTempResidenceCount = 0;

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
          totalRevenue += room.contract.rentPrice;
          totalDeposit += room.contract.deposit;
        }
        if (room.invoices) {
          room.invoices.forEach(inv => {
            if (inv.status === "unpaid") {
              totalDebt += inv.amount;
              overdueInvoicesCount++;
            } else if (inv.status === "partial") {
              totalDebt += inv.amount / 2;
              overdueInvoicesCount++;
            }
          });
        }
        if (room.tenant && (room.status === "occupied" || room.status === "expiring_soon")) {
          if (!room.tenant.tempResidence) missingTempResidenceCount++;
          else registeredTempResidenceCount++;
          
          if (room.roommates) {
            room.roommates.forEach(rm => {
              if (!rm.tempResidence) missingTempResidenceCount++;
              else registeredTempResidenceCount++;
            });
          }
        }
      } else if (room.rentalType === "shared") {
        if (room.sharedTenants) {
          room.sharedTenants.forEach(st => {
            totalRevenue += st.rentPrice;
            totalDeposit += st.deposit;
            if (!st.tempResidence) missingTempResidenceCount++;
            else registeredTempResidenceCount++;
            
            if (st.invoices) {
              st.invoices.forEach(inv => {
                if (inv.status === "unpaid") {
                  totalDebt += inv.amount;
                  overdueInvoicesCount++;
                } else if (inv.status === "partial") {
                  totalDebt += inv.amount / 2;
                  overdueInvoicesCount++;
                }
              });
            }
          });
        }
      }
    });
  });

  const [expandedFloors, setExpandedFloors] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    building.floors.forEach(f => init[f.id] = false); // Collapse all by default
    return init;
  });

  const toggleFloor = (floorId: string) => {
    setExpandedFloors(prev => ({ ...prev, [floorId]: !prev[floorId] }));
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8 pb-10">
      
      {/* Dynamic Building Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h1 className="font-black text-[24px] md:text-[28px] text-text tracking-tight">{building.name}</h1>
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
        
        {/* 1. Financial Summary */}
        <div className="bg-card border border-border rounded-[16px] p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[100px] h-[100px] bg-emerald-500/5 rounded-full blur-[30px] -z-10" />
          <h3 className="font-bold text-[11px] uppercase tracking-wider text-muted flex items-center gap-1.5"><DollarSign size={14} /> Tài chính</h3>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Doanh thu dự kiến</span>
              <span className="font-black text-[14px] text-emerald-500">{formatMoney(totalRevenue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Nợ chưa thu</span>
              <span className={`font-black text-[14px] ${totalDebt > 0 ? 'text-rose-500' : 'text-text'}`}>{formatMoney(totalDebt)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Cọc đang giữ</span>
              <span className="font-black text-[14px] text-text">{formatMoney(totalDeposit)}</span>
            </div>
          </div>
        </div>

        {/* 2. Occupancy Summary */}
        <div className="bg-card border border-border rounded-[16px] p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[100px] h-[100px] bg-blue-500/5 rounded-full blur-[30px] -z-10" />
          <h3 className="font-bold text-[11px] uppercase tracking-wider text-muted flex items-center gap-1.5"><Home size={14} /> Trạng thái phòng</h3>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Đang thuê / Sắp hết hạn</span>
              <span className="font-black text-[14px] text-text">{occupiedRooms + expiringRooms}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Trống / Đặt cọc</span>
              <span className="font-black text-[14px] text-text">{vacantRooms} / {depositedRooms}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Đang bảo trì</span>
              <span className="font-black text-[14px] text-text">{maintenanceRooms}</span>
            </div>
          </div>
        </div>

        {/* 3. Contract Summary */}
        <div className="bg-card border border-border rounded-[16px] p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[100px] h-[100px] bg-orange-500/5 rounded-full blur-[30px] -z-10" />
          <h3 className="font-bold text-[11px] uppercase tracking-wider text-muted flex items-center gap-1.5"><FileText size={14} /> Hợp đồng</h3>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Sắp hết hạn</span>
              <span className={`font-black text-[14px] ${expiringRooms > 0 ? 'text-orange-500' : 'text-text'}`}>{expiringRooms}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Sắp chuyển đi</span>
              <span className="font-black text-[14px] text-text">0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Chờ tái ký</span>
              <span className="font-black text-[14px] text-text">0</span>
            </div>
          </div>
        </div>

        {/* 4. Temp Residence Summary */}
        <div className="bg-card border border-border rounded-[16px] p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[100px] h-[100px] bg-rose-500/5 rounded-full blur-[30px] -z-10" />
          <h3 className="font-bold text-[11px] uppercase tracking-wider text-muted flex items-center gap-1.5"><ShieldAlert size={14} /> Khai báo tạm trú</h3>
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Đã khai báo</span>
              <span className="font-black text-[14px] text-emerald-500">{registeredTempResidenceCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Chưa khai báo</span>
              <span className={`font-black text-[14px] ${missingTempResidenceCount > 0 ? 'text-rose-500' : 'text-text'}`}>{missingTempResidenceCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-muted">Sắp hết hạn</span>
              <span className="font-black text-[14px] text-text">0</span>
            </div>
          </div>
        </div>

      </div>

      {/* Accordion Floors & Rooms View */}
      <div className="flex flex-col gap-4 mt-4">
        <h2 className="font-black text-[14px] uppercase tracking-widest text-muted border-b border-border/40 pb-2">Bản đồ phòng & Tầng</h2>
        
        <div className="flex flex-col gap-4">
          {building.floors.map(floor => {
            const isExpanded = expandedFloors[floor.id];
            
            // Floor stats
            let fRevenue = 0;
            let fDebt = 0;
            let fOccupied = 0;
            let fVacant = 0;
            let fExpiring = 0;

            floor.rooms.forEach(r => {
              if (r.status === "occupied") fOccupied++;
              if (r.status === "vacant") fVacant++;
              if (r.status === "expiring_soon") fExpiring++;
              
              if (r.rentalType === "whole") {
                if (r.contract) fRevenue += r.contract.rentPrice;
                if (r.debt) fDebt += r.debt;
              } else {
                r.sharedTenants?.forEach(st => {
                  fRevenue += st.rentPrice;
                  if (st.debt) fDebt += st.debt;
                });
              }
            });

            return (
              <div key={floor.id} className="group flex flex-col border border-border/60 bg-card rounded-[12px] overflow-hidden shadow-sm">
                
                {/* Floor Header (Accordion Trigger) */}
                <div 
                  data-testid={`floor-accordion-${floor.id}`}
                  className="flex flex-wrap items-center justify-between p-4 bg-black/[0.02] dark:bg-white/[0.02] cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors"
                  onClick={() => toggleFloor(floor.id)}
                >
                  <div className="flex items-center gap-3">
                    <button 
                      aria-label={isExpanded ? 'Thu gọn tầng' : 'Mở rộng tầng'}
                      aria-expanded={isExpanded}
                      title={isExpanded ? 'Thu gọn' : 'Mở rộng'}
                      className="w-6 h-6 flex items-center justify-center bg-background border border-border rounded-[6px] text-muted"
                    >
                      {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
                    </button>
                    <span className="font-black text-[15px] text-text">Tầng {floor.number}</span>
                    <span className="text-[12px] font-bold text-muted bg-background px-2 py-0.5 rounded-full border border-border">{floor.rooms.length} phòng</span>
                    
                    <div className="flex items-center gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button data-testid="edit-floor-button" onClick={(e) => { e.stopPropagation(); onEditFloor(floor.id); }} className="w-6 h-6 flex items-center justify-center hover:bg-[#6366f1]/10 text-[#6366f1] rounded-[6px] transition-colors" title="Sửa tầng"><Edit size={12}/></button>
                      <button data-testid="delete-floor-button" onClick={(e) => { e.stopPropagation(); onDeleteFloor(floor.id); }} className="w-6 h-6 flex items-center justify-center hover:bg-rose-500/10 text-rose-500 rounded-[6px] transition-colors" title="Xóa tầng"><Trash2 size={12}/></button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-[12px] font-bold">
                    <span className="text-emerald-500">{fOccupied} Thuê</span>
                    <span className="text-muted">{fVacant} Trống</span>
                    {fExpiring > 0 && <span className="text-orange-500">{fExpiring} Sắp hết hạn HĐ</span>}
                    {fDebt > 0 && <span className="text-rose-500">Nợ {formatMoney(fDebt)}</span>}
                    <span className="text-text">{formatMoney(fRevenue)}</span>
                  </div>
                </div>

                {/* Floor Rooms Grid */}
                {isExpanded && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 bg-background/50 border-t border-border/40">
                    {floor.rooms.map(room => (
                      <div key={room.id} data-testid={`room-card-${room.id}`}>
                        <RoomCardV7 room={room} onOpenRoomModal={onOpenRoomModal} />
                      </div>
                    ))}
                    <div 
                      onClick={() => onAddRoomQuick()}
                      className="border-2 border-dashed border-border hover:border-[#6366f1] rounded-[16px] min-h-[140px] flex flex-col items-center justify-center text-muted hover:text-[#6366f1] hover:bg-[#6366f1]/5 cursor-pointer transition-all"
                    >
                      <Plus size={24} className="mb-2" />
                      <span className="font-bold text-[12px]">Thêm phòng mới</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
