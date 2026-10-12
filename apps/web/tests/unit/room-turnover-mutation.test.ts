import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invalidateQueries, update } = vi.hoisted(() => ({ invalidateQueries: vi.fn(), update: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useMutation: (options: any) => options,
}));
vi.mock('../../lib/api/rooms.api', () => ({ roomsApi: { update } }));
vi.mock('@/components/ui/ToastContext', () => ({ useToast: () => ({ showToast: vi.fn() }) }));

import { useCompleteRoomTurnoverMutation } from '../../lib/mutations/rooms.mutations';

describe('Authoritative room turnover mutation', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses guarded status patch without optimistic room changes', async () => {
    const mutation: any = useCompleteRoomTurnoverMutation();
    update.mockResolvedValue({ status: 'AVAILABLE' });
    await mutation.mutationFn('room-1');
    expect(update).toHaveBeenCalledWith('room-1', { status: 'AVAILABLE' });
    expect(mutation.onMutate).toBeUndefined();
  });
  it('refreshes room and contract evidence after success or conflict', async () => {
    const mutation: any = useCompleteRoomTurnoverMutation();
    update.mockRejectedValue(new Error('ROOM_TURNOVER_ROOM_IN_USE'));
    await expect(mutation.mutationFn('room-1')).rejects.toThrow('ROOM_TURNOVER_ROOM_IN_USE');
    mutation.onSettled();
    for (const key of [['buildings'], ['rooms'], ['contracts'], ['contracts', 'detail'], ['dashboard']]) {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: key });
    }
  });
});
