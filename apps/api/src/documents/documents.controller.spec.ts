import { describe, expect, it, vi } from 'vitest';
import { DocumentsController } from './documents.controller';
import { PERMISSIONS_KEY } from '../shared/decorators/require-permissions.decorator';

const ownedRequest = { user: { tenantId: 'tenant-a' } };

function createSubject() {
  const documentsService: any = {
    resolveTenantStoragePath: vi.fn(),
    listTemplates: vi.fn(),
    generateDocument: vi.fn(),
    createUploadedDocument: vi.fn(),
  };
  const storageProvider: any = {
    read: vi.fn(),
    getDownloadUrl: vi.fn(),
  };
  const response: any = {
    set: vi.fn(),
  };

  return {
    controller: new DocumentsController(documentsService, storageProvider),
    documentsService,
    storageProvider,
    response,
  };
}

describe('DocumentsController storage routes', () => {
  it('reads an owned storage version only after tenant authorization', async () => {
    const { controller, documentsService, storageProvider, response } = createSubject();
    documentsService.resolveTenantStoragePath.mockResolvedValue('document-storage://tenant-a/contracts/lease.pdf');
    storageProvider.read.mockResolvedValue(Buffer.from('pdf'));

    await controller.serveStorage(ownedRequest, 'tenant-a/contracts/lease.pdf', response);

    expect(documentsService.resolveTenantStoragePath).toHaveBeenCalledWith('tenant-a', 'tenant-a/contracts/lease.pdf');
    expect(storageProvider.read).toHaveBeenCalledWith('document-storage://tenant-a/contracts/lease.pdf');
  });

  it('does not access storage for foreign or unknown query and direct-link paths', async () => {
    const { controller, documentsService, storageProvider, response } = createSubject();
    documentsService.resolveTenantStoragePath.mockRejectedValue(new Error('Document storage file not found'));

    await expect(controller.serveStorageByQuery(ownedRequest, 'tenant-b/contracts/lease.pdf', response))
      .rejects.toThrow('Document storage file not found');
    await expect(controller.getStorageLink(ownedRequest, 'tenant-b/contracts/lease.pdf', 'true'))
      .rejects.toThrow('Document storage file not found');

    expect(storageProvider.read).not.toHaveBeenCalled();
    expect(storageProvider.getDownloadUrl).not.toHaveBeenCalled();
  });

  it('keeps the document download permission metadata and rejects missing tenant authentication', async () => {
    const { controller, documentsService, response } = createSubject();

    expect(Reflect.getMetadata(PERMISSIONS_KEY, DocumentsController.prototype.serveStorage))
      .toEqual(['document.download']);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, DocumentsController.prototype.getStorageLink))
      .toEqual(['document.download']);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, DocumentsController.prototype.serveStorageByQuery))
      .toEqual(['document.download']);
    await expect(controller.serveStorage({ user: {} }, 'tenant-a/contracts/lease.pdf', response))
      .rejects.toThrow('Tenant ID missing');
    expect(documentsService.resolveTenantStoragePath).not.toHaveBeenCalled();
  });
});

