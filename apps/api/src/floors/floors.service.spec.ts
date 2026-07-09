import { Test, TestingModule } from '@nestjs/testing';
import { FloorsService } from './floors.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FloorsRepository } from './floors.repository';
import { AuditService } from '../shared/audit/audit.service';
import { HttpException } from '@nestjs/common';

describe('FloorsService', () => {
  let service: FloorsService;
  let repository: FloorsRepository;
  let auditService: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FloorsService,
        {
          provide: FloorsRepository,
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

    service = module.get<FloorsService>(FloorsService);
    repository = module.get<FloorsRepository>(FloorsRepository);
    auditService = module.get<AuditService>(AuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listFloors', () => {
    it('should find by building', async () => {
      vi.spyOn(repository, 'paginate').mockResolvedValue({
        data: [{ id: 'f1', level: 1 } as any],
        meta: { total: 1 } as any,
      });

      await service.listFloors(1, 10, undefined, 'b1', 'level', 'asc');

      expect(repository.paginate).toHaveBeenCalledWith(
        expect.objectContaining({ buildingId: 'b1' }),
        1,
        10,
        { level: 'asc' },
        expect.any(Object)
      );
    });
  });

  describe('create', () => {
    it('should create floor in building', async () => {
      vi.spyOn(repository, 'create').mockResolvedValue({ id: 'f1', level: 1 } as any);
      
      await service.create({ level: 1, buildingId: 'b1' }, 'u1');

      expect(repository.create).toHaveBeenCalledWith({ level: 1, buildingId: 'b1' });
    });
  });

  describe('update', () => {
    it('should update floor', async () => {
      vi.spyOn(repository, 'findById').mockResolvedValue({ id: 'f1', level: 1 } as any);
      vi.spyOn(repository, 'update').mockResolvedValue({ id: 'f1', level: 2 } as any);
      
      await service.update('f1', { level: 2 }, 'u1');

      expect(repository.update).toHaveBeenCalledWith('f1', { level: 2 });
    });
  });

  describe('softDelete', () => {
    it('should delete floor if no rooms exist', async () => {
      vi.spyOn(repository, 'findById').mockResolvedValue({ id: 'f1', _count: { rooms: 0 } } as any);
      vi.spyOn(repository, 'softDelete').mockResolvedValue({ id: 'f1' } as any);
      
      await service.softDelete('f1', 'u1');

      expect(repository.softDelete).toHaveBeenCalledWith('f1', 'u1');
    });

    it('should reject delete if rooms exist', async () => {
      vi.spyOn(repository, 'findById').mockResolvedValue({ id: 'f1', _count: { rooms: 5 } } as any);
      
      await expect(service.softDelete('f1', 'u1')).rejects.toThrow(HttpException);
    });
  });
});
