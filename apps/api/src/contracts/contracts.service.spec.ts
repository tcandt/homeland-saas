import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ContractsService } from './contracts.service';
import { ContractsRepository } from './contracts.repository';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../shared/audit/audit.service';
import { DomainEventPublisher } from '../shared/events/domain-event.publisher';
import { ContractStatus, RoomStatus } from '@prisma/client';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('ContractsService', () => {
  let service: ContractsService;
  let prismaService: any;
  let auditService: any;
  let eventPublisher: any;

  beforeEach(async () => {
    prismaService = {
      hunonicMeterMapping: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      tx: { invoice: { create: vi.fn() },
        contract: {
          update: vi.fn(),
        },
        receipt: {
          create: vi.fn(),
        },
        room: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        deposit: {
          create: vi.fn(),
        },
        $transaction: vi.fn((callback) => callback(prismaService.tx)),
      },
    };

    auditService = {
      log: vi.fn(),
    };

    eventPublisher = {
      publish: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        {
          provide: ContractsRepository,
          useValue: {
            findById: vi.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
        {
          provide: DomainEventPublisher,
          useValue: eventPublisher,
        },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  describe('submitContract', () => {
    it('should submit a DRAFT contract successfully', async () => {
      const mockContract = { id: 'c1', status: ContractStatus.DRAFT };
      const updatedContract = { ...mockContract, status: ContractStatus.PENDING_APPROVAL };
      
      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);

      const result = await service.submitContract('c1', 'user1');

      expect(prismaService.tx.contract.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: ContractStatus.PENDING_APPROVAL },
      });
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE',
        entityId: 'c1',
        before: mockContract,
        after: updatedContract,
      }));
      expect(result).toEqual(updatedContract);
    });

    it('should throw BadRequestException if contract is not DRAFT', async () => {
      vi.spyOn(service, 'getDetail').mockResolvedValue({ id: 'c1', status: ContractStatus.ACTIVE } as any);

      await expect(service.submitContract('c1', 'user1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('approveContract', () => {
    it('should approve a PENDING_APPROVAL contract and create deposit', async () => {
      const mockContract = { id: 'c1', status: ContractStatus.PENDING_APPROVAL, roomId: 'r1', depositMoney: 1000, tenantId: 't1', customerId: 'cu1' };
      const updatedContract = { ...mockContract, status: ContractStatus.APPROVED };
      const mockRoom = { id: 'r1', status: RoomStatus.AVAILABLE };
      
      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);
      
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({ ...mockRoom, status: RoomStatus.RESERVED });
      prismaService.tx.deposit.create.mockResolvedValue({ id: 'd1', amount: 1000 });

      const result = await service.approveContract('c1', 'user1');

      expect(prismaService.tx.room.findUnique).toHaveBeenCalledWith({ where: { id: 'r1' } });
      expect(prismaService.tx.$transaction).toHaveBeenCalled();
      expect(prismaService.tx.contract.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: ContractStatus.APPROVED },
      });
      expect(prismaService.tx.room.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: RoomStatus.RESERVED },
      });
      expect(prismaService.tx.deposit.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          roomId: 'r1',
          status: 'DRAFT',
          amount: 1000,
        })
      }));
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE',
        entityId: 'c1',
        before: mockContract,
        after: updatedContract,
      }));
      expect(result).toEqual(updatedContract);
    });

    it('should throw BadRequestException if contract is not PENDING_APPROVAL', async () => {
      vi.spyOn(service, 'getDetail').mockResolvedValue({ id: 'c1', status: ContractStatus.DRAFT } as any);

      await expect(service.approveContract('c1', 'user1')).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if room is not AVAILABLE', async () => {
      const mockContract = { id: 'c1', status: ContractStatus.PENDING_APPROVAL, roomId: 'r1' };
      const mockRoom = { id: 'r1', status: RoomStatus.OCCUPIED };
      
      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);

      await expect(service.approveContract('c1', 'user1')).rejects.toThrow(ConflictException);
    });
  });

  describe('activateContract', () => {
    it('should activate an APPROVED contract with a PAID deposit and create invoice', async () => {
      const mockContract = { id: 'c1', status: ContractStatus.APPROVED, roomId: 'r1', depositMoney: 1000, tenantId: 't1', customerId: 'cu1', monthlyRent: 5000 };
      const updatedContract = { ...mockContract, status: ContractStatus.ACTIVE };
      const mockRoom = { id: 'r1', status: RoomStatus.RESERVED };
      const mockDeposit = { id: 'd1', status: 'PAID' };
      
      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);
      prismaService.tx.deposit.findFirst = vi.fn().mockResolvedValue(mockDeposit);
      
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({ ...mockRoom, status: RoomStatus.OCCUPIED });
      prismaService.tx.deposit.update = vi.fn().mockResolvedValue({ ...mockDeposit, status: 'CONVERTED_TO_CONTRACT' });
      prismaService.tx.invoice = { create: vi.fn().mockResolvedValue({ id: 'inv1' }) };

      const result = await service.activateContract('c1', 'user1');

      expect(prismaService.tx.room.findUnique).toHaveBeenCalledWith({ where: { id: 'r1' } });
      expect(prismaService.tx.deposit.findFirst).toHaveBeenCalledWith({ where: { contractId: 'c1' } });
      expect(prismaService.tx.$transaction).toHaveBeenCalled();
      
      expect(prismaService.tx.contract.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: ContractStatus.ACTIVE },
      });
      expect(prismaService.tx.room.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: RoomStatus.OCCUPIED },
      });
      expect(prismaService.tx.deposit.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: { status: 'CONVERTED_TO_CONTRACT' },
      });
      expect(prismaService.tx.invoice.create).toHaveBeenCalled();
      
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE',
        entityId: 'c1',
        before: mockContract,
        after: updatedContract,
      }));
      expect(result).toEqual(updatedContract);
    });

    it('should throw BadRequestException if contract is not APPROVED', async () => {
      vi.spyOn(service, 'getDetail').mockResolvedValue({ id: 'c1', status: ContractStatus.PENDING_APPROVAL } as any);
      await expect(service.activateContract('c1', 'user1')).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if room is not RESERVED', async () => {
      const mockContract = { id: 'c1', status: ContractStatus.APPROVED, roomId: 'r1' };
      const mockRoom = { id: 'r1', status: RoomStatus.AVAILABLE };
      
      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);

      await expect(service.activateContract('c1', 'user1')).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if deposit is missing', async () => {
      const mockContract = { id: 'c1', status: ContractStatus.APPROVED, roomId: 'r1' };
      const mockRoom = { id: 'r1', status: RoomStatus.RESERVED };
      
      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);
      prismaService.tx.deposit.findFirst = vi.fn().mockResolvedValue(null);

      await expect(service.activateContract('c1', 'user1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if deposit is not PAID', async () => {
      const mockContract = { id: 'c1', status: ContractStatus.APPROVED, roomId: 'r1' };
      const mockRoom = { id: 'r1', status: RoomStatus.RESERVED };
      const mockDeposit = { id: 'd1', status: 'PENDING' };
      
      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);
      prismaService.tx.room.findUnique.mockResolvedValue(mockRoom);
      prismaService.tx.deposit.findFirst = vi.fn().mockResolvedValue(mockDeposit);

      await expect(service.activateContract('c1', 'user1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('terminateContract', () => {
    it('should terminate an ACTIVE contract, update room to CLEANING, and create zero-settlement draft invoice by default', async () => {
      const mockContract = { id: 'c1', code: 'C-001', status: ContractStatus.ACTIVE, roomId: 'r1', tenantId: 't1', customerId: 'cu1', monthlyRent: 9000 };
      const updatedContract = { ...mockContract, status: ContractStatus.TERMINATED };
      
      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);
      
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({ id: 'r1', status: RoomStatus.CLEANING });
      prismaService.tx.invoice.create = vi.fn().mockResolvedValue({ id: 'inv1' });

      const result = await service.terminateContract('c1', 'user1');

      expect(prismaService.tx.$transaction).toHaveBeenCalled();
      
      expect(prismaService.tx.contract.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: ContractStatus.TERMINATED },
      });
      expect(prismaService.tx.room.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: RoomStatus.CLEANING },
      });
      expect(prismaService.tx.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          contractId: 'c1',
          status: 'DRAFT',
          subtotal: 0,
          creditAmount: 0,
        })
      }));
      
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE',
        entityId: 'c1',
        after: expect.objectContaining({
          ...updatedContract,
          settlement: expect.objectContaining({
            totals: expect.objectContaining({
              chargeTotal: 0,
              creditTotal: 0,
            }),
          }),
        }),
      }));
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'contract.settlement.completed',
        expect.objectContaining({
          sourceId: 'c1',
          sourceType: 'CONTRACT',
          amount: 0,
        }),
      );
      expect(result).toEqual(updatedContract);
    });

    it('should create itemized settlement invoice when termination input is provided', async () => {
      const mockContract = {
        id: 'c1',
        code: 'C-002',
        status: ContractStatus.ACTIVE,
        roomId: 'r1',
        tenantId: 't1',
        customerId: 'cu1',
        monthlyRent: 9000,
      };
      const updatedContract = { ...mockContract, status: ContractStatus.TERMINATED };

      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({ id: 'r1', status: RoomStatus.CLEANING });
      prismaService.tx.invoice.create = vi.fn().mockResolvedValue({ id: 'inv2' });
      prismaService.tx.receipt.create.mockResolvedValue({ id: 'rcpt-1', code: 'RCT-C-002-1', amount: 500, status: 'COMPLETED' });

      await service.terminateContract('c1', 'user1', {
        actualMoveOutDate: '2026-08-10T00:00:00.000Z',
        rentDaysCharged: 10,
        electricityAmount: 250,
        waterAmount: 100,
        depositToRefund: 500,
      });

      expect(prismaService.tx.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          contractId: 'c1',
          status: 'DRAFT',
          subtotal: 3350,
          total: 3350,
          creditAmount: 500,
          items: {
            create: [
              expect.objectContaining({
                type: 'RENT',
                amount: 3000,
                description: 'Final rent settlement (10 days)',
              }),
              expect.objectContaining({
                type: 'UTILITY_ELECTRICITY',
                amount: 250,
              }),
              expect.objectContaining({
                type: 'UTILITY_WATER',
                amount: 100,
              }),
            ],
          },
        }),
      }));
      expect(prismaService.tx.receipt.create).not.toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'contract.settlement.completed',
        expect.objectContaining({
          sourceId: 'c1',
          sourceType: 'CONTRACT',
          amount: 2850,
        }),
      );
      expect(eventPublisher.publish).not.toHaveBeenCalledWith(
        'contract.settlement.refunded',
        expect.anything(),
      );
    });

    it('should create a completed refund receipt when settlement credits exceed charges', async () => {
      const mockContract = {
        id: 'c1',
        code: 'C-REFUND',
        status: ContractStatus.ACTIVE,
        roomId: 'r1',
        tenantId: 't1',
        customerId: 'cu1',
        customer: { fullName: 'Khach A', phone: '0901' },
        monthlyRent: 9000,
      };
      const updatedContract = { ...mockContract, status: ContractStatus.TERMINATED };

      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({ id: 'r1', status: RoomStatus.CLEANING });
      prismaService.tx.invoice.create = vi.fn().mockResolvedValue({ id: 'inv3' });
      prismaService.tx.receipt.create.mockResolvedValue({ id: 'rcpt-1', code: 'RCT-C-REFUND-1', amount: 500, status: 'COMPLETED' });

      await service.terminateContract('c1', 'user1', {
        actualMoveOutDate: '2026-08-10T00:00:00.000Z',
        rentDaysCharged: 1,
        depositToRefund: 800,
      });

      expect(prismaService.tx.receipt.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 't1',
          amount: 500,
          status: 'COMPLETED',
          description: 'Contract settlement refund for C-REFUND',
        }),
      }));
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'contract.settlement.refunded',
        expect.objectContaining({
          amount: 500,
          sourceId: 'c1',
          sourceType: 'REFUND',
        }),
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        'contract.settlement.completed',
        expect.objectContaining({
          sourceId: 'c1',
          sourceType: 'CONTRACT',
          amount: 0,
        }),
      );
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATE',
        entity: 'Receipt',
        entityId: 'rcpt-1',
      }));
    });

    it('should move room to maintenance when settlement indicates maintenance turnover', async () => {
      const mockContract = {
        id: 'c1',
        code: 'C-MAINT',
        status: ContractStatus.ACTIVE,
        roomId: 'r1',
        tenantId: 't1',
        customerId: 'cu1',
        monthlyRent: 9000,
      };
      const updatedContract = { ...mockContract, status: ContractStatus.TERMINATED };

      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({ id: 'r1', status: RoomStatus.MAINTENANCE });
      prismaService.tx.invoice.create = vi.fn().mockResolvedValue({ id: 'inv4' });

      await service.terminateContract('c1', 'user1', {
        actualMoveOutDate: '2026-08-10T00:00:00.000Z',
        roomTurnoverStatus: 'MAINTENANCE',
        rentDaysCharged: 0,
      });

      expect(prismaService.tx.room.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { status: RoomStatus.MAINTENANCE },
      });
    });

    it('should throw BadRequestException if contract is not ACTIVE or EXPIRING', async () => {
      vi.spyOn(service, 'getDetail').mockResolvedValue({ id: 'c1', status: ContractStatus.DRAFT } as any);
      await expect(service.terminateContract('c1', 'user1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('previewSettlement', () => {
    it('should calculate settlement totals from explicit inputs', async () => {
      const mockContract = {
        id: 'c1',
        code: 'C-003',
        status: ContractStatus.ACTIVE,
        tenantId: 't1',
        roomId: 'r1',
        customerId: 'cu1',
        monthlyRent: 12000,
      };

      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);

      const result = await service.previewSettlement('c1', {
        actualMoveOutDate: '2026-08-10T00:00:00.000Z',
        rentDaysCharged: 5,
        electricityAmount: 300,
        waterAmount: 120,
        serviceAmount: 80,
        roomRefundAmount: 400,
        depositToRefund: 1000,
        note: 'preview',
      });

      expect(result.assumptions.monthlyRent).toBe(12000);
      expect(result.assumptions.dailyRent).toBe(400);
      expect(result.totals.chargeTotal).toBe(2500);
      expect(result.totals.creditTotal).toBe(1400);
      expect(result.totals.netReceivable).toBe(1100);
      expect(result.totals.refundToCustomer).toBe(0);
      expect(result.invoiceItems).toHaveLength(4);
      expect(result.utilitySnapshot).toEqual({ electricity: null });
    });

    it('should use Hunonic snapshot electricity amount when operator leaves electricity blank', async () => {
      const mockContract = {
        id: 'c1',
        code: 'C-004',
        status: ContractStatus.ACTIVE,
        tenantId: 't1',
        roomId: 'r1',
        customerId: 'cu1',
        monthlyRent: 12000,
      };

      prismaService.hunonicMeterMapping.findFirst.mockResolvedValue({
        id: 'meter-1',
        providerMeterId: 'provider-1',
        displayName: '31-04',
        deviceName: 'ĐIỆN 31.04',
        lastStatus: 'on',
        lastReadingKwh: 42,
        lastAmountVnd: 147000,
        lastSyncedAt: new Date('2026-08-09T09:00:00.000Z'),
        readings: [
          {
            energyMonthKwh: 42,
            moneyMonthVnd: 147000,
            powerCurrentW: 61,
            currentMonth: '2026-08',
            readingAt: new Date('2026-08-09T09:00:00.000Z'),
          },
        ],
      });
      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);

      const result = await service.previewSettlement('c1', {
        actualMoveOutDate: '2026-08-10T00:00:00.000Z',
        rentDaysCharged: 0,
      });

      expect(result.utilitySnapshot.electricity).toEqual(
        expect.objectContaining({
          displayName: '31-04',
          monthAmountVnd: 147000,
          currentMonth: '2026-08',
        }),
      );
      expect(result.settlementSnapshot).toEqual(
        expect.objectContaining({
          electricity: expect.objectContaining({
            monthAmountVnd: 147000,
            monthKwh: 42,
            currentMonth: '2026-08',
          }),
        }),
      );
      expect(result.invoiceItems).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'UTILITY_ELECTRICITY',
            amount: 147000,
          }),
        ]),
      );
    });
  });

  describe('expireContract', () => {
    it('should expire an ACTIVE contract', async () => {
      const mockContract = { id: 'c1', status: ContractStatus.ACTIVE, roomId: 'r1', tenantId: 't1', customerId: 'cu1' };
      const updatedContract = { ...mockContract, status: ContractStatus.EXPIRED };
      
      vi.spyOn(service, 'getDetail').mockResolvedValue(mockContract as any);
      
      prismaService.tx.contract.update.mockResolvedValue(updatedContract);
      prismaService.tx.room.update.mockResolvedValue({ id: 'r1', status: RoomStatus.CLEANING });
      prismaService.tx.invoice.create = vi.fn().mockResolvedValue({ id: 'inv1' });

      const result = await service.expireContract('c1', 'user1');

      expect(prismaService.tx.contract.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: ContractStatus.EXPIRED },
      });
      expect(result).toEqual(updatedContract);
    });

    it('should throw BadRequestException if contract is already EXPIRED', async () => {
      vi.spyOn(service, 'getDetail').mockResolvedValue({ id: 'c1', status: ContractStatus.EXPIRED } as any);
      await expect(service.expireContract('c1', 'user1')).rejects.toThrow(BadRequestException);
    });
  });
});
