"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";

type AppearanceSettings = {
  theme: "light" | "dark" | "system";
  accentColor: string;
  language: "vi" | "en";
  density: "compact" | "default" | "relaxed";
  borderRadius: "sharp" | "rounded" | "pill";
  animation: "off" | "reduced" | "full";
};

const fallback: AppearanceSettings = {
  theme: "dark",
  accentColor: "#6366f1",
  language: "vi",
  density: "default",
  borderRadius: "rounded",
  animation: "full",
};

export default function SettingsAppearance() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<AppearanceSettings>("appearance", "USER", fallback);

  const accentColors = ["#6366f1", "#8b5cf6", "#f97316", "#3b82f6", "#ec4899", "#8b5cf6"];

  return (
    <form
      className="flex flex-col gap-[20px]"
      onSubmit={async (event) => {
        event.preventDefault();
        await save();
      }}
    >
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[20px]">
        <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">Appearance & Locale</h3>
        <div className="flex flex-col gap-[20px]">
          <div>
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide mb-[10px] block">Giao diện (Theme)</label>
            <div className="flex gap-[10px] flex-wrap">
              {[
                { key: "light", label: "Sáng (Light)" },
                { key: "dark", label: "Tối (Dark)" },
                { key: "system", label: "Tự động" },
              ].map((item) => {
                const active = draft.theme === item.key;
                return (
                  <Button
                    type="button"
                    key={item.key}
                    onClick={() => setDraft((prev) => ({ ...prev, theme: item.key as AppearanceSettings["theme"] }))}
                    className={`flex flex-col items-center gap-[6px] p-[12px] rounded-[12px] border-2 transition-all ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  >
                    <div className={`w-[48px] h-[32px] rounded-[6px] ${item.key === "light" ? "bg-card border border-border" : item.key === "dark" ? "bg-gray-900" : "bg-gradient-to-r from-white to-gray-900"}`} />
                    <span className="text-[12px] font-bold text-text">{item.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide mb-[10px] block">Accent Color</label>
            <div className="flex gap-[8px] flex-wrap">
              {accentColors.map((color) => (
                <Button
                  type="button"
                  key={color}
                  onClick={() => setDraft((prev) => ({ ...prev, accentColor: color }))}
                  className={`w-[32px] h-[32px] rounded-full border-2 transition-all ${draft.accentColor === color ? "border-text scale-110" : "border-transparent hover:scale-110"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide mb-[10px] block">Ngôn ngữ</label>
            <div className="flex gap-[10px]">
              {[
                { key: "vi", label: "🇻🇳 Tiếng Việt" },
                { key: "en", label: "🇺🇸 English" },
              ].map((item) => (
                <Button
                  type="button"
                  key={item.key}
                  onClick={() => setDraft((prev) => ({ ...prev, language: item.key as AppearanceSettings["language"] }))}
                  className={`px-[16px] py-[10px] rounded-[10px] text-[13px] font-bold border-2 transition-all ${draft.language === item.key ? "border-primary bg-primary/5 text-primary" : "border-border text-text hover:border-primary/40"}`}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-[14px]">
            {[
              { key: "density", label: "Density", options: ["compact", "default", "relaxed"] },
              { key: "borderRadius", label: "Border Radius", options: ["sharp", "rounded", "pill"] },
              { key: "animation", label: "Animation", options: ["off", "reduced", "full"] },
            ].map((group) => (
              <div key={group.key} className="flex flex-col gap-[8px]">
                <label className="text-[12px] font-bold text-muted uppercase tracking-wide">{group.label}</label>
                <div className="flex gap-[6px]">
                  {group.options.map((option) => {
                    const active = draft[group.key as keyof AppearanceSettings] === option;
                    return (
                      <Button
                        type="button"
                        key={option}
                        onClick={() => setDraft((prev) => ({ ...prev, [group.key]: option }))}
                        className={`flex-1 py-[8px] rounded-[8px] text-[11px] font-bold border transition-all ${active ? "border-primary bg-primary/5 text-primary" : "border-border text-muted hover:border-primary/40"}`}
                      >
                        {option}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end border-t border-border pt-[16px]">
          <Button type="submit" className="h-[40px] px-[20px] rounded-[10px] bg-primary text-white font-bold text-[13px] hover:bg-primary/90 transition-colors" isLoading={isSaving}>
            Lưu giao diện
          </Button>
        </div>
      </div>
    </form>
  );
}
