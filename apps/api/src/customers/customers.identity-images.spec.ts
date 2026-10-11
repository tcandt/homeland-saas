import { describe, expect, it, vi } from 'vitest';
import { CustomersService } from './customers.service';

describe('CustomersService identity image provenance', () => {
  it('merges a tenant-owned approved side and stamps the authenticated reviewer', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findFirst = vi.fn()
      .mockResolvedValueOnce({
        id: 'customer-1',
        idImages: ['document-storage://tenant-a/old.jpg'],
        idImageProvenance: [{
          url: 'document-storage://tenant-a/front.jpg',
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
      { tx } as any,
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
        idImageProvenance: expect.arrayContaining([
          expect.objectContaining({ side: 'front', approvedBy: 'reviewer-old' }),
          expect.objectContaining({ side: 'back', approvedBy: 'reviewer-new', status: 'APPROVED' }),
        ]),
      }),
    }));
  });

  it('rejects a caller-supplied external URL before persistence', async () => {
    const updateMany = vi.fn();
    const service = new CustomersService(
      {} as any,
      { log: vi.fn() } as any,
      { tx: { customer: { findFirst: vi.fn().mockResolvedValue({ id: 'customer-1', idImages: [], idImageProvenance: [] }), updateMany } } } as any,
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
      { tx: { customer: {
        findFirst: vi.fn().mockResolvedValue({ id: 'customer-1', idImages: [], idImageProvenance: [], updatedAt: new Date() }),
        updateMany,
      } } } as any,
      { resolveTenantStoragePath: vi.fn().mockResolvedValue('document-storage://tenant-a/front.jpg') } as any,
    );

    await expect(service.approveIdentityImages('customer-1', 'tenant-a', 'reviewer-new', [{
      url: 'document-storage://tenant-a/front.jpg', side: 'front', source: 'upload',
    }])).rejects.toThrow('vừa thay đổi');
  });
});
