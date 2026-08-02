import type { Building, Floor, Room, Tenant, Invoice } from "../../building.types";
import type { 
  RoomOperationalViewModel, 
  FloorOperationalViewModel, 
  RoomPrimaryStatus, 
  RoomSecondaryWarning 
} from "./building-view.types";
import dayjs from "dayjs";

/**
 * Pure-functional adapters to map domain models from Prisma/API 
 * into operational ViewModel states.
 */

export const mapRoomStatus = (status: string): RoomPrimaryStatus => {
  switch (status?.toLowerCase()) {
    case "occupied":
      return "occupied";
    case "vacant":
    case "available":
      return "vacant";
    case "deposited":
    case "reserved":
      return "deposited";
    case "maintenance":
      return "maintenance";
    default:
      return "unknown";
  }
};

export const toRoomOperationalItem = (
  room: Room,
  roomInvoices: Invoice[] = []
): RoomOperationalViewModel => {
  const today = dayjs().startOf("day");
  
  // 1. Primary Status Mapping
  let primaryStatus = mapRoomStatus(room.status);
  
  // 2. Occupants Count
  let currentOccupants = 0;
  if (room.rentalType === "whole") {
    currentOccupants = room.tenant ? (1 + (room.roommates?.length ?? 0)) : 0;
  } else if (room.rentalType === "shared") {
    currentOccupants = room.sharedTenants?.length ?? 0;
  }

  // 3. Contract Information
  let remainingContractDays: number | undefined;
  if (room.contract?.endDate) {
    const end = dayjs(room.contract.endDate).startOf("day");
    remainingContractDays = end.diff(today, "day");
  } else if (room.rentalType === "shared" && room.sharedTenants && room.sharedTenants.length > 0) {
    // For shared beds, pick the nearest expiring contract
    const daysList = room.sharedTenants
      .map(st => st.endDate ? dayjs(st.endDate).startOf("day").diff(today, "day") : undefined)
      .filter((d): d is number => d !== undefined);
    if (daysList.length > 0) {
      remainingContractDays = Math.min(...daysList);
    }
  }

  // 4. Invoices and Payment Status calculation for active leases (guardrail #7)
  const invoicesList = roomInvoices.length > 0 ? roomInvoices : (room.invoices || []);
  let paymentStatus: "paid" | "due" | "overdue" | "unknown" = "unknown";
  let hasHistoricalDebt = false;

  const isActiveLease = primaryStatus === "occupied" || room.status === "expiring_soon";

  if (isActiveLease) {
    paymentStatus = "paid"; // default to paid if there are no unpaid invoices
    if (invoicesList.length > 0) {
      let hasOverdue = false;
      let hasDue = false;

      invoicesList.forEach(inv => {
        if (inv.status === "paid") return;
        const isPastDue = dayjs(inv.dueDate).startOf("day").isBefore(today);
        if (isPastDue) {
          hasOverdue = true;
        } else {
          hasDue = true;
        }
      });

      if (hasOverdue) {
        paymentStatus = "overdue";
      } else if (hasDue) {
        paymentStatus = "due";
      }
    }
  } else {
    // Vacant, deposited or maintenance: active lease payment status is unknown/not applicable
    paymentStatus = "unknown";
  }

  // Check for historical debt from previous contracts (independent of active lease status)
  if (room.debt && room.debt > 0) {
    if (!isActiveLease) {
      hasHistoricalDebt = true;
    } else {
      // If there is an active lease, but the room debt is greater than 0 and there are no active overdue invoices,
      // it is categorized as historical debt
      const hasCurrentOverdueInvoices = invoicesList.some(inv => inv.status !== "paid" && dayjs(inv.dueDate).startOf("day").isBefore(today));
      if (!hasCurrentOverdueInvoices) {
        hasHistoricalDebt = true;
      }
    }
  }

  // Double check debt field on roommates/shared tenants
  if (room.rentalType === "shared" && room.sharedTenants) {
    const totalSharedDebt = room.sharedTenants.reduce((acc, st) => acc + (st.debt || 0), 0);
    if (totalSharedDebt > 0) {
      paymentStatus = "overdue";
    }
  }

  // 5. Temporary Residence Status Calculation
  let tempResidenceStatus: "declared" | "missing" | "partial" | "unknown" = "unknown";
  if (primaryStatus === "occupied" || room.status === "expiring_soon") {
    if (room.rentalType === "whole") {
      const allResidents = [
        room.tenant ? { tempResidence: room.tenant.tempResidence } : null,
        ...(room.roommates || []).map(r => ({ tempResidence: r.tempResidence })),
      ].filter((x): x is { tempResidence: boolean } => x !== null);

      if (allResidents.length > 0) {
        const declaredCount = allResidents.filter(r => r.tempResidence).length;
        if (declaredCount === allResidents.length) {
          tempResidenceStatus = "declared";
        } else if (declaredCount === 0) {
          tempResidenceStatus = "missing";
        } else {
          tempResidenceStatus = "partial";
        }
      }
    } else if (room.rentalType === "shared" && room.sharedTenants) {
      if (room.sharedTenants.length > 0) {
        const declaredCount = room.sharedTenants.filter(st => st.tempResidence).length;
        if (declaredCount === room.sharedTenants.length) {
          tempResidenceStatus = "declared";
        } else if (declaredCount === 0) {
          tempResidenceStatus = "missing";
        } else {
          tempResidenceStatus = "partial";
        }
      }
    }
  }

  // 6. Assemble Warnings
  const warnings: RoomSecondaryWarning[] = [];
  
  // Warning A: Contract Expiring
  if (remainingContractDays !== undefined && remainingContractDays >= 0 && remainingContractDays <= 30) {
    warnings.push({
      id: "contract_expiring",
      label: `HĐ còn ${remainingContractDays} ngày`,
      type: "warning",
      message: "Hợp đồng thuê sắp hết hạn trong vòng 30 ngày."
    });
    // In legacy UI, expiring soon was a primary status. In the cockpit, 
    // we keep its primary status as occupied but set warnings.
    if (primaryStatus === "occupied") {
      primaryStatus = "occupied"; // explicit check
    }
  }

  // Warning B: Payment Overdue (only for current active lease)
  if (paymentStatus === "overdue" && isActiveLease) {
    warnings.push({
      id: "payment_overdue",
      label: "Quá hạn thanh toán",
      type: "danger",
      message: "Hợp đồng hiện tại đang có hóa đơn quá hạn chưa thu."
    });
  }

  // Warning D: Historical Debt (for vacant rooms or old contract debts)
  if (hasHistoricalDebt) {
    warnings.push({
      id: "historical_debt",
      label: "Công nợ hợp đồng trước",
      type: "warning",
      message: `Tồn đọng khoản nợ ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(room.debt || 0)} từ khách thuê trước.`
    });
  }

  // Warning C: Temp Residence Missing
  if (tempResidenceStatus === "missing" || tempResidenceStatus === "partial") {
    warnings.push({
      id: "temp_residence_missing",
      label: tempResidenceStatus === "missing" ? "Chưa khai tạm trú" : "Thiếu khai tạm trú",
      type: "danger",
      message: "Vẫn còn cư dân trong phòng chưa hoàn tất khai báo tạm trú."
    });
  }

  return {
    room,
    primaryStatus,
    warnings,
    paymentStatus,
    tempResidenceStatus,
    remainingContractDays,
    currentOccupants
  };
};

