export type RoomOperationContext = {
  roomId: string;
  buildingId?: string;
  floorId?: string;
  rentalType?: string;
  generation: number;
};

export type RentalIntentContext = {
  customerId: string;
  roomId: string;
  buildingId: string;
  floorId: string;
  rentalType: string;
  generation: number;
};

export function advanceTenantSelectionContext(
  context: RoomOperationContext,
  overrides?: Partial<RoomOperationContext> | string,
): RoomOperationContext {
  const next = typeof overrides === "string" ? { roomId: overrides } : (overrides || {});
  return {
    roomId: next.roomId ?? context.roomId,
    buildingId: next.buildingId ?? context.buildingId ?? "",
    floorId: next.floorId ?? context.floorId ?? "",
    rentalType: next.rentalType ?? context.rentalType ?? "",
    generation: context.generation + 1,
  };
}

export function isRentalIntentContextCurrent(
  context: RoomOperationContext | RentalIntentContext,
  roomIdOrTarget:
    | string
    | {
        roomId: string;
        buildingId?: string;
        floorId?: string;
        rentalType?: string;
        generation: number;
      },
  generation?: number,
): boolean {
  if (typeof roomIdOrTarget === "string") {
    return context.roomId === roomIdOrTarget && context.generation === generation;
  }
  if (
    context.roomId !== roomIdOrTarget.roomId ||
    context.generation !== roomIdOrTarget.generation
  ) {
    return false;
  }
  if (
    roomIdOrTarget.buildingId &&
    context.buildingId &&
    context.buildingId !== roomIdOrTarget.buildingId
  ) {
    return false;
  }
  if (
    roomIdOrTarget.floorId &&
    context.floorId &&
    context.floorId !== roomIdOrTarget.floorId
  ) {
    return false;
  }
  if (
    roomIdOrTarget.rentalType &&
    context.rentalType &&
    context.rentalType !== roomIdOrTarget.rentalType
  ) {
    return false;
  }
  return true;
}

export const advanceRoomOperationContext = advanceTenantSelectionContext;
export const isRoomOperationContextCurrent = isRentalIntentContextCurrent;

export function createRentalIntentContext(
  paramsOrRoom:
    | {
        customerId: string;
        roomId: string;
        buildingId?: string;
        floorId?: string;
        rentalType?: string;
        generation: number;
      }
    | RoomOperationContext,
  customerId?: string,
  _customerName?: string,
): RentalIntentContext {
  if (customerId && "roomId" in paramsOrRoom && "generation" in paramsOrRoom) {
    const room = paramsOrRoom as RoomOperationContext;
    return {
      customerId,
      roomId: room.roomId,
      buildingId: room.buildingId || "",
      floorId: room.floorId || "",
      rentalType: room.rentalType || "",
      generation: room.generation,
    };
  }
  const params = paramsOrRoom as {
    customerId: string;
    roomId: string;
    buildingId?: string;
    floorId?: string;
    rentalType?: string;
    generation: number;
  };
  return {
    customerId: params.customerId,
    roomId: params.roomId,
    buildingId: params.buildingId || "",
    floorId: params.floorId || "",
    rentalType: params.rentalType || "",
    generation: params.generation,
  };
}

export function resolveDepositCustomerId(
  selectedCustomerId: string,
  retainedCustomerId: string,
) {
  return selectedCustomerId || retainedCustomerId;
}

export function buildRoomBookingIdempotencyKey(
  roomId: string,
  customerId: string,
  generation: number | string,
): string {
  return `room-flow:booking:${roomId}:${customerId}:${generation}`;
}
