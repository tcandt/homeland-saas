import { expect, request as pwRequest, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Seed = {
  prefix: string;
  tenantId: string;
  otherTenantId: string;
  roomId: string;
  cycleAId: string;
  cycleBId: string;
  otherCycleId: string;
  invoiceAId: string;
  invoiceBId: string;
  paymentAId: string;
  paymentBId: string;
  depositAId: string;
  depositBId: string;
  ledgerAId: string;
  ledgerBId: string;
};

function payload(body: any) {
  return body?.data ?? body;
}

async function seedSharedRoom(tenantId: string): Promise<Seed> {
  const prefix = `core0807-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const otherTenant = await prisma.tenantOrg.create({
    data: { name: `${prefix}-other`, code: `${prefix}-other` }, select: { id: true },
  });
  const building = await prisma.building.create({
    data: { tenantId, code: `${prefix}-building`, name: `${prefix}-building` }, select: { id: true },
  });
  const floor = await prisma.floor.create({
    data: { tenantId, buildingId: building.id, level: 807, name: `${prefix}-floor` }, select: { id: true },
  });
  const room = await prisma.room.create({
    data: {
      tenantId,
      buildingId: building.id,
      floorId: floor.id,
      code: `${prefix}-shared`,
      name: `${prefix}-shared`,
      monthlyPrice: 1_000_000,
      rentalType: "SHARED",
      capacity: 2,
      bedCount: 2,
      status: "OCCUPIED",
    }, select: { id: true },
  });
  const [customerA, customerB] = await Promise.all([
    prisma.customer.create({ data: { tenantId, fullName: `${prefix}-customer-a`, phone: `0807${Date.now().toString().slice(-6)}1` }, select: { id: true } }),
    prisma.customer.create({ data: { tenantId, fullName: `${prefix}-customer-b`, phone: `0807${Date.now().toString().slice(-6)}2` }, select: { id: true } }),
  ]);
  const [cycleA, cycleB] = await Promise.all([
    prisma.rentalCycle.create({ data: { tenantId, customerId: customerA.id, roomId: room.id, status: "ACTIVE" }, select: { id: true } }),
    prisma.rentalCycle.create({ data: { tenantId, customerId: customerB.id, roomId: room.id, status: "ACTIVE" }, select: { id: true } }),
  ]);
  const [contractA, contractB] = await Promise.all([
    prisma.contract.create({ data: { tenantId, roomId: room.id, customerId: customerA.id, rentalCycleId: cycleA.id, code: `${prefix}-contract-a`, status: "ACTIVE", startDate: new Date(), endDate: new Date("2027-01-01"), monthlyRent: 1_000_000, depositMoney: 300_000 }, select: { id: true } }),
    prisma.contract.create({ data: { tenantId, roomId: room.id, customerId: customerB.id, rentalCycleId: cycleB.id, code: `${prefix}-contract-b`, status: "ACTIVE", startDate: new Date(), endDate: new Date("2027-01-01"), monthlyRent: 2_000_000, depositMoney: 400_000 }, select: { id: true } }),
  ]);
  const [invoiceA, invoiceB] = await Promise.all([
    prisma.invoice.create({ data: { tenantId, customerId: customerA.id, contractId: contractA.id, rentalCycleId: cycleA.id, code: `${prefix}-invoice-a`, dueDate: new Date("2026-12-31"), subtotal: 1_000_000, total: 1_000_000, paidAmount: 400_000, creditAmount: 100_000, status: "PARTIALLY_PAID", billingKind: "MONTHLY_BASE" }, select: { id: true } }),
    prisma.invoice.create({ data: { tenantId, customerId: customerB.id, contractId: contractB.id, rentalCycleId: cycleB.id, code: `${prefix}-invoice-b`, dueDate: new Date("2026-12-31"), subtotal: 2_000_000, total: 2_000_000, paidAmount: 500_000, creditAmount: 200_000, status: "PARTIALLY_PAID", billingKind: "MONTHLY_BASE" }, select: { id: true } }),
  ]);
  const [paymentA, paymentB] = await Promise.all([
    prisma.payment.create({ data: { tenantId, invoiceId: invoiceA.id, rentalCycleId: cycleA.id, amount: 400_000, provider: "MANUAL", providerRef: `${prefix}-payment-a`, status: "CONFIRMED", paidAt: new Date() }, select: { id: true } }),
    prisma.payment.create({ data: { tenantId, invoiceId: invoiceB.id, rentalCycleId: cycleB.id, amount: 500_000, provider: "MANUAL", providerRef: `${prefix}-payment-b`, status: "CONFIRMED", paidAt: new Date() }, select: { id: true } }),
  ]);
  await prisma.paymentAllocation.createMany({ data: [
    { tenantId, paymentId: paymentA.id, invoiceId: invoiceA.id, amount: 400_000 },
    { tenantId, paymentId: paymentB.id, invoiceId: invoiceB.id, amount: 500_000 },
  ] });
  await prisma.creditNote.createMany({ data: [
    { tenantId, customerId: customerA.id, sourceInvoiceId: invoiceA.id, appliedInvoiceId: invoiceA.id, amount: 100_000, remainingAmount: 0, reason: `${prefix}-credit-a` },
    { tenantId, customerId: customerB.id, sourceInvoiceId: invoiceB.id, appliedInvoiceId: invoiceB.id, amount: 200_000, remainingAmount: 0, reason: `${prefix}-credit-b` },
  ] });
  const [depositA, depositB] = await Promise.all([
    prisma.deposit.create({ data: { tenantId, code: `${prefix}-deposit-a`, type: "SECURITY", roomId: room.id, customerId: customerA.id, contractId: contractA.id, rentalCycleId: cycleA.id, amount: 300_000, status: "PAID" }, select: { id: true } }),
    prisma.deposit.create({ data: { tenantId, code: `${prefix}-deposit-b`, type: "SECURITY", roomId: room.id, customerId: customerB.id, contractId: contractB.id, rentalCycleId: cycleB.id, amount: 400_000, status: "PAID" }, select: { id: true } }),
  ]);
  const [operationA, operationB] = await Promise.all([
    prisma.depositOperation.create({ data: { tenantId, rentalCycleId: cycleA.id, sourceDepositId: depositA.id, contractId: contractA.id, type: "COLLECT", status: "COMPLETED", idempotencyKey: `${prefix}-operation-a`, requestHash: `${prefix}-operation-a` }, select: { id: true } }),
    prisma.depositOperation.create({ data: { tenantId, rentalCycleId: cycleB.id, sourceDepositId: depositB.id, contractId: contractB.id, type: "COLLECT", status: "COMPLETED", idempotencyKey: `${prefix}-operation-b`, requestHash: `${prefix}-operation-b` }, select: { id: true } }),
  ]);
  const [ledgerA, ledgerB] = await Promise.all([
    prisma.depositLedgerEntry.create({ data: { tenantId, rentalCycleId: cycleA.id, depositId: depositA.id, contractId: contractA.id, operationId: operationA.id, type: "CASH_IN", amount: 300_000, balanceEffect: 300_000, idempotencyKey: `${prefix}-ledger-a`, sourceType: "DEPOSIT", sourceId: depositA.id }, select: { id: true } }),
    prisma.depositLedgerEntry.create({ data: { tenantId, rentalCycleId: cycleB.id, depositId: depositB.id, contractId: contractB.id, operationId: operationB.id, type: "REFUND", amount: 50_000, balanceEffect: -50_000, idempotencyKey: `${prefix}-ledger-b`, sourceType: "DEPOSIT", sourceId: depositB.id }, select: { id: true } }),
  ]);
  const otherCustomer = await prisma.customer.create({ data: { tenantId: otherTenant.id, fullName: `${prefix}-other-customer`, phone: `0807${Date.now().toString().slice(-6)}3` }, select: { id: true } });
  const otherBuilding = await prisma.building.create({ data: { tenantId: otherTenant.id, code: `${prefix}-other-building`, name: `${prefix}-other-building` }, select: { id: true } });
  const otherFloor = await prisma.floor.create({ data: { tenantId: otherTenant.id, buildingId: otherBuilding.id, level: 807, name: `${prefix}-other-floor` }, select: { id: true } });
  const otherRoom = await prisma.room.create({ data: { tenantId: otherTenant.id, buildingId: otherBuilding.id, floorId: otherFloor.id, code: `${prefix}-other-room`, name: `${prefix}-other-room`, monthlyPrice: 1, rentalType: "SHARED" }, select: { id: true } });
  const otherCycle = await prisma.rentalCycle.create({ data: { tenantId: otherTenant.id, customerId: otherCustomer.id, roomId: otherRoom.id, status: "ACTIVE" }, select: { id: true } });
  return { prefix, tenantId, otherTenantId: otherTenant.id, roomId: room.id, cycleAId: cycleA.id, cycleBId: cycleB.id, otherCycleId: otherCycle.id, invoiceAId: invoiceA.id, invoiceBId: invoiceB.id, paymentAId: paymentA.id, paymentBId: paymentB.id, depositAId: depositA.id, depositBId: depositB.id, ledgerAId: ledgerA.id, ledgerBId: ledgerB.id };
}

async function cleanup(seed: Seed | undefined) {
  if (!seed) return;
  await prisma.paymentAllocation.deleteMany({ where: { tenantId: seed.tenantId, paymentId: { in: [seed.paymentAId, seed.paymentBId] } } });
  await prisma.creditNote.deleteMany({ where: { tenantId: seed.tenantId, sourceInvoiceId: { in: [seed.invoiceAId, seed.invoiceBId] } } });
  await prisma.payment.deleteMany({ where: { tenantId: seed.tenantId, id: { in: [seed.paymentAId, seed.paymentBId] } } });
  await prisma.invoice.deleteMany({ where: { tenantId: seed.tenantId, id: { in: [seed.invoiceAId, seed.invoiceBId] } } });
  await prisma.depositLedgerEntry.deleteMany({ where: { tenantId: seed.tenantId, id: { in: [seed.ledgerAId, seed.ledgerBId] } } });
  await prisma.depositOperation.deleteMany({ where: { tenantId: seed.tenantId, idempotencyKey: { startsWith: seed.prefix } } });
  await prisma.deposit.deleteMany({ where: { tenantId: seed.tenantId, id: { in: [seed.depositAId, seed.depositBId] } } });
  await prisma.contract.deleteMany({ where: { tenantId: seed.tenantId, code: { startsWith: seed.prefix } } });
  await prisma.rentalCycle.deleteMany({ where: { tenantId: seed.tenantId, id: { in: [seed.cycleAId, seed.cycleBId] } } });
  await prisma.customer.deleteMany({ where: { tenantId: seed.tenantId, fullName: { startsWith: seed.prefix } } });
  await prisma.room.deleteMany({ where: { tenantId: seed.tenantId, id: seed.roomId } });
  await prisma.floor.deleteMany({ where: { tenantId: seed.tenantId, name: { startsWith: seed.prefix } } });
  await prisma.building.deleteMany({ where: { tenantId: seed.tenantId, code: { startsWith: seed.prefix } } });
  await prisma.rentalCycle.deleteMany({ where: { tenantId: seed.otherTenantId, id: seed.otherCycleId } });
  await prisma.customer.deleteMany({ where: { tenantId: seed.otherTenantId, fullName: { startsWith: seed.prefix } } });
  await prisma.room.deleteMany({ where: { tenantId: seed.otherTenantId, code: { startsWith: seed.prefix } } });
  await prisma.floor.deleteMany({ where: { tenantId: seed.otherTenantId, name: { startsWith: seed.prefix } } });
  await prisma.building.deleteMany({ where: { tenantId: seed.otherTenantId, code: { startsWith: seed.prefix } } });
  await prisma.tenantOrg.deleteMany({ where: { id: seed.otherTenantId, code: `${seed.prefix}-other` } });
}

test.describe("CORE-08.07 shared-room finance isolation", () => {
  test("keeps each customer contract and rental cycle financially isolated", async ({}, testInfo) => {
    test.skip(!/Desktop 1920/.test(testInfo.project.name), "Focused once on desktop");
    const apiBaseUrl = process.env.E2E_API_BASE_URL || "http://127.0.0.1:3001";
    const adminPassword = process.env.E2E_ADMIN_PASSWORD;
    if (!adminPassword) throw new Error("E2E_ADMIN_PASSWORD is required for CORE-08.07");
    const unauthenticatedApi = await pwRequest.newContext({ baseURL: apiBaseUrl });
    const loginResponse = await unauthenticatedApi.post("/api/v1/auth/login", {
      data: { emailOrPhone: "admin@homeland.vn", password: adminPassword },
    });
    if (!loginResponse.ok()) {
      throw new Error(`CORE-08.07 login failed: ${loginResponse.status()}`);
    }
    const auth = payload(await loginResponse.json());
    const tenantId = auth?.user?.tenantId;
    if (!auth?.accessToken || !tenantId) throw new Error("CORE-08.07 login lacks tenant context");
    const api = await pwRequest.newContext({
      baseURL: apiBaseUrl,
      extraHTTPHeaders: { Authorization: `Bearer ${auth.accessToken}` },
    });
    let seed: Seed | undefined;
    try {
      seed = await seedSharedRoom(tenantId);
      const [cycleAResponse, cycleBResponse, roomResponse, foreignCycleResponse, invoiceAResponse, invoiceBResponse, foreignInvoiceResponse] = await Promise.all([
        api.get(`/api/v1/deposits/rental-cycles/${seed.cycleAId}/finance-summary`),
        api.get(`/api/v1/deposits/rental-cycles/${seed.cycleBId}/finance-summary`),
        api.get(`/api/v1/deposits/rooms/${seed.roomId}/finance-summary`),
        api.get(`/api/v1/deposits/rental-cycles/${seed.otherCycleId}/finance-summary`),
        api.get(`/api/v1/invoices?rentalCycleId=${seed.cycleAId}&customerId=${encodeURIComponent((await prisma.rentalCycle.findUniqueOrThrow({ where: { id: seed.cycleAId } })).customerId)}`),
        api.get(`/api/v1/invoices?rentalCycleId=${seed.cycleBId}`),
        api.get(`/api/v1/invoices?rentalCycleId=${seed.otherCycleId}`),
      ]);
      expect(cycleAResponse.ok()).toBeTruthy();
      expect(cycleBResponse.ok()).toBeTruthy();
      expect(roomResponse.ok()).toBeTruthy();
      expect(foreignCycleResponse.ok()).toBeFalsy();
      const cycleA = payload(await cycleAResponse.json());
      const cycleB = payload(await cycleBResponse.json());
      const room = payload(await roomResponse.json());
      expect(cycleA.invoices.families.map((item: any) => item.rootInvoiceId)).toEqual([seed.invoiceAId]);
      expect(cycleA.payments.items.map((item: any) => item.id)).toEqual([seed.paymentAId]);
      expect(cycleA.deposits.map((item: any) => item.id)).toEqual([seed.depositAId]);
      expect(cycleA.depositLedger.entries.map((item: any) => item.id)).toEqual([seed.ledgerAId]);
      expect(cycleA.invoices).toMatchObject({ total: 1_000_000, paid: 400_000, credit: 100_000, outstanding: 500_000 });
      expect(cycleB.invoices.families.map((item: any) => item.rootInvoiceId)).toEqual([seed.invoiceBId]);
      expect(cycleB.payments.items.map((item: any) => item.id)).toEqual([seed.paymentBId]);
      expect(cycleB.deposits.map((item: any) => item.id)).toEqual([seed.depositBId]);
      expect(cycleB.depositLedger.entries.map((item: any) => item.id)).toEqual([seed.ledgerBId]);
      expect(cycleB.invoices).toMatchObject({ total: 2_000_000, paid: 500_000, credit: 200_000, outstanding: 1_300_000 });
      expect(room.rentalCycles.map((item: any) => item.rentalCycleId).sort()).toEqual([seed.cycleAId, seed.cycleBId].sort());
      expect(room.totals).toMatchObject({ rentalCycles: 2, invoiceTotal: 3_000_000, cashReceived: 900_000, creditApplied: 300_000, outstanding: 1_800_000, depositBalance: 250_000 });
      expect(payload(await invoiceAResponse.json()).map((item: any) => item.id)).toEqual([seed.invoiceAId]);
      expect(payload(await invoiceBResponse.json()).map((item: any) => item.id)).toEqual([seed.invoiceBId]);
      expect(payload(await foreignInvoiceResponse.json())).toEqual([]);
    } finally {
      await cleanup(seed);
      await api.dispose();
      await unauthenticatedApi.dispose();
    }
  });
});
