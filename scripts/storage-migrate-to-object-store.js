#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient, SettingScope } = require('@prisma/client');

function parseArguments(argv) {
  const options = {
    envFile: null,
    apply: false,
    storageDir: process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'),
    provider: process.env.STORAGE_PROVIDER || 's3',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env-file') {
      options.envFile = argv[index + 1] || null;
      index += 1;
    } else if (argument === '--storage-dir') {
      options.storageDir = argv[index + 1] || options.storageDir;
      index += 1;
    } else if (argument === '--provider') {
      options.provider = argv[index + 1] || options.provider;
      index += 1;
    } else if (argument === '--apply') {
      options.apply = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

function loadEnvFile(envFile) {
  if (!envFile) return;
  const resolved = path.resolve(envFile);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Environment file not found: ${resolved}`);
  }
  require('dotenv').config({ path: resolved });
}

function normalizeStorageReference(value) {
  let normalized = decodeURIComponent(String(value || '')).trim();
  if (!normalized) return '';

  const queryIndex = normalized.indexOf('path=');
  if (normalized.includes('/api/v1/settings/file?path=') && queryIndex >= 0) {
    normalized = normalized.slice(queryIndex + 5);
  } else if (normalized.includes('/api/v1/documents/storage?path=') && queryIndex >= 0) {
    normalized = normalized.slice(queryIndex + 5);
  } else if (normalized.includes('/api/v1/documents/storage/')) {
    normalized = normalized.replace(/^.*\/api\/v1\/documents\/storage\//, '');
  } else if (normalized.includes('/documents/storage/')) {
    normalized = normalized.replace(/^.*\/documents\/storage\//, '');
  }

  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  return normalized;
}

function toDocumentStorageUrl(storageReference) {
  return `/api/v1/documents/storage?path=${encodeURIComponent(storageReference)}`;
}

function resolveLocalFile(storageDir, currentValue) {
  const normalized = normalizeStorageReference(currentValue);
  if (!normalized || normalized.startsWith('s3://')) return null;
  const target = path.resolve(storageDir, normalized);
  const root = path.resolve(storageDir);
  if (!target.startsWith(root + path.sep) && target !== root) {
    throw new Error(`Unsafe storage path: ${target}`);
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return null;
  }
  return {
    normalized,
    fullPath: target,
    nextValue: toDocumentStorageUrl(`s3://${process.env.S3_BUCKET}/${normalized.replace(/\\/g, '/')}`),
  };
}

function createS3Client() {
  const endpoint = process.env.S3_ENDPOINT || '';
  const region = process.env.S3_REGION || 'auto';
  const bucket = process.env.S3_BUCKET || '';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || '';
  const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || 'true').toLowerCase() !== 'false';

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 object storage configuration is incomplete.');
  }

  function encodeKey(key) {
    return key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  }

  function formatAmzDate(date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  function getSignatureKey(dateStamp) {
    const kDate = crypto.createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    return crypto.createHmac('sha256', kService).update('aws4_request').digest();
  }

  function signRequest(method, objectKey, body, contentType) {
    const endpointUrl = new URL(endpoint);
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const objectPath = forcePathStyle ? `/${bucket}/${encodeKey(objectKey)}` : `/${encodeKey(objectKey)}`;
    const host = forcePathStyle ? endpointUrl.host : `${bucket}.${endpointUrl.host}`;
    const url = new URL(endpointUrl.toString());
    url.host = host;
    url.pathname = objectPath;

    const payloadHash = crypto.createHash('sha256').update(body || Buffer.alloc(0)).digest('hex');
    const headers = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    };
    if (contentType) headers['content-type'] = contentType;
    const signedHeaderKeys = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderKeys.map((key) => `${key}:${headers[key]}`).join('\n');
    const signedHeaders = signedHeaderKeys.join(';');
    const canonicalRequest = [
      method,
      url.pathname,
      '',
      `${canonicalHeaders}\n`,
      signedHeaders,
      payloadHash,
    ].join('\n');
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const signature = crypto.createHmac('sha256', getSignatureKey(dateStamp)).update(stringToSign).digest('hex');
    headers.Authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return { url, headers, bucket };
  }

  return {
    bucket,
    async upload(objectKey, buffer, contentType) {
      const signed = signRequest('PUT', objectKey, buffer, contentType || 'application/octet-stream');
      const response = await fetch(signed.url, {
        method: 'PUT',
        headers: signed.headers,
        body: buffer,
      });
      if (!response.ok) {
        throw new Error(`S3 upload failed for ${objectKey}: ${response.status} ${await response.text()}`);
      }
      return `s3://${bucket}/${objectKey}`;
    },
  };
}

