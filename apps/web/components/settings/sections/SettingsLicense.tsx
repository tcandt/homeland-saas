"use client";
import React from "react";
import { Button } from "@/components/ui/Button";

export default function SettingsLicense() {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[20px]">
        <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">License & Billing</h3>
        <div className="flex flex-col gap-[16px]">
          <div className="p-[20px] rounded-[14px] bg-gradient-to-br from-primary/10 to-success/10 border border-primary/20">
            <div className="flex items-center justify-between mb-[12px]">
              <div>
                <div className="font-black text-[18px] text-text">Professional Plan</div>
                <div className="text-[13px] font-medium text-muted mt-[4px]">Đang hoạt động · Hết hạn 31/12/2026</div>
              </div>
              <span className="text-[12px] font-bold text-success bg-success/10 px-[12px] py-[6px] rounded-full border border-success/20">ACTIVE</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[12px] mt-[16px]">
              {[
                { label: "Tòa nhà", used: 3, max: 10 },
                { label: "Phòng", used: 127, max: 500 },
                { label: "Người dùng", used: 8, max: 20 },
                { label: "Dung lượng", used: "48.2 MB", max: "10 GB" },
              ].map((l, i) => (
                <div key={i} className="flex flex-col gap-[6px]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-muted">{l.label}</span>
                    <span className="text-[11px] font-bold text-text">{l.used}/{l.max}</span>
                  </div>
                  <div className="w-full h-[4px] bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: typeof l.used === "number" && typeof l.max === "number" ? `${(l.used / l.max) * 100}%` : "10%" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button className="h-[40px] px-[20px] rounded-[10px] bg-primary text-white font-bold text-[13px] hover:bg-primary/90 transition-colors">Nâng cấp gói</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
