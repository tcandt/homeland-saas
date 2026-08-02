"use client";

import React, { useEffect, useState } from "react";
import { X, User, Phone, Mail, Calendar, MessageCircle, Filter, Edit, MoreVertical } from "lucide-react";
import { formatSalesDate, getSalesStageLabel } from "./sales.types";

export default function OperationsSalesDrawer() {
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const customEvent = event as CustomEvent;
      setSelectedLead(customEvent.detail || null);
    };

    window.addEventListener("open-sales-drawer", handleOpen as EventListener);
    return () => window.removeEventListener("open-sales-drawer", handleOpen as EventListener);
  }, []);

  if (!selectedLead) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[9998] animate-in fade-in duration-200" onClick={() => setSelectedLead(null)} />
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-[860px] bg-card shadow-2xl z-[9999] animate-in slide-in-from-right duration-300 flex flex-col border-l border-border">
        <div className="h-[70px] border-b border-border flex items-center justify-between px-[24px] shrink-0 bg-card z-10">
          <div className="flex items-center gap-[16px] min-w-0">
            <div className="w-[40px] h-[40px] rounded-full bg-[#6366f1]/10 flex items-center justify-center border border-[#6366f1]/20 shrink-0">
              <span className="font-black text-[14px] text-[#6366f1]">{(selectedLead.name || "L").slice(0, 1).toUpperCase()}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-[8px] min-w-0">
                <h2 className="font-black text-[18px] text-text truncate">{selectedLead.name}</h2>
                <span className="text-[11px] font-bold px-[6px] py-[2px] rounded-[4px] text-[#f97316] bg-[#f97316]/10 border border-[#f97316]/20 uppercase">
                  {getSalesStageLabel(selectedLead.status)}
                </span>
              </div>
              <span className="text-[13px] font-medium text-muted truncate">
                {selectedLead.phone || "Chưa có số điện thoại"} • {selectedLead.email || "Chưa có email"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-[12px]">
            <button className="h-[36px] px-[16px] rounded-[10px] bg-background border border-border text-text text-[13px] font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-[6px]" type="button">
              <Edit size={14} /> Chỉnh sửa
            </button>
            <button className="w-[36px] h-[36px] flex items-center justify-center rounded-[10px] hover:bg-black/5 dark:hover:bg-white/5 text-muted transition-colors" type="button">
              <MoreVertical size={16} />
            </button>
            <div className="w-[1px] h-[20px] bg-border mx-[4px]" />
            <button onClick={() => setSelectedLead(null)} className="w-[36px] h-[36px] flex items-center justify-center rounded-[10px] bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors" type="button">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-[24px] flex flex-col gap-[24px] bg-background">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
            <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
              <h3 className="font-black text-[15px] text-text">Thông tin khách hàng</h3>
              <div className="grid grid-cols-1 gap-y-[16px] gap-x-[24px]">
                <DetailItem icon={<Phone size={14} />} label="Số điện thoại" value={selectedLead.phone || "Chưa có"} highlight />
                <DetailItem icon={<Mail size={14} />} label="Email" value={selectedLead.email || "Chưa cập nhật"} />
                <DetailItem icon={<Calendar size={14} />} label="Tạo lúc" value={formatSalesDate(selectedLead.createdAt)} />
                <DetailItem icon={<Calendar size={14} />} label="Cập nhật" value={formatSalesDate(selectedLead.updatedAt)} />
              </div>
            </div>

            <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
              <h3 className="font-black text-[15px] text-text">Ghi chú</h3>
              <div className="p-[12px] bg-yellow-500/10 border border-yellow-500/20 rounded-[8px] text-[13px] text-text leading-relaxed">
                {selectedLead.notes || "Chưa có ghi chú."}
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
            <h3 className="font-black text-[15px] text-text">Trạng thái hiện tại</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[12px]">
              <DetailItem icon={<User size={14} />} label="Lead" value={getSalesStageLabel(selectedLead.status)} />
              <DetailItem icon={<MessageCircle size={14} />} label="Trạng thái hiển thị" value={selectedLead.status} />
              <DetailItem icon={<Calendar size={14} />} label="Nguồn dữ liệu" value="SalesLead DB" />
            </div>
          </div>
        </div>

        <div className="h-[80px] border-t border-border bg-card shrink-0 px-[24px] flex items-center justify-between z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-[12px]">
            <ActionButton icon={<MessageCircle size={16} />} label="Ghi chú" color="bg-background text-text border border-border hover:bg-black/5" />
          </div>

          <div className="flex items-center gap-[12px]">
            <ActionButton icon={<Filter size={16} />} label="Cập nhật trạng thái" color="bg-[#4f46e5]" />
          </div>
        </div>
      </div>
    </>
  );
}

function DetailItem({ icon, label, value, highlight = false }: any) {
  return (
    <div className="flex flex-col gap-[4px]">
      <div className="flex items-center gap-[6px] text-muted">
        {icon}
        <span className="text-[12px] font-medium">{label}</span>
      </div>
      <span className={`text-[14px] font-bold ${highlight ? "text-[#6366f1]" : "text-text"}`}>{value}</span>
    </div>
  );
}

function ActionButton({ icon, label, color }: any) {
  return (
    <button className={`h-[44px] px-[20px] rounded-[12px] flex items-center gap-[8px] text-[14px] font-bold transition-transform active:scale-95 shadow-sm ${color.includes("bg-background") ? color : `${color} text-white hover:opacity-90`}`} type="button">
      {icon}
      {label}
    </button>
  );
}
