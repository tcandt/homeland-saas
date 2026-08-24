const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { classifyReference, collectStringRefs, parseArguments, runAudit } = require('./storage-audit');

test('parses storage audit CLI arguments', () => {
  assert.deepEqual(
    parseArguments(['--env-file', '.env.public-production', '--storage-dir', '/srv/homeland/storage']),
    {
      envFile: '.env.public-production',
      storageDir: '/srv/homeland/storage',
    },
  );
});

test('classifies local and s3 references', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-storage-audit-'));
  fs.mkdirSync(path.join(root, 'tenant'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tenant', 'file.pdf'), 'hello');

  assert.deepEqual(classifyReference(root, '/api/v1/documents/storage/tenant/file.pdf'), {
    type: 'local',
    normalized: 'tenant/file.pdf',
    exists: true,
  });
  assert.deepEqual(classifyReference(root, '/api/v1/documents/storage?path=s3%3A%2F%2Fbucket%2Ftenant%2Ffile.pdf'), {
    type: 's3',
    normalized: 's3://bucket/tenant/file.pdf',
    exists: true,
  });
});

test('collects nested string references', () => {
  assert.deepEqual(
    collectStringRefs({ a: ['x', { b: 'y' }], c: 1, d: null }),
    ['x', 'y'],
  );
});

test('audits storage references across entities', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-storage-audit-run-'));
  fs.mkdirSync(path.join(root, 'tenant', 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'tenant', 'docs', 'lease.pdf'), 'lease');

  const prisma = {
    documentVersion: {
      findMany: async () => [{ id: 'dv1', filePath: '/api/v1/documents/storage/tenant/docs/lease.pdf' }],
    },
    customer: {
      findMany: async () => [{ id: 'c1', idImages: ['/api/v1/documents/storage/tenant/docs/missing.png'] }],
    },
    contract: {
      findMany: async () => [{ id: 'ct1', attachments: ['/api/v1/documents/storage?path=s3%3A%2F%2Fbucket%2Ftenant%2Fdocs%2Flease.pdf'] }],
    },
    expense: {
      findMany: async () => [{ id: 'e1', attachmentUrls: [] }],
    },
    appSetting: {
      findMany: async () => [{ id: 's1', value: { logo: '/api/v1/documents/storage/tenant/docs/missing-logo.png' } }],
    },
  };

  const result = await runAudit({ envFile: null, storageDir: root }, { prisma });
  assert.equal(result.totalReferences, 4);
  assert.equal(result.localReferences, 3);
  assert.equal(result.s3References, 1);
  assert.equal(result.missingLocalFiles.length, 2);
});
