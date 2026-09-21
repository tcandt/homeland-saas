import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { InvoicesService } from "../invoices/invoices.service";
import { CommunicationService } from "../communication/communication.service";
import { HunonicService } from "../hunonic/hunonic.service";
import { AuditService } from "../shared/audit/audit.service";
import { NotificationChannel } from "../automation/automation.constants";
import {
  InvoiceItemType,
  InvoiceStatus,
  Prisma,
  SettingScope,
} from "@prisma/client";
import {
  ACTIVE_LIKE_CONTRACT_STATUSES,
  TERMINAL_CONTRACT_STATUSES,
} from "../contracts/contracts.adapter";
import { createHash } from "node:crypto";

export interface MonthlySettlementSettings {
  autoCloseEnabled: boolean;
  closingDay: "LAST_DAY" | number; // 'LAST_DAY' hoặc ngày 25, 28, 30...
  autoSendNotification: boolean;
  notificationHour: number; // Mặc định 8 (08:00 AM)
  notificationMinute: number; // Mặc định 0
  notificationDay: number; // Mặc định 1 (ngày 01 đầu tháng mới)
  notificationChannel: "ZALO" | "SMS" | "ALL";
  updatedAt?: string;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toPositiveFiniteNumber(value: unknown): number | null {
  const number = numberOrNull(value);
  return number !== null && number > 0 ? number : null;
}

export const DEFAULT_SETTLEMENT_SETTINGS: MonthlySettlementSettings = {
  autoCloseEnabled: true,
  closingDay: "LAST_DAY",
  autoSendNotification: true,
  notificationHour: 8,
  notificationMinute: 0,
  notificationDay: 1,
  notificationChannel: "ZALO",
};

// Helper tính toán theo múi giờ Việt Nam (GMT+7)
export function getVietnamDate(date = new Date()): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utc + 7 * 3600000);
}

export function formatVietnamPeriod(date = new Date()): string {
  const vn = getVietnamDate(date);
  const y = vn.getFullYear();
  const m = String(vn.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function assertValidBillingPeriod(period: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || ""))) {
    throw new BadRequestException("BILLING_PERIOD_INVALID");
  }
  return period;
}

export function getPreviousVietnamPeriod(period: string): string {
  assertValidBillingPeriod(period);
  const [yStr, mStr] = period.split("-");
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function getNextVietnamPeriod(period: string): string {
  assertValidBillingPeriod(period);
  const [yStr, mStr] = period.split("-");
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10) + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function isLastDayOfVietnamMonth(date = new Date()): boolean {
  const vn = getVietnamDate(date);
  const tomorrow = new Date(vn);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getMonth() !== vn.getMonth();
}

export function getPeriodBounds(period: string): {
  start: Date;
  end: Date;
  year: number;
  month: number;
} {
  assertValidBillingPeriod(period);
  const [yStr, mStr] = period.split("-");
  const year = parseInt(yStr, 10);
  const month = parseInt(mStr, 10);
  // 00:00 tại Việt Nam (UTC+7) là 17:00 UTC của ngày liền trước.
  // Dùng UTC instant tường minh để kết quả không phụ thuộc timezone của process.
  const start = new Date(Date.UTC(year, month - 1, 1, -7, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, -7, 0, 0, 0) - 1);
  return { start, end, year, month };
}

/** The billing UI still exposes an inclusive end for display, but settlement
 * decisions are made against this explicit UTC+7 half-open interval. */
export function getHalfOpenPeriodBounds(period: string): {
  start: Date;
  nextStart: Date;
} {
  const { start } = getPeriodBounds(period);
  return { start, nextStart: getPeriodBounds(getNextVietnamPeriod(period)).start };
}

export type SettlementIssue = {
  code: string;
  message: string;
  contractId?: string;
  customerId?: string;
  occupancyId?: string;
};

type CanonicalOccupancyMember = {
  id: string;
  tenantId?: string | null;
  fullName?: string;
  phone?: string | null;
  identityNo?: string | null;
  gender?: string | null;
  zaloPhone?: string | null;
  zaloChatId?: string | null;
  zaloUserId?: string | null;
  hasZalo?: boolean;
  role?: string;
  isRepresentative?: boolean;
  relationship?: string;
  createdAt?: Date | string | null;
  occupancyId?: string | null;
};

export type CanonicalOccupancyResolution = {
  byContractId: Map<
    string,
    { members: CanonicalOccupancyMember[]; membersCount: number; eligibility: boolean }
  >;
  blockers: SettlementIssue[];
  warnings: SettlementIssue[];
  source: "OCCUPANCY";
};

function isPositiveOverlap(
  joinedAt: unknown,
  leftAt: unknown,
  periodStart: Date,
  nextPeriodStart: Date,
) {
  const joined = new Date(joinedAt as any);
  const left = leftAt == null ? null : new Date(leftAt as any);
  return (
    !Number.isNaN(joined.getTime()) &&
    (!left || !Number.isNaN(left.getTime())) &&
    joined < nextPeriodStart &&
    (!left || left > periodStart)
  );
}

/**
 * The sole financial headcount authority. Contract parties, roommates and
 * cached memberCount deliberately do not enter this calculation.
 */
export function resolveCanonicalRoomPeriodOccupancy(input: {
  tenantId?: string;
  rentalType: string;
  contracts: any[];
  occupancies: any[];
  periodStart: Date;
  nextPeriodStart: Date;
  eligibilityByContractId?: Map<string, boolean>;
  /** Relevant live/terminal contracts used only to reject legacy unbound WHOLE occupancy. */
  wholeUnboundContractCount?: number;
}): CanonicalOccupancyResolution {
  const blockers: SettlementIssue[] = [];
  const warnings: SettlementIssue[] = [];
  const byContractId = new Map<string, {
    members: CanonicalOccupancyMember[];
    membersCount: number;
    eligibility: boolean;
  }>();
  const contractsById = new Map(input.contracts.map((contract) => [contract.id, contract]));
  const isShared = input.rentalType === "SHARED";

  for (const contract of input.contracts) {
    if (input.tenantId && contract.tenantId && contract.tenantId !== input.tenantId) {
      blockers.push({
        code: "CONTRACT_TENANT_MISMATCH",
        message: "Hợp đồng không thuộc tenant đang được chốt.",
        contractId: contract.id,
      });
    }
    if (
      input.tenantId &&
      contract.customer?.tenantId &&
      contract.customer.tenantId !== input.tenantId
    ) {
      blockers.push({
        code: "CONTRACT_CUSTOMER_TENANT_MISMATCH",
        message: "Khách payer của hợp đồng không thuộc tenant đang được chốt.",
        contractId: contract.id,
        customerId: contract.customer?.id,
      });
    }
    byContractId.set(contract.id, {
      members: [],
      membersCount: 0,
      eligibility: input.eligibilityByContractId?.get(contract.id) ?? true,
    });
  }

  const memberContractIds = new Map<string, Set<string>>();
  for (const occupancy of input.occupancies || []) {
    if (input.tenantId && occupancy.tenantId && occupancy.tenantId !== input.tenantId) {
      blockers.push({
        code: "OCCUPANCY_TENANT_MISMATCH",
        message: "Occupancy không thuộc tenant đang được chốt.",
        occupancyId: occupancy.id,
        customerId: occupancy.customerId || undefined,
      });
      continue;
    }
    const joined = new Date(occupancy.joinedAt);
    const left = occupancy.leftAt == null ? null : new Date(occupancy.leftAt);
    if (
      Number.isNaN(joined.getTime()) ||
      (left && Number.isNaN(left.getTime())) ||
      (left && left <= joined)
    ) {
      blockers.push({
        code: "OCCUPANCY_INTERVAL_INVALID",
        message: "Khoảng thời gian ở không hợp lệ.",
        occupancyId: occupancy.id,
      });
      continue;
    }
    if (!isPositiveOverlap(occupancy.joinedAt, occupancy.leftAt, input.periodStart, input.nextPeriodStart)) {
      continue;
    }
    if (!occupancy.customerId || !occupancy.customer?.id || occupancy.customer.id !== occupancy.customerId) {
      blockers.push({
        code: "OCCUPANCY_CUSTOMER_INVALID",
        message: "Occupancy không có khách thuê hợp lệ.",
        occupancyId: occupancy.id,
      });
      continue;
    }
    // Real Customer rows always carry tenantId.  Preserve compatibility with
    // legacy in-memory rows that omit it, but never count a known foreign
    // customer merely because the Occupancy record itself names this tenant.
    if (
      input.tenantId &&
      occupancy.customer.tenantId != null &&
      occupancy.customer.tenantId !== input.tenantId
    ) {
      blockers.push({
        code: "OCCUPANCY_CUSTOMER_TENANT_MISMATCH",
        message: "Khách của Occupancy không thuộc tenant đang được chốt.",
        occupancyId: occupancy.id,
        customerId: occupancy.customerId,
      });
      continue;
    }

    let contractId = occupancy.contractId || null;
    if (isShared && !contractId) {
      blockers.push({
        code: "SHARED_OCCUPANCY_CONTRACT_REQUIRED",
        message: "Phòng ghép yêu cầu Occupancy gắn đúng hợp đồng.",
        occupancyId: occupancy.id,
        customerId: occupancy.customerId,
      });
      continue;
    }
    if (!isShared && !contractId && (input.wholeUnboundContractCount ?? input.contracts.length) > 1) {
      // A legacy WHOLE-room occupancy without a contract cannot be attributed
      // after a terminal/replacement contract exists.  Guessing the active
      // contract risks charging the same room usage twice.
      blockers.push({
        code: "WHOLE_UNBOUND_OCCUPANCY_AMBIGUOUS",
        message: "Occupancy phòng nguyên căn chưa gắn hợp đồng khi có nhiều hợp đồng liên quan trong kỳ.",
        occupancyId: occupancy.id,
        customerId: occupancy.customerId,
      });
      continue;
    }
    if (!isShared && !contractId && input.contracts.length === 1) {
      contractId = input.contracts[0].id;
    }
    if (!contractId || !contractsById.has(contractId)) {
      blockers.push({
        code: "OCCUPANCY_CROSS_CONTRACT",
        message: "Occupancy không thuộc hợp đồng đang được chốt.",
        occupancyId: occupancy.id,
        customerId: occupancy.customerId,
        contractId: occupancy.contractId || undefined,
      });
      continue;
    }

    const bucket = byContractId.get(contractId)!;
    if (!bucket.eligibility) {
      blockers.push({
        code: "INELIGIBLE_CONTRACT_HAS_OCCUPANCY",
        message: "Hợp đồng không đủ điều kiện utility không thể có Occupancy tính trong kỳ.",
        contractId,
        customerId: occupancy.customerId,
        occupancyId: occupancy.id,
      });
      continue;
    }
    if (!bucket.members.some((member) => member.id === occupancy.customerId)) {
      const customer = occupancy.customer;
      bucket.members.push({
        id: customer.id,
        tenantId: customer.tenantId || occupancy.tenantId || null,
        fullName: customer.fullName,
        phone: customer.phone || null,
        identityNo: customer.identityNo || null,
        gender: customer.gender || null,
        zaloPhone: customer.zaloPhone || null,
        zaloChatId: customer.zaloChatId || null,
        zaloUserId: customer.zaloUserId || null,
        hasZalo: !!(customer.zaloChatId || customer.zaloUserId),
        role: occupancy.role || "THÀNH VIÊN Ở CÙNG",
        isRepresentative:
          customer.id ===
          (contractsById.get(contractId)?.customerId ||
            contractsById.get(contractId)?.customer?.id),
        relationship: occupancy.role || "Khách ở cùng",
        createdAt: occupancy.joinedAt,
        occupancyId: occupancy.id,
      });
    }
    const assignedContracts = memberContractIds.get(occupancy.customerId) || new Set<string>();
    assignedContracts.add(contractId);
    memberContractIds.set(occupancy.customerId, assignedContracts);
  }

  for (const [customerId, contractIds] of memberContractIds) {
    if (contractIds.size > 1) {
      blockers.push({
        code: "OCCUPANT_ASSIGNED_TO_MULTIPLE_CONTRACTS",
        message: "Một khách không thể được tính cho nhiều hợp đồng trong cùng kỳ.",
        customerId,
      });
    }
  }
  for (const contract of input.contracts) {
    const bucket = byContractId.get(contract.id)!;
    bucket.members.sort((left, right) => left.id.localeCompare(right.id));
    bucket.membersCount = bucket.eligibility ? bucket.members.length : 0;
    if (bucket.membersCount === 0 && bucket.eligibility) {
      blockers.push({
        code: "OCCUPANCY_REQUIRED",
        message: "Hợp đồng cần ít nhất một Occupancy hợp lệ trong kỳ.",
        contractId: contract.id,
      });
    }
    if (Number.isFinite(Number(contract.memberCount)) && Number(contract.memberCount) !== bucket.membersCount) {
      warnings.push({
        code: "CONTRACT_MEMBER_COUNT_MISMATCH",
        message: "memberCount của hợp đồng khác số người ở thực tế; chỉ Occupancy được dùng để tính tiền.",
        contractId: contract.id,
      });
    }
  }
  return { byContractId, blockers, warnings, source: "OCCUPANCY" };
}

function resolveLockedSnapshotOccupancy(
  snapshot: any,
  contracts: any[],
): Omit<CanonicalOccupancyResolution, "source"> & { source: "LOCKED_SNAPSHOT" } {
  const blockers: SettlementIssue[] = [];
  const warnings: SettlementIssue[] = [];
  const allocations = Array.isArray(snapshot?.allocations) ? snapshot.allocations : [];
  const occupants = Array.isArray(snapshot?.occupants) ? snapshot.occupants : [];
  // Explicit policyVersion is authoritative.  A short-lived pre-release v2
  // writer emitted tenant identity fields before the version marker; treat
  // those records as v2 too so they cannot silently downgrade validation.
  const isCore07V2 = snapshot?.policyVersion === "CORE-07-v2" ||
    allocations.some((allocation: any) => allocation?.payerSnapshot?.tenantId != null) ||
    occupants.some((occupant: any) => occupant?.tenantId != null);
  const byContractId = new Map<string, any>();
  const toScaledUnits = (value: unknown, scale: number): number | null => {
    if (
      value === null ||
      value === undefined ||
      (typeof value === "string" && value.trim() === "")
    ) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) return null;
    const scaled = numeric * scale;
    const units = Math.round(scaled);
    return Number.isSafeInteger(units) && Math.abs(scaled - units) <= 1e-8
      ? units
      : null;
  };
  const uniqueOccupants = new Set<string>();
  for (const occupant of occupants) {
    const id = occupant?.customerId || occupant?.id;
    if (!id || uniqueOccupants.has(id)) {
      blockers.push({ code: "LOCKED_SNAPSHOT_OCCUPANTS_INVALID", message: "Snapshot có danh sách người ở không hợp lệ.", customerId: id || undefined });
      continue;
    }
    uniqueOccupants.add(id);
    if (isCore07V2 && occupant?.tenantId !== snapshot?.tenantId) {
      blockers.push({
        code: "LOCKED_SNAPSHOT_OCCUPANT_TENANT_INVALID",
        message: "Occupant snapshot CORE-07-v2 phải thuộc đúng tenant của snapshot.",
        customerId: id,
      });
    }
  }
  const allocationsByContractId = new Map<string, any>();
  for (const allocation of allocations) {
    if (!allocation?.contractId || allocationsByContractId.has(allocation.contractId)) {
      blockers.push({ code: "LOCKED_SNAPSHOT_ALLOCATIONS_INVALID", message: "Snapshot có phân bổ hợp đồng không hợp lệ.", contractId: allocation?.contractId });
      continue;
    }
    allocationsByContractId.set(allocation.contractId, allocation);
  }
  for (const occupant of occupants) {
    const id = occupant?.customerId || occupant?.id;
    if (
      !id ||
      !occupant?.contractId ||
      !allocationsByContractId.has(occupant.contractId)
    ) {
      blockers.push({
        code: "LOCKED_SNAPSHOT_OCCUPANTS_INVALID",
        message: "Snapshot có người ở không thuộc một allocation hợp lệ.",
        customerId: id || undefined,
      });
    }
  }
  for (const contract of contracts) {
    const allocation = allocationsByContractId.get(contract.id);
    const memberCount = Number(allocation?.memberCount);
    const eligibility = allocation?.eligible !== false;
    if (
      !allocation ||
      allocation.memberCount === null ||
      allocation.memberCount === undefined ||
      !Number.isInteger(memberCount) ||
      memberCount < 0 ||
      (eligibility && memberCount < 1)
    ) {
      blockers.push({ code: "LOCKED_SNAPSHOT_ALLOCATIONS_INVALID", message: "Snapshot thiếu phân bổ headcount hợp lệ cho hợp đồng.", contractId: contract.id });
      byContractId.set(contract.id, { members: [], membersCount: 0, eligibility: false });
      continue;
    }
    const members = occupants
      .filter((occupant: any) => occupant?.contractId === contract.id)
      .map((occupant: any) => ({
        id: occupant.customerId || occupant.id,
        fullName: occupant.fullName,
        role: occupant.role,
        occupancyId: occupant.occupancyId || null,
        isRepresentative:
          (occupant.customerId || occupant.id) ===
          (allocation.payerSnapshot?.id || allocation.customerId || contract.customerId),
      }));
    const waterUnits = toScaledUnits(allocation.waterAmount, 100);
    const electricityKwhUnits = toScaledUnits(allocation.electricityKwh, 1000);
    const electricityAmountUnits = toScaledUnits(allocation.electricityAmount, 100);
    const payer = allocation.payerSnapshot;
    if (
      (isCore07V2 && !payer) ||
      (payer && (
        typeof payer.id !== "string" ||
        payer.id.length === 0 ||
        typeof payer.fullName !== "string" ||
        payer.fullName.trim().length === 0 ||
        (allocation.customerId != null && allocation.customerId !== payer.id) ||
        (isCore07V2 && payer.tenantId !== snapshot?.tenantId)
      ))
    ) {
      blockers.push({
        code: "LOCKED_SNAPSHOT_PAYER_INVALID",
        message: "payerSnapshot CORE-07-v2 phải có id/fullName/tenantId hợp lệ và khớp customerId allocation.",
        contractId: contract.id,
      });
    }
    if (members.length !== memberCount) {
      blockers.push({ code: "LOCKED_SNAPSHOT_MEMBER_COUNT_INVALID", message: "Snapshot không khớp danh sách người ở và memberCount.", contractId: contract.id });
    }
    if (
      waterUnits === null ||
      electricityKwhUnits === null ||
      electricityAmountUnits === null ||
      (!eligibility &&
        (memberCount !== 0 || members.length !== 0 || waterUnits !== 0 || electricityKwhUnits !== 0 || electricityAmountUnits !== 0)) ||
      (eligibility && waterUnits !== memberCount * 100000 * 100)
    ) {
      blockers.push({
        code: "LOCKED_SNAPSHOT_ALLOCATION_TOTALS_INVALID",
        message: "Allocation snapshot không khớp điều kiện, headcount hoặc utility bất biến.",
        contractId: contract.id,
      });
    }
    byContractId.set(contract.id, {
      members,
      membersCount: memberCount,
      eligibility,
    });
  }
  const eligibleCount = Array.from(byContractId.values())
    .filter((allocation: any) => allocation.eligibility)
    .reduce((sum: number, allocation: any) => sum + allocation.membersCount, 0);
  const sumScaledUnits = (field: string, scale: number): number | null => {
    let total = 0;
    for (const allocation of allocations) {
      const units = toScaledUnits(allocation?.[field], scale);
      if (units === null || !Number.isSafeInteger(total + units)) return null;
      total += units;
    }
    return total;
  };
  const snapshotWaterUnits = toScaledUnits(snapshot?.waterAmount, 100);
  const snapshotKwhUnits = toScaledUnits(snapshot?.usageKwh, 1000);
  const snapshotElectricityUnits = toScaledUnits(snapshot?.electricityAmount, 100);
  const allocationWaterUnits = sumScaledUnits("waterAmount", 100);
  const allocationKwhUnits = sumScaledUnits("electricityKwh", 1000);
  const allocationElectricityUnits = sumScaledUnits("electricityAmount", 100);
  const snapshotOccupantCount = Number(snapshot?.occupantCount);
  if (
    snapshot?.occupantCount === null ||
    snapshot?.occupantCount === undefined ||
    uniqueOccupants.size !== snapshotOccupantCount ||
    !Number.isSafeInteger(snapshotOccupantCount) ||
    snapshotOccupantCount < 0 ||
    snapshotWaterUnits === null ||
    snapshotKwhUnits === null ||
    snapshotElectricityUnits === null ||
    allocationWaterUnits === null ||
    allocationKwhUnits === null ||
    allocationElectricityUnits === null ||
    snapshotWaterUnits !== eligibleCount * 100000 * 100 ||
    snapshotWaterUnits !== allocationWaterUnits ||
    snapshotKwhUnits !== allocationKwhUnits ||
    snapshotElectricityUnits !== allocationElectricityUnits
  ) {
    blockers.push({ code: "LOCKED_SNAPSHOT_TOTALS_INVALID", message: "Tổng headcount hoặc utility của snapshot không nhất quán." });
  }
  return { byContractId, blockers, warnings, source: "LOCKED_SNAPSHOT" };
}

