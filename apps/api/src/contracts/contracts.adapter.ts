import { ContractStatus } from '@prisma/client';

/**
 * Normalizes ContractStatus to ensure compatibility.
 */
export function normalizeContractStatus(status: string | undefined): ContractStatus | undefined {
  if (!status) return undefined;

  // The DTO validation (zod) will ensure it's one of the valid strings.
  return status as ContractStatus;
}

export const TERMINAL_CONTRACT_STATUSES: ContractStatus[] = [
  ContractStatus.EXPIRED,
  ContractStatus.TERMINATED,
  ContractStatus.CANCELLED
];

export const ACTIVE_LIKE_CONTRACT_STATUSES: ContractStatus[] = [
  ContractStatus.ACTIVE,
  ContractStatus.EXPIRING
];

/**
 * Maps a status string from a query filter.
 */
export function mapStatusFilter(status: string | undefined): any {
  if (!status) return undefined;
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
