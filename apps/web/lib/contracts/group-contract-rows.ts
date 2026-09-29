import { getLinkedRental, isBookingContract } from './booking-conversion';

export type ContractRowGroup = {
  key: string;
  rental: any;
  booking: any | null;
};

function belongsToSameConversion(booking: any, rental: any): boolean {
  if (!booking?.id || !rental?.id || booking.id === rental.id || !isBookingContract(booking)) return false;
  if ([['tenantId'], ['customerId'], ['roomId'], ['rentalCycleId']].some(([field]) =>
    booking[field] && rental[field] && booking[field] !== rental[field]
  )) return false;
  const sourceTargetId = getLinkedRental(booking)?.id;
  const targetSourceId = rental.termsSnapshot?.convertedFromBookingHold?.sourceContractId;
  if (sourceTargetId && sourceTargetId !== rental.id) return false;
  if (targetSourceId && targetSourceId !== booking.id) return false;
  return sourceTargetId === rental.id || targetSourceId === booking.id;
}

export function groupContractRows(contracts: any[]): ContractRowGroup[] {
  const byId = new Map(contracts.filter((contract) => contract?.id).map((contract) => [contract.id, contract]));
  const used = new Set<string>();
  const groups: ContractRowGroup[] = [];

  for (const contract of contracts) {
    if (!contract?.id || used.has(contract.id)) continue;
    const linkedRental = getLinkedRental(contract);
    const linkedBooking = contract.termsSnapshot?.convertedFromBookingHold?.sourceContractId;
    const candidate = linkedRental ? byId.get(linkedRental.id) : linkedBooking ? byId.get(linkedBooking) : null;
    const booking = linkedRental ? contract : candidate;
    const rental = linkedRental ? candidate : contract;
    if (candidate && !used.has(candidate.id) && belongsToSameConversion(booking, rental)) {
      groups.push({ key: rental.id, rental, booking });
      used.add(contract.id);
      used.add(candidate.id);
    } else {
      groups.push({ key: contract.id, rental: contract, booking: null });
      used.add(contract.id);
    }
  }

  return groups;
}
