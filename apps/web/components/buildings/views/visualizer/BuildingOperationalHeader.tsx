"use client";

import React from "react";
import { ArrowLeft, Home } from "lucide-react";
import BuildingSelector from "./BuildingSelector";
import BuildingActionMenu from "./BuildingActionMenu";
import type { Building } from "../../building.types";

interface Props {
  building: Building;
  buildings: Building[];
  onSelectBuilding: (id: string) => void;
  onEditBuilding: () => void;
  onAddFloor: () => void;
  permissions: {
    canUpdateBuilding: boolean;
    canCreateFloor: boolean;
  };
  activeFloorName: string | null;
  onBackToOverview: () => void;
}

export default function BuildingOperationalHeader({
  building,
  buildings,
  onSelectBuilding,
  onEditBuilding,
  onAddFloor,
  permissions,
  activeFloorName,
  onBackToOverview,
}: Props) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/50 pb-5 mb-5 select-none">
      
      {/* Top Row: Breadcrumbs & Actions switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Navigation Breadcrumb / Titles */}
        <div className="flex flex-col min-w-0">
          {activeFloorName ? (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={onBackToOverview}
                className="flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-primary transition-colors w-fit focus:underline focus:outline-none"
              >
                <ArrowLeft size={12} className="text-primary" />
                Toàn bộ tòa nhà / {building.name} / {activeFloorName}
              </button>
              <h1 className="font-semibold text-[22px] md:text-[24px] text-text tracking-tight mt-1.5 truncate">
                {activeFloorName}
              </h1>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-muted flex items-center gap-1.5">
                <Home size={10} className="text-primary" />
                Vận hành Tòa nhà
              </span>
              <h1 className="font-semibold text-[26px] md:text-[28px] text-text tracking-tight truncate">
                {building.name}
              </h1>
            </div>
          )}
        </div>

        {/* Action Controls (Building switcher selector & Action buttons) */}
        <div className="flex flex-wrap items-center gap-3">
          <BuildingSelector
            buildings={buildings}
            selectedBuildingId={building.id}
            onChange={onSelectBuilding}
          />
          {!activeFloorName && (
            <BuildingActionMenu
              onEditBuilding={onEditBuilding}
              onAddFloor={onAddFloor}
              permissions={permissions}
            />
          )}
        </div>

      </div>

    </div>
  );
}
