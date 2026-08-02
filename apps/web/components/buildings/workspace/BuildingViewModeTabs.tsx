"use client";

import React from "react";
import { ViewMode } from "./useBuildingsWorkspace";
import { Layers, LayoutGrid } from "lucide-react";

interface BuildingViewModeTabsProps {
  activeView: ViewMode;
  onSelectViewMode: (view: ViewMode) => void;
}

const TABS = [
  { id: "overview" as ViewMode, label: "Tổng quan 3D", icon: Layers },
  { id: "floor-2d" as ViewMode, label: "Mặt bằng", icon: LayoutGrid },
];

export default function BuildingViewModeTabs({
  activeView,
  onSelectViewMode
}: BuildingViewModeTabsProps) {
  return (
    <div className="flex bg-[#0f172a]/5 dark:bg-white/[0.03] border border-border/40 p-1 rounded-xl gap-1 w-full md:w-auto">
      {TABS.map((tab) => {
        const isActive = activeView === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelectViewMode(tab.id)}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-xs transition-all duration-300 flex-1 md:flex-none ${
              isActive
                ? "bg-white dark:bg-slate-800 text-primary shadow-[0_4px_12px_rgba(79,70,229,0.12)] border border-primary/20 scale-[1.02]"
                : "text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-text"
            }`}
          >
            <Icon size={14} className={isActive ? "text-primary" : "text-muted"} />
            <div className="flex flex-col items-start leading-none">
              <span className="font-bold text-xs">{tab.label}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
