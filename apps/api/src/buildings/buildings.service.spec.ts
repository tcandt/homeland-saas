import { Test, TestingModule } from '@nestjs/testing';
import { BuildingsService } from './buildings.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BuildingsRepository } from './buildings.repository';
import { AuditService } from '../shared/audit/audit.service';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

describe('BuildingsService', () => {
  let service: BuildingsService;
  let repository: BuildingsRepository;
  let auditService: AuditService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BuildingsService,
        {
          provide: BuildingsRepository,
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
        {
          provide: PrismaService,
          useValue: {
            room: { updateMany: vi.fn() },
            floor: { updateMany: vi.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<BuildingsService>(BuildingsService);
    repository = module.get<BuildingsRepository>(BuildingsRepository);
    auditService = module.get<AuditService>(AuditService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listBuildings', () => {
    it('should query tenant scoped buildings and handle filters', async () => {
      vi.spyOn(repository, 'paginate').mockResolvedValue({
        data: [{ id: 'b1', name: 'Building 1' } as any],
        meta: { total: 1 } as any,
      });

      await service.listBuildings(1, 10, 'search-term', 'active', 'name', 'asc');

      expect(repository.paginate).toHaveBeenCalledWith(
        expect.objectContaining({
          OR: expect.any(Array),
          status: 'active',
        }),
        1,
        10,
        { name: 'asc' },
        expect.any(Object)
      );
    });
  });

  describe('create', () => {
    it('should create building with tenantId context', async () => {
      vi.spyOn(repository, 'create').mockResolvedValue({ id: 'b1', name: 'Building 1' } as any);
      
      await service.create({ name: 'Building 1' }, 'u1');

      expect(repository.create).toHaveBeenCalledWith({ name: 'Building 1' });
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'CREATE',
        entity: 'Building',
        entityId: 'b1',
        userId: 'u1'
      }));
    });
  });

  describe('update', () => {
    it('should update building', async () => {
      vi.spyOn(repository, 'findById').mockResolvedValue({ id: 'b1', _count: { floors: 1, rooms: 0 } } as any);
      vi.spyOn(repository, 'update').mockResolvedValue({ id: 'b1', name: 'New' } as any);
      
      await service.update('b1', { name: 'New' }, 'u1');

      expect(repository.update).toHaveBeenCalledWith('b1', { name: 'New' });
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UPDATE',
        entity: 'Building',
        entityId: 'b1',
        userId: 'u1'
      }));
    });
  });

  describe('softDelete', () => {
    it('should delete building if no business rules prevent it', async () => {
      vi.spyOn(repository, 'findById').mockResolvedValue({ id: 'b1', floors: [], rooms: [] } as any);
      vi.spyOn(repository, 'softDelete').mockResolvedValue({ id: 'b1' } as any);
      
      await service.softDelete('b1', 'u1');

      expect(repository.softDelete).toHaveBeenCalledWith('b1', 'u1');
    });

    it('should reject delete if active floors or rooms exist', async () => {
      vi.spyOn(repository, 'findById').mockResolvedValue({
        id: 'b1',
        floors: [],
        rooms: [{ id: 'r1', contracts: [{ id: 'c1' }] }],
      } as any);
      
      await expect(service.softDelete('b1', 'u1')).rejects.toThrow(HttpException);
    });

    it('should cascade soft delete floors and rooms without active contracts', async () => {
      vi.spyOn(repository, 'findById').mockResolvedValue({
        id: 'b1',
        floors: [{ id: 'f1' }],
        rooms: [{ id: 'r1', contracts: [] }],
      } as any);
      vi.spyOn(repository, 'softDelete').mockResolvedValue({ id: 'b1' } as any);

      await service.softDelete('b1', 'u1');

      expect(prismaService.room.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['r1'] } },
        data: { deletedAt: expect.any(Date), deletedBy: 'u1' },
      });
      expect(prismaService.floor.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['f1'] } },
        data: { deletedAt: expect.any(Date), deletedBy: 'u1' },
      });
    });
  });
});
