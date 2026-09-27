export type WholeRoomOccupantCommandPreflight = {
  requiresCommand: boolean;
  contractStatus?: string | null;
  rentalCycleId?: string | null;
};

/**
 * An active whole-room secondary must belong to the contract's canonical
 * rental cycle. Check this before creating a customer so a legacy contract
 * without a cycle cannot leave an unattached customer profile behind.
 */
export function getWholeRoomOccupantCommandPreflightError(
  input: WholeRoomOccupantCommandPreflight,
): "WHOLE_OCCUPANT_RENTAL_CYCLE_REQUIRED" | null {
  if (!input.requiresCommand) return null;

  const status = String(input.contractStatus || "").toUpperCase();
  const activeContract = status === "ACTIVE" || status === "EXPIRING";
  if (activeContract && !input.rentalCycleId?.trim()) {
    return "WHOLE_OCCUPANT_RENTAL_CYCLE_REQUIRED";
  }

  return null;
}
