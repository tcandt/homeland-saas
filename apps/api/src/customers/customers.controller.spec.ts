import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CustomersController } from './customers.controller';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { CustomersService } from './customers.service';
import request from 'supertest';

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
            approveIdentityImages: vi.fn(),
            uploadIdentityImage: vi.fn(),
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
      controller.list({ page: '1', limit: '10', search: 'John', status: 'ACTIVE' } as any, 'tenant-a');
      expect(service.listCustomers).toHaveBeenCalledWith('tenant-a', 1, 10, 'John', 'ACTIVE', 'createdAt', 'desc');
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
      const key = '70c7e0e1-4ef4-4f54-b060-5a8f8d9a7c1c'; // gitleaks:allow — deterministic test UUID
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

    it('maps identity images through create persistence', () => {
      controller.create({ ...payload, notes: 'VIP', idImages: ['front.jpg', 'back.jpg'] }, 'user-a', 'tenant-a');
      expect(service.create).toHaveBeenCalledWith(
        expect.objectContaining({ notes: 'VIP', idImages: ['front.jpg', 'back.jpg'] }),
        'user-a',
        'Customers',
      );
    });
  });

  describe('approveIdentityImages', () => {
    it('passes only the tenant/user context and normalized image metadata to the service', () => {
      controller.approveIdentityImages(
        'cust-1',
        { images: [{ url: ' document-storage://tenant-a/front.jpg ', side: 'front', source: 'scan', approvedBy: 'forged' }] },
        'user-a',
        'tenant-a',
      );
      expect(service.approveIdentityImages).toHaveBeenCalledWith(
        'cust-1',
        'tenant-a',
        'user-a',
        [{ url: 'document-storage://tenant-a/front.jpg', side: 'front', source: 'scan' }],
      );
    });
  });

  it('passes authenticated scope and separate original/scan to the upload command', () => {
    const file = { buffer: Buffer.from('scan'), mimetype: 'image/png', originalname: 'scan.png' };
    const original = { ...file, originalname: 'original.png' };
    controller.uploadIdentityImage('cust-1', { side: 'front', source: 'scan', approvedBy: 'forged' }, { file: [file], original: [original] }, 'user-a', 'tenant-a');
    expect(service.uploadIdentityImage).toHaveBeenCalledWith('cust-1', 'tenant-a', 'user-a', 'front', 'scan', file, original);
  });
});

describe('CustomersController identity image multipart HTTP boundary', () => {
  let app: INestApplication;
  const uploadIdentityImage = vi.fn();

  beforeEach(async () => {
    uploadIdentityImage.mockReset().mockResolvedValue({ ok: true });
    const module = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [{
        provide: CustomersService,
        useValue: { uploadIdentityImage },
      }],
    }).compile();
    app = module.createNestApplication();
    app.use((req: any, _res: any, next: () => void) => {
      req.user = { id: 'user-http', tenantId: 'tenant-http' };
      next();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts the four-part scan payload with original bytes as separate multipart fields', async () => {
    await request(app.getHttpServer())
      .post('/customers/customer-http/identity-images/upload')
      .field('side', 'front')
      .field('source', 'scan')
      .attach('file', Buffer.from('scan-bytes'), { filename: 'scan.png', contentType: 'image/png' })
      .attach('original', Buffer.from('original-bytes'), { filename: 'original.png', contentType: 'image/png' })
      .expect(201);

    expect(uploadIdentityImage).toHaveBeenCalledWith(
      'customer-http', 'tenant-http', 'user-http', 'front', 'scan',
      expect.objectContaining({ originalname: 'scan.png', buffer: Buffer.from('scan-bytes') }),
      expect.objectContaining({ originalname: 'original.png', buffer: Buffer.from('original-bytes') }),
    );
  });

  it('rejects an extra multipart field instead of accepting an unbounded request', async () => {
    await request(app.getHttpServer())
      .post('/customers/customer-http/identity-images/upload')
      .field('side', 'front')
      .field('source', 'scan')
      .field('unexpected', 'must-not-reach-service')
      .attach('file', Buffer.from('scan'), { filename: 'scan.png', contentType: 'image/png' })
      .attach('original', Buffer.from('original'), { filename: 'original.png', contentType: 'image/png' })
      .expect(400);

    expect(uploadIdentityImage).not.toHaveBeenCalled();
  });

  it('rejects a third file instead of treating it as an identity image', async () => {
    await request(app.getHttpServer())
      .post('/customers/customer-http/identity-images/upload')
      .field('side', 'front')
      .field('source', 'scan')
      .attach('file', Buffer.from('scan'), { filename: 'scan.png', contentType: 'image/png' })
      .attach('original', Buffer.from('original'), { filename: 'original.png', contentType: 'image/png' })
      .attach('extra', Buffer.from('extra'), { filename: 'extra.png', contentType: 'image/png' })
      .expect(400);

    expect(uploadIdentityImage).not.toHaveBeenCalled();
  });

  it('rejects an image one byte beyond the configured byte limit before the service command', async () => {
    await request(app.getHttpServer())
      .post('/customers/customer-http/identity-images/upload')
      .field('side', 'front')
      .field('source', 'upload')
      .attach('file', Buffer.alloc(20 * 1024 * 1024 + 1), { filename: 'too-large.png', contentType: 'image/png' })
      .expect(413);

    expect(uploadIdentityImage).not.toHaveBeenCalled();
  });
});
