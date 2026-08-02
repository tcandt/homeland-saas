"use client";

import React from "react";
import type { Building } from "../building.types";
import { SelectedNode } from "../MasterDetailBuildings";
import { User, Phone, Mail, Calendar, CreditCard, AlignLeft, Info } from "lucide-react";

interface Props {
  building: Building;
  floorId: string;
  roomId: string;
  onOpenRoomModal: (roomId: string) => void;
}

export default function RoomView({ building, floorId, roomId, onOpenRoomModal }: Props) {
  const floor = building.floors.find(f => f.id === floorId);
  const room = floor?.rooms.find(r => r.id === roomId);
  if (!room) return null;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 max-w-[800px]">
      
      {/* Quick Info Bar */}
      <div className="flex items-center gap-3 p-4 bg-black/5 dark:bg-white/5 rounded-[12px] border border-border/50">
        <Info size={16} className="text-muted" />
        <span className="text-[13px] font-medium text-text">Để chỉnh sửa tất cả các thông tin, hình ảnh, hợp đồng, vui lòng bấm vào nút <strong className="font-bold">Quản lý chi tiết</strong> ở trên góc phải.</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Basic Info */}
        <div className="flex flex-col gap-4 border border-border/50 rounded-[16px] p-6 bg-card">
          <h3 className="font-black text-[14px] uppercase tracking-widest text-muted border-b border-border/50 pb-3 mb-1">Thông tin cơ bản</h3>
          
          <div className="flex justify-between items-center">
            <span className="text-[13px] font-medium text-muted">Loại phòng</span>
            <span className="text-[14px] font-bold text-text">{(room as any).type || 'STUDIO'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] font-medium text-muted">Diện tích</span>
            <span className="text-[14px] font-bold text-text">{room.area || 0} m²</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[13px] font-medium text-muted">Sức chứa</span>
            <span className="text-[14px] font-bold text-text">Tối đa {room.capacity || 2} người</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-border/50 mt-1">
            <span className="text-[13px] font-medium text-muted">Tiền phòng</span>
            <span className="text-[16px] font-black text-text">
              {room.contract?.rentPrice ? `${room.contract.rentPrice.toLocaleString('vi-VN')} đ` : '-'}
            </span>
          </div>
        </div>

        {/* Tenant Info */}
        <div className="flex flex-col gap-4 border border-border/50 rounded-[16px] p-6 bg-card">
          <h3 className="font-black text-[14px] uppercase tracking-widest text-muted border-b border-border/50 pb-3 mb-1">Khách thuê hiện tại</h3>
          
          {room.tenant ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-[40px] h-[40px] rounded-full bg-[#6366f1]/10 text-[#6366f1] flex items-center justify-center">
                  <User size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-[16px] text-text">{room.tenant.name}</span>
                  <span className="text-[12px] font-bold text-[#8b5cf6]">Đang lưu trú</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-2 text-[13px] text-text font-medium">
                  <Phone size={14} className="text-muted" /> {room.tenant.phone}
                </div>
                <div className="flex items-center gap-2 text-[13px] text-text font-medium">
                  <Mail size={14} className="text-muted" /> {room.tenant.email}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 opacity-50 text-center">
              <User size={32} className="text-muted mb-2" />
              <span className="text-[14px] font-medium text-muted">Chưa có khách thuê</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
