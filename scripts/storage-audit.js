#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PrismaClient, SettingScope } = require('@prisma/client');
const { normalizeStorageReference } = require('./storage-migrate-to-object-store');

function parseArguments(argv) {
  const options = {
    envFile: null,
    storageDir: process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env-file') {
      options.envFile = argv[index + 1] || null;
      index += 1;
    } else if (argument === '--storage-dir') {
      options.storageDir = argv[index + 1] || options.storageDir;
      index += 1;
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

function classifyReference(storageDir, value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = normalizeStorageReference(value);
  if (!normalized) return null;
  if (normalized.startsWith('s3://')) {
    return { type: 's3', normalized, exists: true };
  }

  const root = path.resolve(storageDir);
  const target = path.resolve(root, normalized);
  const safe = target === root || target.startsWith(root + path.sep);
  if (!safe) {
    return { type: 'unsafe', normalized, exists: false };
  }
  return {
    type: 'local',
    normalized,
    exists: fs.existsSync(target) && fs.statSync(target).isFile(),
  };
}

function collectStringRefs(value, refs = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectStringRefs(item, refs);
    return refs;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectStringRefs(item, refs);
    return refs;
  }
  if (typeof value === 'string') refs.push(value);
  return refs;
}

async function runAudit(options, deps = {}) {
  loadEnvFile(options.envFile);
  const prisma = deps.prisma || new PrismaClient();
  const disconnect = deps.prisma ? async () => undefined : async () => prisma.$disconnect();
  const storageDir = path.resolve(options.storageDir);

  const summary = {
    storageDir,
    totalReferences: 0,
    localReferences: 0,
    s3References: 0,
    unsafeReferences: 0,
    missingLocalFiles: [],
    byEntity: {},
  };

  function record(entity, id, value) {
    const classified = classifyReference(storageDir, value);
    if (!classified) return;
    summary.totalReferences += 1;
    summary.byEntity[entity] = (summary.byEntity[entity] || 0) + 1;
    if (classified.type === 'local') {
      summary.localReferences += 1;
      if (!classified.exists) {
        summary.missingLocalFiles.push({ entity, id, path: classified.normalized });
      }
    } else if (classified.type === 's3') {
      summary.s3References += 1;
    } else if (classified.type === 'unsafe') {
      summary.unsafeReferences += 1;
      summary.missingLocalFiles.push({ entity, id, path: classified.normalized });
    }
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

    for (const row of documentVersions) record('DocumentVersion.filePath', row.id, row.filePath);
    for (const row of customers) for (const value of row.idImages || []) record('Customer.idImages', row.id, value);
    for (const row of contracts) for (const value of row.attachments || []) record('Contract.attachments', row.id, value);
    for (const row of expenses) for (const value of row.attachmentUrls || []) record('Expense.attachmentUrls', row.id, value);
    for (const row of appSettings) {
      for (const value of collectStringRefs(row.value)) record('AppSetting.value', row.id, value);
    }

    summary.missingLocalFiles.sort((left, right) => `${left.entity}:${left.id}:${left.path}`.localeCompare(`${right.entity}:${right.id}:${right.path}`));
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return summary;
  } finally {
    await disconnect();
  }
}

if (require.main === module) {
  runAudit(parseArguments(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`Storage audit failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  classifyReference,
  collectStringRefs,
  parseArguments,
  runAudit,
};
