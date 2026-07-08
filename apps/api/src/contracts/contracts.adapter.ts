import { ContractStatus } from '@prisma/client';

/**
 * Normalizes ContractStatus to ensure compatibility during the Expand -> Migrate -> Contract transition.
 * Maps legacy `ENDED` to `EXPIRED` or `TERMINATED` based on dates, if needed, or simply returns the safe status.
 */
export function normalizeContractStatus(status: string | undefined): ContractStatus | undefined {
  if (!status) return undefined;

  // If the client sends an old status, we might need to map it if we are strictly converting,
  // but for Phase A, we just ensure it's a valid enum.
  // The DTO validation (zod) will ensure it's one of the valid strings.
  return status as ContractStatus;
}

export const TERMINAL_CONTRACT_STATUSES: ContractStatus[] = [
  ContractStatus.ENDED,       // Legacy
  ContractStatus.EXPIRED,     // New
  ContractStatus.TERMINATED,  // New
  ContractStatus.CANCELLED    // Existing
];

export const ACTIVE_LIKE_CONTRACT_STATUSES: ContractStatus[] = [
  ContractStatus.ACTIVE,
  ContractStatus.EXPIRING
];

/**
 * Maps a status string from a query filter to support legacy ENDED fallback.
 * If the client queries for ENDED, we return all terminal statuses.
 */
export function mapStatusFilter(status: string | undefined): any {
  if (!status) return undefined;
  if (status === ContractStatus.ENDED) {
    return { in: TERMINAL_CONTRACT_STATUSES };
  }
  return status;
}

/**
 * Checks if a contract is in a terminal state where no further actions can occur.
 */
export function isTerminalContractStatus(status: ContractStatus): boolean {
  return TERMINAL_CONTRACT_STATUSES.includes(status);
}

/**
 * Checks if a contract is considered 'active-like', occupying a room and billing rent.
 */
export function isActiveLikeContractStatus(status: ContractStatus): boolean {
  return ACTIVE_LIKE_CONTRACT_STATUSES.includes(status);
}
