"use client";

import React from "react";
import type { Building } from "../building.types";
import { Landmark } from "lucide-react";

interface BuildingSwitcherProps {
  buildings: Building[];
  activeBuildingId: string | null;
  onSelectBuilding: (buildingId: string) => void;
}

const SWITCHER_ITEMS = [
  { code: "LK01-31" },
  { code: "LK01-32" },
  { code: "LK08-24" },
  { code: "LK08-25" }
];

export default function BuildingSwitcher({
  buildings,
  activeBuildingId,
  onSelectBuilding
}: BuildingSwitcherProps) {
  return (
    <div className="flex flex-wrap items-center bg-[#0f172a]/5 dark:bg-white/[0.03] border border-border/40 p-1 rounded-xl gap-1">
      {SWITCHER_ITEMS.map((item) => {
        // Match building in Adapted List
        const matched = buildings.find(b => 
          b.code?.toUpperCase() === item.code.toUpperCase() ||
          b.name?.toUpperCase().includes(item.code.toUpperCase())
        );
        const isActive = matched && activeBuildingId === matched.id;
        
        return (
          <button
            key={item.code}
            type="button"
            disabled={!matched}
            onClick={() => matched && onSelectBuilding(matched.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs transition-all duration-300 ${
              isActive
                ? "bg-white dark:bg-slate-800 text-primary shadow-[0_2px_8px_rgba(79,70,229,0.08)] border border-primary/20 scale-[1.02]"
                : "text-muted hover:bg-black/5 dark:hover:bg-white/5 hover:text-text disabled:opacity-40 disabled:cursor-not-allowed border border-transparent"
            }`}
          >
            <Landmark size={13} className={isActive ? "text-primary" : "text-muted"} />
            <span className="font-extrabold tracking-tight">{item.code}</span>
          </button>
        );
      })}
    </div>
  );
}
