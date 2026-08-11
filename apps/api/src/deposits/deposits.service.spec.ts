import { BadRequestException } from '@nestjs/common';
import { DepositStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DepositsService } from './deposits.service';

describe('DepositsService', () => {
  function createService() {
    const repository = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      paginate: vi.fn(),
    };
    const prisma = {
      receipt: {
        findFirst: vi.fn(),
      },
      task: {
        findFirst: vi.fn(),
      },
      tx: {
        deposit: {
          update: vi.fn(),
        },
        receipt: {
          create: vi.fn(),
          update: vi.fn(),
        },
        task: {
          create: vi.fn(),
          update: vi.fn(),
        },
        $transaction: vi.fn((callback) => callback(prisma.tx)),
      },
    };
    const auditService = { log: vi.fn() };
    const eventPublisher = { publish: vi.fn() };
    return {
      prisma,
      repository,
      auditService,
      eventPublisher,
      service: new DepositsService(repository as any, auditService as any, eventPublisher as any, prisma as any),
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

  it('publishes a deposit.created event when creating a deposit', async () => {
    const { service, repository, auditService, eventPublisher } = createService();
    repository.create.mockResolvedValue({ id: 'deposit-1' });
    repository.findById.mockResolvedValue({
      id: 'deposit-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      code: 'DEP-001',
      amount: 1500000,
      customer: {
        fullName: 'Nguyen Van A',
        phone: '0909000001',
      },
      room: {
        code: '31-01',
        building: {
          name: 'LK01-31',
        },
      },
    });

    const payload = {
      tenant: { connect: { id: 'tenant-1' } },
      customer: { connect: { id: 'customer-1' } },
      amount: 1500000,
    };

    const result = await service.create(payload, 'user-1', 'Deposits');

    expect(result).toMatchObject({ id: 'deposit-1' });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        entity: 'Deposit',
        entityId: 'deposit-1',
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.created',
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        customerId: 'customer-1',
        customerName: 'Nguyen Van A',
        customerPhone: '0909000001',
        sourceId: 'deposit-1',
        sourceType: 'DEPOSIT',
        amount: 1500000,
        metadata: expect.objectContaining({
          code: 'DEP-001',
          roomCode: '31-01',
          buildingName: 'LK01-31',
        }),
      }),
    );
  });

  it('allows cancelling paid deposits when refund keep or deduct resolution is provided', async () => {
    const { service, repository, auditService, prisma } = createService();
    const deposit = {
      id: 'deposit-1',
      tenantId: 'tenant-1',
      code: 'DEP-CANCEL-001',
      amount: 1000000,
      status: DepositStatus.PAID,
      customer: {
        fullName: 'Nguyen Van A',
        phone: '0909000001',
      },
    };
    repository.findById.mockResolvedValue(deposit);
    prisma.tx.deposit.update.mockResolvedValue({ ...deposit, status: DepositStatus.CANCELLED, note: '[REFUND] Khach huy\nHoàn lại 1,000,000 VND' });
    prisma.tx.receipt.create.mockResolvedValue({
      id: 'receipt-cancel-1',
      code: 'RCT-DEP-CANCEL-001-REFUND-1',
      amount: 1000000,
      status: 'PENDING',
      description: 'Deposit cancellation refund for DEP-CANCEL-001 - Khach huy',
    });
    prisma.tx.task.create.mockResolvedValue({
      id: 'task-cancel-1',
      title: 'Xu ly hoan coc DEP-CANCEL-001',
      status: 'TODO',
    });

    await expect(service.cancel('deposit-1', 'Khach huy', 'user-1', 'REFUND')).resolves.toMatchObject({
      status: DepositStatus.CANCELLED,
      note: expect.stringContaining('[REFUND] Khach huy'),
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CANCEL',
        entity: 'Deposit',
        entityId: 'deposit-1',
      }),
    );
  });

  it('publishes a deposit.refunded event when refunding a paid deposit immediately', async () => {
    const { service, repository, auditService, eventPublisher, prisma } = createService();
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
    prisma.tx.deposit.update.mockResolvedValue({
      ...deposit,
      status: DepositStatus.REFUNDED,
      note: 'Tra coc',
    });
    prisma.tx.receipt.create.mockResolvedValue({
      id: 'receipt-1',
      code: 'RCT-DEP-001-REFUND-1',
      amount: 1500000,
      status: 'COMPLETED',
      description: 'Deposit refund for DEP-001 - Tra coc',
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

  it('creates a pending receipt and follow-up task when deposit refund is not completed yet', async () => {
    const { service, repository, eventPublisher, prisma } = createService();
    const deposit = {
      id: 'deposit-2',
      tenantId: 'tenant-1',
      customerId: 'customer-2',
      code: 'DEP-002',
      amount: 2300000,
      status: DepositStatus.PAID,
      note: null,
      customer: {
        fullName: 'Tran Thi B',
        phone: '0909000002',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    prisma.tx.deposit.update.mockResolvedValue({
      ...deposit,
      status: DepositStatus.REFUNDED,
      note: 'Hoan coc theo yeu cau',
    });
    prisma.tx.receipt.create.mockResolvedValue({
      id: 'receipt-2',
      code: 'RCT-DEP-002-REFUND-1',
      amount: 2300000,
      status: 'PENDING',
      description: 'Deposit refund for DEP-002 - Hoan coc theo yeu cau',
    });
    prisma.tx.task.create.mockResolvedValue({
      id: 'task-2',
      title: 'Xu ly hoan coc DEP-002',
      status: 'TODO',
    });

    await expect(
      service.refund('deposit-2', 'Hoan coc theo yeu cau', 'user-1', 'PENDING', ['https://example.test/deposit-proof.pdf']),
    ).resolves.toMatchObject({
      status: DepositStatus.REFUNDED,
    });

    expect(prisma.tx.receipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
        }),
      }),
    );
    expect(prisma.tx.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'TODO',
          priority: 'HIGH',
        }),
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.refund_requested',
      expect.objectContaining({
        sourceId: 'deposit-2',
        metadata: expect.objectContaining({
          code: 'DEP-002',
          receiptCode: 'RCT-DEP-002-REFUND-1',
          attachmentUrls: ['https://example.test/deposit-proof.pdf'],
        }),
      }),
    );
    expect(eventPublisher.publish).not.toHaveBeenCalledWith('deposit.refunded', expect.anything());
  });

  it('supports partial deposit refund and records retained amount in metadata', async () => {
    const { service, repository, eventPublisher, prisma } = createService();
    const deposit = {
      id: 'deposit-2b',
      tenantId: 'tenant-1',
      customerId: 'customer-2',
      code: 'DEP-002B',
      amount: 2300000,
      status: DepositStatus.PAID,
      note: null,
      customer: {
        fullName: 'Tran Thi B',
        phone: '0909000002',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    prisma.tx.deposit.update.mockResolvedValue({
      ...deposit,
      status: DepositStatus.REFUNDED,
      note: 'Hoan mot phan',
    });
    prisma.tx.receipt.create.mockResolvedValue({
      id: 'receipt-2b',
      code: 'RCT-DEP-002B-REFUND-1',
      amount: 1800000,
      status: 'COMPLETED',
      description: 'Deposit refund for DEP-002B - Hoan mot phan (retain 500,000 VND)',
    });

    await expect(
      service.refund('deposit-2b', 'Hoan mot phan', 'user-1', 'COMPLETED', [], 1800000),
    ).resolves.toMatchObject({
      status: DepositStatus.REFUNDED,
    });

    expect(prisma.tx.receipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 1800000,
        }),
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.refunded',
      expect.objectContaining({
        amount: 1800000,
        metadata: expect.objectContaining({
          originalAmount: 2300000,
          refundAmount: 1800000,
          retainedAmount: 500000,
        }),
      }),
    );
  });

  it('rejects refund amount greater than deposit amount', async () => {
    const { service, repository } = createService();
    repository.findById.mockResolvedValue({
      id: 'deposit-over',
      tenantId: 'tenant-1',
      customerId: 'customer-2',
      code: 'DEP-OVER',
      amount: 1000000,
      status: DepositStatus.PAID,
    });

    await expect(service.refund('deposit-over', 'Vuot muc', 'user-1', 'COMPLETED', [], 1200000)).rejects.toThrow(
      'DEPOSIT_REFUND_AMOUNT_INVALID',
    );
  });

  it('completes a pending deposit refund and publishes deposit.refunded', async () => {
    const { service, repository, eventPublisher, prisma } = createService();
    const deposit = {
      id: 'deposit-3',
      tenantId: 'tenant-1',
      customerId: 'customer-3',
      code: 'DEP-003',
      amount: 1800000,
      status: DepositStatus.REFUNDED,
      note: 'Dang cho xu ly',
      customer: {
        fullName: 'Le Van C',
        phone: '0909000003',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    prisma.receipt.findFirst.mockResolvedValue({
      id: 'receipt-3',
      code: 'RCT-DEP-003-REFUND-1',
      amount: 1800000,
      status: 'PENDING',
      description: 'Deposit refund for DEP-003',
    });
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-3',
      title: 'Xu ly hoan coc DEP-003',
      status: 'TODO',
      description: 'Can hoan tien',
    });
    prisma.tx.receipt.update.mockResolvedValue({
      id: 'receipt-3',
      code: 'RCT-DEP-003-REFUND-1',
      amount: 1800000,
      status: 'COMPLETED',
      description: 'Deposit refund for DEP-003\nCompleted note: Da chuyen khoan',
    });
    prisma.tx.task.update.mockResolvedValue({
      id: 'task-3',
      title: 'Xu ly hoan coc DEP-003',
      status: 'DONE',
      description: 'Can hoan tien\nHoan tat: Da chuyen khoan',
    });

    await expect(service.completePendingRefund('deposit-3', 'user-1', 'Da chuyen khoan')).resolves.toEqual(
      expect.objectContaining({
        success: true,
        receiptId: 'receipt-3',
        taskId: 'task-3',
        amount: 1800000,
      }),
    );

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.refunded',
      expect.objectContaining({
        sourceId: 'deposit-3',
        metadata: expect.objectContaining({
          code: 'DEP-003',
          completedFromPending: true,
          refundCompletionNote: 'Da chuyen khoan',
        }),
      }),
    );
  });

  it('publishes a deposit.deducted event when deducting a paid deposit on cancel', async () => {
    const { service, repository, auditService, eventPublisher, prisma } = createService();
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
    prisma.tx.deposit.update.mockResolvedValue({
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

  it('keeps part of a paid deposit and creates a pending refund for the remainder on cancel', async () => {
    const { service, repository, prisma, eventPublisher } = createService();
    const deposit = {
      id: 'deposit-keep-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      code: 'DEP-KEEP-001',
      amount: 2000000,
      status: DepositStatus.PAID,
      note: null,
      customer: {
        fullName: 'Nguyen Van A',
        phone: '0909000001',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    prisma.tx.deposit.update.mockResolvedValue({
      ...deposit,
      status: DepositStatus.CANCELLED,
      note: '[KEEP] Giu coc theo chinh sach',
    });
    prisma.tx.receipt.create.mockResolvedValue({
      id: 'receipt-keep-1',
      code: 'RCT-DEP-KEEP-001-REFUND-1',
      amount: 500000,
      status: 'PENDING',
      description: 'Deposit cancellation refund for DEP-KEEP-001 - Giu coc theo chinh sach',
    });
    prisma.tx.task.create.mockResolvedValue({
      id: 'task-keep-1',
      title: 'Xu ly hoan coc DEP-KEEP-001',
      status: 'TODO',
    });

    await expect(
      service.cancel('deposit-keep-1', 'Giu coc theo chinh sach', 'user-1', 'KEEP', 1500000, 'PENDING', ['https://example.test/keep-proof.pdf']),
    ).resolves.toMatchObject({
      status: DepositStatus.CANCELLED,
    });

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.deducted',
      expect.objectContaining({
        amount: 1500000,
        metadata: expect.objectContaining({
          adjustmentType: 'DEPOSIT_RETAINED',
          retainedAmount: 1500000,
          refundableAmount: 500000,
        }),
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.refund_requested',
      expect.objectContaining({
        amount: 500000,
        metadata: expect.objectContaining({
          resolutionAction: 'KEEP',
          refundAmount: 500000,
          retainedAmount: 1500000,
        }),
      }),
    );
  });

  it('deducts part of a paid deposit and immediately refunds the remainder on cancel', async () => {
    const { service, repository, prisma, eventPublisher } = createService();
    const deposit = {
      id: 'deposit-deduct-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      code: 'DEP-DEDUCT-001',
      amount: 2000000,
      status: DepositStatus.PAID,
      note: null,
      customer: {
        fullName: 'Nguyen Van A',
        phone: '0909000001',
      },
    };

    repository.findById.mockResolvedValue(deposit);
    prisma.tx.deposit.update.mockResolvedValue({
      ...deposit,
      status: DepositStatus.CANCELLED,
      note: '[DEDUCT] Khau tru phi vi pham',
    });
    prisma.tx.receipt.create.mockResolvedValue({
      id: 'receipt-deduct-1',
      code: 'RCT-DEP-DEDUCT-001-REFUND-1',
      amount: 1200000,
      status: 'COMPLETED',
      description: 'Deposit cancellation refund for DEP-DEDUCT-001 - Khau tru phi vi pham',
    });

    await expect(
      service.cancel('deposit-deduct-1', 'Khau tru phi vi pham', 'user-1', 'DEDUCT', 800000, 'COMPLETED'),
    ).resolves.toMatchObject({
      status: DepositStatus.CANCELLED,
    });

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.deducted',
      expect.objectContaining({
        amount: 800000,
        metadata: expect.objectContaining({
          adjustmentType: 'DEPOSIT_DEDUCTION',
          deductedAmount: 800000,
          refundableAmount: 1200000,
        }),
      }),
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      'deposit.refunded',
      expect.objectContaining({
        amount: 1200000,
        metadata: expect.objectContaining({
          resolutionAction: 'DEDUCT',
          refundAmount: 1200000,
          deductedAmount: 800000,
        }),
      }),
    );
  });
});
