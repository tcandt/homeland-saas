import { describe, it, expect, vi, beforeEach } from 'vitest';
import { depositsApi } from '../../lib/api/deposits.api';
import { apiClient } from '../../lib/api/client';

describe('D2-FIX-09: Production Deposit API Commands & Invariants', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('convertToContract sends POST /deposits/:id/convert-contract with securityRequired, excessAction and Idempotency-Key', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true, operationId: 'op-1' } } as any);

    await depositsApi.convertToContract(
      'dep-booking-1',
      {
        securityRequired: 5000000,
        contractId: 'contract-1',
        excessAction: 'CREDIT',
        refundStatus: 'COMPLETED',
      },
      'idemp-convert-key-123'
    );

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      '/deposits/dep-booking-1/convert-contract',
      {
        securityRequired: 5000000,
        contractId: 'contract-1',
        excessAction: 'CREDIT',
        refundStatus: 'COMPLETED',
        idempotencyKey: 'idemp-convert-key-123',
      },
      {
        headers: { 'Idempotency-Key': 'idemp-convert-key-123' },
      }
    );
  });

  it('cancel deposit sends POST /deposits/:id/commands/cancel with allocations and Idempotency-Key', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true, operationId: 'op-cancel-1' } } as any);

    await depositsApi.cancel(
      'dep-paid-1',
      {
        reason: 'Khách hủy thuê phòng do chuyển công tác',
        refundAmount: 3000000,
        keepAmount: 2000000,
        deductAmount: 0,
        refundStatus: 'PENDING',
      },
      'idemp-cancel-key-456'
    );

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      '/deposits/dep-paid-1/commands/cancel',
      {
        reason: 'Khách hủy thuê phòng do chuyển công tác',
        refundAmount: 3000000,
        keepAmount: 2000000,
        deductAmount: 0,
        refundStatus: 'PENDING',
        idempotencyKey: 'idemp-cancel-key-456',
      },
      {
        headers: { 'Idempotency-Key': 'idemp-cancel-key-456' },
      }
    );
  });

  it('completePendingRefund sends POST /deposits/operations/:operationId/refund/complete using operationId, NOT depositId', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true, operationId: 'op-refund-pending-999' } } as any);

    await depositsApi.completePendingRefund(
      'op-refund-pending-999',
      undefined,
      'idemp-complete-refund-789'
    );

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      '/deposits/operations/op-refund-pending-999/refund/complete',
      { idempotencyKey: 'idemp-complete-refund-789' },
      {
        headers: { 'Idempotency-Key': 'idemp-complete-refund-789' },
      }
    );
  });

  it('collect deposit sends POST /deposits/:id/collect with note and Idempotency-Key header', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } } as any);

    await depositsApi.collect('dep-1', { note: 'Thu qua SePay VietQR' }, 'idemp-collect-001');

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      '/deposits/dep-1/collect',
      { note: 'Thu qua SePay VietQR', idempotencyKey: 'idemp-collect-001' },
      { headers: { 'Idempotency-Key': 'idemp-collect-001' } }
    );
  });

  it('getOperationStatus queries /deposits/operations/status with idempotencyKey param', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { status: 'COMPLETED' } } as any);

    await depositsApi.getOperationStatus('idemp-key-check');

    expect(getSpy).toHaveBeenCalledWith('/deposits/operations/status', {
      params: { idempotencyKey: 'idemp-key-check' },
    });
  });
});
