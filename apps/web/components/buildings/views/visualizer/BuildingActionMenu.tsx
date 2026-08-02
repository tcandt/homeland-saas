"use client";

import React from "react";
import { Settings, Plus } from "lucide-react";

interface Props {
  onEditBuilding: () => void;
  onAddFloor: () => void;
  permissions: {
    canUpdateBuilding: boolean;
    canCreateFloor: boolean;
  };
}

export default function BuildingActionMenu({ onEditBuilding, onAddFloor, permissions }: Props) {
  return (
    <div className="flex items-center gap-3.5">
      {permissions.canUpdateBuilding && (
        <button
          type="button"
          onClick={onEditBuilding}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-background border border-border hover:bg-slate-50 dark:hover:bg-white/5 text-[13px] font-bold text-text rounded-xl transition-all shadow-sm focus:ring-2 focus:ring-primary focus:outline-none"
        >
          <Settings size={14} className="text-muted" />
          Cấu hình Tòa nhà
        </button>
      )}

      {permissions.canCreateFloor && (
        <button
          type="button"
          onClick={onAddFloor}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-[13px] font-bold rounded-xl transition-all shadow-[0_4px_14px_0_rgb(99,102,241,0.39)] hover:shadow-lg focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-none"
        >
          <Plus size={14} />
          Thêm Tầng
        </button>
      )}
    </div>
  );
}
