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
      tx: {
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
});
