import { Test, TestingModule } from '@nestjs/testing';
import { CustomersController } from './customers.controller';
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
            listCustomers: jest.fn(),
            getDetail: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
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
      controller.list({ page: '1', limit: '10', search: 'John', status: 'ACTIVE' });
      expect(service.listCustomers).toHaveBeenCalledWith(1, 10, 'John', 'ACTIVE', undefined, undefined);
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
