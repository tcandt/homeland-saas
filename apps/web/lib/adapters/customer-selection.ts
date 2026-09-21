import { maskPhone, maskCccd } from './tenant-masking.adapter';

type CustomerSelection = {
  id: string;
  phone?: string | null;
  identityNo?: string | null;
  roomId?: string | null;
  room?: { id?: string } | null;
  occupancies?: Array<{ roomId?: string; room?: { id?: string }; leftAt?: string | null }>;
  contracts?: Array<{ roomId?: string; status?: string; deletedAt?: string | null }>;
};

export function evaluateExistingCustomerSelection(customer: CustomerSelection, currentRoomId: string) {
  const openOccupancies = (customer.occupancies || []).filter((occupancy) => !occupancy.leftAt);
  const isInCurrentRoom = openOccupancies.some((occupancy) => (occupancy.roomId || occupancy.room?.id) === currentRoomId);
  const isInAnotherRoom = openOccupancies.some((occupancy) => {
    const roomId = occupancy.roomId || occupancy.room?.id;
    return Boolean(roomId && roomId !== currentRoomId);
  });
  // Legacy roomId is not an occupancy source. Without the authoritative relation,
  // a cached binding requires reconciliation before we can safely change rooms.
  const hasUnknownRoom = (!Array.isArray(customer.occupancies) && Boolean(customer.roomId || customer.room?.id)) ||
    openOccupancies.some((occupancy) => !occupancy.roomId && !occupancy.room?.id);
  const hasConflictingContract = (customer.contracts || []).some((contract) =>
    !contract.deletedAt &&
    ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'EXPIRING'].includes(contract.status || '') &&
    Boolean(contract.roomId && contract.roomId !== currentRoomId),
  );
  return {
    isSelectable: Boolean(currentRoomId) && !isInCurrentRoom && !isInAnotherRoom && !hasUnknownRoom && !hasConflictingContract,
    isInCurrentRoom, isInAnotherRoom, hasUnknownRoom, hasConflictingContract,
    maskedPhone: maskPhone(customer.phone), maskedCccd: maskCccd(customer.identityNo),
  };
}
