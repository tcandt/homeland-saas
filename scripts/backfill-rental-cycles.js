#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { buildDuplicateComponents } = require('./customer-duplicate-review');

const CONFIRMATION = 'BACKFILL_RENTAL_CYCLES';

function parseArguments(argv) {
  const options = { envFile: null, tenantId: '', apply: false, confirm: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env-file') options.envFile = argv[++index] || null;
    else if (argument === '--tenant-id') options.tenantId = argv[++index] || '';
    else if (argument === '--confirm') options.confirm = argv[++index] || '';
    else if (argument === '--apply') options.apply = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.apply && options.confirm !== CONFIRMATION) {
    throw new Error(`--apply requires --confirm ${CONFIRMATION}`);
  }
  return options;
}

function loadEnvFile(envFile) {
  if (!envFile) return;
  const resolved = path.resolve(envFile);
  if (!fs.existsSync(resolved)) throw new Error(`Environment file not found: ${resolved}`);
  require('dotenv').config({ path: resolved });
}

function mapRentalCycleStatus(contractStatus) {
  if (contractStatus === 'DRAFT') return 'PLANNED';
  if (['PENDING_APPROVAL', 'APPROVED'].includes(contractStatus)) return 'RESERVED';
  if (['ACTIVE', 'EXPIRING'].includes(contractStatus)) return 'ACTIVE';
  if (['EXPIRED', 'TERMINATED'].includes(contractStatus)) return 'CLOSED';
  if (contractStatus === 'CANCELLED') return 'CANCELLED';
  throw new Error(`Unsupported contract status: ${contractStatus}`);
}

function deterministicCycleId(contractId) {
  return `rc_${crypto.createHash('sha256').update(`contract:${contractId}`).digest('hex').slice(0, 28)}`;
}

function dateValue(value) {
  return value ? new Date(value).toISOString() : '';
}

function decimalValue(value) {
  return Number(value || 0).toFixed(2);
}

function contractSignature(contract, canonicalCustomerId) {
  return [
    contract.tenantId,
    canonicalCustomerId,
    contract.roomId,
    dateValue(contract.startDate),
    dateValue(contract.endDate),
    decimalValue(contract.monthlyRent),
    decimalValue(contract.depositMoney),
  ].join('|');
}