async function runMigration(options) {
  loadEnvFile(options.envFile);
  if (String(options.provider).toLowerCase() === 'local') {
    throw new Error('Refusing to migrate to local provider. Set --provider s3 and S3_* configuration.');
  }

  const prisma = new PrismaClient();
  const s3 = createS3Client();
  const storageDir = path.resolve(options.storageDir);
  const uploads = new Map();
  const updates = [];
  const missing = [];

  async function stageUpload(currentValue) {
    const local = resolveLocalFile(storageDir, currentValue);
    if (!local) {
      if (typeof currentValue === 'string' && currentValue && !normalizeStorageReference(currentValue).startsWith('s3://')) {
        missing.push(currentValue);
      }
      return currentValue;
    }

    if (!uploads.has(local.normalized)) {
      const buffer = fs.readFileSync(local.fullPath);
      await s3.upload(local.normalized.replace(/\\/g, '/'), buffer, undefined);
      uploads.set(local.normalized, local.nextValue);
    }
    return uploads.get(local.normalized);
  }

  try {
    const [documentVersions, customers, contracts, expenses, appSettings] = await Promise.all([
      prisma.documentVersion.findMany({ select: { id: true, filePath: true } }),
      prisma.customer.findMany({ select: { id: true, idImages: true } }),
      prisma.contract.findMany({ select: { id: true, attachments: true } }),
      prisma.expense.findMany({ select: { id: true, attachmentUrls: true } }),
      prisma.appSetting.findMany({
        where: {
          OR: [
            { scope: SettingScope.USER, key: 'profile' },
            { key: 'business' },
            { key: 'owners' },
          ],
        },
        select: { id: true, value: true },
      }),
    ]);

    for (const row of documentVersions) {
      const nextValue = await stageUpload(row.filePath);
      if (nextValue !== row.filePath) {
        updates.push({
          entity: 'DocumentVersion',
          id: row.id,
          apply: () => prisma.documentVersion.update({ where: { id: row.id }, data: { filePath: nextValue } }),
        });
      }
    }

    for (const row of customers) {
      const nextImages = [];
      let changed = false;
      for (const image of row.idImages || []) {
        const nextValue = await stageUpload(image);
        nextImages.push(nextValue);
        if (nextValue !== image) changed = true;
      }
      if (changed) {
        updates.push({
          entity: 'Customer',
          id: row.id,
          apply: () => prisma.customer.update({ where: { id: row.id }, data: { idImages: nextImages } }),
        });
      }
    }

    for (const row of contracts) {
      const nextAttachments = [];
      let changed = false;
      for (const attachment of row.attachments || []) {
        const nextValue = await stageUpload(attachment);
        nextAttachments.push(nextValue);
        if (nextValue !== attachment) changed = true;
      }
      if (changed) {
        updates.push({
          entity: 'Contract',
          id: row.id,
          apply: () => prisma.contract.update({ where: { id: row.id }, data: { attachments: nextAttachments } }),
        });
      }
    }

    for (const row of expenses) {
      const nextAttachments = [];
      let changed = false;
      for (const attachment of row.attachmentUrls || []) {
        const nextValue = await stageUpload(attachment);
        nextAttachments.push(nextValue);
        if (nextValue !== attachment) changed = true;
      }
      if (changed) {
        updates.push({
          entity: 'Expense',
          id: row.id,
          apply: () => prisma.expense.update({ where: { id: row.id }, data: { attachmentUrls: nextAttachments } }),
        });
      }
    }

    for (const row of appSettings) {
      const nextValue = await (async () => {
        let touched = false;
        const mapped = await replaceStorageRefsAsync(row.value, async (value) => {
          const next = await stageUpload(value);
          if (next !== value) touched = true;
          return next;
        });
        return touched ? mapped : row.value;
      })();

      if (nextValue !== row.value) {
        updates.push({
          entity: 'AppSetting',
          id: row.id,
          apply: () => prisma.appSetting.update({ where: { id: row.id }, data: { value: nextValue } }),
        });
      }
    }

    if (options.apply) {
      for (const update of updates) {
        await update.apply();
      }
    }

    const result = {
      apply: options.apply,
      uploadedObjects: uploads.size,
      updatedRecords: updates.length,
      missingReferences: Array.from(new Set(missing)).sort(),
      updatedEntities: updates.map((update) => ({ entity: update.entity, id: update.id })),
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

async function replaceStorageRefsAsync(value, mapper) {
  if (Array.isArray(value)) {
    const next = [];
    for (const item of value) {
      next.push(await replaceStorageRefsAsync(item, mapper));
    }
    return next;
  }
  if (value && typeof value === 'object') {
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      next[key] = await replaceStorageRefsAsync(item, mapper);
    }
    return next;
  }
  if (typeof value === 'string') {
    return mapper(value);
  }
  return value;
}

if (require.main === module) {
  runMigration(parseArguments(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`Storage migration failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseArguments,
  normalizeStorageReference,
  resolveLocalFile,
};
