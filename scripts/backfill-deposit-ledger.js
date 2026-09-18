#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');

const CONFIRMATION = 'BACKFILL_REVIEWED_DEPOSIT_OPENING_BALANCES';

function parseArguments(argv) {
  const options = { envFile: null, tenantId: '', reviewFile: null, apply: false, confirm: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env-file') options.envFile = argv[++index] || null;
    else if (argument === '--tenant-id') options.tenantId = argv[++index] || '';
    else if (argument === '--review-file') options.reviewFile = argv[++index] || null;
    else if (argument === '--confirm') options.confirm = argv[++index] || '';
    else if (argument === '--apply') options.apply = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.apply && options.confirm !== CONFIRMATION) {
    throw new Error(`--apply requires --confirm ${CONFIRMATION}`);
  }
  if (options.apply && !options.reviewFile) throw new Error('--apply requires --review-file');
  return options;
}

function loadEnvFile(envFile) {
  if (!envFile) return;
  const resolved = path.resolve(envFile);
  if (!fs.existsSync(resolved)) throw new Error(`Environment file not found: ${resolved}`);
  require('dotenv').config({ path: resolved });
}

function deterministicId(prefix, depositId) {
  return `${prefix}_${crypto.createHash('sha256').update(depositId).digest('hex').slice(0, 24)}`;
}

function buildReviewQueue(deposits) {
  const reviewQueue = [];
  const alreadyBackfilled = [];
  for (const deposit of deposits || []) {
    const reviewBase = {
      depositId: deposit.id,
      tenantId: deposit.tenantId,
      rentalCycleId: deposit.rentalCycleId,
      contractId: deposit.contractId,
      customerId: deposit.customerId,
      roomId: deposit.roomId,
      code: deposit.code,
      type: deposit.type,
      status: deposit.status,
      originalAmount: Number(deposit.amount || 0),
    };
    if ((deposit.ledgerEntries || []).length > 0) {
      alreadyBackfilled.push({
        ...reviewBase,
        ledgerEntryCount: deposit.ledgerEntries.length,
        reason: 'LEDGER_ALREADY_EXISTS',
      });
      continue;
    }
    reviewQueue.push({
      ...reviewBase,
      decision: 'REVIEW_REQUIRED',
      approvedBalance: null,
      evidenceRef: null,
      reason: deposit.rentalCycleId
        ? 'BALANCE_AND_EVIDENCE_MUST_BE_REVIEWED'
        : 'RENTAL_CYCLE_REQUIRED_BEFORE_LEDGER_BACKFILL',
    });
  }
  return { reviewQueue, alreadyBackfilled };
}

function parseReviewDecisions(content, candidates) {
  const parsed = typeof content === 'string' ? JSON.parse(content) : content;
  const rows = Array.isArray(parsed) ? parsed : parsed?.decisions;
  if (!Array.isArray(rows)) throw new Error('Review file must be an array or contain a decisions array');
  const candidateById = new Map(candidates.map((candidate) => [candidate.depositId, candidate]));
  const seen = new Set();
  const approved = [];
  for (const row of rows) {
    if (!row || row.decision !== 'APPROVE') continue;
    if (!row.depositId || seen.has(row.depositId)) throw new Error(`Duplicate or missing depositId: ${row?.depositId || ''}`);
    seen.add(row.depositId);
    const candidate = candidateById.get(row.depositId);
    if (!candidate) throw new Error(`Deposit is not in the current review queue: ${row.depositId}`);
    if (row.tenantId !== candidate.tenantId) throw new Error(`Tenant mismatch for deposit ${row.depositId}`);
    if (!candidate.rentalCycleId) throw new Error(`RentalCycle is required for deposit ${row.depositId}`);
    const approvedBalance = Number(row.approvedBalance);
    if (!Number.isFinite(approvedBalance) || approvedBalance <= 0) {
      throw new Error(`approvedBalance must be greater than zero for deposit ${row.depositId}`);
    }
    if (approvedBalance > candidate.originalAmount) {
      throw new Error(`approvedBalance exceeds original amount for deposit ${row.depositId}`);
    }
    const evidenceRef = String(row.evidenceRef || '').trim();
    if (evidenceRef.length < 3) throw new Error(`evidenceRef is required for deposit ${row.depositId}`);
    approved.push({ ...candidate, approvedBalance, evidenceRef });
  }
  return approved;
}

