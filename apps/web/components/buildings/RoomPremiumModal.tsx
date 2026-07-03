"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Building, Room, Tenant, SharedTenant, Invoice, PaymentHistoryItem, Contract, RoomAttachment } from "./mockData";
import { X, Save, Trash2, LayoutDashboard, Image as ImageIcon, Users, FileText, CreditCard, AlignLeft, Upload, Plus, ShieldAlert, Check, AlertCircle, Calendar, DollarSign, Eye, UserPlus, Paperclip, Edit2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

interface Props {
  roomId: string;
  buildings: Building[];
  onClose: () => void;
  onUpdateRoom?: (roomId: string, updatedRoom: Partial<Room>) => void;
  initialTab?: string;
}

type TabKey = "rental_flow" | "finances" | "contract" | "temp_residence" | "images" | "notes" | "overview";

export default function RoomPremiumModal({ roomId, buildings, onClose, onUpdateRoom, initialTab = "rental_flow" }: Props) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab as TabKey);
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const { showToast } = useToast();

  let currentRoom: Room | null = null;
  for (const b of buildings) {
    for (const f of b.floors) {
      const r = f.rooms.find(r => r.id === roomId);
      if (r) {
        currentRoom = r;
        break;
      }
    }
    if (currentRoom) break;
  }

  const [roomData, setRoomData] = useState<Room | null>(currentRoom);

  useEffect(() => {
    setMounted(true);
    setRoomData(currentRoom);
  }, [roomId, currentRoom]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", handleEsc); };
  }, [onClose]);

  if (!mounted || !roomData) return null;

  const handleSave = () => { if (onUpdateRoom && roomData) { onUpdateRoom(roomData.id, roomData); } onClose(); };
  const handleFieldChange = (field: keyof Room, value: any) => { setRoomData(prev => prev ? { ...prev, [field]: value } : null); };
  const handleTenantChange = (field: keyof Tenant, value: any) => {
    setRoomData(prev => {
      if (!prev) return null;
      const tenant = prev.tenant ? { ...prev.tenant, [field]: value } : { id: `t-${prev.id}`, name: "", phone: "", email: "", cccd: "", idImages: [], tempResidence: false, [field]: value };
      return { ...prev, tenant };
    });
  };

  const formatCompactMoney = (amount: number) => {
    if (amount === 0) return "0";
    if (amount >= 1000000) {
      return (amount / 1000000).toLocaleString("en-US", { maximumFractionDigits: 2 }) + "M";
    }
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  let tenantName = "Trống";
  let daysLeft = "-";
  let rDebt = roomData.debt || 0;
  if (roomData.rentalType === "whole" && roomData.tenant) {
    tenantName = roomData.tenant.name;
    if (roomData.contract) {
      const diff = Math.ceil((new Date(roomData.contract.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
      daysLeft = diff > 0 ? `${diff}d` : "0d";
    }
  } else if (roomData.rentalType === "shared") {
    const count = roomData.sharedTenants?.length || 0;
    tenantName = count > 0 ? `${count} khách ghép` : "Trống";
    if (count > 0) {
      rDebt = roomData.sharedTenants?.reduce((acc, st) => acc + (st.debt || 0), 0) || 0;
      const minDays = Math.min(...(roomData.sharedTenants?.map(st => st.remainingDays) || [0]));
      daysLeft = `${minDays}d`;
    }
  }

  const tabs = [
    { id: "rental_flow", label: "Khách thuê", icon: <Users size={14} className="shrink-0" /> },
    { id: "finances", label: "Tài chính", icon: <DollarSign size={14} className="shrink-0" /> },
    { id: "contract", label: "Hợp đồng", icon: <FileText size={14} className="shrink-0" /> },
    { id: "temp_residence", label: "Tạm trú", icon: <ShieldAlert size={14} className="shrink-0" /> },
    { id: "images", label: "Ảnh", icon: <ImageIcon size={14} className="shrink-0" /> },
    { id: "notes", label: "Ghi chú", icon: <AlignLeft size={14} className="shrink-0" /> },
    { id: "overview", label: "Metadata", icon: <LayoutDashboard size={14} className="shrink-0" /> },
  ];

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8 overflow-hidden box-border max-w-full w-full">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-300" onClick={onClose} />

      {/* Modal Box */}
      <div className="relative z-10 w-full max-w-[500px] md:max-w-[1250px] h-[85dvh] md:h-[85vh] max-h-[850px] bg-background md:bg-card/95 md:backdrop-blur-3xl border border-border/60 shadow-xl rounded-[20px] md:rounded-[24px] flex flex-col overflow-hidden animate-in zoom-in-[0.98] duration-300 box-border">
        
        {/* Sticky Header Mobile */}
        <div className="flex flex-col p-4 md:px-8 md:py-5 border-b border-border/50 bg-black/[0.01] dark:bg-white/[0.01] shrink-0 w-full box-border max-w-full">
          <div className="flex items-start justify-between w-full min-w-0">
            <div className="flex flex-col flex-1 min-w-0 pr-2 overflow-hidden">
              <h2 className="font-black text-[16px] md:text-[22px] tracking-tight text-text leading-tight truncate">
                P.{roomData.number}
              </h2>
              <div className="flex flex-col mt-0.5 min-w-0 overflow-hidden text-[12px] font-bold">
                <span className="text-text truncate w-full">{tenantName}</span>
                <div className="flex items-center gap-2 mt-0.5 truncate w-full text-[11px]">
                  {rDebt > 0 ? <span className="text-rose-500">Nợ: {formatCompactMoney(rDebt)}</span> : <span className="text-emerald-500">Không nợ</span>}
                  <span className="text-muted">•</span>
                  <span className="text-muted">{daysLeft !== "-" ? `Còn: ${daysLeft}` : "Trống"}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button 
                onClick={handleSave}
              >
                <Save size={16} /> <span className="hidden md:inline ml-2">Lưu thay đổi</span>
              </Button>
              <Button 
                variant="ghost"
                size="icon"
                onClick={onClose}
              >
                <X size={18} />
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden flex-col md:flex-row w-full box-border max-w-full">
          
          {/* Segmented Tabs Navigation */}
          <div className="w-full max-w-full border-b border-border/50 bg-black/[0.01] dark:bg-white/[0.01] shrink-0 box-border md:w-[250px] md:border-b-0 md:border-r md:flex-col md:overflow-y-auto">
            <div className="tabs-scroll overflow-x-auto max-w-full flex gap-[8px] px-[12px] py-[12px] scrollbar-hide md:flex-col md:px-4 md:py-4">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabKey)}
                  className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 rounded-[8px] md:rounded-[12px] font-bold text-[12px] md:text-[13px] transition-all whitespace-nowrap shrink-0 snap-start text-left border flex-[0_0_auto] ${activeTab === tab.id ? 'bg-[#6366f1] text-white border-[#6366f1] md:bg-[#6366f1]/10 md:text-[#6366f1] shadow-sm' : 'text-muted border-border/50 bg-card md:bg-transparent md:border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content panel */}
          <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 relative w-full box-border pb-[80px] max-w-full">
            
            {/* Overview / Metadata Tab */}
            {activeTab === "overview" && (
              <div className="flex flex-col gap-4 md:gap-6 max-w-[700px] animate-in w-full box-border">
                <h3 className="font-black text-[14px] md:text-[15px] uppercase tracking-widest text-muted border-b border-border/40 pb-2">Thông tin cơ bản phòng</h3>
                
                <div className="flex flex-col gap-4 w-full">
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">Trạng thái</label>
                    <Select 
                      value={roomData.status} 
                      onChange={(e) => handleFieldChange("status", e.target.value)}
                      options={[
                        { label: "Trống", value: "vacant" },
                        { label: "Đang thuê", value: "occupied" },
                        { label: "Đặt cọc", value: "deposited" },
                        { label: "Sắp hết hạn", value: "expiring_soon" },
                        { label: "Bảo trì", value: "maintenance" }
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">Loại phòng</label>
                    <Select 
                      value={roomData.type}
                      onChange={(e) => handleFieldChange("type", e.target.value)}
                      options={[
                        { label: "Studio", value: "Studio" },
                        { label: "1 Phòng ngủ (1PN)", value: "1PN" },
                        { label: "2 Phòng ngủ (2PN)", value: "2PN" },
                        { label: "Văn phòng (Office)", value: "Office" },
                        { label: "Ở ghép / Dorm", value: "Dorm" }
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">Diện tích (m²)</label>
                    <Input 
                      type="number" 
                      value={roomData.area} 
                      onChange={(e) => handleFieldChange("area", Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">Sức chứa (người)</label>
                    <Input 
                      type="number" 
                      value={roomData.capacity} 
                      onChange={(e) => handleFieldChange("capacity", Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Rental Flow / Tenant Tab */}
            {activeTab === "rental_flow" && (
              <div className="flex flex-col gap-4 md:gap-6 animate-in w-full box-border">
                {/* Mode Selector */}
                <div className="flex flex-col gap-2 p-3 md:p-5 rounded-[12px] md:rounded-[16px] bg-black/[0.01] dark:bg-white/[0.01] border border-border/50 w-full box-border">
                  <span className="text-[11px] md:text-[12px] font-black text-muted uppercase tracking-wider">Hình thức vận hành</span>
                  <div className="flex flex-row gap-2 mt-1 md:mt-2 w-full">
                    <label className="flex-1 flex items-center justify-center gap-2 p-2 border rounded-[8px] md:rounded-[10px] cursor-pointer transition-all w-full box-border text-center" style={{ backgroundColor: roomData.rentalType === "whole" ? 'var(--card)' : 'transparent', borderColor: roomData.rentalType === "whole" ? '#6366f1' : 'var(--border)' }}>
                      <input 
                        type="radio" 
                        name="rentalType" 
                        checked={roomData.rentalType === "whole"} 
                        onChange={() => handleFieldChange("rentalType", "whole")}
                        className="accent-[#6366f1] w-[14px] h-[14px] shrink-0 hidden" 
                      />
                      <span className={`font-bold text-[12px] md:text-[13px] truncate ${roomData.rentalType === "whole" ? 'text-[#6366f1]' : 'text-muted'}`}>Nguyên phòng</span>
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-2 p-2 border rounded-[8px] md:rounded-[10px] cursor-pointer transition-all w-full box-border text-center" style={{ backgroundColor: roomData.rentalType === "shared" ? 'var(--card)' : 'transparent', borderColor: roomData.rentalType === "shared" ? '#6366f1' : 'var(--border)' }}>
                      <input 
                        type="radio" 
                        name="rentalType" 
                        checked={roomData.rentalType === "shared"} 
                        onChange={() => handleFieldChange("rentalType", "shared")}
                        className="accent-[#6366f1] w-[14px] h-[14px] shrink-0 hidden" 
                      />
                      <span className={`font-bold text-[12px] md:text-[13px] truncate ${roomData.rentalType === "shared" ? 'text-[#6366f1]' : 'text-muted'}`}>Ở ghép (Dorm)</span>
                    </label>
                  </div>
                </div>

                {/* WHOLE ROOM */}
                {roomData.rentalType === "whole" && (
                  <div className="flex flex-col gap-4 md:gap-6 w-full max-w-[750px] box-border">
                    <div className="border border-border/40 rounded-[12px] md:rounded-[16px] p-4 md:p-5 bg-card flex flex-col gap-3 md:gap-4 w-full box-border">
                      <div className="flex items-center justify-between border-b border-border/40 pb-2">
                        <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2">
                          <Users size={14} /> Đại diện hợp đồng
                        </h4>
                        <div className="flex gap-1">
                          <button onClick={() => setIsTenantModalOpen(true)} className="w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-muted hover:text-text hover:bg-black/5 bg-transparent border border-transparent hover:border-border transition-colors"><Edit2 size={14} /></button>
                          <button className="w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-rose-500 hover:bg-rose-50 hover:border-rose-200 border border-transparent transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {roomData.tenant ? (
                        <div className="flex flex-col gap-3 md:gap-5 w-full">
                          <div className="flex flex-col gap-1 w-full">
                            <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">Họ và tên</label>
                            <Input 
                              type="text" 
                              value={roomData.tenant.name}
                              onChange={(e) => handleTenantChange("name", e.target.value)}
                            />
                          </div>
                          <div className="flex flex-col gap-1 w-full">
                            <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">Số điện thoại</label>
                            <Input 
                              type="text" 
                              value={roomData.tenant.phone}
                              onChange={(e) => handleTenantChange("phone", e.target.value)}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 md:p-6 text-center border-2 border-dashed border-border rounded-[10px] md:rounded-[12px] flex flex-col items-center">
                          <span className="text-[12px] md:text-[13px] text-muted font-bold">Chưa có thông tin</span>
                        </div>
                      )}
                    </div>
                    
                    <Button variant="outline" onClick={() => setIsTenantModalOpen(true)} className="w-full mt-4 border-dashed border-[#6366f1]/40 bg-[#6366f1]/5 text-[#6366f1] hover:bg-[#6366f1]/10">
                      <UserPlus size={16} className="mr-2" /> Thêm người ở cùng
                    </Button>
                  </div>
                )}

                {/* SHARED ROOM */}
                {roomData.rentalType === "shared" && (
                  <div className="flex flex-col gap-4 w-full box-border">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <h4 className="font-black text-[13px] md:text-[15px] uppercase tracking-widest text-muted">
                        Khách ghép ({roomData.sharedTenants?.length ?? 0})
                      </h4>
                    </div>

                    {roomData.sharedTenants && roomData.sharedTenants.length > 0 ? (
                      <div className="flex flex-col gap-3 w-full">
                        {roomData.sharedTenants.map(st => (
                          <div key={st.id} className="flex flex-col p-3 border border-border/60 bg-card rounded-[10px] shadow-sm w-full box-border gap-2">
                            <div className="flex items-center justify-between border-b border-border/40 pb-2">
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-[12px] shrink-0">
                                  {st.bedPosition.charAt(0) || "G"}
                                </span>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-black text-[13px] text-text truncate">{st.name}</span>
                                  <span className="text-[10px] text-muted truncate">{st.bedPosition}</span>
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => setIsTenantModalOpen(true)} className="w-[24px] h-[24px] flex items-center justify-center rounded-[6px] text-muted hover:text-text hover:bg-black/5 bg-transparent border border-transparent transition-colors"><Edit2 size={12} /></button>
                                <button className="w-[24px] h-[24px] flex items-center justify-center rounded-[6px] text-rose-500 hover:bg-rose-50 border border-transparent transition-colors"><Trash2 size={12} /></button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-1">
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-[9px] font-bold text-muted uppercase truncate">Tiền thuê</span>
                                <span className="font-black text-[11px] text-text truncate">{formatCompactMoney(st.rentPrice)}</span>
                              </div>
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-[9px] font-bold text-muted uppercase truncate">Tiền cọc</span>
                                <span className="font-black text-[11px] text-text truncate">{formatCompactMoney(st.deposit)}</span>
                              </div>
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-[9px] font-bold text-muted uppercase truncate">Công nợ</span>
                                <span className={`font-black text-[11px] truncate ${st.debt > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{st.debt > 0 ? formatCompactMoney(st.debt) : '0 ₫'}</span>
                              </div>
                              <div className="flex flex-col overflow-hidden">
                                <span className="text-[9px] font-bold text-muted uppercase truncate">Còn lại</span>
                                <span className="font-black text-[11px] text-text truncate">{st.remainingDays} ngày</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[12px] text-muted italic">Chưa có khách ghép nào.</span>
                    )}

                    <Button variant="outline" onClick={() => setIsTenantModalOpen(true)} className="w-full mt-4 border-dashed border-[#6366f1]/40 bg-[#6366f1]/5 text-[#6366f1] hover:bg-[#6366f1]/10">
                      <UserPlus size={16} className="mr-2" /> Thêm khách ghép mới
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Empty States for other tabs */}
            {["finances", "contract", "temp_residence", "images", "notes"].includes(activeTab) && (
              <div className="flex flex-col gap-4 animate-in">
                <span className="text-[12px] font-bold text-muted italic">Màn hình {tabs.find(t => t.id === activeTab)?.label} đang cập nhật...</span>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>

      {/* Sub-modal overlay for adding/editing tenant */}
      <Modal 
        isOpen={isTenantModalOpen} 
        onClose={() => setIsTenantModalOpen(false)}
        title="Thông tin khách hàng"
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button variant="outline" onClick={() => setIsTenantModalOpen(false)}>Hủy</Button>
            <Button onClick={() => { setIsTenantModalOpen(false); showToast("Lưu thông tin khách hàng thành công!", "success"); }}>Lưu thông tin</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-muted uppercase">Họ và tên</label>
            <Input type="text" placeholder="Nguyễn Văn A" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-muted uppercase">Số điện thoại</label>
            <Input type="tel" placeholder="0901234567" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-muted uppercase">CCCD / CMND</label>
            <Input type="text" placeholder="0123456789" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-muted uppercase">Địa chỉ thường trú</label>
            <Input type="text" placeholder="Nhập địa chỉ..." />
          </div>
        </div>
      </Modal>

    </>
    , document.body
  );
}