function buildBackfillPlan({ contracts, customers, orphanDeposits = [], orphanInvoices = [] }) {
  const duplicateComponents = buildDuplicateComponents(customers || []);
  const canonicalByCustomer = new Map();
  for (const component of duplicateComponents) {
    for (const customerId of component.customerIds) canonicalByCustomer.set(customerId, component.componentId);
  }
  const signatureGroups = new Map();
  for (const contract of contracts || []) {
    const canonical = canonicalByCustomer.get(contract.customerId) || contract.customerId;
    const signature = contractSignature(contract, canonical);
    const rows = signatureGroups.get(signature) || [];
    rows.push(contract);
    signatureGroups.set(signature, rows);
  }

  const candidates = [];
  const skipped = [];
  for (const group of signatureGroups.values()) {
    if (group.length > 1) {
      for (const contract of group) {
        skipped.push({
          contractId: contract.id,
          tenantId: contract.tenantId,
          reason: 'DUPLICATE_CONTRACT_SIGNATURE_REQUIRES_REVIEW',
          relatedContractIds: group.map((item) => item.id).filter((id) => id !== contract.id),
        });
      }
      continue;
    }
    const contract = group[0];
    const bindingMismatch = [
      ...(contract.deposits || []),
      ...(contract.invoices || []),
    ].some((item) => item.tenantId !== contract.tenantId || item.customerId !== contract.customerId);
    if (bindingMismatch) {
      skipped.push({ contractId: contract.id, tenantId: contract.tenantId, reason: 'FINANCIAL_BINDING_MISMATCH_REQUIRES_REVIEW' });
      continue;
    }
    const occupancies = contract.occupancies || [];
    const joinedDates = occupancies.map((item) => item.joinedAt).filter(Boolean).map((value) => new Date(value));
    const leftDates = occupancies.map((item) => item.leftAt).filter(Boolean).map((value) => new Date(value));
    const actualMoveInAt = contract.actualMoveInAt || (joinedDates.length ? new Date(Math.min(...joinedDates.map(Number))) : null);
    const actualEndAt = contract.actualMoveOutAt || (leftDates.length ? new Date(Math.max(...leftDates.map(Number))) : null);
    const invoiceIds = (contract.invoices || []).map((item) => item.id);
    const paymentIds = (contract.invoices || []).flatMap((item) => (item.payments || []).map((payment) => payment.id));
    candidates.push({
      cycleId: deterministicCycleId(contract.id),
      tenantId: contract.tenantId,
      contractId: contract.id,
      customerId: contract.customerId,
      roomId: contract.roomId,
      status: mapRentalCycleStatus(contract.status),
      expectedMoveInAt: contract.startDate,
      actualMoveInAt,
      actualEndAt: ['EXPIRED', 'TERMINATED', 'CANCELLED'].includes(contract.status) ? actualEndAt || contract.endDate : actualEndAt,
      closedReason: contract.terminationReason || (['EXPIRED', 'TERMINATED', 'CANCELLED'].includes(contract.status) ? `Backfill từ hợp đồng ${contract.status}` : null),
      depositIds: (contract.deposits || []).map((item) => item.id),
      occupancyIds: occupancies.map((item) => item.id),
      invoiceIds,
      paymentIds,
      settlementId: contract.settlement?.id || null,
    });
  }
  const candidatesByExactBinding = new Map();
  for (const candidate of candidates) {
    const key = `${candidate.tenantId}:${candidate.customerId}:${candidate.roomId}`;
    const rows = candidatesByExactBinding.get(key) || [];
    rows.push(candidate);
    candidatesByExactBinding.set(key, rows);
  }
  const unresolvedDeposits = [];
  for (const deposit of orphanDeposits) {
    const key = `${deposit.tenantId}:${deposit.customerId}:${deposit.roomId}`;
    const matchingCandidates = candidatesByExactBinding.get(key) || [];
    if (matchingCandidates.length === 1) {
      matchingCandidates[0].depositIds = [...new Set([...matchingCandidates[0].depositIds, deposit.id])];
    } else {
      unresolvedDeposits.push({
        ...deposit,
        reviewReason: matchingCandidates.length > 1
          ? 'MULTIPLE_MATCHING_CONTRACTS_REQUIRE_REVIEW'
          : 'NO_MATCHING_CONTRACT_REQUIRES_REVIEW',
      });
    }
  }
  return {
    candidates,
    skipped,
    reviewQueue: {
      orphanDeposits: unresolvedDeposits.map((item) => ({
        id: item.id, tenantId: item.tenantId, customerId: item.customerId, roomId: item.roomId, type: item.type, status: item.status,
        reason: item.reviewReason,
      })),
      orphanInvoices: orphanInvoices.map((item) => ({
        id: item.id, tenantId: item.tenantId, customerId: item.customerId, status: item.status,
        reason: 'NO_CONTRACT_ID_REQUIRES_REVIEW',
      })),
    },
  };
}

async function loadBackfillData(prisma, tenantId = '') {
  const tenantWhere = tenantId ? { tenantId } : {};
  const [contracts, customers, orphanDeposits, orphanInvoices] = await Promise.all([
    prisma.contract.findMany({
      where: { ...tenantWhere, deletedAt: null, rentalCycleId: null },
      select: {
        id: true, tenantId: true, roomId: true, customerId: true, status: true,
        startDate: true, endDate: true, monthlyRent: true, depositMoney: true,
        actualMoveOutAt: true, terminationReason: true,
        deposits: { where: { deletedAt: null }, select: { id: true, tenantId: true, customerId: true } },
        occupancies: { select: { id: true, joinedAt: true, leftAt: true } },
        invoices: {
          where: { deletedAt: null },
          select: {
            id: true, tenantId: true, customerId: true,
            payments: { where: { deletedAt: null }, select: { id: true } },
          },
        },
        settlement: { select: { id: true } },
      },
      orderBy: [{ tenantId: 'asc' }, { startDate: 'asc' }, { id: 'asc' }],
    }),
    prisma.customer.findMany({
      where: { ...tenantWhere, deletedAt: null },
      select: { id: true, tenantId: true, phone: true, identityNo: true, createdAt: true },
    }),
    prisma.deposit.findMany({
      where: { ...tenantWhere, deletedAt: null, rentalCycleId: null, contractId: null, status: { in: ['PAID', 'CONVERTED_TO_CONTRACT'] } },
      select: { id: true, tenantId: true, customerId: true, roomId: true, type: true, status: true },
    }),
    prisma.invoice.findMany({
      where: { ...tenantWhere, deletedAt: null, rentalCycleId: null, contractId: null, status: { not: 'CANCELLED' } },
      select: { id: true, tenantId: true, customerId: true, status: true },
    }),
  ]);
  return { contracts, customers, orphanDeposits, orphanInvoices };
}

