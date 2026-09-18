#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const ACTIVE_CONTRACT_STATUSES = new Set(['ACTIVE', 'EXPIRING']);

function parseArguments(argv) {
  const options = { envFile: null, tenantId: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env-file') {
      options.envFile = argv[++index] || null;
    } else if (argument === '--tenant-id') {
      options.tenantId = argv[++index] || '';
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function loadEnvFile(envFile) {
  if (!envFile) return;
  const resolved = path.resolve(envFile);
  if (!fs.existsSync(resolved)) throw new Error(`Environment file not found: ${resolved}`);
  require('dotenv').config({ path: resolved });
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeIdentity(value) {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function mask(value, visible = 3) {
  const text = String(value || '');
  if (!text) return null;
  if (text.length <= visible) return '*'.repeat(text.length);
  return `${'*'.repeat(Math.min(8, text.length - visible))}${text.slice(-visible)}`;
}

function makeComponentId(tenantId, ids) {
  return `customer-duplicate-${crypto.createHash('sha256').update(`${tenantId}:${[...ids].sort().join(',')}`).digest('hex').slice(0, 16)}`;
}

function countDuplicateKeys(customers) {
  let count = 0;
  for (const read of [(item) => normalizePhone(item.phone), (item) => normalizeIdentity(item.identityNo)]) {
    const groups = new Map();
    for (const customer of customers) {
      const normalized = read(customer);
      if (!normalized) continue;
      const key = `${customer.tenantId}:${normalized}`;
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    count += [...groups.values()].filter((value) => value > 1).length;
  }
  return count;
}

function buildDuplicateComponents(customers) {
  const parent = new Map(customers.map((customer) => [customer.id, customer.id]));
  const find = (id) => {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current);
    let cursor = id;
    while (parent.get(cursor) !== cursor) {
      const next = parent.get(cursor);
      parent.set(cursor, current);
      cursor = next;
    }
    return current;
  };
  const union = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  };

  const matchingKeys = new Map();
  for (const [kind, read] of [
    ['PHONE', (item) => normalizePhone(item.phone)],
    ['IDENTITY', (item) => normalizeIdentity(item.identityNo)],
  ]) {
    const groups = new Map();
    for (const customer of customers) {
      const normalized = read(customer);
      if (!normalized) continue;
      const key = `${customer.tenantId}:${kind}:${normalized}`;
      const rows = groups.get(key) || [];
      rows.push(customer);
      groups.set(key, rows);
    }
    for (const [key, rows] of groups) {
      if (rows.length < 2) continue;
      for (let index = 1; index < rows.length; index += 1) union(rows[0].id, rows[index].id);
      matchingKeys.set(key, { kind, customerIds: rows.map((item) => item.id) });
    }
  }

  const grouped = new Map();
  for (const customer of customers) {
    const root = find(customer.id);
    const rows = grouped.get(root) || [];
    rows.push(customer);
    grouped.set(root, rows);
  }

  return [...grouped.values()]
    .filter((rows) => rows.length > 1)
    .map((rows) => {
      const ids = rows.map((item) => item.id).sort();
      const tenantId = rows[0].tenantId;
      if (rows.some((item) => item.tenantId !== tenantId)) throw new Error('Duplicate component crossed tenant boundary');
      const matchedBy = [...matchingKeys.values()]
        .filter((match) => match.customerIds.some((id) => ids.includes(id)))
        .map((match) => match.kind);
      const openRooms = new Set(rows.flatMap((item) => (item.occupancies || []).filter((row) => !row.leftAt).map((row) => row.roomId)));
      const activeContractRooms = new Set(rows.flatMap((item) => (item.contracts || []).filter((row) => ACTIVE_CONTRACT_STATUSES.has(row.status)).map((row) => row.roomId)));
      const phones = new Set(rows.map((item) => normalizePhone(item.phone)).filter(Boolean));
      const identities = new Set(rows.map((item) => normalizeIdentity(item.identityNo)).filter(Boolean));
      const conflictCodes = [];
      if (openRooms.size > 1) conflictCodes.push('BLOCKING_OPEN_OCCUPANCIES_IN_DIFFERENT_ROOMS');
      if (activeContractRooms.size > 1) conflictCodes.push('BLOCKING_ACTIVE_CONTRACTS_IN_DIFFERENT_ROOMS');
      if (phones.size > 1) conflictCodes.push('PHONE_VALUES_DIFFER');
      if (identities.size > 1) conflictCodes.push('IDENTITY_VALUES_DIFFER');
      const score = (item) => {
        const open = (item.occupancies || []).filter((row) => !row.leftAt).length;
        const active = (item.contracts || []).filter((row) => ACTIVE_CONTRACT_STATUSES.has(row.status)).length;
        const links = ['contracts', 'deposits', 'invoices', 'occupancies', 'rentalCycles', 'contractParties']
          .reduce((total, key) => total + (item[key] || []).length, 0);
        const completeness = ['email', 'identityNo', 'birthDate', 'address', 'zaloUserId'].filter((key) => item[key]).length;
        return open * 1000 + active * 500 + links * 10 + completeness;
      };
      const ranked = [...rows].sort((left, right) => score(right) - score(left) || new Date(left.createdAt) - new Date(right.createdAt) || left.id.localeCompare(right.id));
      return {
        componentId: makeComponentId(tenantId, ids),
        tenantId,
        customerIds: ids,
        matchedBy: [...new Set(matchedBy)].sort(),
        conflictCodes,
        blocked: conflictCodes.some((code) => code.startsWith('BLOCKING_')),
        suggestedPrimaryCustomerId: ranked[0].id,
        suggestionRule: 'Ưu tiên hồ sơ có lưu trú mở, hợp đồng hoạt động, nhiều liên kết và dữ liệu đầy đủ hơn; bắt buộc người vận hành duyệt.',
        customers: rows.map((item) => ({
          id: item.id,
          fullName: item.fullName,
          maskedPhone: mask(normalizePhone(item.phone)),
          maskedIdentityNo: mask(normalizeIdentity(item.identityNo), 2),
          cachedRoomId: item.roomId || null,
          createdAt: item.createdAt,
          linkCounts: {
            contracts: (item.contracts || []).length,
            activeContracts: (item.contracts || []).filter((row) => ACTIVE_CONTRACT_STATUSES.has(row.status)).length,
            deposits: (item.deposits || []).length,
            invoices: (item.invoices || []).length,
            occupancies: (item.occupancies || []).length,
            openOccupancies: (item.occupancies || []).filter((row) => !row.leftAt).length,
            rentalCycles: (item.rentalCycles || []).length,
            contractParties: (item.contractParties || []).length,
          },
        })),
        decisionTemplate: {
          componentId: makeComponentId(tenantId, ids),
          tenantId,
          action: 'MERGE',
          primaryCustomerId: null,
          duplicateCustomerIds: [],
          approvedBy: '',
          evidence: [],
          acknowledgedConflictCodes: [],
        },
      };
    })
    .sort((left, right) => left.tenantId.localeCompare(right.tenantId) || left.componentId.localeCompare(right.componentId));
}

const CUSTOMER_REVIEW_SELECT = {
  id: true,
  tenantId: true,
  fullName: true,
  phone: true,
  email: true,
  identityNo: true,
  birthDate: true,
  address: true,
  zaloUserId: true,
  roomId: true,
  createdAt: true,
  contracts: { where: { deletedAt: null }, select: { id: true, roomId: true, status: true } },
  deposits: { where: { deletedAt: null }, select: { id: true } },
  invoices: { where: { deletedAt: null }, select: { id: true } },
  occupancies: { select: { id: true, roomId: true, leftAt: true } },
  rentalCycles: { select: { id: true } },
  contractParties: { select: { id: true } },
};

async function loadDuplicateReview(prisma, tenantId = '') {
  const customers = await prisma.customer.findMany({
    where: { ...(tenantId ? { tenantId } : {}), deletedAt: null },
    select: CUSTOMER_REVIEW_SELECT,
    orderBy: [{ tenantId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  const components = buildDuplicateComponents(customers);
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: 'REVIEW',
    readOnly: true,
    duplicateFindingCount: countDuplicateKeys(customers),
    componentCount: components.length,
    blockedComponentCount: components.filter((item) => item.blocked).length,
    components,
  };
}

async function runReview(options, deps = {}) {
  loadEnvFile(options.envFile);
  const prisma = deps.prisma || new PrismaClient();
  const disconnect = deps.prisma ? async () => undefined : async () => prisma.$disconnect();
  try {
    const report = await loadDuplicateReview(prisma, options.tenantId);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally {
    await disconnect();
  }
}

if (require.main === module) {
  runReview(parseArguments(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`Customer duplicate review failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  CUSTOMER_REVIEW_SELECT,
  buildDuplicateComponents,
  countDuplicateKeys,
  loadDuplicateReview,
  makeComponentId,
  normalizeIdentity,
  normalizePhone,
  parseArguments,
  runReview,
};
