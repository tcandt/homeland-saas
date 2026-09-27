import { Test, TestingModule } from '@nestjs/testing';
import { CustomersController } from './customers.controller';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomersService } from './customers.service';

describe('CustomersController', () => {
  let controller: CustomersController;
  let service: CustomersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        {
          provide: CustomersService,
          useValue: {
            listCustomers: vi.fn(),
            getDetail: vi.fn(),
            create: vi.fn(),
            createIdempotent: vi.fn(),
            update: vi.fn(),
            softDelete: vi.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CustomersController>(CustomersController);
    service = module.get<CustomersService>(CustomersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    it('should call service.listCustomers with parsed query', () => {
      controller.list({ page: '1', limit: '10', search: 'John', status: 'ACTIVE' } as any);
      expect(service.listCustomers).toHaveBeenCalledWith(1, 10, 'John', 'ACTIVE', 'createdAt', 'desc');
    });
  });

  describe('getDetail', () => {
    it('should call service.getDetail with id and includes', () => {
      controller.getDetail('cust-123');
      expect(service.getDetail).toHaveBeenCalledWith('cust-123', {
        contracts: { include: { room: { include: { building: true } } } },
        occupancies: {
          where: { leftAt: null },
          select: { id: true, roomId: true, leftAt: true, room: { select: { id: true, code: true, name: true } } },
        },
      });
    });
  });

  describe('create', () => {
    const payload = { fullName: 'Nguyen Van A', phone: '0901234567' };

    it.each([
      [{ fullName: 'Nguyen Van A' }],
      [{ fullName: 'Nguyen Van A', phone: '' }],
    ])('rejects a missing or blank phone before invoking persistence', (invalidPayload) => {
      expect(() => controller.create(invalidPayload, 'user-a', 'tenant-a')).toThrow();
      expect(service.create).not.toHaveBeenCalled();
      expect(service.createIdempotent).not.toHaveBeenCalled();
    });

    it('uses the idempotent service command when the client supplies a key', () => {
      const key = '70c7e0e1-4ef4-4f54-b060-5a8f8d9a7c1c';
      controller.create(payload, 'user-a', 'tenant-a', key);

      expect(service.createIdempotent).toHaveBeenCalledWith(
        'tenant-a',
        'user-a',
        expect.objectContaining({ fullName: payload.fullName, phone: payload.phone, identityNo: undefined }),
        key,
      );
      expect(service.create).not.toHaveBeenCalled();
    });

    it('preserves the legacy create command without an idempotency key', () => {
      controller.create(payload, 'user-a', 'tenant-a');

      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ fullName: payload.fullName, phone: payload.phone, identityNo: undefined }),
        'user-a',
        'Customers',
      );
      expect(service.createIdempotent).not.toHaveBeenCalled();
    });
  });
});
