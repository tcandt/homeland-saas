#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const ACTIVE_CONTRACT_STATUSES = new Set(['ACTIVE', 'EXPIRING']);
const TERMINAL_CONTRACT_STATUSES = new Set(['EXPIRED', 'TERMINATED', 'CANCELLED']);
const FINANCIAL_DEPOSIT_STATUSES = new Set(['PAID', 'CONVERTED_TO_CONTRACT']);

function parseArguments(argv) {
  const options = { envFile: null, tenantId: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env-file') {
      options.envFile = argv[index + 1] || null;
      index += 1;
    } else if (argument === '--tenant-id') {
      options.tenantId = argv[index + 1] || '';
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
  if (!fs.existsSync(resolved)) throw new Error(`Environment file not found: ${resolved}`);
  require('dotenv').config({ path: resolved });
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeIdentity(value) {
  return String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function money(value) {
  const result = Number(value || 0);
  return Number.isFinite(result) ? Math.round(result * 100) / 100 : 0;
}

function analyzeLifecycleData(data) {
  const findings = [];
  const add = (code, severity, entityType, entityId, tenantId, detail) => {
    findings.push({ code, severity, tenantId, entityType, entityId, detail });
  };

  for (const room of data.rooms || []) {
    const activeContracts = (room.contracts || []).filter((item) => ACTIVE_CONTRACT_STATUSES.has(item.status));
    const openOccupancies = room.occupancies || [];
    const cachedCustomers = room.roommates || [];
    const bindingCount = activeContracts.length + openOccupancies.length + cachedCustomers.length;
    if (room.status === 'AVAILABLE' && bindingCount > 0) {
      add('ROOM_AVAILABLE_WITH_ACTIVE_BINDINGS', 'HIGH', 'Room', room.id, room.tenantId, {
        activeContractIds: activeContracts.map((item) => item.id),
        openOccupancyIds: openOccupancies.map((item) => item.id),
        cachedCustomerIds: cachedCustomers.map((item) => item.id),
      });
    }
    if (room.status === 'OCCUPIED' && bindingCount === 0) {
      add('ROOM_OCCUPIED_WITHOUT_ACTIVE_BINDINGS', 'HIGH', 'Room', room.id, room.tenantId, {});
    }
    if (room.rentalType === 'SHARED' && openOccupancies.length > Number(room.capacity || 0)) {
      add('SHARED_ROOM_CAPACITY_EXCEEDED', 'CRITICAL', 'Room', room.id, room.tenantId, {
        capacity: Number(room.capacity || 0),
        openOccupancyCount: openOccupancies.length,
      });
    }
  }

  const openOccupancyByCustomer = new Map();
  for (const occupancy of data.occupancies || []) {
    if (occupancy.contract && TERMINAL_CONTRACT_STATUSES.has(occupancy.contract.status)) {
      add('OPEN_OCCUPANCY_WITH_TERMINAL_CONTRACT', 'CRITICAL', 'Occupancy', occupancy.id, occupancy.tenantId, {
        contractId: occupancy.contract.id,
        contractStatus: occupancy.contract.status,
      });
    }
    if (occupancy.customer && occupancy.customer.roomId !== occupancy.roomId) {
      add('CUSTOMER_ROOM_CACHE_MISMATCH', 'MEDIUM', 'Occupancy', occupancy.id, occupancy.tenantId, {
        customerId: occupancy.customerId,
        occupancyRoomId: occupancy.roomId,
        cachedRoomId: occupancy.customer.roomId || null,
      });
    }
    const key = `${occupancy.tenantId}:${occupancy.customerId}`;
    const ids = openOccupancyByCustomer.get(key) || [];
    ids.push(occupancy.id);
    openOccupancyByCustomer.set(key, ids);
  }
  for (const [key, ids] of openOccupancyByCustomer) {
    if (ids.length > 1) {
      const [tenantId, customerId] = key.split(':');
      add('CUSTOMER_MULTIPLE_OPEN_OCCUPANCIES', 'CRITICAL', 'Customer', customerId, tenantId, { occupancyIds: ids });
    }
  }

  for (const field of [
    { name: 'PHONE', normalize: normalizePhone, read: (item) => item.phone },
    { name: 'IDENTITY', normalize: normalizeIdentity, read: (item) => item.identityNo },
  ]) {
    const groups = new Map();
    for (const customer of data.customers || []) {
      const normalized = field.normalize(field.read(customer));
      if (!normalized) continue;
      const key = `${customer.tenantId}:${normalized}`;
      const ids = groups.get(key) || [];
      ids.push(customer.id);
      groups.set(key, ids);
    }
    for (const [key, ids] of groups) {
      if (ids.length > 1) {
        const tenantId = key.slice(0, key.indexOf(':'));
        add(`DUPLICATE_CUSTOMER_${field.name}`, 'HIGH', 'Customer', ids[0], tenantId, { customerIds: ids });
      }
    }
  }

  const contractsByRoom = new Map();
  for (const contract of data.contracts || []) {
    if (!contract.rentalCycleId) {
      add('CONTRACT_WITHOUT_RENTAL_CYCLE', 'HIGH', 'Contract', contract.id, contract.tenantId, {});
    } else if (
      !contract.rentalCycle ||
      contract.rentalCycle.tenantId !== contract.tenantId ||
      contract.rentalCycle.customerId !== contract.customerId ||
      contract.rentalCycle.roomId !== contract.roomId
    ) {
      add('CONTRACT_RENTAL_CYCLE_BINDING_MISMATCH', 'CRITICAL', 'Contract', contract.id, contract.tenantId, {
        rentalCycleId: contract.rentalCycleId,
      });
    }
    if (TERMINAL_CONTRACT_STATUSES.has(contract.status)) continue;
    const key = `${contract.tenantId}:${contract.roomId}`;
    const rows = contractsByRoom.get(key) || [];
    rows.push(contract);
    contractsByRoom.set(key, rows);
  }
  for (const contracts of contractsByRoom.values()) {
    contracts.sort((left, right) => new Date(left.startDate) - new Date(right.startDate));
    for (let leftIndex = 0; leftIndex < contracts.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < contracts.length; rightIndex += 1) {
        const left = contracts[leftIndex];
        const right = contracts[rightIndex];
        if (new Date(right.startDate) > new Date(left.endDate)) break;
        add('OVERLAPPING_ROOM_CONTRACTS', 'HIGH', 'Contract', left.id, left.tenantId, {
          contractIds: [left.id, right.id],
          roomId: left.roomId,
        });
      }
    }
  }

  const depositsByContract = new Map();
  for (const deposit of data.deposits || []) {
    if (!deposit.contractId || !deposit.contract) continue;
    if (
      deposit.tenantId !== deposit.contract.tenantId ||
      deposit.roomId !== deposit.contract.roomId ||
      deposit.customerId !== deposit.contract.customerId
    ) {
      add('DEPOSIT_CONTRACT_BINDING_MISMATCH', 'CRITICAL', 'Deposit', deposit.id, deposit.tenantId, {
        contractId: deposit.contractId,
      });
    }
    if (deposit.contractId && deposit.contract?.rentalCycleId && deposit.rentalCycleId !== deposit.contract.rentalCycleId) {
      add('DEPOSIT_RENTAL_CYCLE_BINDING_MISMATCH', 'CRITICAL', 'Deposit', deposit.id, deposit.tenantId, {
        contractId: deposit.contractId,
      });
    }
    if (FINANCIAL_DEPOSIT_STATUSES.has(deposit.status)) {
      const rows = depositsByContract.get(deposit.contractId) || [];
      rows.push(deposit);
      depositsByContract.set(deposit.contractId, rows);
    }
  }
  for (const deposits of depositsByContract.values()) {
    const contract = deposits[0].contract;
    if (!['APPROVED', 'ACTIVE', 'EXPIRING'].includes(contract.status)) continue;
    const actual = money(deposits.reduce((total, item) => total + money(item.amount), 0));
    const expected = money(contract.depositMoney);
    if (actual !== expected) {
      add('CONTRACT_DEPOSIT_BALANCE_MISMATCH', 'CRITICAL', 'Contract', contract.id, contract.tenantId, {
        expectedDeposit: expected,
        recordedPaidDeposit: actual,
        depositIds: deposits.map((item) => item.id),
      });
    }
  }

  for (const invoice of data.invoices || []) {
    if (invoice.contractId && invoice.contract?.rentalCycleId && invoice.rentalCycleId !== invoice.contract.rentalCycleId) {
      add('INVOICE_RENTAL_CYCLE_BINDING_MISMATCH', 'CRITICAL', 'Invoice', invoice.id, invoice.tenantId, {
        contractId: invoice.contractId,
      });
    }
    const confirmedAllocationTotal = money((invoice.allocations || []).reduce((total, allocation) => {
      if (allocation.payment?.status !== 'CONFIRMED' || allocation.payment?.deletedAt) return total;
      return total + money(allocation.amount);
    }, 0));
    const paidAmount = money(invoice.paidAmount);
    if (confirmedAllocationTotal !== paidAmount) {
      add('INVOICE_PAID_AMOUNT_ALLOCATION_MISMATCH', 'CRITICAL', 'Invoice', invoice.id, invoice.tenantId, {
        paidAmount,
        confirmedAllocationTotal,
        delta: money(paidAmount - confirmedAllocationTotal),
      });
    }
  }

  for (const payment of data.payments || []) {
    if (payment.invoice?.rentalCycleId && payment.rentalCycleId !== payment.invoice.rentalCycleId) {
      add('PAYMENT_RENTAL_CYCLE_BINDING_MISMATCH', 'CRITICAL', 'Payment', payment.id, payment.tenantId, {
        invoiceId: payment.invoiceId,
      });
    }
  }

  const countsByCode = findings.reduce((result, finding) => {
    result[finding.code] = (result[finding.code] || 0) + 1;
    return result;
  }, {});
  const countsBySeverity = findings.reduce((result, finding) => {
    result[finding.severity] = (result[finding.severity] || 0) + 1;
    return result;
  }, {});
  return { generatedAt: new Date().toISOString(), readOnly: true, totalFindings: findings.length, countsBySeverity, countsByCode, findings };
}

async function runDetector(options, deps = {}) {
  loadEnvFile(options.envFile);
  const prisma = deps.prisma || new PrismaClient();
  const disconnect = deps.prisma ? async () => undefined : async () => prisma.$disconnect();
  const tenantWhere = options.tenantId ? { tenantId: options.tenantId } : {};
  try {
    const [rooms, occupancies, customers, contracts, deposits, invoices, payments] = await Promise.all([
      prisma.room.findMany({
        where: { ...tenantWhere, deletedAt: null },
        select: {
          id: true, tenantId: true, status: true, rentalType: true, capacity: true,
          contracts: { where: { deletedAt: null }, select: { id: true, status: true } },
          occupancies: { where: { leftAt: null }, select: { id: true } },
          roommates: { where: { deletedAt: null }, select: { id: true } },
        },
      }),
      prisma.occupancy.findMany({
        where: { ...tenantWhere, leftAt: null },
        select: {
          id: true, tenantId: true, roomId: true, customerId: true,
          customer: { select: { roomId: true } },
          contract: { select: { id: true, status: true } },
        },
      }),
      prisma.customer.findMany({
        where: { ...tenantWhere, deletedAt: null },
        select: { id: true, tenantId: true, phone: true, identityNo: true },
      }),
      prisma.contract.findMany({
        where: { ...tenantWhere, deletedAt: null },
        select: {
          id: true, tenantId: true, roomId: true, customerId: true, rentalCycleId: true,
          status: true, startDate: true, endDate: true,
          rentalCycle: { select: { tenantId: true, customerId: true, roomId: true } },
        },
      }),
      prisma.deposit.findMany({
        where: { ...tenantWhere, deletedAt: null },
        select: {
          id: true, tenantId: true, roomId: true, customerId: true, contractId: true, rentalCycleId: true, amount: true, status: true,
          contract: { select: { id: true, tenantId: true, roomId: true, customerId: true, rentalCycleId: true, status: true, depositMoney: true } },
        },
      }),
      prisma.invoice.findMany({
        where: { ...tenantWhere, deletedAt: null },
        select: {
          id: true, tenantId: true, contractId: true, rentalCycleId: true, paidAmount: true,
          contract: { select: { rentalCycleId: true } },
          allocations: {
            select: { amount: true, payment: { select: { status: true, deletedAt: true } } },
          },
        },
      }),
      prisma.payment.findMany({
        where: { ...tenantWhere, deletedAt: null },
        select: {
          id: true, tenantId: true, invoiceId: true, rentalCycleId: true,
          invoice: { select: { rentalCycleId: true } },
        },
      }),
    ]);
    const report = analyzeLifecycleData({ rooms, occupancies, customers, contracts, deposits, invoices, payments });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally {
    await disconnect();
  }
}

if (require.main === module) {
  runDetector(parseArguments(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`Core lifecycle detector failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  });
}

module.exports = { analyzeLifecycleData, normalizeIdentity, normalizePhone, parseArguments, runDetector };
