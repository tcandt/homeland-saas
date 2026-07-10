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
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";

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

  const { data: invoicesResponse } = useInvoicesQuery({ roomId });
  const realInvoices = (invoicesResponse as any)?.data?.items || [];

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
  if (roomData.tenant) {
    tenantName = roomData.tenant.name;
    if (roomData.contract) {
      const diff = Math.ceil((new Date(roomData.contract.endDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
      daysLeft = diff > 0 ? `${diff}d` : "0d";
    }
  } else {
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
                {roomData.name}
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
                    <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">Tên phòng</label>
                    <Input 
                      value={roomData.name}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">Mã phòng</label>
                    <Input 
                      value={roomData.code}
                      onChange={(e) => handleFieldChange("code", e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">Trạng thái</label>
                    <Select 
                      value={roomData.status} 
                      onChange={(e) => handleFieldChange("status", e.target.value)}
                      options={[
                        { label: "Trống", value: "AVAILABLE" },
                        { label: "Đang thuê", value: "RENTED" },
                        { label: "Đặt cọc", value: "RESERVED" },
                        { label: "Bảo trì", value: "MAINTENANCE" },
                        { label: "Không khả dụng", value: "UNAVAILABLE" }
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">Giá thuê</label>
                    <Input 
                      type="number" 
                      value={roomData.monthlyPrice}
                      onChange={(e) => handleFieldChange("monthlyPrice", Number(e.target.value))}
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
                {/* WHOLE ROOM */}
                {(
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

              </div>
            )}

            {/* Finances Tab */}
            {activeTab === "finances" && (
              <div className="flex flex-col gap-6 animate-in w-full box-border max-w-[750px]">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2">
                    <CreditCard size={14} /> Danh sách hóa đơn
                  </h4>
                  <Button size="sm" onClick={() => showToast("Chức năng tạo hóa đơn thủ công đang được xử lý.", "info")}>
                    <Plus size={12} className="mr-1" /> Tạo hóa đơn
                  </Button>
                </div>
                
                <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-black/5 dark:bg-white/5 text-[11px] font-black uppercase text-muted tracking-wider border-b border-border/40">
                        <th className="p-3">Mã HĐ</th>
                        <th className="p-3">Số tiền</th>
                        <th className="p-3">Hạn thanh toán</th>
                        <th className="p-3 text-right">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {realInvoices && realInvoices.length > 0 ? (
                        realInvoices.map((inv: any) => (
                          <tr key={inv.id} className="border-b border-border/40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                            <td className="p-3 font-bold">{inv.code}</td>
                            <td className="p-3 font-black">{(inv.total || inv.amount || 0).toLocaleString()} đ</td>
                            <td className="p-3 text-muted">{new Date(inv.dueDate).toLocaleDateString("vi-VN")}</td>
                            <td className="p-3 text-right">
                              <span className={`px-2 py-0.5 rounded-[6px] text-[11px] font-bold uppercase ${['PAID', 'paid'].includes(inv.status) ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                                {['PAID', 'paid'].includes(inv.status) ? "Đã trả" : "Chưa trả"}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-muted italic">Chưa có hóa đơn nào</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2">
                    Lịch sử thanh toán
                  </h4>
                  <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-black/5 dark:bg-white/5 text-[11px] font-black uppercase text-muted tracking-wider border-b border-border/40">
                          <th className="p-3">Tháng</th>
                          <th className="p-3">Số tiền</th>
                          <th className="p-3">Ngày thanh toán</th>
                          <th className="p-3 text-right">Hình thức</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roomData.paymentHistory && roomData.paymentHistory.length > 0 ? (
                          roomData.paymentHistory.map(pay => (
                            <tr key={pay.id} className="border-b border-border/40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                              <td className="p-3 font-bold">{pay.month}</td>
                              <td className="p-3 font-black">{pay.amount.toLocaleString()} đ</td>
                              <td className="p-3 text-muted">{new Date(pay.date).toLocaleDateString("vi-VN")}</td>
                              <td className="p-3 text-right text-muted">{pay.method}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-muted italic">Chưa có lịch sử thanh toán</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Contract Tab */}
            {activeTab === "contract" && (
              <div className="flex flex-col gap-6 animate-in w-full box-border max-w-[750px]">
                <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2 border-b border-border/40 pb-2">
                  <FileText size={14} /> Thông tin hợp đồng thuê
                </h4>
                {roomData.contract ? (
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border border-border/60 rounded-xl p-4 bg-card">
                        <label className="text-[10px] font-black text-muted uppercase">Mã hợp đồng</label>
                        <p className="text-sm font-bold text-text mt-1">{roomData.contract.code}</p>
                      </div>
                      <div className="border border-border/60 rounded-xl p-4 bg-card">
                        <label className="text-[10px] font-black text-muted uppercase">Tiền đặt cọc</label>
                        <p className="text-sm font-black text-text mt-1">{roomData.contract.deposit.toLocaleString()} đ</p>
                      </div>
                      <div className="border border-border/60 rounded-xl p-4 bg-card">
                        <label className="text-[10px] font-black text-muted uppercase">Ngày bắt đầu</label>
                        <p className="text-sm font-bold text-text mt-1">{new Date(roomData.contract.startDate).toLocaleDateString("vi-VN")}</p>
                      </div>
                      <div className="border border-border/60 rounded-xl p-4 bg-card">
                        <label className="text-[10px] font-black text-muted uppercase">Ngày kết thúc</label>
                        <p className="text-sm font-bold text-text mt-1">{new Date(roomData.contract.endDate).toLocaleDateString("vi-VN")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      <Button variant="outline" className="flex-1" onClick={() => showToast("Đang tải tệp PDF...", "info")}>
                        <Paperclip size={14} className="mr-1.5" /> Xem PDF
                      </Button>
                      <Button variant="outline" className="flex-1 text-amber-500 border-amber-500/20 hover:bg-amber-500/10" onClick={() => showToast("Yêu cầu hết hạn hợp đồng đã gửi.", "info")}>
                        Hết hạn hợp đồng
                      </Button>
                      <Button variant="outline" className="flex-1 text-danger border-danger/20 hover:bg-danger/10" onClick={() => showToast("Yêu cầu chấm dứt hợp đồng đã gửi.", "info")}>
                        Chấm dứt hợp đồng
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center">
                    <FileText size={32} className="text-muted opacity-40 mb-2" />
                    <span className="text-sm font-bold text-muted">Phòng này hiện chưa có hợp đồng</span>
                    <Button size="sm" className="mt-4" onClick={() => showToast("Mở biểu mẫu tạo hợp đồng mới.", "info")}>
                      <Plus size={12} className="mr-1" /> Tạo hợp đồng ngay
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Temporary Residence Tab */}
            {activeTab === "temp_residence" && (
              <div className="flex flex-col gap-6 animate-in w-full box-border max-w-[750px]">
                <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2 border-b border-border/40 pb-2">
                  <ShieldAlert size={14} /> Tình trạng khai báo tạm trú
                </h4>
                <div className="border border-border/60 rounded-xl p-5 bg-card flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-text">Khai báo tạm trú (Công an sở tại)</span>
                    <span className="text-xs text-muted mt-0.5">Quy định bắt buộc đối với khách thuê lưu trú qua đêm</span>
                  </div>
                  <button 
                    onClick={() => {
                      if (roomData.tenant) {
                        handleTenantChange("tempResidence", !roomData.tenant.tempResidence);
                        showToast("Cập nhật trạng thái tạm trú thành công!", "success");
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${roomData.tenant?.tempResidence ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}
                  >
                    {roomData.tenant?.tempResidence ? "Đã khai báo" : "Chưa khai báo"}
                  </button>
                </div>
              </div>
            )}

            {/* Images Tab */}
            {activeTab === "images" && (
              <div className="flex flex-col gap-6 animate-in w-full box-border max-w-[750px]">
                <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2 border-b border-border/40 pb-2">
                  <ImageIcon size={14} /> Hình ảnh căn hộ và CCCD khách thuê
                </h4>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {roomData.images && roomData.images.length > 0 ? (
                    roomData.images.map((img, idx) => (
                      <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-border/60 bg-muted group">
                        <img src={img} alt={`Room image ${idx}`} className="w-full h-full object-cover" />
                        <button className="absolute top-2 right-2 w-[24px] h-[24px] bg-black/60 hover:bg-rose-500/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full p-8 text-center text-muted italic">Chưa tải ảnh phòng lên</div>
                  )}

                  <div className="border-2 border-dashed border-border rounded-xl aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <Upload size={24} className="text-muted opacity-50 mb-1" />
                    <span className="text-[11px] font-bold text-muted">Tải ảnh lên (Max 5MB)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === "notes" && (
              <div className="flex flex-col gap-6 animate-in w-full box-border max-w-[750px]">
                <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2 border-b border-border/40 pb-2">
                  <AlignLeft size={14} /> Ghi chú nội bộ
                </h4>
                <textarea 
                  value={roomData.notes || ""} 
                  onChange={(e) => handleFieldChange("notes", e.target.value)}
                  placeholder="Nhập các ghi chú quan trọng về khách thuê hoặc phòng..." 
                  className="flex min-h-[150px] w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-none"
                />
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