function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Chia một tổng theo trọng số và phân bổ phần lẻ theo thứ tự ổn định.
 * Kết quả luôn cộng lại đúng bằng tổng sau khi làm tròn ở độ chính xác yêu cầu.
 */
export function allocateDeterministically(
  total: number,
  weights: number[],
  decimals = 2,
): number[] {
  if (!Number.isFinite(total) || total < 0) {
    throw new BadRequestException("Tổng cần phân bổ phải là số không âm.");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) {
    throw new BadRequestException("Độ chính xác phân bổ không hợp lệ.");
  }
  if (weights.length === 0) return [];

  const normalizedWeights = weights.map((weight) =>
    Number.isFinite(weight) && weight > 0 ? weight : 0,
  );
  const totalWeight = normalizedWeights.reduce(
    (sum, weight) => sum + weight,
    0,
  );
  if (totalWeight <= 0) {
    throw new BadRequestException("Tổng trọng số phân bổ phải lớn hơn 0.");
  }

  const scale = 10 ** decimals;
  const totalUnits = Math.round(total * scale);
  const rawUnits = normalizedWeights.map(
    (weight) => (totalUnits * weight) / totalWeight,
  );
  const allocatedUnits = rawUnits.map((value) => Math.floor(value));
  let remainder =
    totalUnits - allocatedUnits.reduce((sum, value) => sum + value, 0);

  const remainderOrder = rawUnits
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort(
      (left, right) =>
        right.remainder - left.remainder || left.index - right.index,
    );

  for (let index = 0; index < remainder; index += 1) {
    allocatedUnits[remainderOrder[index % remainderOrder.length].index] += 1;
  }

  return allocatedUnits.map((value) => value / scale);
}

function sanitizeInvoiceCodePart(value: string): string {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9-]/g, "")
    .slice(0, 32);
}

function stableSnapshotJson(value: any): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableSnapshotJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSnapshotJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashSnapshotSource(value: unknown): string {
  return createHash("sha256").update(stableSnapshotJson(value)).digest("hex");
}

function billingEvidenceLockKey(tenantId: string, roomId: string, usagePeriod: string): string {
  return `${tenantId}:billing-evidence:${roomId}:${usagePeriod}`;
}

export function buildSettlementRunIdentity(
  period: string,
  input: { roomIds?: string[]; autoSend?: boolean },
) {
  const roomIds = Array.from(new Set(input.roomIds || [])).sort();
  const scopeKey =
    roomIds.length > 0
      ? `ROOMS:${createHash("sha256").update(roomIds.join(":")).digest("hex").slice(0, 24)}`
      : "ALL";
  const requestHash = hashSnapshotSource({
    period,
    roomIds,
    autoSend: Boolean(input.autoSend),
  });
  return {
    scopeKey,
    requestHash,
    idempotencyKey: `monthly-close:${period}:${scopeKey}`,
  };
}

function buildMonthlyInvoiceCode(
  period: string,
  roomCode: string,
  contract: any,
  isSharedRoom: boolean,
): string {
  const periodPart = period.replace("-", "");
  if (!isSharedRoom) {
    return `INV-${periodPart}-${roomCode}`;
  }

  const contractPart = sanitizeInvoiceCodePart(
    contract?.code || contract?.id || "SHARED",
  );
  return `INV-${periodPart}-${roomCode}-${contractPart}`;
}

function assertSettlementScopeUnambiguous(items: any[]) {
  const blockers = items.flatMap((item) =>
    (Array.isArray(item.settlementBlockers) ? item.settlementBlockers : []).map(
      (blocker: SettlementIssue) => ({ ...blocker, roomId: item.roomId, roomCode: item.roomCode }),
    ),
  );
  if (blockers.length === 0) return;
  const terminal = blockers.find(
    (blocker: SettlementIssue) =>
      blocker.code === "TERMINAL_CONTRACT_REQUIRES_FINAL_SETTLEMENT",
  );
  const reason = terminal?.code || blockers[0]?.code || "OCCUPANCY_RESOLUTION_BLOCKED";
  throw new ConflictException({
    message: reason,
    code: "MONTHLY_SETTLEMENT_OCCUPANCY_AMBIGUOUS",
    reason,
    blockers,
  });
}

