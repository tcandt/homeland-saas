import { expect } from "@playwright/test";
import { test } from "../../fixtures/admin.fixture";

function createContract(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id || "contract-active-1",
    code: overrides.code || "C-ACTIVE-001",
    status: overrides.status || "ACTIVE",
    startDate: overrides.startDate || "2026-01-01T00:00:00.000Z",
    endDate: overrides.endDate || "2026-12-31T00:00:00.000Z",
    monthlyRent: overrides.monthlyRent ?? 5000000,
    depositMoney: overrides.depositMoney ?? 5000000,
    debt: overrides.debt ?? 0,
    memberCount: overrides.memberCount ?? 2,
    attachments: overrides.attachments || [],
    customer: overrides.customer || {
      id: "customer-1",
      fullName: "Nguyen Van A",
      phone: "0901234567",
      idImages: [],
    },
    room: overrides.room || {
      id: "room-1",
      number: "P101",
      code: "P101",
      status: overrides.roomStatus || "OCCUPIED",
      building: {
        id: "building-1",
        name: "LK01-31",
      },
    },
    coRepresentatives: overrides.coRepresentatives || [],
    settlementRefund: overrides.settlementRefund ?? null,
    updatedAt: overrides.updatedAt || "2026-08-11T08:00:00.000Z",
    createdAt: overrides.createdAt || "2026-08-01T08:00:00.000Z",
  };
}

function createSettlementPreview(payload: any) {
  const depositToRefund = Number(payload?.depositToRefund || 0);
  const depositToDeduct = Number(payload?.depositToDeduct || 0);
  const chargeTotal = 2100000 + depositToDeduct;
  const creditTotal = 1200000 + depositToRefund;
  const refundToCustomer = Math.max(creditTotal - chargeTotal, 0);
  const netReceivable = Math.max(chargeTotal - creditTotal, 0);

  return {
    actualMoveOutDate: payload?.actualMoveOutDate || "2026-08-11",
    roomTurnoverStatus: payload?.roomTurnoverStatus || "CLEANING",
    charges: [
      { key: "rentChargeAmount", description: "Final rent settlement (10 days)", amount: 1200000 },
      { key: "electricityAmount", description: "Electricity settlement", amount: 500000 },
      { key: "waterAmount", description: "Water settlement", amount: 200000 },
      { key: "serviceAmount", description: "Service fee", amount: 200000 },
      ...(depositToDeduct > 0 ? [{ key: "depositToDeduct", description: "Deposit applied to outstanding debt", amount: depositToDeduct }] : []),
    ],
    credits: [
      { key: "roomRefundAmount", description: "Room refund", amount: 700000 },
      { key: "waterSupportAmount", description: "Water support", amount: 500000 },
      ...(depositToRefund > 0 ? [{ key: "depositToRefund", description: "Deposit refund", amount: depositToRefund }] : []),
    ],
    totals: {
      chargeTotal,
      creditTotal,
      refundToCustomer,
      netReceivable,
    },
    utilitySnapshot: {
      electricity: {
        displayName: "Cong to phong P101",
        deviceName: "Hunonic Meter 01",
        readingAt: "2026-08-11T08:00:00.000Z",
        source: "hunonic-sync",
        monthKwh: 120,
        monthAmountVnd: 500000,
        calculatedAmountVnd: 500000,
        rateMode: "CUSTOM",
        calculationSource: "SETTLEMENT_SNAPSHOT",
      },
      water: {
        previousReading: 10,
        currentReading: 18,
        usage: 8,
        unitPrice: 25000,
        amount: 200000,
        source: "manual-preview",
      },
    },
  };
}

