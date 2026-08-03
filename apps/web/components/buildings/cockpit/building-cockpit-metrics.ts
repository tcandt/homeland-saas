import type { CockpitBuildingSpec, CockpitFloorSpec } from "./building-cockpit.types";

export function formatVnd(value = 0) {
  return new Intl.NumberFormat("vi-VN").format(value) + " đ";
}

export function getStatusLabel(status: string) {
  if (status === "occupied") return "Đã thuê";
  if (status === "expiring_soon") return "HĐ sắp hết hạn";
  if (status === "deposited") return "Đặt cọc";
  if (status === "maintenance") return "Cảnh báo";
  return "Đang trống";
}

export function getStatusTone(status: string) {
  if (status === "occupied") return { dot: "#16a34a", bg: "#dcfce7", text: "#15803d" };
  if (status === "expiring_soon") return { dot: "#f97316", bg: "#ffedd5", text: "#c2410c" };
  if (status === "deposited") return { dot: "#0284c7", bg: "#e0f2fe", text: "#0369a1" };
  if (status === "maintenance") return { dot: "#dc2626", bg: "#fee2e2", text: "#b91c1c" };
  return { dot: "#64748b", bg: "#f1f5f9", text: "#475569" };
}

export function getBuildingMetrics(building: CockpitBuildingSpec) {
  const rooms = building.floors.flatMap((floor) => floor.rooms);
  const occupiedRooms = rooms.filter((room) => room.status === "occupied" || room.status === "expiring_soon").length;
  const vacantRooms = rooms.filter((room) => room.status === "vacant").length;
  const expiringContracts = rooms.filter((room) => room.status === "expiring_soon" || room.contract).slice(0, 3).length;
  const residentCount = rooms.reduce((sum, room) => sum + Math.max(room.occupants, room.status === "occupied" ? 1 : 0), 0);
  const monthlyRevenue = rooms.reduce((sum, room) => (room.status === "occupied" || room.status === "expiring_soon") ? sum + (room.monthlyRent || 0) : sum, 0);
  const occupancyRate = rooms.length ? Math.round((occupiedRooms / rooms.length) * 100) : 0;

  return {
    totalRooms: rooms.length,
    occupiedRooms,
    vacantRooms,
    expiringContracts,
    residentCount,
    monthlyRevenue,
    yearlyRevenue: monthlyRevenue * 5,
    depositTotal: 120000000,
    occupancyRate,
    temporaryResidenceRate: 92,
    incompleteTemporaryResidence: 2,
    overduePayments: 1,
  };
}

export function getFloorOccupancy(floor: CockpitFloorSpec) {
  const active = floor.rooms.filter((room) => room.status === "occupied" || room.status === "expiring_soon").length;
  return floor.rooms.length ? Math.round((active / floor.rooms.length) * 100) : 0;
}