async function applyCandidate(tx, candidate) {
  await tx.rentalCycle.create({
    data: {
      id: candidate.cycleId,
      tenantId: candidate.tenantId,
      customerId: candidate.customerId,
      roomId: candidate.roomId,
      status: candidate.status,
      expectedMoveInAt: candidate.expectedMoveInAt,
      actualMoveInAt: candidate.actualMoveInAt,
      actualEndAt: candidate.actualEndAt,
      closedReason: candidate.closedReason,
    },
  });
  const contractUpdate = await tx.contract.updateMany({
    where: { id: candidate.contractId, tenantId: candidate.tenantId, rentalCycleId: null },
    data: { rentalCycleId: candidate.cycleId },
  });
  if (contractUpdate.count !== 1) throw new Error(`Contract changed during RentalCycle backfill: ${candidate.contractId}`);
  const linked = {};
  for (const [name, model, ids] of [
    ['deposits', tx.deposit, candidate.depositIds],
    ['occupancies', tx.occupancy, candidate.occupancyIds],
    ['invoices', tx.invoice, candidate.invoiceIds],
    ['payments', tx.payment, candidate.paymentIds],
  ]) {
    if (!ids.length) {
      linked[name] = 0;
      continue;
    }
    const result = await model.updateMany({
      where: { tenantId: candidate.tenantId, id: { in: ids }, rentalCycleId: null },
      data: { rentalCycleId: candidate.cycleId },
    });
    if (result.count !== ids.length) throw new Error(`${name} changed during RentalCycle backfill for contract ${candidate.contractId}`);
    linked[name] = result.count;
  }
  if (candidate.settlementId) {
    const result = await tx.contractSettlement.updateMany({
      where: { id: candidate.settlementId, tenantId: candidate.tenantId, rentalCycleId: null },
      data: { rentalCycleId: candidate.cycleId },
    });
    if (result.count !== 1) throw new Error(`Settlement changed during RentalCycle backfill: ${candidate.settlementId}`);
    linked.settlements = 1;
  } else linked.settlements = 0;
  await tx.auditLog.create({
    data: {
      tenantId: candidate.tenantId,
      action: 'CREATE',
      module: 'RentalCycleBackfill',
      entity: 'RentalCycle',
      entityId: candidate.cycleId,
      before: { contractId: candidate.contractId, rentalCycleId: null },
      after: { contractId: candidate.contractId, status: candidate.status, linked },
    },
  });
  return { cycleId: candidate.cycleId, contractId: candidate.contractId, linked };
}

async function runBackfill(options, deps = {}) {
  loadEnvFile(options.envFile);
  const prisma = deps.prisma || new PrismaClient();
  const disconnect = deps.prisma ? async () => undefined : async () => prisma.$disconnect();
  try {
    const data = await loadBackfillData(prisma, options.tenantId);
    const plan = buildBackfillPlan(data);
    const result = {
      mode: options.apply ? 'APPLY' : 'DRY_RUN',
      readOnly: !options.apply,
      candidateCount: plan.candidates.length,
      skippedCount: plan.skipped.length,
      orphanDepositCount: plan.reviewQueue.orphanDeposits.length,
      orphanInvoiceCount: plan.reviewQueue.orphanInvoices.length,
      candidates: plan.candidates,
      skipped: plan.skipped,
      reviewQueue: plan.reviewQueue,
    };
    if (options.apply) {
      result.applied = await prisma.$transaction(async (tx) => {
        const applied = [];
        for (const candidate of plan.candidates) applied.push(await applyCandidate(tx, candidate));
        return applied;
      });
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await disconnect();
  }
}

if (require.main === module) {
  runBackfill(parseArguments(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`RentalCycle backfill failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIRMATION,
  applyCandidate,
  buildBackfillPlan,
  contractSignature,
  deterministicCycleId,
  loadBackfillData,
  mapRentalCycleStatus,
  parseArguments,
  runBackfill,
};
