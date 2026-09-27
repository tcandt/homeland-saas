import { Test, TestingModule } from '@nestjs/testing';
import { AuditAction } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
  let auditService: any;

  beforeEach(async () => {
    prismaService = {
      customer: {
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };
    prismaService.tx = { customer: { findFirst: vi.fn().mockResolvedValue(null) } };
    auditService = { log: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: CustomersRepository,
          useValue: {
            paginate: vi.fn(),
            create: vi.fn(),
            findById: vi.fn(),
            update: vi.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: auditService,
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
    const customers = [{
      id: 'foreign',
      tenantId: 'tenant-b',
      phone: '0901234567',
      phoneNormalized: '0901234567',
      identityNo: '123456789',
      identityNoNormalized: '123456789',
      fullName: 'Private B',
    }];
    const rawFind = vi.fn(async (args: any) => customers.find((customer) =>
      (!args.where.tenantId || customer.tenantId === args.where.tenantId) &&
      (!args.where.phoneNormalized || customer.phoneNormalized === args.where.phoneNormalized) &&
      (!args.where.identityNoNormalized || customer.identityNoNormalized === args.where.identityNoNormalized),
    ) || null);
    prismaService.customer.findFirst = rawFind;
    prismaService.tx = { customer: { findFirst: (args: any) => rawFind(applyTenantScope('Customer', 'findFirst', args, 'tenant-a')) } };
    await expect(service.checkDuplicate({ phone: '0901234567' })).resolves.toMatchObject({ isDuplicate: false, duplicateCustomer: null });
    await expect(service.checkDuplicate({ identityNo: '123456789' })).resolves.toMatchObject({ isDuplicate: false, duplicateCustomer: null });
    await expect(service.validateCustomerUniqueness('0901234567', '123456789')).resolves.toBeUndefined();
    expect(rawFind).toHaveBeenCalledTimes(4);
    for (const [query] of rawFind.mock.calls) expect(query.where.tenantId).toBe('tenant-a');
    expect(rawFind.mock.calls.some(([query]: any[]) => query.where.phoneNormalized === '0901234567')).toBe(true);
    expect(rawFind.mock.calls.some(([query]: any[]) => query.where.identityNoNormalized === '123456789')).toBe(true);
  });

  it('persists normalized identifiers on ordinary create and update commands', async () => {
    prismaService.tx.customer.findFirst.mockResolvedValue(null);
    (repository.create as any).mockImplementation(async (data: any) => ({ id: 'customer-a', tenantId: 'tenant-a', ...data }));
    (repository.findById as any).mockResolvedValue({ id: 'customer-a', tenantId: 'tenant-a', phone: '0901234567', roomId: null });
    (repository.update as any).mockImplementation(async (_id: string, data: any) => ({
      id: 'customer-a', tenantId: 'tenant-a', phone: '0901234567', roomId: null, ...data,
    }));

    await service.create({ fullName: 'Nguyen Van A', phone: '0901 234 567', identityNo: '001-234 567' }, 'user-a');
    await service.update('customer-a', { identityNo: '001.234 568' }, 'user-a');

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      phoneNormalized: '0901234567',
      identityNoNormalized: '001234567',
    }));
    expect(repository.update).toHaveBeenCalledWith('customer-a', expect.objectContaining({
      identityNoNormalized: '001234568',
    }));
  });

  it.each([
    [{ fullName: 'Nguyen Van A' }],
    [{ fullName: 'Nguyen Van A', phone: '   ' }],
    [{ fullName: 'Nguyen Van A', phone: '---' }],
  ])('rejects an absent or non-canonical phone before persistence', async (input) => {
    await expect(service.create(input, 'user-a')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
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
      contracts: {
        where: {
          deletedAt: null,
          status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
        },
        orderBy: { endDate: 'asc' },
        take: 1,
        select: {
          id: true,
          code: true,
          status: true,
          startDate: true,
          endDate: true,
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

    it('keeps the active contract relation bounded to each paginated customer row', async () => {
      await service.listCustomers(2, 10);

      const include = (repository.paginate as any).mock.calls[0][4];
      expect(include.contracts).toEqual({
        where: {
          deletedAt: null,
          status: { in: ACTIVE_LIKE_CONTRACT_STATUSES },
        },
        orderBy: { endDate: 'asc' },
        take: 1,
        select: {
          id: true,
          code: true,
          status: true,
          startDate: true,
          endDate: true,
          room: {
            select: {
              id: true,
              code: true,
              name: true,
              building: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });
      expect(repository.paginate).toHaveBeenCalledWith({}, 2, 10, { createdAt: 'desc' }, include);
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

  describe('createIdempotent', () => {
    const key = '70c7e0e1-4ef4-4f54-b060-5a8f8d9a7c1c';
    const input = { fullName: 'Nguyen Van A', phone: '0901234567' };

    function createTransactionClient(options: { audit?: any; room?: any; customer?: any } = {}) {
      const tx = {
        auditLog: {
          findFirst: vi.fn().mockResolvedValue(options.audit ?? null),
          create: vi.fn().mockResolvedValue({}),
        },
        room: {
          findFirst: vi.fn().mockResolvedValue(
            Object.prototype.hasOwnProperty.call(options, 'room') ? options.room : { id: 'room-a' },
          ),
        },
        customer: {
          findFirst: vi.fn().mockResolvedValue(options.customer ?? null),
          create: vi.fn().mockImplementation(async ({ data }: any) => data),
        },
        occupancy: { create: vi.fn().mockResolvedValue({}) },
      };
      prismaService.$transaction.mockImplementation(async (callback: any) => callback(tx));
      return tx;
    }

    function replayAudit(customerId: string, request: typeof input = input) {
      return {
        tenantId: 'tenant-a',
        module: 'Customers',
        entity: 'Customer',
        action: AuditAction.CREATE,
        after: {
          idempotencyKey: key,
          requestHash: (service as any).createRequestHash(request),
          customerId,
        },
      };
    }

    it('replays an exact command without creating another customer, occupancy, or audit log', async () => {
      const existing = { id: 'customer-a', tenantId: 'tenant-a', ...input, roomId: null };
      const tx = createTransactionClient({ audit: replayAudit(existing.id), customer: existing });

      await expect(service.createIdempotent('tenant-a', 'user-a', input, key)).resolves.toEqual(existing);

      expect(tx.customer.create).not.toHaveBeenCalled();
      expect(tx.occupancy.create).not.toHaveBeenCalled();
      expect(tx.auditLog.create).not.toHaveBeenCalled();
    });

    it('persists canonical identifiers for a new idempotent command', async () => {
      const tx = createTransactionClient();

      await service.createIdempotent('tenant-a', 'user-a', {
        fullName: 'Nguyen Van A',
        phone: '0901 234 567',
        identityNo: '001-234 567',
      }, key);

      expect(tx.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phoneNormalized: '0901234567',
          identityNoNormalized: '001234567',
          tenantId: 'tenant-a',
        }),
      });
    });

    it('allows the same canonical identifiers in another tenant', async () => {
      const foreignCustomer = {
        id: 'customer-b',
        tenantId: 'tenant-b',
        fullName: 'Tenant B',
        phoneNormalized: '0901234567',
        identityNoNormalized: '001234567',
        deletedAt: null,
      };
      const tx = createTransactionClient();
      tx.customer.findFirst.mockImplementation(async ({ where }: any) => (
        where.tenantId === foreignCustomer.tenantId
          && where.phoneNormalized === foreignCustomer.phoneNormalized
          && where.identityNoNormalized === foreignCustomer.identityNoNormalized
          ? foreignCustomer
          : null
      ));

      await expect(service.createIdempotent('tenant-a', 'user-a', {
        fullName: 'Tenant A',
        phone: '0901 234 567',
        identityNo: '001-234 567',
      }, key)).resolves.toMatchObject({ tenantId: 'tenant-a' });

      expect(tx.customer.create).toHaveBeenCalledOnce();
    });

    it('allows reusing canonical identifiers from a soft-deleted customer', async () => {
      const softDeletedCustomer = {
        id: 'customer-deleted',
        tenantId: 'tenant-a',
        fullName: 'Deleted',
        phoneNormalized: '0901234567',
        identityNoNormalized: '001234567',
        deletedAt: new Date(),
      };
      const tx = createTransactionClient();
      tx.customer.findFirst.mockImplementation(async ({ where }: any) => (
        where.deletedAt === softDeletedCustomer.deletedAt ? softDeletedCustomer : null
      ));

      await expect(service.createIdempotent('tenant-a', 'user-a', {
        fullName: 'Replacement',
        phone: '0901 234 567',
        identityNo: '001-234 567',
      }, key)).resolves.toMatchObject({ tenantId: 'tenant-a' });

      expect(tx.customer.create).toHaveBeenCalledOnce();
    });

    it('rejects active canonical duplicates before creating a customer', async () => {
      const activeCustomer = {
        id: 'customer-active',
        tenantId: 'tenant-a',
        fullName: 'Existing',
        phoneNormalized: '0901234567',
        identityNoNormalized: '001234567',
        deletedAt: null,
      };
      const tx = createTransactionClient();
      tx.customer.findFirst.mockImplementation(async ({ where }: any) => (
        where.tenantId === activeCustomer.tenantId
          && where.deletedAt === null
          && (where.phoneNormalized === activeCustomer.phoneNormalized
            || where.identityNoNormalized === activeCustomer.identityNoNormalized)
          ? activeCustomer
          : null
      ));

      await expect(service.createIdempotent('tenant-a', 'user-a', {
        fullName: 'Duplicate',
        phone: '0901 234 567',
        identityNo: '001-234 567',
      }, key)).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.customer.create).not.toHaveBeenCalled();
    });

    it('rejects a reused idempotency key with a changed request', async () => {
      const tx = createTransactionClient({
        audit: replayAudit('customer-a'),
        customer: { id: 'customer-a', tenantId: 'tenant-a', ...input, roomId: null },
      });

      await expect(service.createIdempotent('tenant-a', 'user-a', { ...input, fullName: 'Nguyen Van B' }, key))
        .rejects.toBeInstanceOf(ConflictException);
      expect(tx.customer.create).not.toHaveBeenCalled();
    });

    it('rejects a room from another tenant before customer creation', async () => {
      const tx = createTransactionClient({ room: null });

      await expect(service.createIdempotent('tenant-a', 'user-a', { ...input, roomId: 'room-b' }, key))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(tx.room.findFirst).toHaveBeenCalledWith({
        where: { id: 'room-b', tenantId: 'tenant-a', deletedAt: null },
        select: { id: true },
      });
      expect(tx.customer.create).not.toHaveBeenCalled();
    });

    it('resolves a concurrent unique-key collision only when it finds a valid replay', async () => {
      const existing = { id: 'customer-a', tenantId: 'tenant-a', ...input, roomId: null };
      const tx = createTransactionClient();
      tx.auditLog.create.mockRejectedValue({ code: 'P2002' });
      prismaService.auditLog = { findFirst: vi.fn().mockResolvedValue(replayAudit(existing.id)) };
      prismaService.customer.findFirst = vi.fn().mockResolvedValue(existing);

      await expect(service.createIdempotent('tenant-a', 'user-a', input, key)).resolves.toEqual(existing);
      expect(prismaService.auditLog.findFirst).toHaveBeenCalledWith({
        where: { id: expect.any(String), tenantId: 'tenant-a' },
      });
      expect(prismaService.customer.findFirst).toHaveBeenCalledWith({
        where: { id: existing.id, tenantId: 'tenant-a', deletedAt: null },
      });
    });
  });
});
