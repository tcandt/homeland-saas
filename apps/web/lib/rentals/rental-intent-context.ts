export type RentalIntentContext = {
  customerId: string;
  roomId: string;
  buildingId: string;
  generation: number;
};

export function isRentalIntentContextCurrent(
  context: RentalIntentContext,
  roomId: string,
  generation: number,
) {
  return context.roomId === roomId && context.generation === generation;
}

export function resolveDepositCustomerId(
  selectedCustomerId: string,
  retainedCustomerId: string,
) {
  return selectedCustomerId || retainedCustomerId;
}