async function mockContracts(page: any) {
  let lastPreviewPayload: any = null;
  let lastTerminatePayload: any = null;
  let lastCompleteRefundPayload: any = null;

  const activeContract = createContract();
  const terminatedContract = createContract({
    id: "contract-terminated-1",
    code: "C-TERM-001",
    status: "TERMINATED",
    roomStatus: "CLEANING",
    settlementRefund: {
      receiptId: "receipt-1",
      receiptCode: "RC-SETTLE-001",
      receiptStatus: "PENDING",
      receiptAmount: 1800000,
      receiptDescription: "Contract settlement refund for C-TERM-001",
      taskId: "task-1",
      taskTitle: "Xu ly hoan tien C-TERM-001",
      taskStatus: "TODO",
      pending: true,
      completed: false,
    },
  });

  const contracts = [activeContract, terminatedContract];

  await page.route("**/api/v1/contracts**", async (route: any) => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    const method = route.request().method();

    if (pathname.endsWith("/settlement-preview") && method === "POST") {
      lastPreviewPayload = route.request().postDataJSON?.() || {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: createSettlementPreview(lastPreviewPayload),
        }),
      });
      return;
    }

    if (pathname.endsWith("/settlement-refund/complete") && method === "POST") {
      lastCompleteRefundPayload = route.request().postDataJSON?.() || {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            success: true,
            receiptId: "receipt-1",
            taskId: "task-1",
            amount: 1800000,
          },
        }),
      });
      return;
    }

    if (pathname.endsWith("/terminate") && method === "POST") {
      lastTerminatePayload = route.request().postDataJSON?.() || {};
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            ...activeContract,
            status: "TERMINATED",
          },
        }),
      });
      return;
    }

    if (pathname.endsWith("/contracts") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            items: contracts,
            total: contracts.length,
          },
        }),
      });
      return;
    }

    const id = pathname.split("/").pop();
    const contract = contracts.find((item) => item.id === id);
    await route.fulfill({
      status: contract ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify({
        success: !!contract,
        data: contract || null,
      }),
    });
  });

  return {
    getLastPreviewPayload: () => lastPreviewPayload,
    getLastTerminatePayload: () => lastTerminatePayload,
    getLastCompleteRefundPayload: () => lastCompleteRefundPayload,
  };
}

test.describe("Contracts Settlement Desktop Regression", () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), "Desktop-only regression");
  });

  test("opens settlement modal and terminates contract with pending refund payload", async ({ admin }) => {
    const mock = await mockContracts(admin.page);

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });

    await admin.page
      .locator("[data-testid='contract-card']:visible")
      .filter({ hasText: "C-ACTIVE-001" })
      .first()
      .dispatchEvent("click");

    await expect(admin.page.getByTestId("btn-open-settlement")).toBeVisible();
    await admin.page.getByTestId("btn-open-settlement").click();

    await expect(admin.page.getByTestId("contract-settlement-modal")).toBeVisible();

    await expect.poll(() => mock.getLastPreviewPayload(), { timeout: 10000 }).toMatchObject({
      refundReceiptStatus: "COMPLETED",
    });

    await admin.page.getByTestId("contract-settlement-deposit-deduct").fill("300000");
    await admin.page.getByTestId("contract-settlement-deposit-refund").fill("800000");
    await admin.page.getByTestId("contract-settlement-refund-status").selectOption("PENDING");
    await admin.page.getByTestId("contract-settlement-refund-reason").fill("Cho chuyen khoan sau doi soat");

    await admin.page.getByTestId("btn-confirm-terminate-settlement").click();

    await expect
      .poll(() => mock.getLastTerminatePayload(), { timeout: 10000 })
      .toMatchObject({
        depositToDeduct: 300000,
        depositToRefund: 800000,
        refundReceiptStatus: "PENDING",
        refundReason: "Cho chuyen khoan sau doi soat",
      });
  });

  test("completes pending settlement refund from terminated contract", async ({ admin }) => {
    const mock = await mockContracts(admin.page);

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });

    await admin.page
      .locator("[data-testid='contract-card']:visible")
      .filter({ hasText: "C-TERM-001" })
      .first()
      .dispatchEvent("click");

    await expect(admin.page.getByTestId("contract-pending-settlement-refund")).toBeVisible();
    await expect(admin.page.getByText("RC-SETTLE-001")).toBeVisible();

    await admin.page.getByTestId("contract-complete-settlement-refund-open").click();

    await expect(admin.page.getByTestId("contract-settlement-refund-complete-modal")).toBeVisible();
    await admin.page.getByTestId("contract-settlement-refund-complete-note").fill("Da chuyen khoan settlement");
    await admin.page.getByTestId("contract-settlement-refund-complete-submit").click();

    await expect
      .poll(() => mock.getLastCompleteRefundPayload(), { timeout: 10000 })
      .toMatchObject({
        note: "Da chuyen khoan settlement",
      });
  });
});
