export type RoomUiStatus = "occupied" | "vacant" | "deposited" | "maintenance";

export interface RoomOccupancyCandidate {
  id?: string;
  leftAt?: string | Date | null;
  status?: string;
  roomId?: string;
  [key: string]: any;
}

export interface RoomHoldCandidate {
  id?: string;
  status?: string;
  expiresAt?: string | Date | null;
  [key: string]: any;
}

export interface ContractCandidate {
  id?: string;
  status?: string;
  deletedAt?: string | Date | null;
  roomId?: string;
  endDate?: string | Date | null;
  startDate?: string | Date | null;
  [key: string]: any;
}

export const ACTIVE_CONTRACT_STATUSES = new Set([
  "ACTIVE",
  "APPROVED",
  "EXPIRING",
]);

export const PENDING_CONTRACT_STATUSES = new Set([
  "DRAFT",
  "PENDING_APPROVAL",
]);

export const TERMINAL_CONTRACT_STATUSES = new Set([
  "EXPIRED",
  "TERMINATED",
  "CANCELLED",
  "DELETED",
]);

export function isActiveContract(contract: ContractCandidate | null | undefined): boolean {
  if (!contract || contract.deletedAt) return false;
  const status = String(contract.status || "").toUpperCase();
  return ACTIVE_CONTRACT_STATUSES.has(status);
}

export function isNonTerminalContract(contract: ContractCandidate | null | undefined): boolean {
  if (!contract || contract.deletedAt) return false;
  const status = String(contract.status || "").toUpperCase();
  return !TERMINAL_CONTRACT_STATUSES.has(status);
}

export function hasOpenOccupancy(occupancies: RoomOccupancyCandidate[] | null | undefined): boolean {
  if (!Array.isArray(occupancies) || occupancies.length === 0) return false;
  return occupancies.some((occ) => !occ.leftAt && occ.status !== "TERMINATED" && occ.status !== "CANCELLED");
}

export function hasActiveHold(holds: RoomHoldCandidate[] | null | undefined, asOf: Date = new Date()): boolean {
  if (!Array.isArray(holds) || holds.length === 0) return false;
  const nowTime = asOf.getTime();
  return holds.some((h) => {
    if (String(h.status).toUpperCase() !== "ACTIVE") return false;
    if (!h.expiresAt) return true;
    const expTime = new Date(h.expiresAt).getTime();
    return !Number.isNaN(expTime) && expTime > nowTime;
  });
}

/**
 * Pure adapter to compute authoritative Room UI status.
 * Order of precedence:
 * 1. MAINTENANCE status -> "maintenance"
 * 2. Active contract (ACTIVE, APPROVED, EXPIRING) -> "occupied"
 * 3. Open occupancy (!leftAt) -> "occupied"
 * 4. Active hold (ACTIVE and not expired) -> "deposited"
 * 5. RESERVED status with valid hold -> "deposited"
 * 6. Everything else (AVAILABLE, CLEANING, expired/terminated contracts, historical roommates without open occupancy) -> "vacant"
 */
export function getRoomUiStatus(room: any, asOf: Date = new Date()): RoomUiStatus {
  if (!room) return "vacant";

  const rawStatus = String(room.status || "").toUpperCase();
  if (rawStatus === "MAINTENANCE") {
    return "maintenance";
  }

  // 1. Check contracts
  const contracts: ContractCandidate[] = [
    ...(room.contract ? [room.contract] : []),
    ...(Array.isArray(room.contracts) ? room.contracts : []),
  ];
  const activeContract = contracts.find((c) => isActiveContract(c));
  if (activeContract) {
    return "occupied";
  }

  // 2. Check open occupancies
  const occupancies: RoomOccupancyCandidate[] = [
    ...(Array.isArray(room.occupancies) ? room.occupancies : []),
  ];
  if (hasOpenOccupancy(occupancies)) {
    return "occupied";
  }

  // 3. Check active room holds
  const holds: RoomHoldCandidate[] = [
    ...(Array.isArray(room.holds) ? room.holds : []),
    ...(Array.isArray(room.roomHolds) ? room.roomHolds : []),
  ];
  if (hasActiveHold(holds, asOf)) {
    return "deposited";
  }

  // 4. Raw RESERVED status if hold data is not populated but status is explicitly RESERVED
  if (rawStatus === "RESERVED" && (!room.holds || room.holds.length === 0)) {
    return "deposited";
  }

  // 5. Default is vacant (AVAILABLE, CLEANING, or rooms with only expired/terminated history)
  return "vacant";
}

export type TenantRentalStatus = "ACTIVE" | "EXPIRING" | "EXPIRED" | "DRAFT" | "TERMINATED" | "NO_CONTRACT";

export interface TenantRentalStatusResult {
  status: TenantRentalStatus;
  statusLabel: string;
  statusVariant: "success" | "warning" | "error" | "neutral" | "primary";
}

/**
 * Pure adapter to compute authoritative Tenant rental status.
 */
export function getTenantRentalStatus(
  customer: any,
  customerContracts: ContractCandidate[] = [],
  asOf: Date = new Date()
): TenantRentalStatusResult {
  if (!customer) {
    return { status: "NO_CONTRACT", statusLabel: "Chưa thuê", statusVariant: "neutral" };
  }

  const contracts = [
    ...(Array.isArray(customerContracts) ? customerContracts : []),
    ...(Array.isArray(customer.contracts) ? customer.contracts : []),
  ].filter((c) => !c.deletedAt);

  const activeContract = contracts.find((c) => isNonTerminalContract(c));
  const latestTerminatedContract = contracts.find((c) => {
    const s = String(c.status || "").toUpperCase();
    return TERMINAL_CONTRACT_STATUSES.has(s);
  });

  const occupancies: RoomOccupancyCandidate[] = Array.isArray(customer.occupancies)
    ? customer.occupancies
    : [];
  const openOccupancy = occupancies.find((occ) => !occ.leftAt);

  if (activeContract) {
    const s = String(activeContract.status || "").toUpperCase();
    if (s === "ACTIVE" || s === "APPROVED") {
      if (activeContract.endDate) {
        const endTime = new Date(activeContract.endDate).getTime();
        const nowTime = asOf.getTime();
        const daysLeft = Math.ceil((endTime - nowTime) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0 && daysLeft <= 30) {
          return { status: "EXPIRING", statusLabel: "Sắp hết HĐ", statusVariant: "warning" };
        }
        if (daysLeft <= 0) {
          return { status: "EXPIRED", statusLabel: "Hết hạn HĐ", statusVariant: "error" };
        }
      }
      return { status: "ACTIVE", statusLabel: "Đang thuê", statusVariant: "success" };
    }
    if (s === "EXPIRING") {
      return { status: "EXPIRING", statusLabel: "Sắp hết HĐ", statusVariant: "warning" };
    }
    if (s === "DRAFT" || s === "PENDING_APPROVAL") {
      return { status: "DRAFT", statusLabel: "Chờ ký HĐ", statusVariant: "primary" };
    }
  }

  if (openOccupancy) {
    return { status: "ACTIVE", statusLabel: "Ở ghép", statusVariant: "success" };
  }

  if (latestTerminatedContract) {
    return { status: "TERMINATED", statusLabel: "Đã trả phòng", statusVariant: "neutral" };
  }

  return { status: "NO_CONTRACT", statusLabel: "Chưa thuê", statusVariant: "neutral" };
}
