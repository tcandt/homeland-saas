type RoomLike = {
  id?: string | null;
  code?: string | null;
  name?: string | null;
  rentalType?: string | null;
  capacity?: number | null;
  buildingId?: string | null;
  building?: {
    id?: string | null;
    name?: string | null;
    ownerId?: string | null;
  } | null;
};

type ContractLike = {
  id?: string | null;
  code?: string | null;
  memberCount?: number | null;
};

function normalizeRoomRentalType(value?: string | null) {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'SHARED') return 'SHARED';
  return 'WHOLE';
}

export function buildRoomContext(room?: RoomLike | null, contract?: ContractLike | null) {
  const rawRentalType = String(room?.rentalType || '').trim();
  const rentalType = rawRentalType ? normalizeRoomRentalType(rawRentalType) : null;
  const memberCount = Number(contract?.memberCount ?? 0);
  const resolvedMemberCount = Number.isFinite(memberCount) && memberCount > 0 ? memberCount : null;

  return {
    roomId: room?.id || null,
    roomCode: room?.code || null,
    roomName: room?.name || null,
    roomRentalType: rentalType,
    roomRentalTypeLabel: rentalType === 'SHARED' ? 'Phòng ghép' : rentalType === 'WHOLE' ? 'Nguyên căn' : null,
    roomMemberCount: resolvedMemberCount,
    roomCapacity: Number.isFinite(Number(room?.capacity)) ? Number(room?.capacity) : null,
    buildingId: room?.buildingId || room?.building?.id || null,
    buildingName: room?.building?.name || null,
  };
}
