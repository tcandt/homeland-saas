import type { Building, Floor } from "../building.types";
import type { FloorLayoutSpec } from "../views/visualizer/geometry/floor-layout.types";
import { floor2Layout } from "../views/visualizer/layouts/floor-2.layout";
import { floor3Layout } from "../views/visualizer/layouts/floor-3.layout";
import { floor4Layout } from "../views/visualizer/layouts/floor-4.layout";

export type VisualizationProfile = "lk01-31-custom" | "generic-operational";

export function normalizeBuildingCode(code: string): string {
  return (code || "").replace(".", "-").trim().toUpperCase();
}

export function resolveVisualizationProfile(buildingCode: string): VisualizationProfile {
  const normalized = normalizeBuildingCode(buildingCode);
  if (normalized === "LK01-31") {
    return "lk01-31-custom";
  }
  return "generic-operational";
}

/**
 * Single source of truth for custom architectural layouts.  Keep database
 * identity checks here so visual components never infer a layout from a
 * display label or a hard-coded floor number alone.
 */
export function resolveFloorLayoutSpec(
  building: Building,
  floor: Floor | null,
): FloorLayoutSpec | null {
  if (!floor || resolveVisualizationProfile(building.code || building.name || "") !== "lk01-31-custom") {
    return null;
  }

  const databaseFloor = building.floors.find((candidate) => candidate.id === floor.id);
  if (!databaseFloor) return null;

  const roomCodes = new Set(databaseFloor.rooms.map((room) => normalizeBuildingCode(room.code)));
  const candidates: Array<{ layout: FloorLayoutSpec; roomCodes: [string, string] }> = [
    { layout: floor2Layout, roomCodes: ["PN 31-02", "PN 31-03"] },
    { layout: floor3Layout, roomCodes: ["PN 31-04", "PN 31-05"] },
    { layout: floor4Layout, roomCodes: ["PN 31-06", "PN 31-07"] },
  ];
  const match = candidates.find(({ layout, roomCodes: expectedCodes }) =>
    databaseFloor.number === layout.floorNumber &&
    expectedCodes.every((code) => roomCodes.has(code)),
  );

  return match?.layout ?? null;
}
