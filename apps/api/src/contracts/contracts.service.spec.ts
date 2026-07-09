import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ContractsService } from './contracts.service';
import { ContractsRepository } from './contracts.repository';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../shared/audit/audit.service';
import { ContractStatus, RoomStatus } from '@prisma/client';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('ContractsService', () => {
  let service: ContractsService;
  let prismaService: any;
  let auditService: any;

  beforeEach(async () => {
    prismaService = {
      tx: { invoice: { create: vi.fn() },
        contract: {
          update: vi.fn(),
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
    it('should terminate an ACTIVE contract, update room to CLEANING, and create draft invoice', async () => {
      const mockContract = { id: 'c1', status: ContractStatus.ACTIVE, roomId: 'r1', tenantId: 't1', customerId: 'cu1' };
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
        })
      }));
      
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE',
        entityId: 'c1',
        after: updatedContract,
      }));
      expect(result).toEqual(updatedContract);
    });

    it('should throw BadRequestException if contract is not ACTIVE or EXPIRING', async () => {
      vi.spyOn(service, 'getDetail').mockResolvedValue({ id: 'c1', status: ContractStatus.DRAFT } as any);
      await expect(service.terminateContract('c1', 'user1')).rejects.toThrow(BadRequestException);
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
