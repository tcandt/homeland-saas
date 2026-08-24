const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseArguments, normalizeStorageReference, resolveLocalFile } = require('./storage-migrate-to-object-store');

test('parses storage migration CLI arguments', () => {
  assert.deepEqual(
    parseArguments(['--env-file', '.env.prod', '--storage-dir', 'storage', '--provider', 's3', '--apply']),
    {
      envFile: '.env.prod',
      apply: true,
      storageDir: 'storage',
      provider: 's3',
    },
  );
});

test('normalizes local and query storage references', () => {
  assert.equal(normalizeStorageReference('/api/v1/documents/storage/tenant/contracts/a.pdf'), 'tenant/contracts/a.pdf');
  assert.equal(
    normalizeStorageReference('/api/v1/documents/storage?path=tenant%2Fcontracts%2Fa.pdf'),
    'tenant/contracts/a.pdf',
  );
  assert.equal(normalizeStorageReference('/api/v1/settings/file?path=s3%3A%2F%2Fbucket%2Ftenant%2Fa.pdf'), 's3://bucket/tenant/a.pdf');
});

test('resolves a local file to next s3-backed document url', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'homeland-storage-migrate-'));
  const filePath = path.join(root, 'tenant', 'contracts');
  fs.mkdirSync(filePath, { recursive: true });
  fs.writeFileSync(path.join(filePath, 'lease.pdf'), 'hello');
  process.env.S3_BUCKET = 'homeland-bucket';

  const resolved = resolveLocalFile(root, '/api/v1/documents/storage/tenant/contracts/lease.pdf');
  assert.ok(resolved);
  assert.equal(resolved.normalized, 'tenant/contracts/lease.pdf');
  assert.equal(
    resolved.nextValue,
    '/api/v1/documents/storage?path=s3%3A%2F%2Fhomeland-bucket%2Ftenant%2Fcontracts%2Flease.pdf',
  );
});