async function loadDeposits(prisma, tenantId = '') {
  return prisma.deposit.findMany({
    where: { ...(tenantId ? { tenantId } : {}), deletedAt: null },
    select: {
      id: true,
      tenantId: true,
      rentalCycleId: true,
      contractId: true,
      customerId: true,
      roomId: true,
      code: true,
      type: true,
      status: true,
      amount: true,
      ledgerEntries: { select: { id: true } },
    },
    orderBy: [{ tenantId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
}

async function applyReviewedOpeningBalance(tx, decision) {
  const operationId = deterministicId('dop_open', decision.depositId);
  const ledgerEntryId = deterministicId('dle_open', decision.depositId);
  const idempotencyKey = `reviewed-opening:${decision.depositId}`;
  const current = await tx.deposit.findFirst({
    where: {
      id: decision.depositId,
      tenantId: decision.tenantId,
      rentalCycleId: decision.rentalCycleId,
      deletedAt: null,
    },
    include: { ledgerEntries: true },
  });
  if (!current) throw new Error(`Deposit changed or disappeared: ${decision.depositId}`);
  if (Number(current.amount) < decision.approvedBalance) {
    throw new Error(`Approved balance now exceeds original amount: ${decision.depositId}`);
  }
  if (current.ledgerEntries.length > 0) {
    const existing = current.ledgerEntries.find((entry) => entry.id === ledgerEntryId);
    if (existing && Number(existing.balanceEffect) === decision.approvedBalance) {
      return { depositId: decision.depositId, operationId, ledgerEntryId, replayed: true };
    }
    throw new Error(`Ledger appeared during review; manual reconciliation required: ${decision.depositId}`);
  }
  const completedAt = new Date();
  const requestHash = crypto.createHash('sha256').update(JSON.stringify({
    depositId: decision.depositId,
    approvedBalance: decision.approvedBalance,
    evidenceRef: decision.evidenceRef,
  })).digest('hex');
  await tx.depositOperation.create({
    data: {
      id: operationId,
      tenantId: decision.tenantId,
      rentalCycleId: decision.rentalCycleId,
      sourceDepositId: decision.depositId,
      contractId: decision.contractId,
      type: 'COLLECT',
      status: 'COMPLETED',
      idempotencyKey,
      requestHash,
      result: {
        backfill: true,
        approvedBalance: decision.approvedBalance,
        evidenceRef: decision.evidenceRef,
      },
      completedAt,
    },
  });
  await tx.depositLedgerEntry.create({
    data: {
      id: ledgerEntryId,
      tenantId: decision.tenantId,
      rentalCycleId: decision.rentalCycleId,
      depositId: decision.depositId,
      contractId: decision.contractId,
      operationId,
      type: 'CASH_IN',
      amount: new Prisma.Decimal(decision.approvedBalance),
      balanceEffect: new Prisma.Decimal(decision.approvedBalance),
      idempotencyKey: `${idempotencyKey}:cash-in`,
      sourceType: 'REVIEWED_OPENING_BALANCE',
      sourceId: decision.evidenceRef,
      metadata: { evidenceRef: decision.evidenceRef, reviewed: true },
    },
  });
  await tx.auditLog.create({
    data: {
      tenantId: decision.tenantId,
      module: 'DepositLedgerBackfill',
      entity: 'Deposit',
      entityId: decision.depositId,
      action: 'CREATE',
      before: { ledgerBalance: null },
      after: {
        ledgerBalance: decision.approvedBalance,
        operationId,
        ledgerEntryId,
        evidenceRef: decision.evidenceRef,
      },
    },
  });
  return { depositId: decision.depositId, operationId, ledgerEntryId, replayed: false };
}

async function runBackfill(options, deps = {}) {
  loadEnvFile(options.envFile);
  const prisma = deps.prisma || new PrismaClient();
  const disconnect = deps.prisma ? async () => undefined : async () => prisma.$disconnect();
  try {
    const deposits = await loadDeposits(prisma, options.tenantId);
    const plan = buildReviewQueue(deposits);
    let approved = [];
    if (options.reviewFile) {
      const reviewContent = fs.readFileSync(path.resolve(options.reviewFile), 'utf8');
      approved = parseReviewDecisions(reviewContent, [...plan.reviewQueue, ...plan.alreadyBackfilled]);
    }
    const result = {
      mode: options.apply ? 'APPLY' : 'DRY_RUN',
      readOnly: !options.apply,
      reviewRequiredCount: plan.reviewQueue.length,
      alreadyBackfilledCount: plan.alreadyBackfilled.length,
      approvedCount: approved.length,
      reviewQueue: plan.reviewQueue,
      alreadyBackfilled: plan.alreadyBackfilled,
    };
    if (options.apply) {
      result.applied = await prisma.$transaction(async (tx) => {
        const rows = [];
        for (const decision of approved) rows.push(await applyReviewedOpeningBalance(tx, decision));
        return rows;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await disconnect();
  }
}

if (require.main === module) {
  runBackfill(parseArguments(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`Deposit ledger backfill failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIRMATION,
  applyReviewedOpeningBalance,
  buildReviewQueue,
  deterministicId,
  parseArguments,
  parseReviewDecisions,
  runBackfill,
};
