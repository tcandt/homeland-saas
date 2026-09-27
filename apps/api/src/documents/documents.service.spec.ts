import { describe, expect, it, vi } from 'vitest';
import { DocumentsService } from './documents.service';

function createSubject() {
  const tx: any = {
    document: {
      create: vi.fn(),
      update: vi.fn(),
    },
    documentVersion: {
      create: vi.fn(),
    },
  };
  const prisma: any = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
    documentVersion: {
      findFirst: vi.fn(),
    },
    documentTemplate: {
      findMany: vi.fn(),
    },
  };
  const storageProvider: any = {
    read: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const service = new DocumentsService(prisma, storageProvider, {} as any, {} as any);

  return { service, prisma, storageProvider, tx };
}

describe('DocumentsService storage ownership', () => {
  it('resolves a document version owned by the authenticated tenant', async () => {
    const { service, prisma } = createSubject();
    prisma.documentVersion.findFirst.mockResolvedValue({
      filePath: 'document-storage://tenant-a/contracts/lease.pdf',
    });

    await expect(service.resolveTenantStoragePath('tenant-a', 'tenant-a/contracts/lease.pdf'))
      .resolves.toBe('document-storage://tenant-a/contracts/lease.pdf');

    expect(prisma.documentVersion.findFirst).toHaveBeenCalledWith({
      where: {
        filePath: {
          in: [
            'tenant-a/contracts/lease.pdf',
            'document-storage://tenant-a/contracts/lease.pdf',
          ],
        },
        document: {
          tenantId: 'tenant-a',
          deletedAt: null,
        },
      },
      select: { filePath: true },
    });
  });

  it('rejects foreign or unknown storage paths before any storage provider access', async () => {
    const { service, prisma, storageProvider } = createSubject();
    prisma.documentVersion.findFirst.mockResolvedValue(null);

    await expect(service.resolveTenantStoragePath('tenant-a', 'tenant-b/contracts/lease.pdf'))
      .rejects.toThrow('Document storage file not found');

    expect(storageProvider.read).not.toHaveBeenCalled();
  });
});

describe('DocumentsService template catalog', () => {
  it('returns summary fields from the authenticated tenant only', async () => {
    const { service, prisma } = createSubject();
    prisma.documentTemplate.findMany.mockResolvedValue([{ id: 'template-1', code: 'LEASE' }]);

    await expect(service.listTemplates('tenant-a')).resolves.toEqual([{ id: 'template-1', code: 'LEASE' }]);

    expect(prisma.documentTemplate.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a' },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  });
});

describe('DocumentsService uploaded documents', () => {
  it('persists a tenant-owned OTHER/DRAFT document and its first version after storage succeeds', async () => {
    const { service, storageProvider, prisma, tx } = createSubject();
    storageProvider.save.mockResolvedValue({
      url: 'document-storage://tenant-a/refund-proofs/proof.pdf',
      size: 42,
      mimeType: 'application/pdf',
    });
    tx.document.create.mockResolvedValue({ id: 'document-1' });
    tx.documentVersion.create.mockResolvedValue({ id: 'version-1' });
    tx.document.update.mockResolvedValue({ id: 'document-1', currentVersionId: 'version-1' });

    await expect(service.createUploadedDocument(
      'tenant-a',
      'refund-proofs',
      'proof.pdf',
      Buffer.from('proof'),
      'application/pdf',
      { createdBy: 'owner@example.com' },
    )).resolves.toEqual({
      url: 'document-storage://tenant-a/refund-proofs/proof.pdf',
      size: 42,
      mimeType: 'application/pdf',
      documentId: 'document-1',
      versionId: 'version-1',
    });

    expect(storageProvider.save).toHaveBeenCalledWith(
      'tenant-a',
      'refund-proofs',
      'proof.pdf',
      Buffer.from('proof'),
      'application/pdf',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(storageProvider.save.mock.invocationCallOrder[0])
      .toBeLessThan(prisma.$transaction.mock.invocationCallOrder[0]);
    expect(tx.document.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-a',
        title: 'proof.pdf',
        type: 'OTHER',
        status: 'DRAFT',
        tags: [],
        createdBy: 'owner@example.com',
      }),
    });
    expect(tx.documentVersion.create).toHaveBeenCalledWith({
      data: {
        documentId: 'document-1',
        versionNumber: 1,
        fileName: 'proof.pdf',
        filePath: 'document-storage://tenant-a/refund-proofs/proof.pdf',
        mimeType: 'application/pdf',
        size: 42,
        createdBy: 'owner@example.com',
      },
    });
    expect(tx.document.update).toHaveBeenCalledWith({
      where: { id: 'document-1' },
      data: { currentVersionId: 'version-1' },
    });
  });

  it('removes the stored object and rethrows when the transaction fails', async () => {
    const { service, storageProvider, prisma } = createSubject();
    const databaseError = new Error('database unavailable');
    storageProvider.save.mockResolvedValue({
      url: 'document-storage://tenant-a/refund-proofs/proof.pdf',
      size: 42,
      mimeType: 'application/pdf',
    });
    prisma.$transaction.mockRejectedValue(databaseError);

    await expect(service.createUploadedDocument(
      'tenant-a',
      'refund-proofs',
      'proof.pdf',
      Buffer.from('proof'),
      'application/pdf',
    )).rejects.toThrow(databaseError);

    expect(storageProvider.save).toHaveBeenCalledTimes(1);
    expect(storageProvider.delete).toHaveBeenCalledWith('document-storage://tenant-a/refund-proofs/proof.pdf');
  });

  it('keeps the persistence error when storage cleanup also fails', async () => {
    const { service, storageProvider, prisma } = createSubject();
    const databaseError = new Error('database unavailable');
    storageProvider.save.mockResolvedValue({
      url: 'document-storage://tenant-a/refund-proofs/proof.pdf',
      size: 42,
      mimeType: 'application/pdf',
    });
    prisma.$transaction.mockRejectedValue(databaseError);
    storageProvider.delete.mockRejectedValue(new Error('storage unavailable'));

    await expect(service.createUploadedDocument(
      'tenant-a',
      'refund-proofs',
      'proof.pdf',
      Buffer.from('proof'),
      'application/pdf',
    )).rejects.toThrow(databaseError);

    expect(storageProvider.delete).toHaveBeenCalledWith('document-storage://tenant-a/refund-proofs/proof.pdf');
  });
});
