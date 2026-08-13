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
  const chargeTotal = 2100000;
  const creditTotal = 1200000 + depositToRefund + depositToDeduct;
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
    ],
    credits: [
      { key: "roomRefundAmount", description: "Room refund", amount: 700000 },
      { key: "waterSupportAmount", description: "Water support", amount: 500000 },
      ...(depositToDeduct > 0 ? [{ key: "depositToDeduct", description: "Deposit applied to outstanding debt", amount: depositToDeduct }] : []),
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
  let lastRoomUpdatePayload: any = null;

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
      terminatedContract.settlementRefund = {
        ...terminatedContract.settlementRefund,
        receiptStatus: "COMPLETED",
        taskStatus: "DONE",
        pending: false,
        completed: true,
      };
      terminatedContract.updatedAt = "2026-08-12T09:00:00.000Z";
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

  await page.route("**/api/v1/rooms/*", async (route: any) => {
    const requestUrl = new URL(route.request().url());
    const pathname = requestUrl.pathname;
    const method = route.request().method();

    if (method === "PATCH") {
      lastRoomUpdatePayload = route.request().postDataJSON?.() || {};
      const roomId = pathname.split("/").pop();
      const currentContract = contracts.find((item) => item.room?.id === roomId);
      const nextStatus = String(lastRoomUpdatePayload?.status || "AVAILABLE");
      if (currentContract?.room) {
        currentContract.room = {
          ...currentContract.room,
          status: nextStatus,
        };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: roomId,
            number: currentContract?.room?.number || "P101",
            status: nextStatus,
            type: "STUDIO",
            price: 5000000,
            area: 25,
            capacity: 2,
            images: [],
            rentalType: "whole",
            buildingId: currentContract?.room?.building?.id || "building-1",
            floorId: "floor-1",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-08-11T08:00:00.000Z",
          },
        }),
      });
      return;
    }

    await route.fallback();
  });

  return {
    getLastPreviewPayload: () => lastPreviewPayload,
    getLastTerminatePayload: () => lastTerminatePayload,
    getLastCompleteRefundPayload: () => lastCompleteRefundPayload,
    getLastRoomUpdatePayload: () => lastRoomUpdatePayload,
  };
}

