#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { loadDuplicateReview } = require('./customer-duplicate-review');

const CONFIRMATION = 'MERGE_REVIEWED_CUSTOMERS';
const PROFILE_FIELDS = [
  'email', 'identityNo', 'gender', 'birthDate', 'nationality', 'address', 'zaloPhone',
  'zaloChatId', 'zaloUserId', 'emergencyPhone', 'relationship',
];

function parseArguments(argv) {
  const options = { envFile: null, tenantId: '', decisionFile: '', apply: false, confirm: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env-file') options.envFile = argv[++index] || null;
    else if (argument === '--tenant-id') options.tenantId = argv[++index] || '';
    else if (argument === '--decision-file') options.decisionFile = argv[++index] || '';
    else if (argument === '--confirm') options.confirm = argv[++index] || '';
    else if (argument === '--apply') options.apply = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.decisionFile) throw new Error('--decision-file is required');
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

function readDecisionFile(decisionFile) {
  const resolved = path.resolve(decisionFile);
  if (!fs.existsSync(resolved)) throw new Error(`Decision file not found: ${resolved}`);
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (parsed.version !== 1 || !Array.isArray(parsed.decisions)) {
    throw new Error('Decision file must contain version 1 and a decisions array');
  }
  return parsed;
}

function sameMembers(left, right) {
  return [...left].sort().join('|') === [...right].sort().join('|');
}

function validateMergeDecisions(review, decisionDocument, tenantId = '') {
  const components = new Map(review.components.map((item) => [item.componentId, item]));
  const seen = new Set();
  const plans = [];
  const errors = [];
  for (const decision of decisionDocument.decisions) {
    const component = components.get(decision.componentId);
    if (!component) {
      errors.push(`${decision.componentId || '<missing>'}: component is not present in the current review`);
      continue;
    }
    if (seen.has(component.componentId)) errors.push(`${component.componentId}: duplicated decision`);
    seen.add(component.componentId);
    if (tenantId && component.tenantId !== tenantId) errors.push(`${component.componentId}: outside requested tenant`);
    if (decision.tenantId !== component.tenantId) errors.push(`${component.componentId}: tenantId changed since review`);
    if (decision.action !== 'MERGE') errors.push(`${component.componentId}: action must be MERGE`);
    if (!component.customerIds.includes(decision.primaryCustomerId)) errors.push(`${component.componentId}: primaryCustomerId is not in component`);
    const expectedDuplicates = component.customerIds.filter((id) => id !== decision.primaryCustomerId);
    if (!Array.isArray(decision.duplicateCustomerIds) || !sameMembers(decision.duplicateCustomerIds, expectedDuplicates)) {
      errors.push(`${component.componentId}: duplicateCustomerIds must contain every non-primary member exactly once`);
    }
    if (!String(decision.approvedBy || '').trim()) errors.push(`${component.componentId}: approvedBy is required`);
    if (!Array.isArray(decision.evidence) || decision.evidence.length === 0) errors.push(`${component.componentId}: at least one evidence item is required`);
    const acknowledged = new Set(decision.acknowledgedConflictCodes || []);
    for (const code of component.conflictCodes) {
      if (!acknowledged.has(code)) errors.push(`${component.componentId}: conflict ${code} has not been acknowledged`);
    }
    if (component.blocked) errors.push(`${component.componentId}: blocking occupancy/contract conflict must be repaired before merge`);
    plans.push({ component, decision });
  }
  if (errors.length) throw new Error(`Merge decision validation failed:\n- ${errors.join('\n- ')}`);
  return plans;
}

function buildPrimaryProfile(primary, duplicates) {
  const patch = {};
  for (const field of PROFILE_FIELDS) {
    if (primary[field] !== null && primary[field] !== undefined && primary[field] !== '') continue;
    const candidate = duplicates.find((item) => item[field] !== null && item[field] !== undefined && item[field] !== '');
    if (candidate) patch[field] = candidate[field];
  }
  patch.idImages = [...new Set([...(primary.idImages || []), ...duplicates.flatMap((item) => item.idImages || [])])];
  return patch;
}

async function applyMergePlan(tx, plan) {
  const { component, decision } = plan;
  const ids = component.customerIds;
  const rows = await tx.customer.findMany({ where: { tenantId: component.tenantId, id: { in: ids }, deletedAt: null } });
  if (rows.length !== ids.length) throw new Error(`${component.componentId}: customer set changed before apply`);
  const primary = rows.find((item) => item.id === decision.primaryCustomerId);
  const duplicates = rows.filter((item) => decision.duplicateCustomerIds.includes(item.id));
  if (!primary || duplicates.length !== decision.duplicateCustomerIds.length) throw new Error(`${component.componentId}: invalid live customer set`);

  const liveOccupancies = await tx.occupancy.findMany({
    where: { tenantId: component.tenantId, customerId: { in: ids }, leftAt: null },
    select: { id: true, roomId: true },
  });
  if (new Set(liveOccupancies.map((item) => item.roomId)).size > 1) {
    throw new Error(`${component.componentId}: open occupancies now point to different rooms`);
  }
  const activeContracts = await tx.contract.findMany({
    where: { tenantId: component.tenantId, customerId: { in: ids }, deletedAt: null, status: { in: ['ACTIVE', 'EXPIRING'] } },
    select: { id: true, roomId: true },
  });
  if (new Set(activeContracts.map((item) => item.roomId)).size > 1) {
    throw new Error(`${component.componentId}: active contracts now point to different rooms`);
  }

  const duplicateIds = duplicates.map((item) => item.id);
  const profilePatch = buildPrimaryProfile(primary, duplicates);
  await tx.customer.update({
    where: { id: primary.id, tenantId: component.tenantId },
    data: { ...profilePatch, roomId: liveOccupancies[0]?.roomId || null },
  });

  const moved = {};
  for (const [name, model] of [
    ['contracts', tx.contract], ['deposits', tx.deposit], ['invoices', tx.invoice],
    ['occupancies', tx.occupancy], ['rentalCycles', tx.rentalCycle], ['creditNotes', tx.creditNote],
  ]) {
    const result = await model.updateMany({
      where: { tenantId: component.tenantId, customerId: { in: duplicateIds } },
      data: { customerId: primary.id },
    });
    moved[name] = result.count;
  }

  const parties = await tx.contractParty.findMany({
    where: { tenantId: component.tenantId, customerId: { in: duplicateIds } },
    select: { id: true, contractId: true, role: true },
  });
  moved.contractParties = 0;
  moved.contractPartySnapshotsDetached = 0;
  for (const party of parties) {
    const collision = await tx.contractParty.findFirst({
      where: { contractId: party.contractId, customerId: primary.id, role: party.role },
      select: { id: true },
    });
    await tx.contractParty.update({
      where: { id: party.id },
      data: { customerId: collision ? null : primary.id },
    });
    if (collision) moved.contractPartySnapshotsDetached += 1;
    else moved.contractParties += 1;
  }

  const coRepresentativeContracts = await tx.contract.findMany({
    where: { tenantId: component.tenantId, coRepresentativeIds: { hasSome: duplicateIds } },
    select: { id: true, customerId: true, coRepresentativeIds: true },
  });
  for (const contract of coRepresentativeContracts) {
    const replaced = contract.coRepresentativeIds.map((id) => duplicateIds.includes(id) ? primary.id : id);
    const coRepresentativeIds = [...new Set(replaced)].filter((id) => id !== contract.customerId);
    await tx.contract.update({ where: { id: contract.id, tenantId: component.tenantId }, data: { coRepresentativeIds } });
  }
  moved.coRepresentativeContracts = coRepresentativeContracts.length;

  const mergedAt = new Date();
  for (const duplicate of duplicates) {
    await tx.customer.update({
      where: { id: duplicate.id, tenantId: component.tenantId },
      data: {
        roomId: null,
        deletedAt: mergedAt,
        deletedBy: decision.approvedBy,
        deleteReason: `MERGED_INTO:${primary.id}`,
      },
    });
  }
  await tx.auditLog.create({
    data: {
      tenantId: component.tenantId,
      userId: decision.approvedBy,
      action: 'UPDATE',
      module: 'CustomerDuplicateMerge',
      entity: 'Customer',
      entityId: primary.id,
      before: { componentId: component.componentId, customerIds: ids },
      after: {
        primaryCustomerId: primary.id,
        mergedCustomerIds: duplicateIds,
        evidence: decision.evidence,
        acknowledgedConflictCodes: decision.acknowledgedConflictCodes || [],
        moved,
      },
    },
  });
  return { componentId: component.componentId, tenantId: component.tenantId, primaryCustomerId: primary.id, mergedCustomerIds: duplicateIds, moved };
}

async function runMerge(options, deps = {}) {
  loadEnvFile(options.envFile);
  const prisma = deps.prisma || new PrismaClient();
  const disconnect = deps.prisma ? async () => undefined : async () => prisma.$disconnect();
  try {
    const decisions = readDecisionFile(options.decisionFile);
    const review = await loadDuplicateReview(prisma, options.tenantId);
    const plans = validateMergeDecisions(review, decisions, options.tenantId);
    const result = {
      mode: options.apply ? 'APPLY' : 'DRY_RUN',
      readOnly: !options.apply,
      reviewedComponentCount: plans.length,
      components: plans.map(({ component, decision }) => ({
        componentId: component.componentId,
        tenantId: component.tenantId,
        primaryCustomerId: decision.primaryCustomerId,
        duplicateCustomerIds: decision.duplicateCustomerIds,
        conflictsAcknowledged: component.conflictCodes,
      })),
    };
    if (options.apply) {
      result.applied = await prisma.$transaction(async (tx) => {
        const applied = [];
        for (const plan of plans) applied.push(await applyMergePlan(tx, plan));
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
  let options;
  try {
    options = parseArguments(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`Customer merge failed: ${error.message}\n`);
    process.exitCode = 1;
  }
  if (options) runMerge(options).catch((error) => {
    process.stderr.write(`Customer merge failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIRMATION,
  PROFILE_FIELDS,
  applyMergePlan,
  buildPrimaryProfile,
  parseArguments,
  readDecisionFile,
  runMerge,
  validateMergeDecisions,
};