describe('DocumentsController generation routes', () => {
  it('lists only templates scoped to the authenticated tenant', async () => {
    const { controller, documentsService } = createSubject();
    documentsService.listTemplates.mockResolvedValue([{ code: 'LEASE', name: 'Lease', type: 'CONTRACT' }]);

    await expect(controller.listTemplates(ownedRequest)).resolves.toEqual([
      { code: 'LEASE', name: 'Lease', type: 'CONTRACT' },
    ]);

    expect(documentsService.listTemplates).toHaveBeenCalledWith('tenant-a');
    expect(Reflect.getMetadata(PERMISSIONS_KEY, DocumentsController.prototype.listTemplates))
      .toEqual(['document.read']);

    await expect(controller.listTemplates({ user: {} })).rejects.toThrow('Tenant ID missing');
  });

  it('generates from the selected template with authenticated tenant metadata', async () => {
    const { controller, documentsService } = createSubject();
    documentsService.generateDocument.mockResolvedValue({ id: 'document-1' });
    const request = { user: { tenantId: 'tenant-a', email: 'owner@example.com' } };

    await expect(controller.generate(request, 'new', {
      templateCode: ' LEASE ',
      title: ' Lease September ',
      payload: { customerName: 'Lan' },
    })).resolves.toEqual({ id: 'document-1' });

    expect(documentsService.generateDocument).toHaveBeenCalledWith('tenant-a', 'LEASE', { customerName: 'Lan' }, {
      createdBy: 'owner@example.com',
      title: 'Lease September',
      sourceType: undefined,
      sourceId: undefined,
    });
    expect(Reflect.getMetadata(PERMISSIONS_KEY, DocumentsController.prototype.generate))
      .toEqual(['document.create']);
  });

  it('rejects a generation request without an actual template or object payload', async () => {
    const { controller, documentsService } = createSubject();

    await expect(controller.generate(ownedRequest, 'new', { templateCode: '   ' }))
      .rejects.toThrow('Template code is required');
    await expect(controller.generate(ownedRequest, 'new', { templateCode: 'LEASE', payload: [] }))
      .rejects.toThrow('Document payload must be an object');
    expect(documentsService.generateDocument).not.toHaveBeenCalled();
  });
});

describe('DocumentsController upload route', () => {
  it('propagates the authenticated tenant and returns the legacy fields with document IDs', async () => {
    const { controller, documentsService } = createSubject();
    documentsService.createUploadedDocument.mockResolvedValue({
      url: 'document-storage://tenant-a/uploads/proof.pdf',
      size: 42,
      mimeType: 'application/pdf',
      documentId: 'document-1',
      versionId: 'version-1',
    });
    const request = { user: { tenantId: 'tenant-a', email: 'owner@example.com' } };
    const file = {
      originalname: 'proof.pdf',
      buffer: Buffer.from('proof'),
      mimetype: 'application/pdf',
    };

    await expect(controller.uploadFile(request, file, { folder: 'refund-proofs' })).resolves.toEqual({
      url: 'document-storage://tenant-a/uploads/proof.pdf',
      size: 42,
      mimeType: 'application/pdf',
      documentId: 'document-1',
      versionId: 'version-1',
    });

    expect(documentsService.createUploadedDocument).toHaveBeenCalledWith(
      'tenant-a',
      'refund-proofs',
      'proof.pdf',
      file.buffer,
      'application/pdf',
      { createdBy: 'owner@example.com' },
    );
  });

  it('does not report a successful upload when document persistence fails', async () => {
    const { controller, documentsService } = createSubject();
    documentsService.createUploadedDocument.mockRejectedValue(new Error('database unavailable'));

    await expect(controller.uploadFile(ownedRequest, {
      originalname: 'proof.pdf',
      buffer: Buffer.from('proof'),
      mimetype: 'application/pdf',
    }, { folder: 'refund-proofs' })).rejects.toThrow('database unavailable');
  });

  it('rejects unsupported MIME types and oversized files before persistence', async () => {
    const { controller, documentsService } = createSubject();

    await expect(controller.uploadFile(ownedRequest, {
      originalname: 'payload.exe',
      buffer: Buffer.from('MZ'),
      size: 2,
      mimetype: 'application/octet-stream',
    }, { folder: 'uploads' })).rejects.toThrow('Only PDF or image files are supported');

    await expect(controller.uploadFile(ownedRequest, {
      originalname: 'large.pdf',
      buffer: Buffer.alloc(1),
      size: 20 * 1024 * 1024 + 1,
      mimetype: 'application/pdf',
    }, { folder: 'uploads' })).rejects.toThrow('upload limit');

    expect(documentsService.createUploadedDocument).not.toHaveBeenCalled();
  });
});
