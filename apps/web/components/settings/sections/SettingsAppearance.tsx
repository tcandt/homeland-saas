"use client";
import React from "react";
import { Button } from "@/components/ui/Button";
export default function SettingsAppearance() {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[20px]">
        <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">Appearance & Locale</h3>
        <div className="flex flex-col gap-[20px]">
          <div>
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide mb-[10px] block">Giao diện (Theme)</label>
            <div className="flex gap-[10px]">
              {["Sáng (Light)", "Tối (Dark)", "Tự động"].map((t, i) => (
                <Button key={t} className={`flex flex-col items-center gap-[6px] p-[12px] rounded-[12px] border-2 transition-all ${i === 1 ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <div className={`w-[48px] h-[32px] rounded-[6px] ${i === 0 ? "bg-card border border-border" : i === 1 ? "bg-gray-900" : "bg-gradient-to-r from-white to-gray-900"}`} />
                  <span className="text-[12px] font-bold text-text">{t}</span>
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide mb-[10px] block">Accent Color</label>
            <div className="flex gap-[8px]">
              {["#6366f1", "#10b981", "#f97316", "#3b82f6", "#ec4899", "#8b5cf6"].map((c) => (
                <Button key={c} className={`w-[32px] h-[32px] rounded-full border-2 transition-all ${c === "#6366f1" ? "border-text scale-110" : "border-transparent hover:scale-110"}`} style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide mb-[10px] block">Ngôn ngữ</label>
            <div className="flex gap-[10px]">
              {["🇻🇳 Tiếng Việt", "🇺🇸 English"].map((l, i) => (
                <Button key={l} className={`px-[16px] py-[10px] rounded-[10px] text-[13px] font-bold border-2 transition-all ${i === 0 ? "border-primary bg-primary/5 text-primary" : "border-border text-text hover:border-primary/40"}`}>{l}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-[14px]">
            {[["Density", ["Compact", "Default", "Relaxed"]], ["Border Radius", ["Sharp", "Rounded", "Pill"]], ["Animation", ["Off", "Reduced", "Full"]]].map(([label, opts]: any) => (
              <div key={label} className="flex flex-col gap-[8px]">
                <label className="text-[12px] font-bold text-muted uppercase tracking-wide">{label}</label>
                <div className="flex gap-[6px]">
                  {opts.map((o: string, j: number) => (
                    <Button key={o} className={`flex-1 py-[8px] rounded-[8px] text-[11px] font-bold border transition-all ${j === 1 ? "border-primary bg-primary/5 text-primary" : "border-border text-muted hover:border-primary/40"}`}>{o}</Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end border-t border-border pt-[16px]">
          <Button className="h-[40px] px-[20px] rounded-[10px] bg-primary text-white font-bold text-[13px] hover:bg-primary/90 transition-colors">Lưu giao diện</Button>
        </div>
      </div>
    </div>
  );
}
