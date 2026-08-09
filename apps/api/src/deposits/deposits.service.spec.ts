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

    await expect(service.cancel('deposit-1', 'Khách hủy', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
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
    repository.update.mockResolvedValue({ ...deposit, status: DepositStatus.CANCELLED, note: '[REFUND] Khách hủy' });

    await expect(service.cancel('deposit-1', 'Khách hủy', 'user-1', 'REFUND')).resolves.toMatchObject({
      status: DepositStatus.CANCELLED,
      note: '[REFUND] Khách hủy',
    });

    expect(repository.update).toHaveBeenCalledWith('deposit-1', {
      status: DepositStatus.CANCELLED,
      note: '[REFUND] Khách hủy',
    });
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CANCEL',
      entity: 'Deposit',
      entityId: 'deposit-1',
    }));
  });
});
