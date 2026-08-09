import type { Building } from "../building.types";
import type { Room, RoomType } from "../building.types";
import { createCockpitBuildingSpec } from "../cockpit/building-cockpit-data";
import type { CockpitBuildingSpec, CockpitRoomSpec } from "../cockpit/building-cockpit.types";

function cloneBuilding(building: Building): Building {
  return JSON.parse(JSON.stringify(building)) as Building;
}

function toMobileRoomType(type: string): RoomType {
  if (type.includes("2PN")) return "2PN";
  if (type.includes("Studio")) return "Studio";
  if (type.includes("Dorm")) return "Dorm";
  if (type.includes("Office") || type.includes("Văn Phòng")) return "Office";
  return "1PN";
}

function toMobileRoom(room: CockpitRoomSpec): Room {
  const sourceRoom = room.sourceRoom;
  return {
    ...(sourceRoom || {}),
    id: sourceRoom?.id || room.id,
    name: sourceRoom?.name || room.code,
    code: room.code,
    number: room.urlCode,
    type: sourceRoom?.type || toMobileRoomType(room.type),
    rentalType: sourceRoom?.rentalType || "whole",
    price: sourceRoom?.price ?? room.monthlyRent ?? 0,
    status: room.status,
    monthlyPrice: sourceRoom?.monthlyPrice ?? room.monthlyRent ?? 0,
    area: sourceRoom?.area ?? room.estimatedArea,
    capacity: sourceRoom?.capacity ?? room.capacity,
    images: sourceRoom?.images || [],
    tenant: sourceRoom?.tenant || null,
    contract: sourceRoom?.contract || room.contract,
    invoices: sourceRoom?.invoices || [],
    paymentHistory: sourceRoom?.paymentHistory || [],
    debt: sourceRoom?.debt || 0,
    sharedTenants: sourceRoom?.sharedTenants || [],
  };
}

function cockpitSpecToMobileBuilding(source: Building, spec: CockpitBuildingSpec): Building {
  return {
    ...source,
    code: spec.code,
    name: spec.name,
    address: spec.address,
    floors: spec.floors.map((floor) => {
      const sourceFloor = source.floors.find((item) => item.number === floor.dbNumber);
      return {
        id: sourceFloor?.id || `structure-floor-${spec.code}-${floor.id}`,
        number: floor.dbNumber,
        notes: sourceFloor?.notes,
        rooms: floor.rooms.map(toMobileRoom),
      };
    }),
  };
}

export function adaptBuildingForLK01_31(building: Building): Building {
  return adaptBuildingGeneral(building, "LK01-31", "LK01-31", building.address);
}

export function adaptBuildingGeneral(building: Building, code: string, name: string, address: string): Building {
  const copy = cloneBuilding(building);
  copy.code = code;
  copy.name = name;
  copy.address = copy.address || address;
  const spec = createCockpitBuildingSpec([copy], code);
  return spec ? cockpitSpecToMobileBuilding(copy, spec) : copy;
}
