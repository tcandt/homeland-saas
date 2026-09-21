import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomersRepository } from './customers.repository';
import { AuditService } from '../shared/audit/audit.service';
import { ACTIVE_LIKE_CONTRACT_STATUSES } from '../contracts/contracts.adapter';
import { PrismaService } from '../prisma.service';
import { applyTenantScope } from '../prisma.service';

describe('CustomersService', () => {
  let service: CustomersService;
  let repository: CustomersRepository;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      customer: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: CustomersRepository,
          useValue: {
            paginate: vi.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {},
        },
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    repository = module.get<CustomersRepository>(CustomersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('duplicate checks and write validation cannot expose or reject a customer from another tenant', async () => {
    const customers = [{ id: 'foreign', tenantId: 'tenant-b', phone: '0901234567', identityNo: '123456789', fullName: 'Private B' }];
    const rawFind = vi.fn(async (args: any) => customers.find((customer) =>
      (!args.where.tenantId || customer.tenantId === args.where.tenantId) &&
      (!args.where.phone || customer.phone === args.where.phone.equals) &&
      (!args.where.identityNo || customer.identityNo === args.where.identityNo.equals),
    ) || null);
    prismaService.customer.findFirst = rawFind;
    prismaService.tx = { customer: { findFirst: (args: any) => rawFind(applyTenantScope('Customer', 'findFirst', args, 'tenant-a')) } };
    await expect(service.checkDuplicate({ phone: '0901234567' })).resolves.toMatchObject({ isDuplicate: false, duplicateCustomer: null });
    await expect(service.checkDuplicate({ identityNo: '123456789' })).resolves.toMatchObject({ isDuplicate: false, duplicateCustomer: null });
    await expect(service.validateCustomerUniqueness('0901234567', '123456789')).resolves.toBeUndefined();
    expect(rawFind).toHaveBeenCalledTimes(4);
    for (const [query] of rawFind.mock.calls) expect(query.where.tenantId).toBe('tenant-a');
  });

  describe('listCustomers', () => {
    const listInclude = {
      room: {
        select: {
          id: true,
          code: true,
          name: true,
          building: { select: { id: true, code: true, name: true } },
        },
      },
      occupancies: {
        where: { leftAt: null },
        orderBy: { joinedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          contractId: true,
          role: true,
          joinedAt: true,
          room: {
            select: {
              id: true,
              code: true,
              name: true,
              building: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
      _count: { select: { contracts: true } },
    };

    it('should query active status via either contracts or open occupancy', async () => {
      await service.listCustomers(1, 10, undefined, 'ACTIVE');
      expect(repository.paginate).toHaveBeenCalledWith(
        {
          AND: [{
            OR: [
              { contracts: { some: { status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } } } },
              { occupancies: { some: { leftAt: null } } },
            ],
          }],
        },
        1,
        10,
        { createdAt: 'desc' },
        listInclude,
      );
    });

    it('should query inactive status via contracts and occupancy relations', async () => {
      await service.listCustomers(1, 10, undefined, 'INACTIVE');
      expect(repository.paginate).toHaveBeenCalledWith(
        {
          AND: [
            { contracts: { none: { status: { in: ACTIVE_LIKE_CONTRACT_STATUSES } } } },
            { occupancies: { none: { leftAt: null } } },
          ],
        },
        1,
        10,
        { createdAt: 'desc' },
        listInclude,
      );
    });

    it('should query debt status via invoices relation', async () => {
      await service.listCustomers(1, 10, undefined, 'DEBT');
      expect(repository.paginate).toHaveBeenCalledWith(
        { AND: [{ invoices: { some: { status: 'OVERDUE' } } }] },
        1,
        10,
        { createdAt: 'desc' },
        listInclude,
      );
    });

    it('should apply search filters correctly', async () => {
      await service.listCustomers(1, 10, 'john', undefined);
      expect(repository.paginate).toHaveBeenCalledWith(
        { AND: [{
          OR: [
            { fullName: { contains: 'john', mode: 'insensitive' } },
            { phone: { contains: 'john', mode: 'insensitive' } },
            { identityNo: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } },
            { zaloChatId: { contains: 'john', mode: 'insensitive' } },
            { zaloUserId: { contains: 'john', mode: 'insensitive' } },
          ],
        }] },
        1,
        10,
        { createdAt: 'desc' },
        listInclude,
      );
    });
  });

  describe('softDelete', () => {
    it('should block deleting a customer while the customer is still assigned to a room', async () => {
      prismaService.customer.findUnique.mockResolvedValue({
        id: 'cu1',
        fullName: 'Khach A',
        roomId: 'room-1',
        room: {
          id: 'room-1',
          code: '301',
          name: '301',
          building: { id: 'b1', code: 'B1', name: 'Toa B1' },
        },
        contracts: [],
      });

      await expect(service.softDelete('cu1', 'user1')).rejects.toThrow(
        'vẫn đang được gắn với Toa B1 - Phòng 301',
      );
    });
  });
});
