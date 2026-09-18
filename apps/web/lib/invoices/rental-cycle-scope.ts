export type InvoiceRentalCycleScope = {
  roomId: string;
  customerId: string;
  contractId: string;
  rentalCycleId: string;
};

type FinanceCandidate = {
  customerId?: string;
  contractId?: string;
  cycleId?: string;
};

/**
 * A finance action is only safe to open when its complete server identity is
 * known. Keeping this separate from display fields prevents a room shared by
 * multiple rental cycles from silently falling back to another contract.
 */
export function createInvoiceRentalCycleScope(
  roomId: string | undefined,
  candidate: FinanceCandidate | null | undefined,
): InvoiceRentalCycleScope | null {
  if (
    !roomId ||
    !candidate?.customerId ||
    !candidate.contractId ||
    !candidate.cycleId
  ) {
    return null;
  }

  return {
    roomId,
    customerId: candidate.customerId,
    contractId: candidate.contractId,
    rentalCycleId: candidate.cycleId,
  };
}

export function withInvoiceRentalCycleScope<T extends object>(
  payload: T,
  scope?: InvoiceRentalCycleScope,
): T & Partial<InvoiceRentalCycleScope> {
  return scope ? { ...payload, ...scope } : payload;
}

/**
 * A source-document drawer must fail closed when a previously selected invoice
 * no longer belongs to the finance identity currently displayed by the room.
 */
export function isInvoiceInRentalCycleScope(
  invoice: any,
  scope: InvoiceRentalCycleScope | null | undefined,
): boolean {
  if (!invoice || !scope) return false;

  const invoiceRoomId =
    invoice.roomId || invoice.contract?.roomId || invoice.contract?.room?.id;

  return (
    invoiceRoomId === scope.roomId &&
    invoice.customerId === scope.customerId &&
    invoice.contractId === scope.contractId &&
    invoice.rentalCycleId === scope.rentalCycleId
  );
}

export function isSameInvoiceRentalCycleScope(
  left: InvoiceRentalCycleScope | null | undefined,
  right: InvoiceRentalCycleScope | null | undefined,
): boolean {
  return Boolean(
    left &&
      right &&
      left.roomId === right.roomId &&
      left.customerId === right.customerId &&
      left.contractId === right.contractId &&
      left.rentalCycleId === right.rentalCycleId,
  );
}
