import { isNonTerminalContract } from './room-status.adapter';

export interface DeduplicatedContractsResult<T = any> {
  activeContracts: T[];
  historicalContracts: T[];
  allContracts: T[];
}

/**
 * Pure adapter to deduplicate contracts from diverse sources (tenant, roommates, sharedTenants, room.contracts).
 * Key precedence: contract.id -> contract.code.
 */
export function deduplicateContracts<T extends Record<string, any>>(
  contracts: (T | null | undefined)[]
): DeduplicatedContractsResult<T> {
  if (!Array.isArray(contracts)) {
    return { activeContracts: [], historicalContracts: [], allContracts: [] };
  }

  const seenKeys = new Set<string>();
  const uniqueContracts: T[] = [];

  for (const contract of contracts) {
    if (!contract || typeof contract !== "object") continue;
    if (contract.deletedAt) continue;

    const id = contract.id ? String(contract.id).trim() : "";
    const code = contract.code ? String(contract.code).trim() : "";
    const key = id ? `id:${id}` : (code ? `code:${code}` : "");

    if (!key) {
      // If neither id nor code exists, keep it as an anonymous row rather than discarding or merging
      uniqueContracts.push(contract);
      continue;
    }

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    uniqueContracts.push(contract);
  }

  const activeContracts: T[] = [];
  const historicalContracts: T[] = [];

  for (const contract of uniqueContracts) {
    if (isNonTerminalContract(contract)) {
      activeContracts.push(contract);
    } else {
      historicalContracts.push(contract);
    }
  }

  return {
    activeContracts,
    historicalContracts,
    allContracts: uniqueContracts,
  };
}
