import { describe, it, expect, vi } from 'vitest';
import {
  createRentalIntentContext,
  advanceRoomOperationContext,
  isRentalIntentContextCurrent,
  isRoomOperationContextCurrent,
  buildRoomBookingIdempotencyKey,
  RoomOperationContext,
  RentalIntentContext,
} from '../../lib/rentals/rental-intent-context';

describe('P0.1, P0.2, P0.3: Rental Intent Context Lifecycle & Idempotency Safeguards', () => {
  const roomA: RoomOperationContext = {
    roomId: 'room-101',
    buildingId: 'bldg-1',
    floorId: 'floor-1',
    rentalType: 'WHOLE',
    generation: 1,
  };

  const roomB: RoomOperationContext = {
    roomId: 'room-102',
    buildingId: 'bldg-1',
    floorId: 'floor-1',
    rentalType: 'WHOLE',
    generation: 1,
  };

  describe('P0.1: Context Binding across cancel/reopen/change', () => {
    it('invalidates context when room or building or floor or rentalType changes', () => {
      const intentA = createRentalIntentContext(roomA, 'tenant-001', 'Nguyen Van A');

      // Attempting to match intentA with roomB must fail
      expect(isRentalIntentContextCurrent(intentA, roomB)).toBe(false);

      // Attempting to match intentA with different rentalType must fail
      const roomADifferentType: RoomOperationContext = {
        ...roomA,
        rentalType: 'SHARED',
      };
      expect(isRentalIntentContextCurrent(intentA, roomADifferentType)).toBe(false);

      // Attempting to match intentA with different building must fail
      const roomADifferentBuilding: RoomOperationContext = {
        ...roomA,
        buildingId: 'bldg-2',
      };
      expect(isRentalIntentContextCurrent(intentA, roomADifferentBuilding)).toBe(false);

      // Exact match passes
      expect(isRentalIntentContextCurrent(intentA, roomA)).toBe(true);
    });

    it('advances generation on reopen to prevent stale async commits', () => {
      const advancedRoomA = advanceRoomOperationContext(roomA);
      expect(advancedRoomA.generation).toBe(roomA.generation + 1);
      expect(advancedRoomA.roomId).toBe(roomA.roomId);

      const staleIntent = createRentalIntentContext(roomA, 'tenant-001');
      // Stale intent from generation 1 cannot be committed to advanced room generation 2
      expect(isRentalIntentContextCurrent(staleIntent, advancedRoomA)).toBe(false);
    });
  });

  describe('P0.2: In-flight race condition: room switch / cancel while tenant draft request is pending', () => {
    it('rejects in-flight customer resolution when user switched rooms during fetch', async () => {
      let currentRoomContext: RoomOperationContext = { ...roomA };

      // Simulate an async tenant search or draft creation that takes time
      const simulateAsyncTenantResolution = async (contextAtStart: RoomOperationContext) => {
        // Simulating latency
        await new Promise((resolve) => setTimeout(resolve, 10));

        // When resolution finishes, verify if the context is still current
        if (!isRoomOperationContextCurrent(contextAtStart, currentRoomContext)) {
          return { status: 'REJECTED_STALE_CONTEXT' };
        }

        const intent = createRentalIntentContext(contextAtStart, 'tenant-race-1', 'Le Thi B');
        return { status: 'COMMITTED', intent };
      };

      // 1. User starts selecting tenant in roomA
      const inFlightPromise = simulateAsyncTenantResolution(currentRoomContext);

      // 2. User quickly switches room to roomB before request finishes
      currentRoomContext = { ...roomB, generation: 1 };

      // 3. Request completes
      const result = await inFlightPromise;

      expect(result.status).toBe('REJECTED_STALE_CONTEXT');
      expect((result as any).intent).toBeUndefined();
    });

    it('rejects in-flight customer resolution when modal is closed and reopened for same room', async () => {
      let currentRoomContext: RoomOperationContext = { ...roomA };

      const simulateAsyncTenantResolution = async (contextAtStart: RoomOperationContext) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (!isRoomOperationContextCurrent(contextAtStart, currentRoomContext)) {
          return { status: 'REJECTED_STALE_CONTEXT' };
        }
        return { status: 'COMMITTED', intent: createRentalIntentContext(contextAtStart, 'tenant-race-2') };
      };

      const inFlightPromise = simulateAsyncTenantResolution(currentRoomContext);

      // User closed modal and reopened -> generation advanced
      currentRoomContext = advanceRoomOperationContext(currentRoomContext);

      const result = await inFlightPromise;
      expect(result.status).toBe('REJECTED_STALE_CONTEXT');
    });
  });

  describe('P0.3: Double-click & retry idempotency command generation', () => {
    it('produces identical deterministic idempotency key on rapid double-click in same session', () => {
      const customerId = 'cus-456';
      const bookingGeneration = roomA.generation;

      const keyClick1 = buildRoomBookingIdempotencyKey(roomA.roomId, customerId, bookingGeneration);
      const keyClick2 = buildRoomBookingIdempotencyKey(roomA.roomId, customerId, bookingGeneration);

      expect(keyClick1).toBe(keyClick2);
      expect(keyClick1).toBe('room-flow:booking:room-101:cus-456:1');
    });

    it('produces a new command key when session reloads / modal reopens with next generation', () => {
      const customerId = 'cus-456';
      const initialKey = buildRoomBookingIdempotencyKey(roomA.roomId, customerId, roomA.generation);

      // Reopen modal / session reload
      const reloadedRoom = advanceRoomOperationContext(roomA);
      const reloadedKey = buildRoomBookingIdempotencyKey(reloadedRoom.roomId, customerId, reloadedRoom.generation);

      expect(reloadedKey).not.toBe(initialKey);
      expect(reloadedKey).toBe('room-flow:booking:room-101:cus-456:2');
    });
  });
});
