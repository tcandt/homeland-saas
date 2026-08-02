import type { Room } from "./building.types";

export const cleanRoomNumber = (name: string): string => {
  let clean = name.trim();
  if (clean.toLowerCase().startsWith("phòng ")) {
    clean = clean.substring(6).trim();
  } else if (clean.toLowerCase().startsWith("p.")) {
    clean = clean.substring(2).trim();
  }
  return clean;
};

export const formatRoomCompactName = (room?: Pick<Room, "name" | "number" | "code"> | null): string => {
  if (!room) return "P.-";
  const raw = room.name?.trim() || room.number?.trim() || room.code?.trim() || "Chưa đặt tên";
  return `P.${cleanRoomNumber(raw)}`;
};

export const formatRoomFullTitle = (room?: Pick<Room, "name" | "number" | "code"> | null): string => {
  if (!room) return "Phòng chưa đặt tên";
  const raw = room.name?.trim() || room.number?.trim() || room.code?.trim() || "Chưa đặt tên";
  return `Phòng ${cleanRoomNumber(raw)}`;
};

export const getRoomDisplayName = (room?: Pick<Room, "name" | "number" | "code"> | null) => {
  const label = room?.name?.trim() || room?.number?.trim() || room?.code?.trim();
  return label || "Chưa đặt tên";
};

export const getFloorDisplayName = (floorNumber: number, buildingCodeOrName?: string): string => {
  const normalized = (buildingCodeOrName || "").replace(".", "-").trim().toUpperCase();
  if (normalized.includes("LK01-31")) {
    if (floorNumber === 1) return "Tầng trệt";
    return `Tầng ${floorNumber}`;
  }
  if (floorNumber === 1) return "Tầng trệt";
  return `Tầng ${floorNumber - 1}`;
};