async function mockFullRentalJourney(page: any) {
  const state = {
    roomStatus: "AVAILABLE",
    deposit: {
      id: "deposit-journey-1",
      code: "DEP-JOURNEY-001",
      type: "SECURITY",
      status: "PENDING",
      amount: 5000000,
      note: "Deposit for end-to-end rental journey",
      expiredAt: "2026-09-01T00:00:00.000Z",
      createdAt: "2026-08-13T08:00:00.000Z",
      updatedAt: "2026-08-13T08:00:00.000Z",
      customer: { id: "customer-journey-1", fullName: "Nguyen Van Journey", phone: "0901234567" },
      room: {
        id: "room-journey-1",
        code: "31-01",
        name: "Phong 31-01",
        building: { id: "building-journey-1", code: "LK01-31", name: "LK01-31" },
      },
      refundSummary: null as any,
    },
    contract: {
      id: "contract-journey-1",
      code: "CTR-JOURNEY-001",
      status: "DRAFT",
      startDate: "2026-08-13T00:00:00.000Z",
      endDate: "2027-08-12T00:00:00.000Z",
      monthlyRent: 5000000,
      depositMoney: 5000000,
      debt: 0,
      memberCount: 1,
      attachments: [],
      customer: { id: "customer-journey-1", fullName: "Nguyen Van Journey", phone: "0901234567", idImages: [] },
      room: {
        id: "room-journey-1",
        number: "31-01",
        code: "31-01",
        status: "AVAILABLE",
        building: { id: "building-journey-1", code: "LK01-31", name: "LK01-31" },
      },
      coRepresentatives: [],
      settlementRefund: null as any,
      createdAt: "2026-08-13T08:00:00.000Z",
      updatedAt: "2026-08-13T08:00:00.000Z",
    },
    invoice: {
      id: "invoice-journey-1",
      code: "INV-JOURNEY-001",
      status: "DRAFT",
      total: 5000000,
      paidAmount: 0,
      creditAmount: 0,
      paidPercent: 0,
      period: "08/2026",
      createdAt: "2026-08-13T08:00:00.000Z",
      dueDate: "2026-08-20T00:00:00.000Z",
      customer: { id: "customer-journey-1", name: "Nguyen Van Journey", fullName: "Nguyen Van Journey" },
      contract: {
        id: "contract-journey-1",
        roomId: "room-journey-1",
        room: {
          id: "room-journey-1",
          number: "31-01",
          code: "31-01",
          building: { id: "building-journey-1", code: "LK01-31", name: "LK01-31" },
        },
      },
      items: [{ id: "item-rent-1", type: "RENT", description: "Monthly rent", quantity: 1, unitPrice: 5000000, amount: 5000000 }],
    },
    contractCreated: false,
    invoiceCreated: false,
    lastCollectPayload: null as any,
    lastConvertPayload: null as any,
    lastInvoicePaymentPayload: null as any,
    lastSettlementPreviewPayload: null as any,
    lastTerminationPayload: null as any,
    lastRoomPayload: null as any,
  };

  const json = (route: any, data: any, status = 200) => route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify({ success: status < 400, data }),
  });

  await page.route("**/api/v1/deposits**", async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path.endsWith("/collect") && method === "POST") {
      state.lastCollectPayload = request.postDataJSON?.() || {};
      state.deposit.status = "PAID";
      state.roomStatus = "RESERVED";
      state.contract.room.status = state.roomStatus;
      return json(route, state.deposit);
    }
    if (path.endsWith("/convert-contract") && method === "POST") {
      state.lastConvertPayload = request.postDataJSON?.() || {};
      state.deposit.status = "CONVERTED_TO_CONTRACT";
      state.contractCreated = true;
      return json(route, state.contract);
    }
    if (path.endsWith(`/deposits/${state.deposit.id}`) && method === "GET") {
      return json(route, state.deposit);
    }
    if (path.endsWith("/deposits") && method === "GET") {
      return json(route, { items: [state.deposit], total: 1 });
    }
    return json(route, null, 404);
  });

  await page.route("**/api/v1/contracts**", async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path.endsWith("/submit") && method === "POST") {
      state.contract.status = "PENDING_APPROVAL";
      return json(route, state.contract);
    }
    if (path.endsWith("/approve") && method === "POST") {
      state.contract.status = "APPROVED";
      state.roomStatus = "RESERVED";
      state.contract.room.status = state.roomStatus;
      return json(route, state.contract);
    }
    if (path.endsWith("/activate") && method === "POST") {
      state.contract.status = "ACTIVE";
      state.deposit.status = "CONVERTED_TO_CONTRACT";
      state.roomStatus = "OCCUPIED";
      state.contract.room.status = state.roomStatus;
      state.invoiceCreated = true;
      return json(route, state.contract);
    }
    if (path.endsWith("/settlement-preview") && method === "POST") {
      const payload = request.postDataJSON?.() || {};
      state.lastSettlementPreviewPayload = payload;
      const chargeTotal = Number(payload.electricityAmount || 350000) + Number(payload.waterAmount || 150000);
      const creditTotal = Number(payload.depositToRefund || 0) + Number(payload.depositToDeduct || 0);
      return json(route, {
        actualMoveOutDate: payload.actualMoveOutDate,
        roomTurnoverStatus: payload.roomTurnoverStatus || "CLEANING",
        charges: [
          { key: "electricityAmount", description: "Electricity settlement", amount: Number(payload.electricityAmount || 350000) },
          { key: "waterAmount", description: "Water settlement", amount: Number(payload.waterAmount || 150000) },
        ],
        credits: [
          ...(Number(payload.depositToDeduct || 0) > 0 ? [{ key: "depositToDeduct", description: "Deposit deduction", amount: Number(payload.depositToDeduct) }] : []),
          ...(Number(payload.depositToRefund || 0) > 0 ? [{ key: "depositToRefund", description: "Deposit refund", amount: Number(payload.depositToRefund) }] : []),
        ],
        totals: {
          chargeTotal,
          creditTotal,
          refundToCustomer: Math.max(creditTotal - chargeTotal, 0),
          netReceivable: Math.max(chargeTotal - creditTotal, 0),
        },
        utilitySnapshot: {
          electricity: {
            displayName: "Hunonic 31-01",
            deviceName: "HUNONIC-JOURNEY-01",
            readingAt: "2026-08-13T09:00:00.000Z",
            source: "hunonic-sync",
            monthKwh: 100,
            monthAmountVnd: 350000,
            calculatedAmountVnd: 350000,
            rateMode: "CUSTOM",
            calculationSource: "SETTLEMENT_SNAPSHOT",
          },
          water: {
            previousReading: 20,
            currentReading: 26,
            usage: 6,
            unitPrice: 25000,
            amount: 150000,
            source: "manual-preview",
          },
        },
      });
    }
    if (path.endsWith("/terminate") && method === "POST") {
      state.lastTerminationPayload = request.postDataJSON?.() || {};
      state.contract.status = "TERMINATED";
      state.roomStatus = state.lastTerminationPayload.roomTurnoverStatus || "CLEANING";
      state.contract.room.status = state.roomStatus;
      state.contract.settlementRefund = {
        receiptId: "receipt-journey-1",
        receiptCode: "RC-JOURNEY-001",
        receiptStatus: state.lastTerminationPayload.refundReceiptStatus || "COMPLETED",
        receiptAmount: Number(state.lastTerminationPayload.depositToRefund || 0),
        pending: state.lastTerminationPayload.refundReceiptStatus === "PENDING",
        completed: state.lastTerminationPayload.refundReceiptStatus !== "PENDING",
      };
      return json(route, state.contract);
    }
    if (path.endsWith(`/contracts/${state.contract.id}`) && method === "GET") {
      return json(route, state.contractCreated ? state.contract : null, state.contractCreated ? 200 : 404);
    }
    if (path.endsWith("/contracts") && method === "GET") {
      const items = state.contractCreated ? [state.contract] : [];
      return json(route, { items, total: items.length });
    }
    return json(route, null, 404);
  });

  await page.route("**/api/v1/invoices**", async (route: any) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();

    if (path.endsWith("/issue") && method === "POST") {
      state.invoice.status = "ISSUED";
      return json(route, state.invoice);
    }
    if (path.endsWith("/pay") && method === "POST") {
      state.lastInvoicePaymentPayload = request.postDataJSON?.() || {};
      state.invoice.paidAmount = Math.min(state.invoice.total, state.invoice.paidAmount + Number(state.lastInvoicePaymentPayload.amount || 0));
      state.invoice.paidPercent = Math.round((state.invoice.paidAmount / state.invoice.total) * 100);
      state.invoice.status = state.invoice.paidAmount >= state.invoice.total ? "PAID" : "PARTIALLY_PAID";
      return json(route, state.invoice);
    }
    if (path.endsWith(`/invoices/${state.invoice.id}`) && method === "GET") {
      return json(route, state.invoiceCreated ? state.invoice : null, state.invoiceCreated ? 200 : 404);
    }
    if (path.endsWith("/invoices") && method === "GET") {
      const items = state.invoiceCreated ? [state.invoice] : [];
      return json(route, { items, total: items.length });
    }
    return json(route, null, 404);
  });

  await page.route("**/api/v1/rooms/*", async (route: any) => {
    const request = route.request();
    if (request.method() !== "PATCH") return route.fallback();
    state.lastRoomPayload = request.postDataJSON?.() || {};
    state.roomStatus = String(state.lastRoomPayload.status || "AVAILABLE");
    state.contract.room.status = state.roomStatus;
    return json(route, {
      id: state.contract.room.id,
      number: state.contract.room.number,
      code: state.contract.room.code,
      status: state.roomStatus,
      type: "STUDIO",
      price: 5000000,
      area: 25,
      capacity: 2,
      images: [],
      rentalType: "whole",
      buildingId: state.contract.room.building.id,
      floorId: "floor-journey-1",
      createdAt: "2026-08-13T08:00:00.000Z",
      updatedAt: "2026-08-13T10:00:00.000Z",
    });
  });

  return state;
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

    await expect(admin.page.getByTestId("btn-confirm-terminate-settlement")).toBeEnabled();
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

    await expect(admin.page.getByTestId("contract-settlement-refund-complete-modal")).not.toBeVisible();
    await expect(admin.page.getByTestId("contract-pending-settlement-refund")).not.toBeVisible();
  });

  test("marks terminated room back to available after cleaning completion", async ({ admin }) => {
    const mock = await mockContracts(admin.page);

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });

    await admin.page
      .locator("[data-testid='contract-card']:visible")
      .filter({ hasText: "C-TERM-001" })
      .first()
      .dispatchEvent("click");

    await expect(admin.page.getByTestId("btn-room-ready")).toBeVisible();
    await admin.page.getByTestId("btn-room-ready").click();

    await expect
      .poll(() => mock.getLastRoomUpdatePayload(), { timeout: 10000 })
      .toMatchObject({
        status: "AVAILABLE",
      });
  });

  test("shows deposit deduction as settlement credit instead of extra charge", async ({ admin }) => {
    const mock = await mockContracts(admin.page);

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });

    await admin.page
      .locator("[data-testid='contract-card']:visible")
      .filter({ hasText: "C-ACTIVE-001" })
      .first()
      .dispatchEvent("click");

    await admin.page.getByTestId("btn-open-settlement").click();
    await expect(admin.page.getByTestId("contract-settlement-modal")).toBeVisible();

    await admin.page.getByTestId("contract-settlement-deposit-refund").fill("");
    const deductionPreviewResponse = admin.page.waitForResponse(async (response) => {
      if (!response.url().endsWith("/settlement-preview") || response.request().method() !== "POST") return false;
      const payload = response.request().postDataJSON?.() || {};
      return Number(payload.depositToDeduct || 0) === 500000;
    });
    await admin.page.getByTestId("contract-settlement-deposit-deduct").fill("500000");

    await deductionPreviewResponse;
    await expect
      .poll(() => mock.getLastPreviewPayload(), { timeout: 10000 })
      .toMatchObject({
        depositToDeduct: 500000,
      });

    const deductionCredit = admin.page.getByTestId("contract-settlement-credit-depositToDeduct");
    await expect(deductionCredit).toContainText("Deposit applied to outstanding debt");
    await expect(deductionCredit).toContainText("500.000đ");
    await expect(admin.page.getByText("Thu thêm:").locator("..")).toContainText("400.000đ");
  });

  test("terminates contract with maintenance turnover and completed refund surplus", async ({ admin }) => {
    const mock = await mockContracts(admin.page);

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });

    await admin.page
      .locator("[data-testid='contract-card']:visible")
      .filter({ hasText: "C-ACTIVE-001" })
      .first()
      .dispatchEvent("click");

    await admin.page.getByTestId("btn-open-settlement").click();
    await expect(admin.page.getByTestId("contract-settlement-modal")).toBeVisible();

    await admin.page.getByTestId("contract-settlement-room-turnover-status").selectOption("MAINTENANCE");
    await admin.page.getByTestId("contract-settlement-deposit-refund").fill("2000000");
    await admin.page.getByTestId("contract-settlement-deposit-deduct").fill("");

    await expect
      .poll(() => mock.getLastPreviewPayload(), { timeout: 10000 })
      .toMatchObject({
        roomTurnoverStatus: "MAINTENANCE",
        depositToRefund: 2000000,
      });

    await expect(admin.page.getByText("Bảo trì trước khi mở bán")).toBeVisible();
    await expect(admin.page.getByText("Hoàn khách:").locator("..")).toContainText("1.100.000đ");

    await admin.page.getByTestId("btn-confirm-terminate-settlement").click();

    await expect
      .poll(() => mock.getLastTerminatePayload(), { timeout: 10000 })
      .toMatchObject({
        roomTurnoverStatus: "MAINTENANCE",
        depositToRefund: 2000000,
        refundReceiptStatus: "COMPLETED",
      });
  });

  test("runs one rental record from deposit collection through paid invoice and room turnover", async ({ admin }) => {
    const journey = await mockFullRentalJourney(admin.page);
    admin.page.on("dialog", async (dialog) => {
      if (dialog.type() === "prompt") await dialog.accept("5000000");
      else await dialog.accept();
    });

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });
    await admin.page.locator("[data-testid='deposit-card']:visible").filter({ hasText: journey.deposit.code }).first().click();
    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();
    await admin.page.getByTestId("deposit-action-collect").click();
    await expect.poll(() => journey.deposit.status).toBe("PAID");
    const depositDrawer = admin.page.getByTestId("deposit-detail-drawer");
    await expect(depositDrawer.getByTestId("deposit-status-badge")).toContainText("PAID");
    await expect(depositDrawer.getByTestId("deposit-action-convert")).toBeVisible();
    await depositDrawer.getByTestId("deposit-action-convert").click();
    await expect.poll(() => journey.deposit.status).toBe("CONVERTED_TO_CONTRACT");
    expect(journey.lastCollectPayload).toEqual({});

    const openJourneyContract = async () => {
      const contractCard = admin.page.locator("[data-testid='contract-card']:visible").filter({ hasText: journey.contract.code }).first();
      await expect(contractCard).toBeVisible();
      await contractCard.click();
      await expect(admin.page.getByRole("heading", { name: new RegExp(`Chi tiết hợp đồng ${journey.contract.code}`) })).toBeVisible();
    };

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });
    await openJourneyContract();
    await admin.page.getByTestId("btn-submit-contract").click();
    await expect.poll(() => journey.contract.status).toBe("PENDING_APPROVAL");
    await openJourneyContract();
    await admin.page.getByTestId("btn-approve-contract").click();
    await expect.poll(() => journey.contract.status).toBe("APPROVED");
    await openJourneyContract();
    await admin.page.getByTestId("btn-activate-contract").click();
    await expect.poll(() => journey.contract.status).toBe("ACTIVE");
    expect(journey.roomStatus).toBe("OCCUPIED");
    expect(journey.invoiceCreated).toBe(true);

    const openJourneyInvoice = async () => {
      const row = admin.page.locator("tr").filter({ hasText: journey.invoice.customer.fullName }).filter({ hasText: journey.invoice.contract.room.code }).first();
      await expect(row).toBeVisible();
      await expect(row).toContainText("5.000.000");
      await row.getByRole("button").first().click();
      await expect(admin.page.getByTestId("invoice-detail-drawer")).toBeVisible();
    };

    await admin.page.goto("/invoices", { waitUntil: "domcontentloaded" });
    await openJourneyInvoice();
    await admin.page.getByTestId("btn-issue-invoice").click();
    await expect.poll(() => journey.invoice.status).toBe("ISSUED");
    await admin.page.getByTestId("invoice-detail-close").click();
    await admin.page.reload({ waitUntil: "domcontentloaded" });
    await openJourneyInvoice();
    await admin.page.getByTestId("btn-pay-invoice").click();
    await expect.poll(() => journey.invoice.status).toBe("PAID");
    expect(journey.lastInvoicePaymentPayload).toMatchObject({ amount: 5000000 });

    await admin.page.goto("/contracts", { waitUntil: "domcontentloaded" });
    await openJourneyContract();
    await admin.page.getByTestId("btn-open-settlement").click();
    await expect(admin.page.getByTestId("contract-settlement-modal")).toBeVisible();
    await expect.poll(() => journey.lastSettlementPreviewPayload).not.toBeNull();
    await expect(admin.page.getByText("HUNONIC-JOURNEY-01")).toBeVisible();
    await admin.page.getByRole("button", { name: "Áp dụng snapshot" }).click();
    await expect.poll(() => journey.lastSettlementPreviewPayload).toMatchObject({
      electricityAmount: 350000,
      waterAmount: 150000,
      electricityClosingKwh: 100,
      waterPreviousReading: 20,
      waterCurrentReading: 26,
    });
    await admin.page.getByTestId("contract-settlement-deposit-deduct").fill("500000");
    await admin.page.getByTestId("contract-settlement-deposit-refund").fill("4500000");
    await admin.page.getByTestId("contract-settlement-refund-reason").fill("Hoan coc sau khi tru dien nuoc");
    await expect.poll(() => journey.lastSettlementPreviewPayload).toMatchObject({
      depositToDeduct: 500000,
      depositToRefund: 4500000,
    });
    await expect(admin.page.getByTestId("btn-confirm-terminate-settlement")).toBeEnabled();
    await admin.page.getByTestId("btn-confirm-terminate-settlement").click();
    await expect.poll(() => journey.contract.status).toBe("TERMINATED");
    expect(journey.lastTerminationPayload).toMatchObject({
      electricityAmount: 350000,
      waterAmount: 150000,
      depositToDeduct: 500000,
      depositToRefund: 4500000,
      refundReceiptStatus: "COMPLETED",
      roomTurnoverStatus: "CLEANING",
    });
    expect(journey.contract.settlementRefund.completed).toBe(true);
    expect(journey.roomStatus).toBe("CLEANING");

    await openJourneyContract();
    await admin.page.getByTestId("btn-room-ready").click();
    await expect.poll(() => journey.roomStatus).toBe("AVAILABLE");
    expect(journey.lastRoomPayload).toEqual({ status: "AVAILABLE" });
  });
});
