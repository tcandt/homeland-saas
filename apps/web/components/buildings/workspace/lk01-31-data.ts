import type { Building } from "../building.types";

function cloneBuilding(building: Building): Building {
  return JSON.parse(JSON.stringify(building)) as Building;
}

export function adaptBuildingForLK01_31(building: Building): Building {
  return cloneBuilding(building);
}

export function adaptBuildingGeneral(building: Building, code: string, name: string, address: string): Building {
  const copy = cloneBuilding(building);
  copy.code = copy.code || code;
  copy.name = copy.name || name;
  copy.address = copy.address || address;
  return copy;
}
