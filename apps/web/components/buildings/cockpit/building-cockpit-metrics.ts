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
  // Layout rooms describe geometry. Portfolio KPIs must only count records that
  // were actually synchronized from the operational API.
  const rooms = building.floors.flatMap((floor) => floor.rooms).filter((room) => room.sourceRoom);
  const occupiedRooms = rooms.filter((room) => room.status === "occupied" || room.status === "expiring_soon").length;
  const vacantRooms = rooms.filter((room) => room.status === "vacant").length;
  const now = Date.now();
  const inThirtyDays = now + 30 * 24 * 60 * 60 * 1000;
  const expiringContracts = rooms.filter((room) => {
    if (room.status === "expiring_soon") return true;
    const end = room.contract?.endDate ? new Date(room.contract.endDate).getTime() : Number.NaN;
    return Number.isFinite(end) && end >= now && end <= inThirtyDays;
  }).length;
  const residentCount = rooms.reduce((sum, room) => sum + room.occupants, 0);
  const monthlyRevenue = rooms.reduce((sum, room) => (room.status === "occupied" || room.status === "expiring_soon") ? sum + (room.monthlyRent || 0) : sum, 0);
  const occupancyRate = rooms.length ? Math.round((occupiedRooms / rooms.length) * 100) : 0;
  const declaredTemporaryResidence = rooms.filter((room) => room.sourceRoom?.tenant?.tempResidence).length;
  const temporaryResidenceRate = occupiedRooms ? Math.round((declaredTemporaryResidence / occupiedRooms) * 100) : 0;
  const depositTotal = rooms.reduce((sum, room) => sum + (room.contract?.deposit || 0), 0);
  const overduePayments = rooms.reduce((sum, room) => sum + (room.sourceRoom?.invoices || []).filter((invoice) => invoice.status !== "paid" && new Date(invoice.dueDate).getTime() < now).length, 0);

  return {
    totalRooms: rooms.length,
    occupiedRooms,
    vacantRooms,
    expiringContracts,
    residentCount,
    monthlyRevenue,
    yearlyRevenue: monthlyRevenue * 12,
    depositTotal,
    occupancyRate,
    temporaryResidenceRate,
    declaredTemporaryResidence,
    incompleteTemporaryResidence: Math.max(occupiedRooms - declaredTemporaryResidence, 0),
    overduePayments,
  };
}

export function getFloorOccupancy(floor: CockpitFloorSpec) {
  const rooms = floor.rooms.filter((room) => room.sourceRoom);
  const active = rooms.filter((room) => room.status === "occupied" || room.status === "expiring_soon").length;
  return rooms.length ? Math.round((active / rooms.length) * 100) : 0;
}
