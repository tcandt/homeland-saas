import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { CustomersRepository } from './customers.repository';
import { AuditService } from '../shared/audit/audit.service';

describe('CustomersService', () => {
  let service: CustomersService;
  let repository: CustomersRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: CustomersRepository,
          useValue: {
            paginate: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    repository = module.get<CustomersRepository>(CustomersRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listCustomers', () => {
    it('should query active status via contracts relation', async () => {
      await service.listCustomers(1, 10, undefined, 'ACTIVE');
      expect(repository.paginate).toHaveBeenCalledWith(
        { contracts: { some: { status: 'ACTIVE' } } },
        1,
        10,
        { createdAt: 'desc' },
        { _count: { select: { contracts: true } } }
      );
    });

    it('should query inactive status via contracts relation', async () => {
      await service.listCustomers(1, 10, undefined, 'INACTIVE');
      expect(repository.paginate).toHaveBeenCalledWith(
        { contracts: { none: { status: 'ACTIVE' } } },
        1,
        10,
        { createdAt: 'desc' },
        { _count: { select: { contracts: true } } }
      );
    });

    it('should query debt status via invoices relation', async () => {
      await service.listCustomers(1, 10, undefined, 'DEBT');
      expect(repository.paginate).toHaveBeenCalledWith(
        { invoices: { some: { status: 'OVERDUE' } } },
        1,
        10,
        { createdAt: 'desc' },
        { _count: { select: { contracts: true } } }
      );
    });

    it('should apply search filters correctly', async () => {
      await service.listCustomers(1, 10, 'john', undefined);
      expect(repository.paginate).toHaveBeenCalledWith(
        {
          OR: [
            { fullName: { contains: 'john', mode: 'insensitive' } },
            { phone: { contains: 'john', mode: 'insensitive' } },
            { email: { contains: 'john', mode: 'insensitive' } },
          ],
        },
        1,
        10,
        { createdAt: 'desc' },
        { _count: { select: { contracts: true } } }
      );
    });
  });
});
