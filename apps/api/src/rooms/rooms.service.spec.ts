import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from './rooms.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomsRepository } from './rooms.repository';
import { AuditService } from '../shared/audit/audit.service';
import { HttpException } from '@nestjs/common';

describe('RoomsService', () => {
  let service: RoomsService;
  let repository: RoomsRepository;
  let auditService: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        {
          provide: RoomsRepository,
          useValue: {
            paginate: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            softDelete: vi.fn(),
            findById: vi.fn(),
            count: vi.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    repository = module.get<RoomsRepository>(RoomsRepository);
    auditService = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listRooms', () => {
    it('should find by floor and building', async () => {
      vi.spyOn(repository, 'paginate').mockResolvedValue({
        items: [{ id: 'r1' } as any],
        total: 1,
      });

      await service.listRooms(1, 10, undefined, 'b1', 'f1', undefined, undefined, 'code', 'asc');

      expect(repository.paginate).toHaveBeenCalledWith(
        expect.objectContaining({ buildingId: 'b1', floorId: 'f1' }),
        1,
        10,
        { code: 'asc' },
        expect.any(Object)
      );
    });
  });

  describe('create', () => {
    it('should create room and validate it belongs to tenant building', async () => {
      vi.spyOn(repository, 'create').mockResolvedValue({ id: 'r1' } as any);
      
      await service.create({ code: '101', buildingId: 'b1' }, 'u1');

      expect(repository.create).toHaveBeenCalledWith({ code: '101', buildingId: 'b1' });
    });
  });

  describe('update', () => {
    it('should update room', async () => {
      vi.spyOn(repository, 'findById').mockResolvedValue({ id: 'r1', code: '101' } as any);
      vi.spyOn(repository, 'update').mockResolvedValue({ id: 'r1', code: '102' } as any);
      
      await service.update('r1', { code: '102' }, 'u1');

      expect(repository.update).toHaveBeenCalledWith('r1', { code: '102' });
    });
  });

  describe('softDelete', () => {
    it('should delete vacant room', async () => {
      vi.spyOn(repository, 'findById').mockResolvedValue({ id: 'r1', status: 'AVAILABLE' } as any);
      vi.spyOn(repository, 'softDelete').mockResolvedValue({ id: 'r1' } as any);
      vi.spyOn(repository as any, 'count').mockResolvedValue(0); 
      
      await service.softDelete('r1', 'u1');

      expect(repository.softDelete).toHaveBeenCalledWith('r1', 'u1');
    });

    it('should reject delete if active contract exists', async () => {
      vi.spyOn(repository, 'findById').mockResolvedValue({ id: 'r1', status: 'OCCUPIED' } as any);
      vi.spyOn(repository as any, 'count').mockResolvedValue(1); 
      
      await expect(service.softDelete('r1', 'u1')).rejects.toThrow(HttpException);
    });
  });
});
