import { BadRequestException } from '@nestjs/common';
import { DepositStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DepositsService } from './deposits.service';

describe('DepositsService', () => {
  function createService() {
    const repository = {
      findById: vi.fn(),
      update: vi.fn(),
      paginate: vi.fn(),
    };
    const auditService = { log: vi.fn() };
    const eventPublisher = { publish: vi.fn() };
    return {
      repository,
      auditService,
      eventPublisher,
      service: new DepositsService(repository as any, auditService as any, eventPublisher as any),
    };
  }

  it('blocks cancelling paid deposits without an explicit resolution action', async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue({
      id: 'deposit-1',
      tenantId: 'tenant-1',
      status: DepositStatus.PAID,
    });

    await expect(service.cancel('deposit-1', 'Khach huy', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('allows cancelling paid deposits when refund keep or deduct resolution is provided', async () => {
    const { service, repository, auditService } = createService();
    const deposit = {
      id: 'deposit-1',
      tenantId: 'tenant-1',
      status: DepositStatus.PAID,
    };
    repository.findById.mockResolvedValue(deposit);
    repository.update.mockResolvedValue({ ...deposit, status: DepositStatus.CANCELLED, note: '[REFUND] Khach huy' });

    await expect(service.cancel('deposit-1', 'Khach huy', 'user-1', 'REFUND')).resolves.toMatchObject({
      status: DepositStatus.CANCELLED,
      note: '[REFUND] Khach huy',
    });

    expect(repository.update).toHaveBeenCalledWith('deposit-1', {
      status: DepositStatus.CANCELLED,
      note: '[REFUND] Khach huy',
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CANCEL',
        entity: 'Deposit',
        entityId: 'deposit-1',
      }),
    );
  });

  it('publishes a deposit.refunded event when refunding a paid deposit', async () => {
    const { service, repository, auditService, eventPublisher } = createService();
    const deposit = {
      id: 'deposit-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      code: 'DEP-001',
      amount: 1500000,
      status: DepositStatus.PAID,
      note: null,
      customer: {
        fullName: 'Nguyen Van A',
        phone: '0909000001',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    repository.update.mockResolvedValue({
      ...deposit,
      status: DepositStatus.REFUNDED,
      note: 'Tra coc',
    });

    await expect(service.refund('deposit-1', 'Tra coc', 'user-1')).resolves.toMatchObject({
      status: DepositStatus.REFUNDED,
      note: 'Tra coc',
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REFUND',
        entity: 'Deposit',
        entityId: 'deposit-1',
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.refunded',
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        customerId: 'customer-1',
        customerName: 'Nguyen Van A',
        customerPhone: '0909000001',
        sourceId: 'deposit-1',
        sourceType: 'REFUND',
        amount: 1500000,
        paymentProvider: 'MANUAL',
        metadata: expect.objectContaining({
          code: 'DEP-001',
          note: 'Tra coc',
          refundSourceType: 'DEPOSIT',
        }),
      }),
    );
  });

  it('publishes a deposit.deducted event when deducting a paid deposit on cancel', async () => {
    const { service, repository, auditService, eventPublisher } = createService();
    const deposit = {
      id: 'deposit-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      code: 'DEP-001',
      amount: 1500000,
      status: DepositStatus.PAID,
      note: null,
      customer: {
        fullName: 'Nguyen Van A',
        phone: '0909000001',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    repository.update.mockResolvedValue({
      ...deposit,
      status: DepositStatus.CANCELLED,
      note: '[DEDUCT] Giu lai tien coc',
    });

    await expect(service.cancel('deposit-1', 'Giu lai tien coc', 'user-1', 'DEDUCT')).resolves.toMatchObject({
      status: DepositStatus.CANCELLED,
      note: '[DEDUCT] Giu lai tien coc',
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CANCEL',
        entity: 'Deposit',
        entityId: 'deposit-1',
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.deducted',
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        customerId: 'customer-1',
        customerName: 'Nguyen Van A',
        customerPhone: '0909000001',
        sourceId: 'deposit-1',
        sourceType: 'ADJUSTMENT',
        amount: 1500000,
        paymentProvider: 'MANUAL',
        metadata: expect.objectContaining({
          code: 'DEP-001',
          note: 'Giu lai tien coc',
          adjustmentType: 'DEPOSIT_DEDUCTION',
          resolutionAction: 'DEDUCT',
        }),
      }),
    );
  });
});
