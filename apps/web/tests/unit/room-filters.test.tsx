import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/hooks/useRoomsStore', () => ({ useRoomsStore: vi.fn() }));
vi.mock('../../lib/queries/buildings.queries', () => ({ useBuildingsQuery: vi.fn() }));
vi.mock('../../lib/queries/rooms.queries', () => ({ useRoomsQuery: vi.fn() }));
vi.mock('../../components/buildings/building-labels', () => ({ getRoomDisplayName: vi.fn() }));

import { resetRoomFilters } from '../../components/rooms/RoomFilters';
import { toRoomQueryParams } from '../../components/rooms/RoomGrid';

describe('room filter query parameters', () => {
  it('includes each supported select value, including the actual room type', () => {
    expect(toRoomQueryParams({
      search: '101',
      buildingId: 'building-1',
      floorId: 'floor-2',
      status: 'OCCUPIED',
      type: 'Studio',
    })).toEqual({
      search: '101',
      buildingId: 'building-1',
      floorId: 'floor-2',
      status: 'OCCUPIED',
      type: 'Studio',
    });
  });

  it('omits cleared and legacy all-values from the room API query', () => {
    expect(toRoomQueryParams({
      search: '',
      buildingId: 'Tất cả',
      floorId: '',
      status: 'Tất cả',
      type: '',
    })).toEqual({
      search: undefined,
      buildingId: undefined,
      floorId: undefined,
      status: undefined,
      type: undefined,
    });
  });

  it('resets every supported room filter', () => {
    const setSearch = vi.fn();
    const setBuildingId = vi.fn();
    const setFloorId = vi.fn();
    const setStatus = vi.fn();
    const setType = vi.fn();

    resetRoomFilters({ setSearch, setBuildingId, setFloorId, setStatus, setType });

    expect(setSearch).toHaveBeenCalledWith('');
    expect(setBuildingId).toHaveBeenCalledWith('');
    expect(setFloorId).toHaveBeenCalledWith('');
    expect(setStatus).toHaveBeenCalledWith('');
    expect(setType).toHaveBeenCalledWith('');
  });
});