@Injectable()
export class MonthlySettlementService {
  private readonly logger = new Logger(MonthlySettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
    private readonly invoicesService: InvoicesService,
    private readonly communicationService: CommunicationService,
    private readonly hunonicService: HunonicService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Lấy cấu hình tự động chốt & gửi thông báo
   */
  async getSettings(tenantId: string): Promise<MonthlySettlementSettings> {
    const record = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: "monthly-settlement-config",
        },
      },
    });

    if (!record || !record.value) {
      return DEFAULT_SETTLEMENT_SETTINGS;
    }

    return {
      ...DEFAULT_SETTLEMENT_SETTINGS,
      ...(record.value as any),
    };
  }

  /**
   * Lưu cấu hình tự động chốt & gửi thông báo
   */
  async saveSettings(
    tenantId: string,
    settings: Partial<MonthlySettlementSettings>,
  ): Promise<MonthlySettlementSettings> {
    const current = await this.getSettings(tenantId);
    const updated: MonthlySettlementSettings = {
      ...current,
      ...settings,
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.appSetting.upsert({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: "monthly-settlement-config",
        },
      },
      update: { value: updated as any },
      create: {
        tenantId,
        scope: SettingScope.TENANT,
        ownerId: tenantId,
        key: "monthly-settlement-config",
        value: updated as any,
      },
    });

    return updated;
  }

  /**
   * Lấy dữ liệu tổng hợp chốt tháng cho toàn bộ các phòng
   * Logic nghiệp vụ:
   * - Kỳ thanh toán: Tháng M (Billing Month)
   * - Kỳ sử dụng: Tháng M-1 (Usage Month)
   * - Tiền phòng + Tiền nước: Tính cho kỳ tháng M (Prepaid / Current Month)
   * - Tiền điện + Phí dịch vụ: Tính cho kỳ sử dụng tháng M-1 (Postpaid / Previous Usage Month)
   * - Khách mới ký hợp đồng vào ở từ tháng M (startDate/moveInDate >= 01/M) sẽ KHÔNG bị tính tiền điện/dịch vụ tháng M-1.
   */
  async getOverview(
    tenantId: string,
    query: {
      period?: string;
      buildingId?: string;
      search?: string;
      notificationStatus?: string;
      paymentStatus?: string;
    },
  ) {
    const period = query.period || formatVietnamPeriod();
    const usagePeriod = getPreviousVietnamPeriod(period);

    // 1. Lấy danh sách các tòa nhà
    const buildings = await this.prisma.building.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true, code: true },
      orderBy: { displayOrder: "asc" },
    });

    // 2. Lấy dữ liệu Hunonic Overview để trích xuất chỉ số điện từng phòng
    let hunonicMeters: any[] = [];
    try {
      const hunonicOverview = await this.hunonicService.getOverview(tenantId, {
        allowAutoLock: false,
      });
      hunonicMeters = hunonicOverview?.meters || [];
    } catch (e: any) {
      this.logger.warn(
        `Could not load Hunonic overview for tenant ${tenantId}: ${e?.message}`,
      );
    }

    // A room code is only unique inside a building.  Never fall back to the
    // room-code-only key or another building can receive this room's meter.
    const meterMap = new Map<string, any>();
    for (const m of hunonicMeters) {
      if (m.buildingCode && m.roomCode) {
        meterMap.set(`${m.buildingCode}::${m.roomCode}`, m);
      }
    }

    // 3. Lấy danh sách tất cả các phòng cùng các hợp đồng
    const roomWhere: any = {
      tenantId,
      deletedAt: null,
    };
    if (query.buildingId && query.buildingId !== "ALL") {
      roomWhere.buildingId = query.buildingId;
    }

    const rooms = await this.prisma.room.findMany({
      where: roomWhere,
      include: {
        building: { select: { id: true, name: true, code: true } },
        floor: { select: { id: true, name: true, level: true } },
        contracts: {
          include: {
            customer: true,
            settlement: true,
          },
          orderBy: { startDate: "desc" },
        },
        occupancies: {
          where: {
            tenantId,
            // Deliberately load every occupancy which could have started by
            // the next UTC+7 boundary. The resolver validates malformed
            // intervals instead of allowing SQL overlap filters to hide them.
            joinedAt: { lt: getHalfOpenPeriodBounds(usagePeriod).nextStart },
          },
          include: { customer: true },
          orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ building: { displayOrder: "asc" } }, { code: "asc" }],
    });

    const roomIds = rooms.map((room) => room.id);
    const prismaAny = this.prisma as any;
    const [lockedSnapshots, persistedReadings] = await Promise.all([
      prismaAny.billingSnapshot?.findMany
        ? prismaAny.billingSnapshot.findMany({
            where: {
              tenantId,
              usagePeriod,
              roomId: { in: roomIds },
              status: "LOCKED",
            },
            orderBy: [{ lockedAt: "desc" }, { createdAt: "desc" }],
          })
        : Promise.resolve([]),
      prismaAny.hunonicMeterReading?.findMany
        ? prismaAny.hunonicMeterReading.findMany({
            where: {
              tenantId,
              sourcePeriod: usagePeriod,
              roomId: { in: roomIds },
            },
            include: { meterMapping: true },
            orderBy: [{ readingAt: "desc" }, { createdAt: "desc" }],
          })
        : Promise.resolve([]),
    ]);
    const snapshotByRoomId = new Map<string, any>();
    for (const snapshot of lockedSnapshots) {
      if (!snapshotByRoomId.has(snapshot.roomId))
        snapshotByRoomId.set(snapshot.roomId, snapshot);
    }
    const persistedReadingByRoomId = new Map<string, any>();
    const persistedReadingByRoomAndMapping = new Map<string, any>();
    const latestEvidenceByRoomId = new Map<string, any>();
    for (const reading of persistedReadings) {
      if (reading.roomId && !latestEvidenceByRoomId.has(reading.roomId)) {
        latestEvidenceByRoomId.set(reading.roomId, reading);
      }
      if (reading.aggregateBasis !== "MONTHLY_AGGREGATE_V1") {
        continue;
      }
      if (reading.roomId && !persistedReadingByRoomId.has(reading.roomId)) {
        persistedReadingByRoomId.set(reading.roomId, reading);
      }
      if (reading.roomId && reading.meterMappingId) {
        const key = `${reading.roomId}:${reading.meterMappingId}`;
        if (!persistedReadingByRoomAndMapping.has(key)) {
          persistedReadingByRoomAndMapping.set(key, reading);
        }
      }
    }

    // 4. Lấy tất cả hóa đơn của kỳ này
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        deletedAt: null,
        billingKind: "MONTHLY_BASE",
        period,
      },
      include: {
        items: true,
        customer: true,
        contract: {
          include: {
            room: {
              include: { building: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Only canonical MONTHLY_BASE documents are projections. Manual entries,
    // adjustments and code-shaped lookalikes never influence settlement truth.
    const invoiceByRoomId = new Map<string, any>();
    const invoiceByContractId = new Map<string, any>();
    for (const inv of invoices) {
      const invRoomId = inv.contract?.roomId || (inv as any).roomId;
      const invContractId = inv.contractId || inv.contract?.id;
      if (
        invRoomId &&
        invContractId &&
        inv.baseInvoiceKey === `MONTHLY:${invContractId}:${period}`
      ) {
        if (!invoiceByRoomId.has(invRoomId)) {
          invoiceByRoomId.set(invRoomId, inv);
        }
        if (invContractId && !invoiceByContractId.has(invContractId)) {
          invoiceByContractId.set(invContractId, inv);
        }
      }
    }

    // 5. Lấy danh sách thông báo đã gửi cho các hóa đơn kỳ này
    const notifications = await this.prisma.notification.findMany({
      where: {
        tenantId,
        type: "INVOICE_ZALO_PAYMENT_REQUEST",
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const notifByInvoiceCode = new Map<string, any>();
    for (const n of notifications) {
      const invCode =
        (n.metadata as any)?.invoiceCode || (n.metadata as any)?.code;
      if (invCode && !notifByInvoiceCode.has(invCode)) {
        notifByInvoiceCode.set(invCode, n);
      }
    }

    // 6. Tổng hợp dữ liệu từng phòng theo Eligibility Engine
    const items = [];
    for (const room of rooms) {
      const billingBounds = getHalfOpenPeriodBounds(period);
      const usageBounds = getHalfOpenPeriodBounds(usagePeriod);
      const activeContracts = room.contracts.filter((c) => {
        const cStart = new Date(c.startDate);
        const cEnd = new Date(c.endDate);
        return cStart < billingBounds.nextStart && cEnd > billingBounds.start &&
          ACTIVE_LIKE_CONTRACT_STATUSES.includes(c.status) && !c.deletedAt;
      });
      const lockedSnapshot = snapshotByRoomId.get(room.id) || null;
      const lockedAllocations = Array.isArray(lockedSnapshot?.allocations)
        ? lockedSnapshot.allocations
        : [];
      const lockedProvenance = (lockedSnapshot?.sourceProvenance || {}) as any;
      const resolvedRentalType = lockedSnapshot
        ? (lockedProvenance.rentalType ||
          (lockedAllocations.length > 1 ? "SHARED" : room.rentalType))
        : room.rentalType;
      const isSharedRoom = resolvedRentalType === "SHARED";
      const resolvedBillingScope = lockedSnapshot
        ? (lockedProvenance.billingScope || (isSharedRoom ? "CONTRACT" : "ROOM"))
        : (isSharedRoom ? "CONTRACT" : "ROOM");
      const liveBillingContracts = isSharedRoom
        ? activeContracts
        : activeContracts[0]
          ? [activeContracts[0]]
          : [];
      const allContractsById = new Map<string, any>(
        room.contracts.map((contract) => [contract.id, contract]),
      );
      const lockedAllocationContractIds: string[] = Array.from(
        new Set<string>(
          lockedAllocations
            .map((allocation: any) => allocation?.contractId)
            .filter((contractId: unknown): contractId is string => typeof contractId === "string" && contractId.length > 0) as string[],
        ),
      );
      const missingLockedContracts = lockedSnapshot
        ? lockedAllocationContractIds.filter((contractId) => !allContractsById.has(contractId))
        : [];
      // A locked roster is immutable: its allocation contract IDs, including
      // historical terminal/soft-deleted contracts, define the billing scope.
      const billingContracts = lockedSnapshot
        ? lockedAllocationContractIds
            .map((contractId) => allContractsById.get(contractId))
            .filter(Boolean) as any[]
        : liveBillingContracts;
      const eligibilityByContractId = new Map(
        billingContracts.map((contract) => [
          contract.id,
          new Date(contract.startDate) < usageBounds.nextStart,
        ]),
      );
      const occupancyResolution = lockedSnapshot
        ? resolveLockedSnapshotOccupancy(lockedSnapshot, billingContracts)
        : resolveCanonicalRoomPeriodOccupancy({
          rentalType: room.rentalType,
            tenantId,
            contracts: billingContracts,
            occupancies: (Array.isArray((room as any).occupancies)
              ? (room as any).occupancies
              : []
            ).filter(
              (occupancy: any) =>
                !room.contracts.some(
                  (contract) =>
                    contract.id === occupancy.contractId &&
                    TERMINAL_CONTRACT_STATUSES.includes(contract.status) &&
                    !!contract.settlement,
                ),
            ),
            periodStart: usageBounds.start,
            nextPeriodStart: usageBounds.nextStart,
            eligibilityByContractId,
            wholeUnboundContractCount: !isSharedRoom
              ? room.contracts.filter((contract: any) => {
                  const contractEnd = new Date(contract.actualMoveOutAt || contract.endDate);
                  return (
                    new Date(contract.startDate) < usageBounds.nextStart &&
                    contractEnd > usageBounds.start &&
                    (ACTIVE_LIKE_CONTRACT_STATUSES.includes(contract.status) ||
                      TERMINAL_CONTRACT_STATUSES.includes(contract.status))
                  );
                }).length
              : undefined,
          });
      const lockedContractTenantBlockers: SettlementIssue[] = lockedSnapshot
        ? billingContracts.flatMap((contract) => {
            const blockers: SettlementIssue[] = [];
            if (contract.tenantId && contract.tenantId !== tenantId) {
              blockers.push({
                code: "CONTRACT_TENANT_MISMATCH",
                message: "Hợp đồng snapshot không thuộc tenant đang được chốt.",
                contractId: contract.id,
              });
            }
            if (contract.customer?.tenantId && contract.customer.tenantId !== tenantId) {
              blockers.push({
                code: "CONTRACT_CUSTOMER_TENANT_MISMATCH",
                message: "Payer của hợp đồng snapshot không thuộc tenant đang được chốt.",
                contractId: contract.id,
                customerId: contract.customer.id,
              });
            }
            return blockers;
          })
        : [];
      const terminalBlockers: SettlementIssue[] = lockedSnapshot ? [] : room.contracts
        .filter((contract) => {
          if (
            !TERMINAL_CONTRACT_STATUSES.includes(contract.status) ||
            contract.settlement
          ) return false;
          const end = new Date(contract.actualMoveOutAt || contract.endDate);
          return (
            new Date(contract.startDate) < usageBounds.nextStart &&
            end > usageBounds.start &&
            (room.occupancies || []).some(
              (occupancy: any) =>
                occupancy.contractId === contract.id &&
                (!occupancy.tenantId || occupancy.tenantId === tenantId) &&
                isPositiveOverlap(
                  occupancy.joinedAt,
                  occupancy.leftAt,
                  usageBounds.start,
                  usageBounds.nextStart,
                ),
            )
          );
        })
        .map((contract) => ({
          code: "TERMINAL_CONTRACT_REQUIRES_FINAL_SETTLEMENT",
          message: "Hợp đồng đã kết thúc có dữ liệu sử dụng trong kỳ; cần quyết toán cuối hợp đồng.",
          contractId: contract.id,
        }));
      const settledTerminalReconciliationBlockers: SettlementIssue[] =
        !lockedSnapshot && activeContracts.length > 0 && room.contracts.some(
          (contract) =>
            TERMINAL_CONTRACT_STATUSES.includes(contract.status) &&
            !!contract.settlement &&
            (room.occupancies || []).some(
              (occupancy: any) =>
                occupancy.contractId === contract.id &&
                (!occupancy.tenantId || occupancy.tenantId === tenantId) &&
                isPositiveOverlap(
                  occupancy.joinedAt,
                  occupancy.leftAt,
                  usageBounds.start,
                  usageBounds.nextStart,
                ),
            ),
        )
          ? [{
              code: "TERMINAL_USAGE_RECONCILIATION_REQUIRED",
              message: "Không thể chứng minh điện nước phòng đã loại trừ phần quyết toán cuối hợp đồng.",
            }]
          : [];
      const wholeRoomContractBlockers: SettlementIssue[] =
        !lockedSnapshot && !isSharedRoom && activeContracts.length > 1
          ? [{
              code: "WHOLE_ROOM_MULTIPLE_BILLING_CONTRACTS",
              message: "Phòng nguyên căn chỉ được có một hợp đồng thanh toán trong kỳ.",
            }]
          : [];
      const settlementBlockers = [
        ...terminalBlockers,
        ...settledTerminalReconciliationBlockers,
        ...missingLockedContracts.map((contractId) => ({
          code: "LOCKED_SNAPSHOT_CONTRACT_MISSING",
          message: "Snapshot tham chiếu hợp đồng lịch sử không còn truy xuất được.",
          contractId,
        })),
        ...lockedContractTenantBlockers,
        ...wholeRoomContractBlockers,
        ...occupancyResolution.blockers,
      ];
      const settlementWarnings = [
        ...occupancyResolution.warnings,
        ...(lockedSnapshot && !lockedProvenance.rentalType
          ? [{
              code: "LOCKED_SNAPSHOT_SCOPE_LEGACY_INFERRED",
              message: "Rental type/billing scope của snapshot legacy được suy luận từ allocations.",
            }]
          : []),
      ];
      const contractMemberCounts = new Map(
        billingContracts.map((contract) => [
          contract.id,
          occupancyResolution.byContractId.get(contract.id)?.membersCount || 0,
        ]),
      );
      const sharedTotalMembers = isSharedRoom
        ? billingContracts.reduce(
            (sum, contract) =>
              sum + (contractMemberCounts.get(contract.id) || 0),
            0,
          )
        : 0;

      // Khoản 3: Tiền điện tháng M-1 (Postpaid) - Chỉ tính nếu khách đã ở trong kỳ M-1
      const meter =
        meterMap.get(`${room.building.code}::${room.code}`) || null;
      // Khi snapshot đã khóa, reconciliation chỉ được so với observation mới
      // của đúng meter đã tạo snapshot, không lấy meter thay thế cùng phòng.
      const persistedReading = lockedSnapshot?.meterMappingId
        ? persistedReadingByRoomAndMapping.get(
            `${room.id}:${lockedSnapshot.meterMappingId}`,
          ) || null
        : persistedReadingByRoomId.get(room.id) || null;
      const nowVnPeriod = formatVietnamPeriod();

      // Xác định số kWh và số tiền theo đúng kỳ sử dụng M-1:
      // - Nếu kỳ sử dụng M-1 là tháng trước đó (usagePeriod < nowVnPeriod, vd: đang tháng 9/2026 xem kỳ tháng 9 nên M-1 là tháng 8/2026): lấy energyPrevMonthKwh & moneyPrevMonthVnd (Tổng T8)
      // - Nếu kỳ sử dụng M-1 là tháng hiện tại (usagePeriod === nowVnPeriod, vd: đang tháng 9/2026 xem kỳ chốt tháng 10 nên M-1 là tháng 9/2026): lấy energyMonthKwh & moneyMonthVnd (Tiêu thụ T9)
      let rawElectricityKwh = 0;
      let rawElectricityAmount = 0;
      const liveCustomRate = toPositiveFiniteNumber(meter?.customRateVnd);
      if (lockedSnapshot) {
        rawElectricityKwh = Number(lockedSnapshot.usageKwh || 0);
        rawElectricityAmount = Number(lockedSnapshot.electricityAmount || 0);
      } else if (persistedReading) {
        rawElectricityKwh = Number(persistedReading.energyMonthKwh || 0);
        rawElectricityAmount = Number(persistedReading.moneyMonthVnd || 0);
      } else if (meter) {
        if (usagePeriod < nowVnPeriod) {
          rawElectricityKwh = Number(
            meter.energyPrevMonthKwh ?? meter.energyMonthKwh ?? 0,
          );
          rawElectricityAmount = Number(
            meter.moneyPrevMonthVnd ?? meter.moneyMonthVnd ?? 0,
          );
        } else {
          rawElectricityKwh = Number(meter.energyMonthKwh ?? 0);
          rawElectricityAmount = Number(meter.moneyMonthVnd ?? 0);
        }

        // Nếu phòng áp dụng phương thức Tự thiết lập (Custom Rate Unit Price):
        if (meter.rateMode === "custom") {
          if (liveCustomRate !== null) {
            const computedCustomAmount = Math.round(
              rawElectricityKwh * liveCustomRate,
            );
            if (computedCustomAmount > 0) {
              rawElectricityAmount = computedCustomAmount;
            }
          }
        }
      }

      // A live Hunonic aggregate remains useful for the UI, but it is not
      // admissible financial evidence.  Surface it with an explicit blocker
      // so full-scope close preflight rejects the entire request before the
      // first room can write an invoice or snapshot.
      if (
        !lockedSnapshot &&
        latestEvidenceByRoomId.has(room.id) &&
        latestEvidenceByRoomId.get(room.id)?.aggregateBasis !==
          "MONTHLY_AGGREGATE_V1"
      ) {
        settlementBlockers.push({
          code: "BILLING_SNAPSHOT_LEGACY_EVIDENCE_REQUIRES_RECONCILIATION",
          message: "Observation điện mới nhất chưa có aggregate basis được xác minh; cần đối soát trước khi chốt kỳ.",
        });
      }
      if (
        !lockedSnapshot &&
        (rawElectricityKwh > 0 || rawElectricityAmount > 0) &&
        (!persistedReading?.id || !persistedReading?.meterMappingId)
      ) {
        settlementBlockers.push({
          code: "BILLING_SNAPSHOT_REQUIRES_PERSISTED_OBSERVATION",
          message: "Điện năng dương chỉ có dữ liệu Hunonic live; cần observation đã lưu để chốt kỳ.",
        });
      }
      if (
        !lockedSnapshot &&
        persistedReading &&
        (numberOrNull(persistedReading.energyMonthKwh) === null ||
          numberOrNull(persistedReading.moneyMonthVnd) === null)
      ) {
        settlementBlockers.push({
          code: "HUNONIC_MONTHLY_AGGREGATE_INCOMPLETE",
          message:
            "Observation Hunonic thiếu sản lượng hoặc số tiền; không thể dùng dữ liệu chưa đầy đủ để chốt kỳ.",
        });
      }

      // Khoản 4: Phí dịch vụ tháng M-1 (Postpaid)
      const rawServiceAmount = 0;

      const resolvedRateMode =
        lockedSnapshot?.pricingMode || meter?.rateMode || "residential";
      const isCustomRate = resolvedRateMode === "custom";
      const isUnknownRate = resolvedRateMode !== "custom" && resolvedRateMode !== "residential";
      if (!lockedSnapshot && isUnknownRate) {
        settlementBlockers.push({
          code: "HUNONIC_RATE_MODE_UNVERIFIED",
          message: "Chưa xác minh phương thức tính giá Hunonic; cần đối soát trước khi chốt snapshot hoặc tạo hóa đơn.",
        });
      }
      const customRateVnd = isCustomRate
        // Locked values are immutable.  A live custom meter must provide an
        // explicit provider unit price; never substitute a local default.
        ? lockedSnapshot
          ? numberOrNull(lockedSnapshot.unitRateVnd)
          : liveCustomRate
        : null;
      const rateModeLabel = isCustomRate
        ? customRateVnd !== null
          ? `Tự thiết lập (${customRateVnd.toLocaleString("vi-VN")}đ/kWh)`
          : "Tự thiết lập (chưa có đơn giá Hunonic)"
        : isUnknownRate ? "Chưa rõ phương thức giá" : "Bậc thang EVN";
      if (!lockedSnapshot && isCustomRate && rawElectricityKwh > 0 && customRateVnd === null) {
        settlementBlockers.push({
          code: "HUNONIC_CUSTOM_RATE_REQUIRED",
          message: "Công tơ Hunonic đang dùng giá tự thiết lập nhưng chưa có đơn giá xác thực; không thể chốt kỳ.",
        });
      }
      const meterReadingView =
        lockedSnapshot || persistedReading || meter
          ? {
              snapshotId: lockedSnapshot?.id || null,
              snapshotStatus: lockedSnapshot?.status || null,
              snapshotPolicyVersion:
                lockedSnapshot?.policyVersion || null,
              snapshotSourcePayloadHash:
                lockedSnapshot?.sourcePayloadHash || null,
              sourceReadingId:
                lockedSnapshot?.sourceReadingId || persistedReading?.id || null,
              // Once a snapshot is locked, its provenance is the immutable
              // evidence.  A later observation is reconciliation only and
              // must never rewrite what an invoice retry uses as its source.
              sourceProvider:
                lockedSnapshot?.sourceProvenance?.sourceProvider ||
                persistedReading?.sourceProvider || null,
              sourceProviderMeterId:
                lockedSnapshot?.sourceProvenance?.sourceProviderMeterId ||
                persistedReading?.sourceProviderMeterId || null,
              sourcePayloadHash:
                lockedSnapshot?.sourceProvenance?.readingPayloadHash ||
                lockedSnapshot?.sourcePayloadHash ||
                persistedReading?.payloadHash || null,
              meterMappingId:
                lockedSnapshot?.sourceProvenance?.meterMappingId ||
                lockedSnapshot?.meterMappingId ||
                persistedReading?.meterMappingId ||
                meter?.id ||
                null,
              // Hunonic reports a monthly aggregate, not register endpoints.
              // Deliberately keep both endpoint fields NULL instead of
              // presenting a fabricated 0 → monthly reading interval.
              oldReading: null,
              newReading: null,
              powerW: Number(meter?.powerCurrentW || 0),
              isOnline:
                meter?.status === "on" ||
                meter?.lastStatus === "on" ||
                meter?.isOnline === true,
              lastSyncedAt:
                // `readingAt` is the provider's usage observation period and
                // can legitimately be the first day of the month. It is not
                // the time our sync succeeded, so it must not drive the
                // stale-data badge in the UI.
                meter?.lastSyncedAt || persistedReading?.readingAt || null,
              rateMode: isUnknownRate ? "unknown" : isCustomRate ? "custom" : "residential",
              customRateVnd,
              rateModeLabel,
              dataSource: lockedSnapshot
                ? "LOCKED_SNAPSHOT"
                : persistedReading
                  ? "PERSISTED_READING"
                  : "LIVE_MAPPING",
            }
          : null;
      const electricityReconciliation =
        lockedSnapshot && persistedReading
          ? {
              currentKwh: Number(persistedReading.energyMonthKwh || 0),
              currentAmount: Number(persistedReading.moneyMonthVnd || 0),
              deltaKwh:
                Number(persistedReading.energyMonthKwh || 0) -
                Number(lockedSnapshot.usageKwh || 0),
              deltaAmount:
                Number(persistedReading.moneyMonthVnd || 0) -
                Number(lockedSnapshot.electricityAmount || 0),
              status:
                Number(persistedReading.energyMonthKwh || 0) ===
                  Number(lockedSnapshot.usageKwh || 0) &&
                Number(persistedReading.moneyMonthVnd || 0) ===
                  Number(lockedSnapshot.electricityAmount || 0)
                  ? "MATCHED"
                  : "MISMATCHED",
            }
          : null;
      const utilityEligibility = billingContracts.map((contract) => {
        return occupancyResolution.byContractId.get(contract.id)?.eligibility === true;
      });
      const allocationWeights = billingContracts.map((contract, index) =>
        utilityEligibility[index]
          ? contractMemberCounts.get(contract.id) || 0
          : 0,
      );
      const hasEligibleUtilityOccupants = allocationWeights.some(
        (weight) => weight > 0,
      );
      const electricityKwhShares = hasEligibleUtilityOccupants
        ? allocateDeterministically(rawElectricityKwh, allocationWeights, 3)
        : billingContracts.map(() => 0);
      const electricityAmountShares = hasEligibleUtilityOccupants
        ? allocateDeterministically(rawElectricityAmount, allocationWeights, 2)
        : billingContracts.map(() => 0);
      const serviceAmountShares = hasEligibleUtilityOccupants
        ? allocateDeterministically(rawServiceAmount, allocationWeights, 2)
        : billingContracts.map(() => 0);

      if (billingContracts.length === 0) {
        // Phòng trống / chưa có hợp đồng: Vẫn hiển thị đầy đủ trên danh sách tổng hợp
        const item = {
          billingGroupKey: `ROOM:${room.id}`,
          billingScope: resolvedBillingScope,
          utilityShareRatio: 1,
          sharedTotalMembers: 0,
          roomElectricityKwh: rawElectricityKwh,
          roomElectricityAmount: rawElectricityAmount,
          roomServiceAmount: 0,
          roomId: room.id,
          roomCode: room.code,
          roomName: room.name,
          buildingId: room.building.id,
          buildingCode: room.building.code,
          buildingName: room.building.name,
          floorName: room.floor.name,
          floorLevel: room.floor.level,
          roomRentalType: resolvedRentalType,
          roomCapacity: room.capacity,
          contractId: null,
          contractCode: null,
          contractStatus: null,
          contractStartDate: null,
          contractSignedAt: null,
          hasContract: false,
          isFirstMonthNewTenant: false,
          electricityEligible: false,
          serviceEligible: false,
          representative: null,
          membersCount: 0,
          members: [],
          period,
          usagePeriod,
          invoiceId: null,
          invoiceCode: `INV-${period.replace("-", "")}-${room.code}`,
          roomPrice: 0,
          electricityKwh: 0,
          electricityAmount: 0,
          meterReading: meterReadingView,
          billingSnapshotId: lockedSnapshot?.id || null,
          billingSnapshotProvenance: lockedSnapshot?.sourceProvenance || null,
          billingDataSource: lockedSnapshot
            ? "LOCKED_SNAPSHOT"
            : persistedReading
              ? "PERSISTED_READING"
              : "LIVE_MAPPING",
          electricityReconciliation,
          waterAmount: 0,
          serviceAmount: 0,
          waterEligible: false,
          totalAmount: 0,
          notificationStatus: "PENDING" as const,
          notificationSentAt: null,
          notificationError: null,
          paymentStatus: "DRAFT",
          paidAmount: 0,
          settlementBlockers,
          settlementWarnings,
        };

        if (query.search) {
          const needle = query.search.trim().toLowerCase();
          const matchRoom = room.code.toLowerCase().includes(needle);
          const matchBuilding =
            room.building.name.toLowerCase().includes(needle) ||
            room.building.code.toLowerCase().includes(needle);
          if (!matchRoom && !matchBuilding) {
            continue;
          }
        }

        if (query.notificationStatus && query.notificationStatus !== "ALL") {
          continue;
        }

        if (query.paymentStatus && query.paymentStatus !== "ALL") {
          continue;
        }

        items.push(item);
        continue;
      }

      for (const [
        contractIndex,
        activeContract,
      ] of billingContracts.entries()) {
        const lockedAllocation = lockedAllocations.find(
          (allocation: any) => allocation.contractId === activeContract.id,
        );
        const lockedPayer = lockedAllocation
          ? (lockedAllocation.payerSnapshot ||
            (lockedAllocation.customerId
              ? { id: lockedAllocation.customerId }
              : null))
          : null;
        const representative = lockedPayer || activeContract?.customer || null;
        const existingInvoice = resolvedBillingScope === "CONTRACT"
          ? invoiceByContractId.get(activeContract.id) || null
          : invoiceByRoomId.get(room.id) ||
            invoiceByContractId.get(activeContract.id) ||
            null;
        const hasContract = !!activeContract;
        const contractMembersCount =
          contractMemberCounts.get(activeContract.id) || 0;
        const canonicalMembership = occupancyResolution.byContractId.get(
          activeContract.id,
        ) || { members: [], membersCount: 0, eligibility: false };
        const isEligibleForPreviousUsage =
          hasContract &&
          canonicalMembership.eligibility === true;
        const isFirstMonthNewTenant =
          hasContract && !isEligibleForPreviousUsage;
        const utilityShareRatio =
          isSharedRoom && sharedTotalMembers > 0
            ? contractMembersCount / sharedTotalMembers
            : 1;
        const electricityKwh = isEligibleForPreviousUsage
          ? Number(
              lockedAllocation?.electricityKwh ??
                electricityKwhShares[contractIndex],
            )
          : 0;
        const electricityAmount = isEligibleForPreviousUsage
          ? Number(
              lockedAllocation?.electricityAmount ??
                electricityAmountShares[contractIndex],
            )
          : 0;
        const serviceAmount = isEligibleForPreviousUsage
          ? serviceAmountShares[contractIndex]
          : 0;

        const allMembers = canonicalMembership.members;
        const membersCount = canonicalMembership.membersCount;
        const occupancySource = occupancyResolution.source;
        const roomPrice = Number(activeContract.monthlyRent || 0);
        const waterAmount = isEligibleForPreviousUsage
          ? Number(lockedAllocation?.waterAmount ?? membersCount * 100000)
          : 0;

        let totalAmount =
          roomPrice + electricityAmount + waterAmount + serviceAmount;
        let finalRoomPrice = roomPrice;
        let finalElectricityAmount = electricityAmount;
        let finalWaterAmount = waterAmount;
        let finalServiceAmount = serviceAmount;
        const invoiceSnapshotBlockers: SettlementIssue[] = [];

        if (existingInvoice) {
          // An empty canonical document is also an invalid projection when a
          // locked snapshot expects positive utility, so do not skip this
          // validation merely because there are no rows yet.
          if (Array.isArray(existingInvoice.items)) {
            const roomItem = existingInvoice.items.find(
              (i: any) =>
                i.type === InvoiceItemType.RENT ||
                i.description?.toLowerCase().includes("phòng") ||
                i.description?.toLowerCase().includes("thuê"),
            );
            const elecItem = existingInvoice.items.find(
              (i: any) =>
                i.type === InvoiceItemType.UTILITY_ELECTRICITY ||
                i.description?.toLowerCase().includes("điện"),
            );
            const waterItem = existingInvoice.items.find(
              (i: any) =>
                i.type === InvoiceItemType.UTILITY_WATER ||
                i.description?.toLowerCase().includes("nước"),
            );
            const serviceItem = existingInvoice.items.find(
              (i: any) => i.type === InvoiceItemType.SERVICE,
            );
            if (lockedSnapshot) {
              // The locked economics remain authoritative.  Treat MONTHLY_BASE
              // as a projection of that snapshot, never as a replacement
              // source.  Missing/duplicate/wrongly linked utility lines are
              // all unsafe to repair during a close retry.
              const sameMoney = (left: unknown, right: unknown) => {
                const leftValue = Number(left);
                const rightValue = Number(right);
                return Number.isFinite(leftValue) && Number.isFinite(rightValue) &&
                  Math.round(leftValue * 100) === Math.round(rightValue * 100);
              };
              const rowsOfType = (type: InvoiceItemType) =>
                existingInvoice.items.filter((invoiceItem: any) => invoiceItem.type === type);
              const hasExactProjectionRow = (
                type: InvoiceItemType,
                expectedAmount: number,
                expectedServicePeriod: string,
                requireSnapshotLink: boolean,
              ) => {
                const rows = rowsOfType(type);
                if (expectedAmount > 0 && rows.length !== 1) return false;
                if (expectedAmount === 0 && rows.length !== 0) return false;
                if (rows.length === 0) return expectedAmount === 0;
                const row = rows[0];
                return sameMoney(row.amount, expectedAmount) &&
                  row.servicePeriod === expectedServicePeriod &&
                  (!requireSnapshotLink || row.billingSnapshotId === lockedSnapshot.id);
              };
              const allowedTypes = new Set<InvoiceItemType>([
                InvoiceItemType.RENT,
                InvoiceItemType.UTILITY_ELECTRICITY,
                InvoiceItemType.UTILITY_WATER,
                InvoiceItemType.SERVICE,
              ]);
              const itemTotal = existingInvoice.items.reduce(
                (sum: number, invoiceItem: any) => sum + Number(invoiceItem.amount || 0),
                0,
              );
              const expectedTotal = roomPrice + electricityAmount + waterAmount + serviceAmount;
              const identityMatches =
                existingInvoice.tenantId === tenantId &&
                existingInvoice.billingKind === "MONTHLY_BASE" &&
                existingInvoice.baseInvoiceKey ===
                  `MONTHLY:${activeContract.id}:${period}` &&
                existingInvoice.contractId === activeContract.id &&
                existingInvoice.customerId === representative.id &&
                (existingInvoice.rentalCycleId || null) ===
                  (activeContract.rentalCycleId || null) &&
                existingInvoice.period === period &&
                existingInvoice.usagePeriod === usagePeriod;
              if (
                !identityMatches ||
                existingInvoice.items.some(
                  (invoiceItem: any) => !allowedTypes.has(invoiceItem.type),
                ) ||
                !hasExactProjectionRow(InvoiceItemType.RENT, roomPrice, period, false) ||
                !hasExactProjectionRow(
                  InvoiceItemType.UTILITY_ELECTRICITY,
                  electricityAmount,
                  usagePeriod,
                  true,
                ) ||
                !hasExactProjectionRow(
                  InvoiceItemType.UTILITY_WATER,
                  waterAmount,
                  usagePeriod,
                  true,
                ) ||
                !hasExactProjectionRow(
                  InvoiceItemType.SERVICE,
                  serviceAmount,
                  usagePeriod,
                  false,
                ) ||
                !sameMoney(existingInvoice.subtotal, itemTotal) ||
                !sameMoney(existingInvoice.total, itemTotal) ||
                !sameMoney(itemTotal, expectedTotal)
              ) {
                invoiceSnapshotBlockers.push({
                  code: "LOCKED_SNAPSHOT_INVOICE_UTILITY_MISMATCH",
                  message: "MONTHLY_BASE không phải projection chính xác của snapshot đã khóa.",
                  contractId: activeContract.id,
                });
              }
            } else {
              totalAmount = Number(
                existingInvoice.total || existingInvoice.subtotal || 0,
              );
              if (roomItem) finalRoomPrice = Number(roomItem.amount);
              if (elecItem) finalElectricityAmount = Number(elecItem.amount);
              if (waterItem) finalWaterAmount = Number(waterItem.amount);
              finalServiceAmount = serviceItem
                ? Number(serviceItem.amount)
                : totalAmount -
                  (finalRoomPrice + finalElectricityAmount + finalWaterAmount);
              if (finalServiceAmount < 0) finalServiceAmount = 0;
            }
          }
          if (lockedSnapshot) {
            totalAmount = finalRoomPrice + electricityAmount + waterAmount + serviceAmount;
          }
        }

        let notifStatus: "SENT_ZALO" | "PENDING" | "FAILED" | "SENDING" =
          "PENDING";
        let notifSentAt: string | null = null;
        let notifError: string | null = null;
        const invoiceCode =
          existingInvoice?.code ||
          buildMonthlyInvoiceCode(
            period,
            room.code,
            activeContract,
            resolvedBillingScope === "CONTRACT",
          );

        if (existingInvoice) {
          const notif = notifByInvoiceCode.get(existingInvoice.code);
          if (notif) {
            notifSentAt = notif.createdAt?.toISOString() || null;
            if (["SENT", "DELIVERED", "READ"].includes(notif.status)) {
              notifStatus = "SENT_ZALO";
            } else if (notif.status === "FAILED") {
              notifStatus = "FAILED";
              notifError =
                (notif.metadata as any)?.lastError || "Lỗi gửi tin nhắn Zalo";
            } else if (["SENDING", "QUEUED"].includes(notif.status)) {
              const createdAt = notif.createdAt
                ? new Date(notif.createdAt).getTime()
                : 0;
              const isStale = Date.now() - createdAt > 2 * 60 * 1000;
              if (isStale) {
                notifStatus = "FAILED";
                notifError =
                  (notif.metadata as any)?.lastError ||
                  "Quá thời gian phản hồi từ Zalo (Hết thời gian chờ). Nhấn Zalo để gửi lại.";
              } else {
                notifStatus = "SENDING";
              }
            }
          }
        }

        const paymentStatus: string = existingInvoice
          ? existingInvoice.status
          : "ISSUED";
        const item = {
          billingGroupKey: resolvedBillingScope === "CONTRACT"
            ? `CONTRACT:${activeContract.id}`
            : `ROOM:${room.id}`,
          billingScope: resolvedBillingScope,
          utilityShareRatio,
          sharedTotalMembers: isSharedRoom ? sharedTotalMembers : membersCount,
          roomElectricityKwh: rawElectricityKwh,
          roomElectricityAmount: rawElectricityAmount,
          roomServiceAmount: rawServiceAmount,
          roomId: room.id,
          roomCode: room.code,
          roomName: room.name,
          buildingId: room.building.id,
          buildingCode: room.building.code,
          buildingName: room.building.name,
          floorName: room.floor.name,
          floorLevel: room.floor.level,
          roomRentalType: resolvedRentalType,
          roomCapacity: room.capacity,
          contractId: activeContract?.id || null,
          rentalCycleId: activeContract?.rentalCycleId || null,
          contractCode: activeContract?.code || null,
          contractStatus: activeContract?.status || null,
          contractStartDate: activeContract?.startDate
            ? new Date(activeContract.startDate).toISOString()
            : null,
          contractSignedAt: activeContract?.signedAt
            ? new Date(activeContract.signedAt).toISOString()
            : null,
          hasContract,
          isFirstMonthNewTenant,
          electricityEligible: isEligibleForPreviousUsage,
          waterEligible: isEligibleForPreviousUsage,
          serviceEligible: isEligibleForPreviousUsage,
          representative: representative
            ? {
                id: representative.id,
                fullName: representative.fullName,
                phone: representative.phone,
                email: representative.email,
                identityNo: representative.identityNo,
                zaloPhone: representative.zaloPhone || null,
                zaloChatId: representative.zaloChatId || null,
                zaloUserId: representative.zaloUserId || null,
                hasZalo: !!(
                  representative.zaloChatId || representative.zaloUserId
                ),
              }
            : null,
          membersCount,
          members: allMembers,
          snapshotOccupants: lockedSnapshot?.occupants || null,
          occupancySource,
          period,
          usagePeriod,
          invoiceId: existingInvoice?.id || null,
          invoiceCode,
          roomPrice: finalRoomPrice,
          electricityKwh,
          electricityAmount: finalElectricityAmount,
          meterReading: meterReadingView,
          billingSnapshotId: lockedSnapshot?.id || null,
          billingSnapshotProvenance: lockedSnapshot?.sourceProvenance || null,
          billingDataSource: lockedSnapshot
            ? "LOCKED_SNAPSHOT"
            : persistedReading
              ? "PERSISTED_READING"
              : "LIVE_MAPPING",
          electricityReconciliation,
          waterAmount: finalWaterAmount,
          serviceAmount: finalServiceAmount,
          totalAmount,
          notificationStatus: notifStatus,
          notificationSentAt: notifSentAt,
          notificationError: notifError,
          paymentStatus,
          paidAmount: existingInvoice
            ? Number(existingInvoice.paidAmount || 0)
            : 0,
          settlementBlockers: [...settlementBlockers, ...invoiceSnapshotBlockers],
          settlementWarnings,
        };

        if (query.search) {
          const needle = query.search.trim().toLowerCase();
          const matchRoom = room.code.toLowerCase().includes(needle);
          const matchBuilding =
            room.building.name.toLowerCase().includes(needle) ||
            room.building.code.toLowerCase().includes(needle);
          const matchRep =
            representative?.fullName?.toLowerCase().includes(needle) ||
            representative?.phone?.includes(needle);
          const matchMember = allMembers.some(
            (m) =>
              m.fullName.toLowerCase().includes(needle) ||
              String(m.phone || "").includes(needle),
          );
          if (!matchRoom && !matchBuilding && !matchRep && !matchMember) {
            continue;
          }
        }

        if (
          query.notificationStatus &&
          query.notificationStatus !== "ALL" &&
          item.notificationStatus !== query.notificationStatus
        ) {
          continue;
        }

        if (
          query.paymentStatus &&
          query.paymentStatus !== "ALL" &&
          item.paymentStatus !== query.paymentStatus
        ) {
          continue;
        }

        items.push(item);
      }
    }

    // 7. Thống kê KPI
    const totalRooms = rooms.length;
    const occupiedRooms = new Set(
      items.filter((i) => i.hasContract).map((i) => i.roomId),
    ).size;
    const billingGroups = items.length;
    const totalAmount = items.reduce((sum, i) => sum + i.totalAmount, 0);
    const sentZaloCount = items.filter(
      (i) => i.hasContract && i.notificationStatus === "SENT_ZALO",
    ).length;
    const pendingCount = items.filter(
      (i) => i.hasContract && i.notificationStatus === "PENDING",
    ).length;
    const failedCount = items.filter(
      (i) => i.hasContract && i.notificationStatus === "FAILED",
    ).length;
    const paidCount = items.filter(
      (i) => i.hasContract && i.paymentStatus === "PAID",
    ).length;
    const totalPaidAmount = items.reduce((sum, i) => sum + i.paidAmount, 0);

    const settings = await this.getSettings(tenantId);

    return {
      period,
      usagePeriod,
      buildings,
      settings,
      stats: {
        totalRooms,
        occupiedRooms,
        billingGroups,
        totalAmount,
        sentZaloCount,
        pendingCount,
        failedCount,
        paidCount,
        totalPaidAmount,
        collectionRate:
          totalAmount > 0 ? (totalPaidAmount / totalAmount) * 100 : 0,
      },
      items,
    };
  }

  async finalizeUsagePeriod(tenantId: string, input: { period?: string }) {
    const usagePeriod = input.period || formatVietnamPeriod();
    const billingPeriod = getNextVietnamPeriod(usagePeriod);
    const overview = await this.getOverview(tenantId, {
      period: billingPeriod,
    });
    // This happens before Hunonic receives any lock request. A terminal
    // contract must be finalized by CORE-09, never silently monthly-locked.
    assertSettlementScopeUnambiguous(overview.items);
    const lockRowsByRoomPeriod = new Map<string, any>();
    for (const item of overview.items) {
      if (!item.hasContract || !item.electricityEligible || !item.meterReading) continue;
      const row = {
        buildingCode: item.buildingCode,
        roomCode: item.roomCode,
        period: usagePeriod,
        note: `Khóa chỉ số điện sử dụng tháng ${usagePeriod} trước kỳ thu ${billingPeriod}`,
      };
      const key = `${item.roomId}:${usagePeriod}`;
      if (!lockRowsByRoomPeriod.has(key)) lockRowsByRoomPeriod.set(key, row);
    }
    const lockRows = Array.from(lockRowsByRoomPeriod.values());

    if (lockRows.length > 0) {
      await this.hunonicService.lockPeriods(tenantId, { rows: lockRows });
    }

    return {
      success: true,
      usagePeriod,
      billingPeriod,
      lockedCount: lockRows.length,
    };
  }

  /**
   * Chốt tháng: tạo/cập nhật hóa đơn và khóa chỉ số công tơ điện
   */
  async closeMonth(
    tenantId: string,
    userId: string,
    input: {
      period?: string;
      roomIds?: string[];
      autoSend?: boolean;
    },
  ) {
    const period = input.period || formatVietnamPeriod();
    const runModel = (this.prisma as any).monthlySettlementRun;
    if (!runModel?.create) {
      return this.executeCloseMonth(tenantId, userId, { ...input, period });
    }

    const identity = buildSettlementRunIdentity(period, input);
    let run: any;
    try {
      run = await runModel.create({
        data: {
          tenantId,
          billingPeriod: period,
          scopeKey: identity.scopeKey,
          status: "RUNNING",
          idempotencyKey: identity.idempotencyKey,
          requestHash: identity.requestHash,
          createdBy: userId,
        },
      });
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;
      const existing = await runModel.findUnique({
        where: {
          tenantId_billingPeriod_scopeKey: {
            tenantId,
            billingPeriod: period,
            scopeKey: identity.scopeKey,
          },
        },
      });
      if (!existing) throw error;
      if (existing.requestHash !== identity.requestHash) {
        throw new ConflictException("MONTHLY_SETTLEMENT_REQUEST_MISMATCH");
      }
      if (existing.status === "COMPLETED" && existing.result) {
        return existing.result;
      }
      if (existing.status === "RUNNING") {
        throw new ConflictException("MONTHLY_SETTLEMENT_ALREADY_RUNNING");
      }
      const reclaimed = await runModel.updateMany({
        where: { id: existing.id, status: "FAILED" },
        data: {
          status: "RUNNING",
          errorCode: null,
          startedAt: new Date(),
          completedAt: null,
          createdBy: userId,
        },
      });
      if (reclaimed.count !== 1) {
        throw new ConflictException("MONTHLY_SETTLEMENT_ALREADY_RUNNING");
      }
      run = existing;
    }

    try {
      const result = await this.executeCloseMonth(tenantId, userId, {
        ...input,
        period,
      });
      const completed = await runModel.updateMany({
        where: { id: run.id, status: "RUNNING" },
        data: {
          status: "COMPLETED",
          result,
          completedAt: new Date(),
          errorCode: null,
        },
      });
      if (completed.count !== 1) {
        throw new ConflictException("MONTHLY_SETTLEMENT_RUN_STATE_LOST");
      }
      return result;
    } catch (error: any) {
      await runModel.updateMany({
        where: { id: run.id, status: "RUNNING" },
        data: {
          status: "FAILED",
          errorCode: String(
            error?.message || "MONTHLY_SETTLEMENT_FAILED",
          ).slice(0, 500),
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async executeCloseMonth(
    tenantId: string,
    userId: string,
    input: {
      period: string;
      roomIds?: string[];
      autoSend?: boolean;
    },
  ) {
    const period = input.period;
    const usagePeriod = getPreviousVietnamPeriod(period);
    const overview = await this.getOverview(tenantId, { period });
    let targetItems = overview.items;

    if (Array.isArray(input.roomIds) && input.roomIds.length > 0) {
      const requestedRoomIds = Array.from(new Set(input.roomIds));
      const resolvedRoomIds = new Set(overview.items.map((item) => item.roomId));
      const unresolvedRoomIds = requestedRoomIds.filter(
        (roomId) => !resolvedRoomIds.has(roomId),
      );
      if (unresolvedRoomIds.length > 0) {
        throw new ConflictException({
          code: "MONTHLY_SETTLEMENT_SCOPE_MISMATCH",
          roomIds: unresolvedRoomIds,
        });
      }
      targetItems = targetItems.filter((i) =>
        input.roomIds?.includes(i.roomId),
      );
    }

    // Preflight the complete requested room scope before the first invoice,
    // snapshot, transaction lock or meter lock is written.
    assertSettlementScopeUnambiguous(targetItems);

    const settledInvoices = [];
    const skippedInvoices = [];
    const lockRows = [];

    for (const item of targetItems) {
      if (!item.hasContract || !item.representative || item.totalAmount <= 0) {
        continue;
      }

      // Chỉ khóa vào hóa đơn base tháng bằng khóa nghiệp vụ canonical. Không dùng
      // invoiceId/code từ projection vì chúng có thể trỏ tới manual/entry/adjustment.
      const baseInvoiceKey = `MONTHLY:${item.contractId}:${period}`;
      let invoice = await this.prisma.invoice.findFirst({
        where: {
          tenantId,
          billingKind: "MONTHLY_BASE",
          baseInvoiceKey,
          deletedAt: null,
        },
      });

      if (invoice && invoice.status !== InvoiceStatus.DRAFT) {
        skippedInvoices.push({
          roomId: item.roomId,
          roomCode: item.roomCode,
          invoiceId: invoice.id,
          invoiceCode: invoice.code,
          status: invoice.status,
          reason:
            "Hóa đơn base tháng đã phát hành; lần chạy lại chỉ replay và không sửa số tiền hoặc dòng hóa đơn.",
        });
        continue;
      }

      const contractCodeSuffix = createHash("sha256")
        .update(item.contractId)
        .digest("hex")
        .slice(0, 8)
        .toUpperCase();
      const invoiceCode =
        invoice?.code ||
        item.invoiceCode ||
        `INV-${period.replace("-", "")}-${item.roomCode}-${contractCodeSuffix}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 5); // Hạn thanh toán: 5 ngày kể từ ngày chốt

      const roomSnapshotItems = overview.items.filter(
        (candidate) =>
          candidate.roomId === item.roomId && candidate.hasContract,
      );
      const snapshotOccupants = new Map<string, any>();
      for (const candidate of roomSnapshotItems) {
        for (const member of candidate.members || []) {
          if (!snapshotOccupants.has(member.id)) {
            snapshotOccupants.set(member.id, {
              customerId: member.id,
              tenantId: member.tenantId || tenantId,
              fullName: member.fullName,
              occupancyId: member.occupancyId || null,
              contractId: candidate.contractId,
              rentalCycleId: candidate.rentalCycleId || null,
              role: member.role,
            });
          }
        }
      }
      const snapshotAllocations = roomSnapshotItems.map((candidate) => ({
        contractId: candidate.contractId,
        rentalCycleId: candidate.rentalCycleId || null,
        customerId: candidate.representative?.id || null,
        payerSnapshot: candidate.representative
          ? {
              id: candidate.representative.id,
              tenantId,
              fullName: candidate.representative.fullName || null,
              phone: candidate.representative.phone || null,
              email: candidate.representative.email || null,
              identityNo: candidate.representative.identityNo || null,
              zaloPhone: candidate.representative.zaloPhone || null,
              zaloChatId: candidate.representative.zaloChatId || null,
              zaloUserId: candidate.representative.zaloUserId || null,
            }
          : null,
        memberCount: candidate.membersCount,
        eligible: candidate.electricityEligible,
        electricityKwh: candidate.electricityKwh,
        electricityAmount: candidate.electricityAmount,
        waterAmount: candidate.waterAmount,
        shareRatio: candidate.utilityShareRatio,
        occupancySource: candidate.occupancySource,
      }));
      const snapshotMeter = item.meterReading || {};
      const candidateSnapshotSource = {
        tenantId,
        roomId: item.roomId,
        billingPeriod: period,
        usagePeriod,
        rentalType: item.roomRentalType,
        billingScope: item.billingScope,
        aggregateBasis: "MONTHLY_AGGREGATE_V1",
        provider: "hunonic",
        sourceReadingId: snapshotMeter.sourceReadingId || null,
        meterMappingId: snapshotMeter.meterMappingId || null,
        sourceProvider: snapshotMeter.sourceProvider || null,
        sourceProviderMeterId: snapshotMeter.sourceProviderMeterId || null,
        readingPayloadHash: snapshotMeter.sourcePayloadHash || null,
        sourceData: snapshotMeter,
        startReadingKwh: null,
        endReadingKwh: null,
        usageKwh: item.roomElectricityKwh,
        electricityAmount: item.roomElectricityAmount,
        pricingMode: snapshotMeter.rateMode || "residential",
        unitRateVnd: snapshotMeter.customRateVnd ?? null,
        waterRatePerPersonVnd: 100000,
        waterAmount: roomSnapshotItems.reduce(
          (sum, candidate) => sum + candidate.waterAmount,
          0,
        ),
        occupantCount: roomSnapshotItems.reduce(
          (sum, candidate) => sum + (candidate.electricityEligible ? candidate.membersCount : 0),
          0,
        ),
        occupants: Array.from(snapshotOccupants.values()),
        allocations: snapshotAllocations,
        policyVersion: "CORE-07-v2",
      };
      // Replay must validate against exactly the source provenance that was
      // locked earlier, rather than a view enriched with later live meter
      // fields.  This is what makes a partial SHARED retry deterministic.
      const snapshotSource =
        snapshotMeter.snapshotId && item.billingSnapshotProvenance &&
        typeof item.billingSnapshotProvenance === "object"
          ? item.billingSnapshotProvenance
          : candidateSnapshotSource;

      // Tạo các dòng chi tiết theo đúng kỳ dịch vụ (servicePeriod)
      // Tiền thuê phòng thu trước (servicePeriod: period)
      const itemsData: any[] = [
        {
          tenantId,
          type: InvoiceItemType.RENT,
          description: `Tiền thuê phòng ${item.roomCode} - Kỳ tháng ${period} (Thu trước)`,
          servicePeriod: period,
          quantity: 1,
          unitPrice: item.roomPrice,
          amount: item.roomPrice,
        },
      ];

      // Tiền nước, điện, phí dịch vụ thu sau theo tháng sử dụng (servicePeriod: usagePeriod)
      if (item.waterEligible !== false && item.waterAmount > 0) {
        itemsData.push({
          tenantId,
          type: InvoiceItemType.UTILITY_WATER,
          description: `Tiền nước sinh hoạt (${item.membersCount} người) - Sử dụng tháng ${usagePeriod} (Thu sau)`,
          servicePeriod: usagePeriod,
          quantity: 1,
          unitPrice: item.waterAmount,
          amount: item.waterAmount,
        });
      }

      if (item.electricityEligible && item.electricityAmount > 0) {
        itemsData.push({
          tenantId,
          type: InvoiceItemType.UTILITY_ELECTRICITY,
          description: `Tiền điện (${item.electricityKwh} kWh) - Sử dụng tháng ${usagePeriod} (Thu sau)`,
          servicePeriod: usagePeriod,
          quantity: 1,
          unitPrice: item.electricityAmount,
          amount: item.electricityAmount,
        });
      }

      if (item.serviceEligible && item.serviceAmount > 0) {
        itemsData.push({
          tenantId,
          type: InvoiceItemType.SERVICE,
          description: `Phí dịch vụ & Quản lý - Sử dụng tháng ${usagePeriod} (Thu sau)`,
          servicePeriod: usagePeriod,
          quantity: 1,
          unitPrice: item.serviceAmount,
          amount: item.serviceAmount,
        });
      }

      const persistMonthlyBase = () =>
        this.prisma.$transaction(async (tx) => {
          const lockKey = `${tenantId}:monthly-base:${baseInvoiceKey}`;
          if (typeof (tx as any).$queryRaw === "function") {
            await tx.$queryRaw(
              Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))::text AS "lock"`,
            );
            const evidenceLockKey = billingEvidenceLockKey(tenantId, item.roomId, usagePeriod);
            await tx.$queryRaw(
              Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${evidenceLockKey}))::text AS "lock"`,
            );
          }
          const exactInvoice = await tx.invoice.findFirst({
            where: {
              tenantId,
              billingKind: "MONTHLY_BASE",
              baseInvoiceKey,
              deletedAt: null,
            },
          });
          if (exactInvoice && exactInvoice.status !== InvoiceStatus.DRAFT) {
            return { invoice: exactInvoice, replayed: true };
          }

          const txAny = tx as any;
          // Invoice.customerId is an id-only FK in the current schema.  Prove
          // tenant ownership inside the same transaction before any document
          // or snapshot write so a stale/cross-tenant payer can never leak
          // into financial records.
          if (typeof txAny.customer?.findFirst === "function") {
            const representative = await txAny.customer.findFirst({
              where: { id: item.representative?.id, tenantId, deletedAt: null },
              select: { id: true },
            });
            if (!representative) {
              throw new BadRequestException("MONTHLY_BASE_REPRESENTATIVE_TENANT_INVALID");
            }
          }
          if (
            (Number(item.roomElectricityKwh || 0) > 0 || Number(item.roomElectricityAmount || 0) > 0) &&
            (!snapshotMeter.sourceReadingId || !snapshotMeter.meterMappingId)
          ) {
            throw new BadRequestException("BILLING_SNAPSHOT_REQUIRES_PERSISTED_OBSERVATION");
          }
          if (
            (Number(item.roomElectricityKwh || 0) > 0 ||
              Number(item.roomElectricityAmount || 0) > 0) &&
            !snapshotMeter.snapshotId &&
            typeof txAny.hunonicMeterReading?.findFirst === "function"
          ) {
            // First prove that the chosen evidence still exists.  Then read
            // the current canonical row without an id pin; that second read
            // detects an observation that arrived before the advisory lock.
            const candidateReading = await txAny.hunonicMeterReading.findFirst({
              where: {
                id: snapshotMeter.sourceReadingId,
                tenantId,
                roomId: item.roomId,
                meterMappingId: snapshotMeter.meterMappingId,
                sourcePeriod: usagePeriod,
                aggregateBasis: "MONTHLY_AGGREGATE_V1",
              },
              select: {
                id: true,
                meterMappingId: true,
                payloadHash: true,
                energyMonthKwh: true,
                moneyMonthVnd: true,
              },
            });
            const canonicalReading = await txAny.hunonicMeterReading.findFirst({
              where: {
                tenantId,
                roomId: item.roomId,
                sourcePeriod: usagePeriod,
                aggregateBasis: "MONTHLY_AGGREGATE_V1",
              },
              orderBy: [
                { observedAt: "desc" },
                { createdAt: "desc" },
                { id: "desc" },
              ],
              select: {
                id: true,
                meterMappingId: true,
                payloadHash: true,
                energyMonthKwh: true,
                moneyMonthVnd: true,
              },
            });
            if (
              !candidateReading ||
              candidateReading.id !== snapshotMeter.sourceReadingId ||
              candidateReading.meterMappingId !== snapshotMeter.meterMappingId ||
              ("energyMonthKwh" in candidateReading &&
                numberOrNull(candidateReading.energyMonthKwh) === null) ||
              ("moneyMonthVnd" in candidateReading &&
                numberOrNull(candidateReading.moneyMonthVnd) === null) ||
              (snapshotMeter.sourcePayloadHash &&
                candidateReading.payloadHash !== undefined &&
                candidateReading.payloadHash !== snapshotMeter.sourcePayloadHash) ||
              !canonicalReading ||
              canonicalReading.id !== snapshotMeter.sourceReadingId ||
              canonicalReading.meterMappingId !== snapshotMeter.meterMappingId ||
              ("energyMonthKwh" in canonicalReading &&
                numberOrNull(canonicalReading.energyMonthKwh) === null) ||
              ("moneyMonthVnd" in canonicalReading &&
                numberOrNull(canonicalReading.moneyMonthVnd) === null) ||
              (snapshotMeter.sourcePayloadHash &&
                canonicalReading.payloadHash !== undefined &&
                canonicalReading.payloadHash !== snapshotMeter.sourcePayloadHash)
            ) {
              throw new ConflictException(
                "BILLING_SNAPSHOT_SOURCE_CHANGED_RETRY",
              );
            }
          }
          const expectedSnapshotSourceHash = hashSnapshotSource(snapshotSource);
          const expectedSnapshotWaterAmount = roomSnapshotItems.reduce(
            (sum, candidate) => sum + candidate.waterAmount,
            0,
          );
          const expectedSnapshotOccupantCount = roomSnapshotItems.reduce(
            (sum, candidate) =>
              sum +
              (candidate.electricityEligible ? candidate.membersCount : 0),
            0,
          );
          const snapshotWhere = {
            tenantId_roomId_usagePeriod: {
              tenantId,
              roomId: item.roomId,
              usagePeriod,
            },
          };
          const snapshotCreateData = {
            tenantId,
            roomId: item.roomId,
            meterMappingId: snapshotMeter.meterMappingId || null,
            sourceReadingId: snapshotMeter.sourceReadingId || null,
            billingPeriod: period,
            usagePeriod,
            status: "LOCKED",
            provider: "hunonic",
            startReadingKwh: null,
            endReadingKwh: null,
            usageKwh: item.roomElectricityKwh,
            pricingMode: snapshotMeter.rateMode || "residential",
            unitRateVnd: snapshotMeter.customRateVnd ?? null,
            electricityAmount: item.roomElectricityAmount,
            waterRatePerPersonVnd: 100000,
            waterAmount: expectedSnapshotWaterAmount,
            occupantCount: expectedSnapshotOccupantCount,
            occupants: Array.from(snapshotOccupants.values()),
            allocations: snapshotAllocations,
            policyVersion: "CORE-07-v2",
            aggregateBasis: "MONTHLY_AGGREGATE_V1",
            sourcePayloadHash: expectedSnapshotSourceHash,
            sourceProvenance: snapshotSource,
            lockedBy: userId,
          };
          // BillingSnapshot is immutable at the database layer.  An upsert
          // would execute UPDATE on conflict and trip that trigger even with
          // update: {}.  INSERT ... ON CONFLICT DO NOTHING followed by an
          // exact read is create-only and also exposes a concurrent winner for
          // the strict validation below.
          if (
            typeof txAny.billingSnapshot?.createMany !== "function" ||
            typeof txAny.billingSnapshot?.findUnique !== "function"
          ) {
            throw new ConflictException("BILLING_SNAPSHOT_STORE_UNAVAILABLE");
          }
          await txAny.billingSnapshot.createMany({
            data: [snapshotCreateData],
            skipDuplicates: true,
          });
          const billingSnapshot = await txAny.billingSnapshot.findUnique({
            where: snapshotWhere,
          });
          if (!billingSnapshot) {
            throw new ConflictException("BILLING_SNAPSHOT_CONCURRENT_WINNER_MISSING");
          }
          if (billingSnapshot) {
            const sameNumber = (left: unknown, right: unknown) =>
              Number.isFinite(Number(left)) &&
              Number.isFinite(Number(right)) &&
              Number(left) === Number(right);
            const sameJson = (left: unknown, right: unknown) =>
              stableSnapshotJson(left) === stableSnapshotJson(right);
            const winnerMatchesSnapshotIdentity =
              billingSnapshot.tenantId === tenantId &&
              billingSnapshot.roomId === item.roomId &&
              billingSnapshot.usagePeriod === usagePeriod &&
              billingSnapshot.status === "LOCKED";
            const winnerMatchesCandidate =
              winnerMatchesSnapshotIdentity &&
              (snapshotMeter.snapshotId
                ? billingSnapshot.id === snapshotMeter.snapshotId &&
                  (billingSnapshot.policyVersion || null) ===
                    (snapshotMeter.snapshotPolicyVersion || null) &&
                  (billingSnapshot.sourcePayloadHash || null) ===
                    (snapshotMeter.snapshotSourcePayloadHash || null) &&
                  billingSnapshot.sourceReadingId ===
                    (snapshotMeter.sourceReadingId || null) &&
                  billingSnapshot.meterMappingId ===
                    (snapshotMeter.meterMappingId || null)
                :
              billingSnapshot.tenantId === tenantId &&
              billingSnapshot.roomId === item.roomId &&
              billingSnapshot.usagePeriod === usagePeriod &&
              billingSnapshot.status === "LOCKED" &&
              billingSnapshot.policyVersion === "CORE-07-v2" &&
              billingSnapshot.sourcePayloadHash ===
                expectedSnapshotSourceHash &&
              billingSnapshot.sourceReadingId === (snapshotMeter.sourceReadingId || null) &&
              billingSnapshot.meterMappingId === (snapshotMeter.meterMappingId || null) &&
              billingSnapshot.aggregateBasis === "MONTHLY_AGGREGATE_V1" &&
              sameNumber(billingSnapshot.usageKwh, item.roomElectricityKwh) &&
              sameNumber(billingSnapshot.electricityAmount, item.roomElectricityAmount) &&
              sameNumber(billingSnapshot.waterAmount, expectedSnapshotWaterAmount) &&
              Number(billingSnapshot.occupantCount) === expectedSnapshotOccupantCount &&
              sameJson(billingSnapshot.occupants, Array.from(snapshotOccupants.values())) &&
              sameJson(billingSnapshot.allocations, snapshotAllocations));
            if (!winnerMatchesCandidate) {
              throw new ConflictException(
                "BILLING_SNAPSHOT_CONCURRENT_WINNER_CONFLICT",
              );
            }
          }
          const persistedItemsData = itemsData.map((invoiceItem) =>
            billingSnapshot &&
            [
              InvoiceItemType.UTILITY_WATER,
              InvoiceItemType.UTILITY_ELECTRICITY,
            ].includes(invoiceItem.type)
              ? { ...invoiceItem, billingSnapshotId: billingSnapshot.id }
              : invoiceItem,
          );

          if (!exactInvoice) {
            const draft = await tx.invoice.create({
              data: {
                tenantId,
                code: invoiceCode,
                period,
                usagePeriod,
                contractId: item.contractId,
                rentalCycleId: item.rentalCycleId,
                customerId: item.representative.id,
                status: InvoiceStatus.DRAFT,
                billingKind: "MONTHLY_BASE",
                baseInvoiceKey,
                dueDate,
                subtotal: item.totalAmount,
                total: item.totalAmount,
                discount: 0,
                paidAmount: 0,
                items: { create: persistedItemsData },
              },
            });
            const issued = await tx.invoice.update({
              where: {
                id: draft.id,
                tenantId,
                status: InvoiceStatus.DRAFT,
              },
              data: { status: InvoiceStatus.ISSUED },
            });
            return { invoice: issued, replayed: false };
          }

          // Chỉ DRAFT canonical mới được hoàn thiện. Xóa/tạo item và CAS issue
          // cùng transaction; mọi trạng thái đã phát hành là append-only.
          await tx.invoiceItem.deleteMany({
            where: {
              invoiceId: exactInvoice.id,
              tenantId,
            },
          });
          const issued = await tx.invoice.update({
            where: {
              id: exactInvoice.id,
              tenantId,
              status: InvoiceStatus.DRAFT,
            },
            data: {
              status: InvoiceStatus.ISSUED,
              period,
              usagePeriod,
              subtotal: item.totalAmount,
              total: item.totalAmount,
              items: { create: persistedItemsData },
            },
          });
          return { invoice: issued, replayed: false };
        });

      let persisted: { invoice: any; replayed: boolean };
      try {
        persisted = await persistMonthlyBase();
      } catch (error: any) {
        if (error?.code !== "P2002") throw error;
        const exact = await this.prisma.invoice.findFirst({
          where: {
            tenantId,
            billingKind: "MONTHLY_BASE",
            baseInvoiceKey,
            deletedAt: null,
          },
        });
        if (!exact) throw error;
        persisted =
          exact.status === InvoiceStatus.DRAFT
            ? await persistMonthlyBase()
            : { invoice: exact, replayed: true };
      }
      invoice = persisted.invoice;

      if (persisted.replayed) {
        skippedInvoices.push({
          roomId: item.roomId,
          roomCode: item.roomCode,
          invoiceId: invoice.id,
          invoiceCode: invoice.code,
          status: invoice.status,
          reason:
            "Hóa đơn base tháng đã được phát hành đồng thời; không ghi đè dữ liệu kinh tế.",
        });
        continue;
      }

      settledInvoices.push({
        roomId: item.roomId,
        roomCode: item.roomCode,
        contractId: item.contractId,
        invoiceId: invoice.id,
        invoiceCode: invoice.code,
        totalAmount: item.totalAmount,
      });

      if (item.electricityEligible) {
        const lockRow = {
          buildingCode: item.buildingCode,
          roomCode: item.roomCode,
          period: usagePeriod,
          note: `Khóa chỉ số điện sử dụng tháng ${usagePeriod} cho kỳ thu ${period}`,
        };
        const lockKey = `${lockRow.buildingCode}:${lockRow.roomCode}:${lockRow.period}`;
        if (
          !lockRows.some(
            (row) =>
              `${row.buildingCode}:${row.roomCode}:${row.period}` === lockKey,
          )
        ) {
          lockRows.push(lockRow);
        }
      }
    }

    // Khóa kỳ công tơ điện trong Hunonic
    if (lockRows.length > 0) {
      try {
        await this.hunonicService.lockPeriods(tenantId, { rows: lockRows });
      } catch (e: any) {
        this.logger.warn(`Could not lock Hunonic meter periods: ${e?.message}`);
      }
    }

    // Nếu chọn tự động gửi thông báo ngay
    let sentCount = 0;
    if (input.autoSend) {
      const sendResult = await this.sendNotifications(tenantId, userId, {
        period,
        invoiceIds: settledInvoices.map((s) => s.invoiceId),
      });
      sentCount = sendResult.sentCount;
    }

    await this.auditService.log({
      action: "UPDATE",
      module: "MonthlySettlement",
      entity: "Settlement",
      entityId: period,
      tenantId,
      userId,
      after: { settledCount: settledInvoices.length, sentCount, period },
    });

    return {
      success: true,
      period,
      settledCount: settledInvoices.length,
      skippedCount: skippedInvoices.length,
      sentCount,
      invoices: settledInvoices,
      skippedInvoices,
    };
  }

  /**
   * Gửi thông báo thanh toán Zalo (hỗ trợ gửi danh sách hoặc toàn bộ)
   */
  async sendNotifications(
    tenantId: string,
    userId: string,
    input: {
      period?: string;
      roomIds?: string[];
      invoiceIds?: string[];
    },
  ) {
    const period = input.period || formatVietnamPeriod();
    const overview = await this.getOverview(tenantId, { period });
    let targetItems = overview.items.filter(
      (i) => i.hasContract && i.representative,
    );

    if (Array.isArray(input.roomIds) && input.roomIds.length > 0) {
      targetItems = targetItems.filter((i) =>
        input.roomIds?.includes(i.roomId),
      );
    }
    if (Array.isArray(input.invoiceIds) && input.invoiceIds.length > 0) {
      targetItems = targetItems.filter(
        (i) => i.invoiceId && input.invoiceIds?.includes(i.invoiceId),
      );
    }

    let sentCount = 0;
    let failedCount = 0;
    const results = [];

    for (const item of targetItems) {
      let invoiceId = item.invoiceId;

      // Nếu chưa có invoice, tạo invoice trước
      if (!invoiceId) {
        const closeRes = await this.closeMonth(tenantId, userId, {
          period,
          roomIds: [item.roomId],
          autoSend: false,
        });
        invoiceId = closeRes.invoices[0]?.invoiceId;
      }

      if (!invoiceId) {
        results.push({
          roomId: item.roomId,
          roomCode: item.roomCode,
          status: "FAILED",
          message: "Không tìm thấy hoặc không thể tạo hóa đơn.",
        });
        failedCount += 1;
        continue;
      }

      const hasZalo = Boolean(
        item.representative?.hasZalo ||
        item.representative?.zaloChatId ||
        item.representative?.zaloUserId,
      );

      if (!hasZalo) {
        results.push({
          roomId: item.roomId,
          roomCode: item.roomCode,
          invoiceId,
          status: "FAILED",
          message:
            "Khách hàng chưa đăng ký / liên kết Zalo Bot (cần chat_id hoặc user_id).",
        });
        failedCount += 1;
        continue;
      }

      try {
        await this.paymentsService.sendInvoiceRequestToZalo(invoiceId, userId);
        results.push({
          roomId: item.roomId,
          roomCode: item.roomCode,
          invoiceId,
          status: "SUCCESS",
          message: "Đã gửi thông báo thanh toán qua Zalo thành công.",
        });
        sentCount += 1;
      } catch (err: any) {
        this.logger.error(
          `Error sending Zalo payment notification for room ${item.roomCode}: ${err?.message}`,
        );
        results.push({
          roomId: item.roomId,
          roomCode: item.roomCode,
          invoiceId,
          status: "FAILED",
          message: err?.message || "Không thể gửi tin nhắn qua Zalo.",
        });
        failedCount += 1;
      }
    }

    return {
      period,
      totalRequested: targetItems.length,
      sentCount,
      failedCount,
      results,
    };
  }

  /**
   * Gửi lại thông báo cho 1 phòng cụ thể
   */
  async resendSingle(
    tenantId: string,
    userId: string,
    roomId: string,
    period?: string,
  ) {
    const targetPeriod = period || formatVietnamPeriod();
    const result = await this.sendNotifications(tenantId, userId, {
      period: targetPeriod,
      roomIds: [roomId],
    });

    const itemResult = result.results[0];
    if (itemResult?.status === "SUCCESS") {
      return { success: true, message: itemResult.message };
    } else {
      throw new BadRequestException(
        itemResult?.message || "Gửi thông báo Zalo thất bại.",
      );
    }
  }
}
