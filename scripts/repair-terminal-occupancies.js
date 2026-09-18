#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const TERMINAL = ['TERMINATED', 'EXPIRED', 'CANCELLED'];
const ACTIVE = ['ACTIVE', 'EXPIRING'];
const CONFIRMATION = 'CLOSE_TERMINAL_OCCUPANCIES';

function parseArguments(argv) {
  const options = { envFile: null, tenantId: '', apply: false, confirm: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env-file') {
      options.envFile = argv[++index] || null;
    } else if (argument === '--tenant-id') {
      options.tenantId = argv[++index] || '';
    } else if (argument === '--confirm') {
      options.confirm = argv[++index] || '';
    } else if (argument === '--apply') {
      options.apply = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
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

function buildRepairPlan(occupancies) {
  const candidates = [];
  const skipped = [];
  for (const occupancy of occupancies) {
    if (!occupancy.contract || !TERMINAL.includes(occupancy.contract.status)) continue;
    if (
      occupancy.tenantId !== occupancy.contract.tenantId ||
      occupancy.roomId !== occupancy.contract.roomId ||
      occupancy.customerId !== occupancy.contract.customerId &&
        !(occupancy.contract.coRepresentativeIds || []).includes(occupancy.customerId)
    ) {
      skipped.push({
        occupancyId: occupancy.id,
        tenantId: occupancy.tenantId,
        reason: 'BINDING_MISMATCH_REQUIRES_REVIEW',
      });
      continue;
    }
    const leftAt = occupancy.contract.actualMoveOutAt || occupancy.contract.endDate || occupancy.contract.updatedAt;
    candidates.push({
      occupancyId: occupancy.id,
      tenantId: occupancy.tenantId,
      roomId: occupancy.roomId,
      customerId: occupancy.customerId,
      contractId: occupancy.contractId,
      leftAt,
      leaveReason: `Backfill: hợp đồng ${occupancy.contract.status.toLowerCase()}`,
    });
  }
  return { candidates, skipped };
}

async function runRepair(options, deps = {}) {
  loadEnvFile(options.envFile);
  const prisma = deps.prisma || new PrismaClient();
  const disconnect = deps.prisma ? async () => undefined : async () => prisma.$disconnect();
  const tenantWhere = options.tenantId ? { tenantId: options.tenantId } : {};
  try {
    const occupancies = await prisma.occupancy.findMany({
      where: {
        ...tenantWhere,
        leftAt: null,
        contract: { is: { status: { in: TERMINAL } } },
      },
      select: {
        id: true, tenantId: true, roomId: true, customerId: true, contractId: true,
        contract: {
          select: {
            id: true, tenantId: true, roomId: true, customerId: true, coRepresentativeIds: true,
            status: true, actualMoveOutAt: true, endDate: true, updatedAt: true,
          },
        },
      },
      orderBy: [{ tenantId: 'asc' }, { roomId: 'asc' }, { customerId: 'asc' }, { createdAt: 'asc' }],
    });
    const plan = buildRepairPlan(occupancies);
    const result = {
      mode: options.apply ? 'APPLY' : 'DRY_RUN',
      readOnly: !options.apply,
      candidateCount: plan.candidates.length,
      skippedCount: plan.skipped.length,
      candidates: plan.candidates,
      skipped: plan.skipped,
    };
    if (!options.apply) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return result;
    }

    await prisma.$transaction(async (tx) => {
      for (const candidate of plan.candidates) {
        const updated = await tx.occupancy.updateMany({
          where: {
            id: candidate.occupancyId,
            tenantId: candidate.tenantId,
            leftAt: null,
            contract: { is: { id: candidate.contractId, status: { in: TERMINAL } } },
          },
          data: { leftAt: candidate.leftAt, leaveReason: candidate.leaveReason },
        });
        if (updated.count !== 1) throw new Error(`Occupancy changed during repair: ${candidate.occupancyId}`);
        await tx.auditLog.create({
          data: {
            tenantId: candidate.tenantId,
            action: 'UPDATE',
            module: 'CoreLifecycleRepair',
            entity: 'Occupancy',
            entityId: candidate.occupancyId,
            before: { leftAt: null, contractId: candidate.contractId },
            after: { leftAt: candidate.leftAt, leaveReason: candidate.leaveReason },
          },
        });
      }

      const customerKeys = new Map(plan.candidates.map((item) => [`${item.tenantId}:${item.customerId}`, item]));
      for (const item of customerKeys.values()) {
        const remaining = await tx.occupancy.findMany({
          where: { tenantId: item.tenantId, customerId: item.customerId, leftAt: null },
          select: { roomId: true, contract: { select: { status: true } } },
        });
        const active = remaining.filter((row) => !row.contract || ACTIVE.includes(row.contract.status));
        if (active.length > 1) throw new Error(`Customer still has multiple active occupancies: ${item.customerId}`);
        await tx.customer.update({
          where: { id: item.customerId, tenantId: item.tenantId },
          data: { roomId: active[0]?.roomId || null },
        });
      }

      const roomKeys = new Map(plan.candidates.map((item) => [`${item.tenantId}:${item.roomId}`, item]));
      for (const item of roomKeys.values()) {
        const [room, openOccupancies, activeContracts] = await Promise.all([
          tx.room.findUniqueOrThrow({ where: { id: item.roomId, tenantId: item.tenantId } }),
          tx.occupancy.count({ where: { tenantId: item.tenantId, roomId: item.roomId, leftAt: null } }),
          tx.contract.count({ where: { tenantId: item.tenantId, roomId: item.roomId, deletedAt: null, status: { in: ACTIVE } } }),
        ]);
        const protectedStatus = ['MAINTENANCE', 'CLEANING', 'INACTIVE'].includes(room.status);
        const status = openOccupancies > 0 || activeContracts > 0
          ? 'OCCUPIED'
          : protectedStatus ? room.status : 'AVAILABLE';
        await tx.room.update({ where: { id: item.roomId, tenantId: item.tenantId }, data: { status } });
      }
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  } finally {
    await disconnect();
  }
}

if (require.main === module) {
  runRepair(parseArguments(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`Terminal occupancy repair failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  });
}

module.exports = { CONFIRMATION, buildRepairPlan, parseArguments, runRepair };
