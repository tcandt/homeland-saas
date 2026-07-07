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
      });
    });
  });
});