export const toFloorOperationalViewModel = (
  floor: Floor,
  allInvoices: Invoice[] = []
): FloorOperationalViewModel => {
  const roomsVM = floor.rooms.map(room => {
    const roomInvoices = allInvoices.filter(inv => {
      // Find invoices belonging to this room code or roomId
      return (room.id && inv.id === room.id) || (room.code && inv.code.includes(room.code));
    });
    return toRoomOperationalItem(room, roomInvoices);
  });

  const totalRooms = roomsVM.length;
  const occupiedRooms = roomsVM.filter(r => r.primaryStatus === "occupied").length;
  const vacantRooms = roomsVM.filter(r => r.primaryStatus === "vacant").length;
  const depositedRooms = roomsVM.filter(r => r.primaryStatus === "deposited").length;
  const maintenanceRooms = roomsVM.filter(r => r.primaryStatus === "maintenance").length;
  
  const residentCount = roomsVM.reduce((sum, r) => sum + r.currentOccupants, 0);
  const alertCount = roomsVM.reduce((sum, r) => sum + r.warnings.length, 0);
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  return {
    floor,
    totalRooms,
    occupiedRooms,
    vacantRooms,
    depositedRooms,
    maintenanceRooms,
    residentCount,
    occupancyRate,
    alertCount,
    rooms: roomsVM
  };
};
