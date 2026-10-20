import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { HunonicService } from './hunonic.service';

const enabled = process.env.RUN_HUNONIC_SYNC_DB_TESTS === '1';
const url = process.env.HUNONIC_TEST_DATABASE_URL;
if (enabled && (!url || !/^homeland_hunonic_test_[a-z0-9_]+$/.test(new URL(url).pathname.slice(1)))) {
  throw new Error('Dedicated Hunonic test database URL required; shared database refused.');
}
describe.skipIf(!enabled)('Hunonic reservation real PostgreSQL', () => {
  const p = new PrismaClient(enabled ? { datasources: { db: { url } } } : undefined);
  const service = new HunonicService(p as any);
  beforeAll(async () => {
    await p.$connect();
    await p.$executeRawUnsafe(`CREATE TABLE "HunonicSyncLog" (
      id TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, status TEXT NOT NULL, source TEXT,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMP(3),
      "metersFound" INTEGER NOT NULL DEFAULT 0, "readingsSaved" INTEGER NOT NULL DEFAULT 0,
      message TEXT, error TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  });
  afterAll(() => p.$disconnect());

  it('concurrent starts reserve exactly one RUNNING job', async () => {
    const jobs = await Promise.all(Array.from({ length: 8 }, () => (service as any).reserveSyncLog('tenant-a', 'mobile')));
    expect(new Set(jobs.map((job) => job.log.id)).size).toBe(1);
    expect(jobs.filter((job) => !job.reused)).toHaveLength(1);
    expect(await p.hunonicSyncLog.count({ where: { tenantId: 'tenant-a', status: 'RUNNING' } })).toBe(1);
  });
  it('keeps another tenant separate and denies foreign job status', async () => {
    const a = await p.hunonicSyncLog.findFirstOrThrow({ where: { tenantId: 'tenant-a' } });
    const b = await (service as any).reserveSyncLog('tenant-b', 'mobile');
    expect(b.log.id).not.toBe(a.id);
    await expect(service.getSyncStatus('tenant-b', a.id)).rejects.toThrow('HUNONIC_SYNC_JOB_NOT_FOUND');
  });
  it('expires stale jobs, reserves a replacement and fences late progress', async () => {
    const old = await p.hunonicSyncLog.create({ data: { tenantId: 'tenant-stale', status: 'RUNNING', startedAt: new Date(0) } });
    expect(await service.getSyncStatus('tenant-stale', old.id)).toMatchObject({ status: 'FAILED', error: 'HUNONIC_SYNC_STALE' });
    const next = await (service as any).reserveSyncLog('tenant-stale', 'mobile');
    expect(next.log.id).not.toBe(old.id);
    await expect((service as any).publishSyncProgress('tenant-stale', old.id, {})).rejects.toThrow('HUNONIC_SYNC_LEASE_LOST');
    expect((await service.getSyncStatus('tenant-stale', next.log.id)).status).toBe('RUNNING');
  });
});
