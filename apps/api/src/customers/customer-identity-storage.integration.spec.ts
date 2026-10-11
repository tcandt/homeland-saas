import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DocumentsService } from '../documents/documents.service';
import { DocumentsController } from '../documents/documents.controller';
import { LocalStorageProvider } from '../documents/providers/storage/local-storage.provider';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';

// Real DB/storage services and controller methods, not HTTP auth/browser/PDF-converter evidence.
const enabled = process.env.RUN_IDENTITY_STORAGE_INTEGRATION === 'true';
const phase = process.env.IDENTITY_STORAGE_PHASE || 'prepare';
const tenantId = 'b12-storage-drill-tenant';
const customerId = 'b12-storage-drill-customer';
const reviewerId = 'b12-storage-drill-reviewer';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2f8AAAAASUVORK5CYII=', 'base64');

describe.runIf(enabled)('B11/B12 isolated PostgreSQL + persistent local storage', () => {
  let prisma: PrismaClient;
  let storage: LocalStorageProvider;
  let documents: DocumentsService;
  let customers: CustomersService;
  let uploads: DocumentsController;
  let approvals: CustomersController;
  let evidenceFile: string;
  let assets: Array<{ url: string; originalUrl: string; side: 'front' | 'back'; source: 'scan' }>;

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || '');
    if (url.pathname !== '/homeland_b12_storage_test'
      || !['localhost', '127.0.0.1', 'homeland-b12-postgres-drill-20261011'].includes(url.hostname)
      || !process.env.STORAGE_DIR
      || !['prepare', 'verify-restart'].includes(phase)) throw new Error('ISOLATED_IDENTITY_DRILL_REQUIRED');
    evidenceFile = path.join(process.env.STORAGE_DIR, 'b12-drill-evidence.json');
    prisma = new PrismaClient();
    await prisma.$connect();
    storage = new LocalStorageProvider();
    documents = new DocumentsService(prisma as any, storage, {} as any, {} as any);
    customers = new CustomersService({} as any, {} as any, prisma as any, documents);
    uploads = new DocumentsController(documents, storage);
    approvals = new CustomersController(customers);

    if (phase === 'verify-restart') {
      assets = JSON.parse(await readFile(evidenceFile, 'utf8')).assets;
      return;
    }
    await prisma.auditLog.deleteMany({ where: { tenantId, entityId: customerId } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.customer.create({ data: {
      id: customerId, tenantId, fullName: 'Synthetic storage drill', phone: '0000000000', phoneNormalized: '0000000000',
    } });
    const upload = async (name: string) => uploads.uploadFile(
      { user: { tenantId, email: 'drill@example.invalid' } },
      { originalname: name, buffer: pixel, mimetype: 'image/png', size: pixel.length },
      { folder: 'customers' },
    );
    assets = [];
    for (const side of ['front', 'back'] as const) {
      const original = await upload(`${side}-original.png`);
      const scan = await upload(`${side}-scan.png`);
      assets.push({ url: scan.url, originalUrl: original.url, side, source: 'scan' });
    }
  }, 30_000);

  afterAll(async () => { await prisma?.$disconnect(); });

  it.runIf(phase === 'prepare')('serializes concurrent front/back approvals without losing either side', async () => {
    // Hold the production row lock, queue both real transactions, then release.
    let release!: () => void;
    let locked!: () => void;
    const lockAcquired = new Promise<void>((resolve) => { locked = resolve; });
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const blocker = prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Customer" WHERE "id" = ${customerId} FOR UPDATE`);
      locked();
      await hold;
    });
    await lockAcquired;
    const contenders = assets.map((image) => approvals.approveIdentityImages(customerId, { images: [image], approvedBy: 'forged' }, reviewerId, tenantId));
    release();
    await blocker;
    const results = await Promise.allSettled(contenders);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(customer.idImageProvenance).toHaveLength(2);
    expect(customer.idImageProvenance).toEqual(expect.arrayContaining(assets.map((image) => expect.objectContaining({
      ...image, status: 'APPROVED', approvedBy: reviewerId, approvedAt: expect.any(String),
    }))));
    expect(await prisma.auditLog.count({ where: { tenantId, entityId: customerId } })).toBe(2);
  });

  it('rejects cross-tenant approval and storage downloads', async () => {
    await expect(approvals.approveIdentityImages(customerId, { images: [assets[0]] }, reviewerId, 'foreign-tenant')).rejects.toThrow();
    await expect(documents.resolveTenantStoragePath('foreign-tenant', assets[0].url.replace('document-storage://', ''))).rejects.toThrow('not found');
    await expect(approvals.approveIdentityImages(customerId, { images: [{ ...assets[0], originalUrl: 'document-storage://foreign/file.png' }] }, reviewerId, tenantId)).rejects.toThrow('not found');
  });

  it('keeps both original and scan bytes available through owned download resolution', async () => {
    for (const image of assets) {
      for (const ref of [image.url, image.originalUrl]) {
        const owned = await documents.resolveTenantStoragePath(tenantId, ref.replace('document-storage://', ''));
        expect(hash(await storage.read(owned))).toBe(hash(pixel));
      }
    }
  });

  it.runIf(phase === 'prepare')('rolls back provenance if the audit insert fails', async () => {
    const before = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION b12_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit insert failure'; END; $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER b12_fail_audit_trigger BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION b12_fail_audit()`);
    try {
      const failingService = new CustomersService({} as any, {} as any, prisma as any, documents);
      await expect(failingService.revokeIdentityImage(customerId, tenantId, reviewerId, assets[0].url)).rejects.toThrow('synthetic audit');
      const after = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
      expect(after.idImageProvenance).toEqual(before.idImageProvenance);
      expect(after.idImages).toEqual(before.idImages);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS b12_fail_audit_trigger ON "AuditLog"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS b12_fail_audit()');
    }
  });

  it.runIf(phase === 'prepare')('writes restart verification evidence after successful approvals', async () => {
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(customer.idImageProvenance).toHaveLength(2);
    await writeFile(evidenceFile, JSON.stringify({ assets, provenance: customer.idImageProvenance, checksum: hash(pixel) }));
  });

  it.runIf(phase === 'prepare')('atomically uploads/approves and removes staged bytes on audit rollback', async () => {
    const atomicCustomerId = `${customerId}-atomic`;
    await prisma.auditLog.deleteMany({ where: { tenantId, entityId: atomicCustomerId } });
    await prisma.customer.deleteMany({ where: { id: atomicCustomerId } });
    await prisma.customer.create({ data: { id: atomicCustomerId, tenantId, fullName: 'Synthetic atomic upload', phone: '0000000001', phoneNormalized: '0000000001' } });
    const file = { originalname: 'atomic-scan.png', mimetype: 'image/png', buffer: pixel };
    const original = { ...file, originalname: 'atomic-original.png' };
    await approvals.uploadIdentityImage(atomicCustomerId, { side: 'front', source: 'scan' }, { file: [file], original: [original] }, reviewerId, tenantId);
    const before = await prisma.customer.findUniqueOrThrow({ where: { id: atomicCustomerId } });
    expect(before.idImages).toHaveLength(1);
    const provenance = before.idImageProvenance as any[];
    expect(provenance[0].originalUrl).not.toBe(provenance[0].url);
    expect(hash(await storage.read(provenance[0].originalUrl))).toBe(hash(pixel));
    const documentCount = await prisma.document.count({ where: { tenantId } });
    const staged: string[] = [];
    const save = storage.save.bind(storage);
    const spy = vi.spyOn(storage, 'save').mockImplementation(async (...args) => {
      const result = await save(...args);
      staged.push(result.url);
      return result;
    });
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION b12_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit insert failure'; END; $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER b12_fail_audit_trigger BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."tenantId" = '${tenantId}') EXECUTE FUNCTION b12_fail_audit()`);
    try {
      await expect(approvals.uploadIdentityImage(atomicCustomerId, { side: 'front', source: 'scan' }, { file: [file], original: [original] }, reviewerId, tenantId)).rejects.toThrow('synthetic audit');
      expect(staged).toHaveLength(2);
      expect(await prisma.document.count({ where: { tenantId } })).toBe(documentCount);
      expect((await prisma.customer.findUniqueOrThrow({ where: { id: atomicCustomerId } })).idImageProvenance).toEqual(before.idImageProvenance);
      for (const ref of staged) await expect(storage.read(ref)).rejects.toThrow();
      expect(hash(await storage.read(provenance[0].url))).toBe(hash(pixel));
    } finally {
      spy.mockRestore();
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS b12_fail_audit_trigger ON "AuditLog"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS b12_fail_audit()');
    }
  });

  it.runIf(phase === 'verify-restart')('loads exactly the same provenance and bytes after DB restart and app recreation', async () => {
    const evidence = JSON.parse(await readFile(evidenceFile, 'utf8'));
    const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
    expect(customer.idImageProvenance).toEqual(evidence.provenance);
    expect(await prisma.auditLog.count({ where: { tenantId, entityId: customerId } })).toBe(2);
    for (const image of assets) {
      expect(hash(await storage.read(image.url))).toBe(evidence.checksum);
      expect(hash(await storage.read(image.originalUrl))).toBe(evidence.checksum);
    }
  });
});
