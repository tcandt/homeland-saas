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

/**
 * Checks if a contract is in a terminal state where no further actions can occur.
 */
export function isTerminalContractStatus(status: ContractStatus): boolean {
  return ([
    ContractStatus.ENDED,       // Legacy
    ContractStatus.EXPIRED,     // New
    ContractStatus.TERMINATED,  // New
    ContractStatus.CANCELLED    // Existing
  ] as ContractStatus[]).includes(status);
}

/**
 * Checks if a contract is considered 'active-like', occupying a room and billing rent.
 */
export function isActiveLikeContractStatus(status: ContractStatus): boolean {
  return ([
    ContractStatus.ACTIVE,
    ContractStatus.EXPIRING
  ] as ContractStatus[]).includes(status);
}
