import { describe, expect, it, vi } from 'vitest';
import { CustomersService } from './customers.service';

function database(tx: any) {
  tx.$queryRaw = vi.fn().mockResolvedValue([{ id: 'customer-1' }]);
  tx.auditLog = { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) };
  return { $transaction: vi.fn((work: any) => work(tx)) } as any;
}

describe('CustomersService identity image provenance', () => {
  function uploadSubject() {
    const tx = { customer: {
      findFirst: vi.fn().mockResolvedValue({ id: 'customer-1', idImages: [], idImageProvenance: [], updatedAt: new Date() }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    } };
    const prisma = database(tx);
    const documents = {
      saveFile: vi.fn(async (_tenant, _folder, name, bytes, mimeType) => ({ url: `document-storage://tenant-a/${name}`, size: bytes.length, mimeType })),
      persistUploadedFile: vi.fn().mockResolvedValue({}),
      discardUnpersistedUpload: vi.fn().mockResolvedValue(undefined),
      resolveTenantStoragePath: vi.fn(async (_tenant, storagePath) => `document-storage://${storagePath}`),
    };
    const service = new CustomersService({} as any, {} as any, prisma, documents as any);
    const file = { buffer: Buffer.from('scan'), mimetype: 'image/png', originalname: 'scan.png' };
    const original = { ...file, buffer: Buffer.from('original'), originalname: 'original.png' };
    return { service, tx: tx as any, prisma, documents, file, original };
  }

  it('persists original, scan, approval and audit in one locked transaction', async () => {
    const { service, tx, prisma, documents, file, original } = uploadSubject();
    await service.uploadIdentityImage('customer-1', 'tenant-a', 'user-a', 'front', 'scan', file, original);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(documents.persistUploadedFile).toHaveBeenCalledTimes(2);
    expect(documents.persistUploadedFile).toHaveBeenCalledWith(tx, 'tenant-a', 'original.png', expect.any(Object), { createdBy: 'user-a' });
    expect(documents.resolveTenantStoragePath).toHaveBeenCalledWith('tenant-a', 'tenant-a/scan.png', tx);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.customer.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      idImages: ['document-storage://tenant-a/scan.png'],
      idImageProvenance: [expect.objectContaining({ originalUrl: 'document-storage://tenant-a/original.png', approvedBy: 'user-a' })],
    }) }));
    expect(documents.discardUnpersistedUpload).not.toHaveBeenCalled();
  });

  it('compensates the original if saving the scan fails', async () => {
    const { service, documents, file, original } = uploadSubject();
    // Fail the second storage operation, after the original has been staged.
    documents.saveFile.mockReset()
      .mockResolvedValueOnce({ url: 'document-storage://tenant-a/original.png', size: 8, mimeType: 'image/png' })
      .mockRejectedValueOnce(new Error('scan storage unavailable'));
    await expect(service.uploadIdentityImage('customer-1', 'tenant-a', 'user-a', 'front', 'scan', file, original)).rejects.toThrow('scan storage unavailable');
    expect(documents.discardUnpersistedUpload).toHaveBeenCalledExactlyOnceWith('document-storage://tenant-a/original.png');
  });

  it('compensates both newly staged files when audit fails', async () => {
    const { service, tx, documents, file, original } = uploadSubject();
    tx.auditLog.create.mockRejectedValue(new Error('audit failed'));
    await expect(service.uploadIdentityImage('customer-1', 'tenant-a', 'user-a', 'front', 'scan', file, original)).rejects.toThrow('audit failed');
    expect(documents.discardUnpersistedUpload.mock.calls).toEqual([
      ['document-storage://tenant-a/original.png'], ['document-storage://tenant-a/scan.png'],
    ]);
  });

  it('does not touch storage for a customer outside the authenticated tenant', async () => {
    const { service, tx, documents, file, original } = uploadSubject();
    tx.$queryRaw.mockResolvedValue([]);
    await expect(service.uploadIdentityImage('customer-1', 'foreign-tenant', 'user-a', 'front', 'scan', file, original)).rejects.toThrow('Không tìm thấy');
    expect(documents.saveFile).not.toHaveBeenCalled();
  });

  it('rejects invalid files or missing originals before opening a transaction', async () => {
    const { service, prisma, file } = uploadSubject();
    await expect(service.uploadIdentityImage('customer-1', 'tenant-a', 'user-a', 'front', 'scan', file)).rejects.toThrow('ảnh gốc');
    await expect(service.uploadIdentityImage('customer-1', 'tenant-a', 'user-a', 'front', 'upload', { ...file, mimetype: 'application/pdf' })).rejects.toThrow('không hợp lệ');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('merges a tenant-owned approved side and stamps the authenticated reviewer', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findFirst = vi.fn()
      .mockResolvedValueOnce({
        id: 'customer-1',
        idImages: ['document-storage://tenant-a/old.jpg'],
        idImageProvenance: [{
          url: 'document-storage://tenant-a/front.jpg',
          originalUrl: 'document-storage://tenant-a/original-front.jpg',
          side: 'front',
          source: 'scan',
          status: 'APPROVED',
          approvedBy: 'reviewer-old',
        }],
        updatedAt: new Date('2026-10-11T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({ id: 'customer-1' });
    const tx = {
      customer: {
        findFirst,
        updateMany,
      },
    };
    const resolveTenantStoragePath = vi.fn().mockImplementation(async (tenant: string, path: string) => `document-storage://${path}`);
    const service = new CustomersService(
      {} as any,
      { log: vi.fn() } as any,
      database(tx),
      { resolveTenantStoragePath } as any,
    );

    await service.approveIdentityImages('customer-1', 'tenant-a', 'reviewer-new', [{
      url: 'document-storage://tenant-a/back.jpg',
      side: 'back',
      source: 'upload',
    }]);

    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'customer-1', tenantId: 'tenant-a' }),
      data: expect.objectContaining({
        idImages: ['document-storage://tenant-a/front.jpg', 'document-storage://tenant-a/back.jpg'],
        idImageProvenance: expect.arrayContaining([
          expect.objectContaining({ side: 'front', approvedBy: 'reviewer-old' }),
          expect.objectContaining({ side: 'back', approvedBy: 'reviewer-new', status: 'APPROVED' }),
        ]),
      }),
    }));
  });

  it('replacing a side removes the old active URL and revoke rebuilds the projection', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findFirst = vi.fn()
      .mockResolvedValueOnce({
        id: 'customer-1',
        idImages: [
          'document-storage://tenant-a/old-front.jpg',
          'document-storage://tenant-a/front-v1.jpg',
          'document-storage://tenant-a/back.jpg',
          'document-storage://tenant-a/legacy-unapproved.jpg',
        ],
        idImageProvenance: [
          {
            url: 'document-storage://tenant-a/front-v1.jpg', originalUrl: 'document-storage://tenant-a/front-v1.jpg',
            side: 'front', source: 'upload', status: 'APPROVED', approvedBy: 'reviewer-old',
          },
          {
            url: 'document-storage://tenant-a/back.jpg', originalUrl: 'document-storage://tenant-a/back.jpg',
            side: 'back', source: 'upload', status: 'APPROVED', approvedBy: 'reviewer-old',
          },
        ],
        updatedAt: new Date('2026-10-11T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({ id: 'customer-1' });
    const tx = { customer: { findFirst, updateMany } };
    const service = new CustomersService(
      {} as any,
      { log: vi.fn() } as any,
      database(tx),
      { resolveTenantStoragePath: vi.fn(async (_tenant, path) => `document-storage://${path}`) } as any,
    );

    await service.approveIdentityImages('customer-1', 'tenant-a', 'reviewer-new', [{
      url: 'document-storage://tenant-a/front-v2.jpg',
      side: 'front', source: 'upload',
    }]);

    expect((tx as any).auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      before: expect.objectContaining({ idImageProvenance: expect.arrayContaining([
        expect.objectContaining({ url: 'document-storage://tenant-a/front-v1.jpg', approvedBy: 'reviewer-old' }),
      ]) }),
    }) }));

    expect(updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        idImages: ['document-storage://tenant-a/front-v2.jpg', 'document-storage://tenant-a/back.jpg'],
      }),
    }));

    findFirst.mockReset()
      .mockResolvedValueOnce({
        id: 'customer-1',
        idImages: ['document-storage://tenant-a/front-v2.jpg', 'document-storage://tenant-a/back.jpg'],
        idImageProvenance: [
          {
            url: 'document-storage://tenant-a/front-v2.jpg', originalUrl: 'document-storage://tenant-a/front-v2.jpg',
            side: 'front', source: 'upload', status: 'APPROVED', approvedBy: 'reviewer-new',
          },
          {
            url: 'document-storage://tenant-a/back.jpg', originalUrl: 'document-storage://tenant-a/back.jpg',
            side: 'back', source: 'upload', status: 'APPROVED', approvedBy: 'reviewer-old',
          },
        ],
        updatedAt: new Date('2026-10-11T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({ id: 'customer-1' });
    updateMany.mockResolvedValue({ count: 1 });

    await service.revokeIdentityImage('customer-1', 'tenant-a', 'reviewer-new', 'document-storage://tenant-a/front-v2.jpg');

    expect((tx as any).auditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({
      before: expect.objectContaining({ idImageProvenance: expect.arrayContaining([
        expect.objectContaining({ url: 'document-storage://tenant-a/front-v2.jpg', originalUrl: 'document-storage://tenant-a/front-v2.jpg', approvedBy: 'reviewer-new' }),
      ]) }),
      after: expect.objectContaining({ revokedIdentityImage: 'document-storage://tenant-a/front-v2.jpg' }),
    }) }));

    expect(updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        idImages: ['document-storage://tenant-a/back.jpg'],
        idImageProvenance: [expect.objectContaining({ side: 'back' })],
      }),
    }));
  });

  it('rejects a caller-supplied external URL before persistence', async () => {
    const updateMany = vi.fn();
    const service = new CustomersService(
      {} as any,
      { log: vi.fn() } as any,
      database({ customer: { findFirst: vi.fn().mockResolvedValue({ id: 'customer-1', idImages: [], idImageProvenance: [] }), updateMany } }),
      { resolveTenantStoragePath: vi.fn() } as any,
    );

    await expect(service.approveIdentityImages('customer-1', 'tenant-a', 'reviewer-new', [{
      url: 'https://evil.test/cccd.jpg',
      side: 'front',
      source: 'upload',
    }])).rejects.toThrow('tài liệu lưu trữ nội bộ');
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('fails closed when the customer changed after the read snapshot', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const service = new CustomersService(
      {} as any,
      { log: vi.fn() } as any,
      database({ customer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'customer-1', idImages: [], idImageProvenance: [], updatedAt: new Date() }),
        updateMany,
      } }),
      { resolveTenantStoragePath: vi.fn().mockResolvedValue('document-storage://tenant-a/front.jpg') } as any,
    );

    await expect(service.approveIdentityImages('customer-1', 'tenant-a', 'reviewer-new', [{
      url: 'document-storage://tenant-a/front.jpg', side: 'front', source: 'upload',
    }])).rejects.toThrow('vừa thay đổi');
  });

  it.each([undefined, 'document-storage://tenant-a/front.jpg'])('rejects a scan without a distinct original: %s', async (originalUrl) => {
    const tx = { customer: {
      findFirst: vi.fn().mockResolvedValue({ id: 'customer-1', idImages: [], idImageProvenance: [] }),
      updateMany: vi.fn(),
    } };
    const service = new CustomersService({} as any, {} as any, database(tx), {
      resolveTenantStoragePath: vi.fn(async (_tenant, path) => `document-storage://${path}`),
    } as any);
    await expect(service.approveIdentityImages('customer-1', 'tenant-a', 'user-a', [{
      url: 'document-storage://tenant-a/front.jpg', originalUrl, side: 'front', source: 'scan',
    }])).rejects.toThrow(/ảnh gốc|Ảnh gốc/);
    expect(tx.customer.updateMany).not.toHaveBeenCalled();
  });

  it('resolves and persists a separate tenant-owned scan original', async () => {
    const tx = { customer: {
      findFirst: vi.fn().mockResolvedValue({ id: 'customer-1', idImages: [], idImageProvenance: [], updatedAt: new Date() }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    } };
    const service = new CustomersService({} as any, {} as any, database(tx), {
      resolveTenantStoragePath: vi.fn(async (_tenant, path) => `document-storage://${path}`),
    } as any);
    await service.approveIdentityImages('customer-1', 'tenant-a', 'user-a', [{
      url: '/api/v1/documents/storage/tenant-a/front.jpg',
      originalUrl: 'document-storage://tenant-a/original.jpg', side: 'front', source: 'scan',
    }]);
    expect(tx.customer.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      idImageProvenance: [expect.objectContaining({
        url: 'document-storage://tenant-a/front.jpg', originalUrl: 'document-storage://tenant-a/original.jpg', approvedBy: 'user-a',
      })],
    }) }));
  });
});
