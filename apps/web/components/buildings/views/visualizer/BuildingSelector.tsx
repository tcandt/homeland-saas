"use client";

import React, { useState } from "react";
import type { Building } from "../../building.types";
import { ChevronDown, Home } from "lucide-react";

interface Props {
  buildings: Building[];
  selectedBuildingId: string;
  onChange: (buildingId: string) => void;
}

export default function BuildingSelector({ buildings, selectedBuildingId, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const activeBuilding = buildings.find(b => b.id === selectedBuildingId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-4 py-2.5 bg-card hover:bg-slate-50 dark:hover:bg-white/5 border border-border/80 rounded-xl font-black text-[14px] text-text transition-all shadow-sm focus:ring-2 focus:ring-primary focus:outline-none"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Chọn tòa nhà vận hành"
      >
        <Home size={16} className="text-primary" />
        <span className="truncate max-w-[150px] sm:max-w-[200px]">
          {activeBuilding?.name || "Chọn tòa nhà..."}
        </span>
        <ChevronDown size={14} className="text-muted" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-[240px] bg-card border border-border shadow-xl rounded-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
            <span className="block px-4 py-1.5 text-[10px] font-black uppercase text-muted tracking-wider">
              Danh sách tòa nhà
            </span>
            <div className="max-h-[250px] overflow-y-auto mt-1 flex flex-col gap-0.5 px-1.5">
              {buildings.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    onChange(b.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-[13px] font-bold transition-colors flex items-center gap-2.5 ${
                    b.id === selectedBuildingId
                      ? "bg-primary/10 text-primary"
                      : "text-text hover:bg-slate-50 dark:hover:bg-white/5"
                  }`}
                  role="option"
                  aria-selected={b.id === selectedBuildingId}
                >
                  <Home size={14} className={b.id === selectedBuildingId ? "text-primary" : "text-muted"} />
                  <span className="truncate">{b.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
