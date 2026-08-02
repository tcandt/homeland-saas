"use client";
import React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
function Field({ label, value, type = "text" }: any) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label className="text-[12px] font-bold text-muted uppercase tracking-wide">{label}</label>
      <Input type={type} defaultValue={value} className="h-[42px] px-[14px] bg-background border border-border rounded-[10px] text-[13px] font-medium text-text focus:outline-none focus:border-primary transition-all" />
    </div>
  );
}
export default function SettingsBuildingRooms() {
  const roomTypes = [
    { icon: "🏠", name: "Studio", area: "25m²", maxPeople: 2, deposit: "2 tháng", color: "#6366f1" },
    { icon: "🛏️", name: "1 Phòng ngủ", area: "40m²", maxPeople: 3, deposit: "2 tháng", color: "#8b5cf6" },
    { icon: "🏡", name: "2 Phòng ngủ", area: "65m²", maxPeople: 5, deposit: "2 tháng", color: "#f97316" },
    { icon: "🏢", name: "3 Phòng ngủ", area: "90m²", maxPeople: 7, deposit: "3 tháng", color: "#3b82f6" },
    { icon: "💼", name: "Office", area: "50m²", maxPeople: 10, deposit: "3 tháng", color: "#8b5cf6" },
    { icon: "🏨", name: "Dorm / Ký túc xá", area: "15m²", maxPeople: 2, deposit: "1 tháng", color: "#ec4899" },
  ];
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-[15px] text-text">Loại phòng (Room Types)</h3>
          <Button className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 flex items-center gap-[6px] transition-colors">
            <Plus size={14} /> Thêm loại phòng
          </Button>
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-[12px]">
          {roomTypes.map((rt, i) => (
            <div key={i} className="flex flex-col gap-[12px] p-[16px] rounded-[12px] border-2 border-border bg-background hover:border-primary/40 cursor-pointer transition-all group">
              <div className="flex items-center gap-[10px]">
                <div className="w-[40px] h-[40px] rounded-[10px] flex items-center justify-center text-[20px]" style={{ backgroundColor: rt.color + "15" }}>{rt.icon}</div>
                <span className="font-black text-[14px] text-text group-hover:text-primary transition-colors">{rt.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-[6px] text-[11px]">
                <div className="flex flex-col"><span className="text-muted">Diện tích</span><span className="font-bold text-text">{rt.area}</span></div>
                <div className="flex flex-col"><span className="text-muted">Tối đa</span><span className="font-bold text-text">{rt.maxPeople} người</span></div>
                <div className="flex flex-col col-span-2"><span className="text-muted">Đặt cọc mặc định</span><span className="font-bold text-text">{rt.deposit}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text">Cài đặt vận hành</h3>
        <div className="grid grid-cols-2 gap-[14px]">
          <Field label="SLA xử lý sự cố (giờ)" value="24" />
          <Field label="Thời gian dọn phòng (giờ)" value="4" />
          <Field label="Thời gian check-out (h)" value="12:00" />
          <Field label="Thời gian check-in (h)" value="14:00" />
        </div>
        <div className="flex justify-end"><Button className="h-[40px] px-[20px] rounded-[10px] bg-primary text-white font-bold text-[13px] hover:bg-primary/90 transition-colors">Lưu cài đặt</Button></div>
      </div>
    </div>
  );
}
