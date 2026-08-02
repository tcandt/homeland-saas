import type { Building, Floor, Room, Tenant, Invoice } from "../../building.types";

export type RoomPrimaryStatus = "vacant" | "occupied" | "deposited" | "maintenance" | "unknown";

export interface RoomSecondaryWarning {
  id: "contract_expiring" | "payment_overdue" | "temp_residence_missing" | "historical_debt";
  label: string;
  type: "warning" | "danger";
  message: string;
}

export interface RoomOperationalViewModel {
  room: Room;
  primaryStatus: RoomPrimaryStatus;
  warnings: RoomSecondaryWarning[];
  paymentStatus: "paid" | "due" | "overdue" | "unknown";
  tempResidenceStatus: "declared" | "missing" | "partial" | "unknown";
  remainingContractDays?: number;
  currentOccupants: number;
}

export interface FloorOperationalViewModel {
  floor: Floor;
  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  depositedRooms: number;
  maintenanceRooms: number;
  residentCount: number;
  occupancyRate: number;
  alertCount: number;
  rooms: RoomOperationalViewModel[];
}

export interface NormalizedRoomLayout {
  x: number;      // 0..1 (percentage of container width)
  y: number;      // 0..1 (percentage of container height)
  width: number;  // 0..1
  height: number; // 0..1
}
