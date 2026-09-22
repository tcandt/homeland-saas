import { expect } from "@playwright/test";
import { test } from "../../fixtures/admin.fixture";

type DepositItem = {
  id: string;
  code: string;
  type: string;
  status: string;
  amount: number;
  availableBalance?: number;
  pendingOperationId?: string | null;
  note: string | null;
  expiredAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    fullName: string;
    phone: string;
  };
  room: {
    id: string;
    code: string;
    name: string;
    building: {
      id: string;
      name: string;
    };
  };
  refundSummary?: any;
};

function createDeposit(overrides: Partial<DepositItem>): DepositItem {
  const status = overrides.status || "PENDING";
  const amount = overrides.amount ?? 5000000;
  return {
    id: overrides.id || "dep-1",
    code: overrides.code || "DEP-001",
    type: overrides.type || "SECURITY",
    status,
    amount,
    availableBalance: overrides.availableBalance ?? (status === "PAID" ? amount : 0),
    pendingOperationId: overrides.pendingOperationId ?? null,
    note: overrides.note ?? "Khách giữ phòng",
    expiredAt: overrides.expiredAt ?? "2026-08-10T00:00:00.000Z",
    createdAt: overrides.createdAt || "2026-08-09T08:00:00.000Z",
    updatedAt: overrides.updatedAt || "2026-08-11T08:00:00.000Z",
    customer: overrides.customer || {
      id: "customer-1",
      fullName: "Nguyễn Văn A",
      phone: "0901234567",
    },
    room: overrides.room || {
      id: "room-1",
      code: "LK01-31.01",
      name: "Phòng 01",
      building: {
        id: "building-1",
        name: "LK01-31",
      },
    },
    refundSummary: overrides.refundSummary ?? null,
  };
}

async function mockDeposits(page: any) {
  let cancelPayload: any = null;
  let cancelIdempotencyKey: string | undefined;
  let completePendingRefundPayload: any = null;
  let completePendingRefundOperationId: string | undefined;
  let completePendingRefundIdempotencyKey: string | undefined;
  let refundPayload: any = null;
  let refundIdempotencyKey: string | undefined;

  const deposits: DepositItem[] = [
    createDeposit({
      id: "dep-pending",
      code: "DEP-PENDING",
      status: "PENDING",
      amount: 3500000,
      note: "Chờ khách chuyển cọc",
    }),
    createDeposit({
      id: "dep-paid",
      code: "DEP-PAID",
      status: "PAID",
      amount: 10000000,
      note: "Khách đã cọc đầy đủ",
    }),
    createDeposit({
      id: "dep-cancelled",
      code: "DEP-CANCELLED",
      status: "CANCELLED",
      amount: 4500000,
      note: "Khách đổi lịch, đang chờ hoàn tiền",
      refundSummary: {
        operationId: "operation-refund-pending-1",
        receiptId: "receipt-1",
        receiptCode: "RC-001",
        receiptStatus: "PENDING",
        receiptAmount: 3000000,
        receiptDescription: "Hoàn một phần tiền cọc",
        taskId: "task-1",
        taskTitle: "Hoàn cọc DEP-CANCELLED",
        taskStatus: "IN_PROGRESS",
        pending: true,
        completed: false,
      },
      pendingOperationId: "operation-refund-pending-1",
    }),
  ];

  await page.route(/\/api\/v1\/deposits(\?.*)?$/, async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          items: deposits,
          total: deposits.length,
        },
      }),
    });
  });

  await page.route(/\/api\/v1\/deposits\/([^/]+)\/refund$/, async (route: any) => {
    refundPayload = route.request().postDataJSON?.() || {};
    refundIdempotencyKey = route.request().headers()['idempotency-key'];
    const match = route.request().url().match(/\/api\/v1\/deposits\/([^/]+)\/refund/);
    const id = match ? match[1] : undefined;
    const current = deposits.find((deposit) => deposit.id === id);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          ...current,
          status: "REFUNDED",
        },
      }),
    });
  });

  await page.route(/\/api\/v1\/deposits\/([^/]+)\/commands\/cancel$/, async (route: any) => {
    cancelPayload = route.request().postDataJSON?.() || {};
    cancelIdempotencyKey = route.request().headers()['idempotency-key'];
    const match = route.request().url().match(/\/api\/v1\/deposits\/([^/]+)\/commands\/cancel$/);
    const id = match ? match[1] : undefined;
    const current = deposits.find((deposit) => deposit.id === id);

    if (current) {
      const refundableAmount = Number(cancelPayload.refundAmount || 0);

      current.status = "CANCELLED";
      current.note = cancelPayload.reason || current.note;
      current.updatedAt = "2026-08-12T08:00:00.000Z";
      const isCompleted = cancelPayload.receiptStatus === "COMPLETED" || cancelPayload.refundStatus === "COMPLETED";

      current.refundSummary =
        refundableAmount > 0
          ? {
              operationId: `operation-${id}`,
              receiptId: `receipt-${id}`,
              receiptCode: `RC-${current.code}`,
              receiptStatus: isCompleted ? "COMPLETED" : "PENDING",
              receiptAmount: refundableAmount,
              receiptDescription: `Hoàn phần dư cọc ${current.code}`,
              taskId: `task-${id}`,
              taskTitle: `Hoàn cọc ${current.code}`,
              taskStatus: isCompleted ? "DONE" : "IN_PROGRESS",
              pending: !isCompleted,
              completed: isCompleted,
            }
          : null;
      if (refundableAmount > 0 && !isCompleted) {
        current.pendingOperationId = `operation-${id}`;
        current.availableBalance = refundableAmount;
      } else {
        current.pendingOperationId = null;
        current.availableBalance = 0;
      }
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          ...current,
          status: "CANCELLED",
        },
      }),
    });
  });

  await page.route(/\/api\/v1\/deposits\/([^/]+)\/cancel$/, async (route: any) => {
    cancelPayload = route.request().postDataJSON?.() || {};
    cancelIdempotencyKey = route.request().headers()['idempotency-key'];
    const match = route.request().url().match(/\/api\/v1\/deposits\/([^/]+)\/cancel$/);
    const id = match ? match[1] : undefined;
    const current = deposits.find((deposit) => deposit.id === id);
    if (current) {
      current.status = "CANCELLED";
      current.note = cancelPayload.reason || current.note;
      current.updatedAt = "2026-08-12T08:00:00.000Z";
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: current }),
    });
  });

  await page.route(/\/api\/v1\/deposits\/operations\/([^/]+)\/refund\/complete$/, async (route: any) => {
    completePendingRefundPayload = route.request().postDataJSON?.() || {};
    completePendingRefundIdempotencyKey = route.request().headers()['idempotency-key'];
    const match = route.request().url().match(/\/api\/v1\/deposits\/operations\/([^/]+)\/refund\/complete$/);
    completePendingRefundOperationId = match ? match[1] : undefined;
    const current = deposits.find(
      (deposit) => deposit.pendingOperationId === completePendingRefundOperationId,
    );

    if (!current) {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ message: "Operation not found" }) });
      return;
    }

    if (current?.refundSummary) {
      current.refundSummary = {
        ...current.refundSummary,
        receiptStatus: "COMPLETED",
        taskStatus: "DONE",
        pending: false,
        completed: true,
      };
      current.pendingOperationId = null;
      current.availableBalance = 0;
      current.updatedAt = "2026-08-12T09:00:00.000Z";
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          success: true,
          receiptId: current?.refundSummary?.receiptId || "receipt-1",
          taskId: current?.refundSummary?.taskId || "task-1",
          amount: current?.refundSummary?.receiptAmount || 0,
        },
      }),
    });
  });

  await page.route(/\/api\/v1\/deposits\/([^/?]+)$/, async (route: any) => {
    const match = route.request().url().match(/\/api\/v1\/deposits\/([^/?]+)$/);
    const id = match ? match[1] : undefined;
    const current = deposits.find((deposit) => deposit.id === id);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: current,
      }),
    });
  });

  return {
    getCancelPayload: () => cancelPayload,
    getCancelIdempotencyKey: () => cancelIdempotencyKey,
    getCompletePendingRefundPayload: () => completePendingRefundPayload,
    getCompletePendingRefundOperationId: () => completePendingRefundOperationId,
    getCompletePendingRefundIdempotencyKey: () => completePendingRefundIdempotencyKey,
    getRefundPayload: () => refundPayload,
    getRefundIdempotencyKey: () => refundIdempotencyKey,
  };
}

test.describe("Deposits Refund Desktop Regression", () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), "Desktop-only regression");
  });

  test("opens pending refund item from refund center", async ({ admin }) => {
    await mockDeposits(admin.page);

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });

    await expect(admin.page.getByTestId("deposits-refund-center")).toBeVisible();
    await admin.page.getByTestId("deposits-refund-center-expand").click();
    await expect(admin.page.getByTestId("refund-center-item-dep-cancelled")).toBeVisible();

    await admin.page.getByTestId("refund-center-item-dep-cancelled").click();

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();
    await expect(admin.page.getByText("RC-001")).toBeVisible();
    await expect(admin.page.getByText("Hoàn một phần tiền cọc")).toBeVisible();
  });

  test("cancels paid deposit with deduct flow payload", async ({ admin }) => {
    const mock = await mockDeposits(admin.page);

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });

    await admin.page.getByTestId("deposits-refund-center-expand").click();
    await admin.page.locator("[data-testid='deposit-card']:visible").filter({ hasText: "DEP-PAID" }).first().click({
      position: { x: 10, y: 10 },
    });

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();

    await admin.page.getByTestId("deposit-action-cancel").click();
    await expect(admin.page.getByTestId("deposit-cancel-modal")).toBeVisible();
    await admin.page.getByTestId("deposit-cancel-reason").fill("Khách đổi kế hoạch");
    await admin.page.getByTestId("deposit-cancel-keep-amount").fill("7500000");
    await admin.page.getByTestId("deposit-cancel-deduct-amount").fill("2500000");
    await admin.page.getByTestId("deposit-cancel-submit").click();

    await expect
      .poll(() => mock.getCancelPayload(), { timeout: 10000 })
      .toMatchObject({
        reason: "Khách đổi kế hoạch",
        refundAmount: 0,
        keepAmount: 7500000,
        deductAmount: 2500000,
      });
    expect(mock.getCancelIdempotencyKey()).toMatch(/^cancel-/);
  });

  test("cancels paid deposit with keep flow payload", async ({ admin }) => {
    const mock = await mockDeposits(admin.page);

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });

    await admin.page.getByTestId("deposits-refund-center-expand").click();
    await admin.page.locator("[data-testid='deposit-card']:visible").filter({ hasText: "DEP-PAID" }).first().click({
      position: { x: 10, y: 10 },
    });

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();

    await admin.page.getByTestId("deposit-action-cancel").click();
    await expect(admin.page.getByTestId("deposit-cancel-modal")).toBeVisible();
    await admin.page.getByTestId("deposit-cancel-reason").fill("Giữ cọc theo chính sách");
    await admin.page.getByTestId("deposit-cancel-submit").click();

    await expect
      .poll(() => mock.getCancelPayload(), { timeout: 10000 })
      .toMatchObject({
        reason: "Giữ cọc theo chính sách",
        refundAmount: 0,
        keepAmount: 10000000,
        deductAmount: 0,
      });
  });

  test("tracks the pending refund remainder after keeping part of a paid deposit", async ({ admin }) => {
    const mock = await mockDeposits(admin.page);

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });
    await admin.page.locator("[data-testid='deposit-card']:visible").filter({ hasText: "DEP-PAID" }).first().click({
      position: { x: 10, y: 10 },
    });

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();

    await admin.page.getByTestId("deposit-action-cancel").click();
    await expect(admin.page.getByTestId("deposit-cancel-modal")).toBeVisible();
    await admin.page.getByTestId("deposit-cancel-reason").fill("Giữ một phần theo chính sách");
    await admin.page.getByTestId("deposit-cancel-refund-amount").fill("6000000");
    await admin.page.getByTestId("deposit-cancel-keep-amount").fill("4000000");
    await admin.page.getByTestId("deposit-cancel-refund-status").selectOption("PENDING");
    await admin.page.getByTestId("deposit-cancel-submit").click();

    await expect
      .poll(() => mock.getCancelPayload(), { timeout: 10000 })
      .toMatchObject({
        reason: "Giữ một phần theo chính sách",
        refundAmount: 6000000,
        keepAmount: 4000000,
        deductAmount: 0,
        refundStatus: "PENDING",
      });

    await expect(admin.page.getByTestId("refund-center-item-dep-paid")).toBeVisible();
    await admin.page.getByTestId("deposit-detail-close").click();
    await expect(admin.page.getByTestId("deposit-detail-drawer")).not.toBeVisible();
    await admin.page.getByTestId("refund-center-item-dep-paid").click();

    const drawer = admin.page.getByTestId("deposit-detail-drawer");
    await expect(drawer.getByText("RC-DEP-PAID")).toBeVisible();
    await expect(drawer.getByText("6.000.000đ")).toBeVisible();
    await expect(admin.page.getByTestId("deposit-action-complete-refund")).toBeVisible();

    await admin.page.getByTestId("deposit-action-complete-refund").click();
    await expect(admin.page.getByTestId("deposit-complete-refund-modal")).toBeVisible();
    await admin.page.getByTestId("deposit-complete-refund-note").fill("Đã chuyển khoản hoàn dư cọc");
    await admin.page.getByTestId("deposit-complete-refund-submit").click();

    await expect
      .poll(() => mock.getCompletePendingRefundPayload(), { timeout: 10000 })
      .toMatchObject({ note: "Đã chuyển khoản hoàn dư cọc" });
    expect(mock.getCompletePendingRefundOperationId()).toBe("operation-dep-paid");
    expect(mock.getCompletePendingRefundIdempotencyKey()).toMatch(/^complete-refund-/);
    await expect(admin.page.getByTestId("deposit-action-complete-refund")).not.toBeVisible();
  });

  test("completes a pending refund from refund center", async ({ admin }) => {
    const mock = await mockDeposits(admin.page);

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });

    await admin.page.getByTestId("deposits-refund-center-expand").click();
    await admin.page.getByTestId("refund-center-item-dep-cancelled").click();

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();
    await expect(admin.page.getByTestId("deposit-action-complete-refund")).toBeVisible();

    await admin.page.getByTestId("deposit-action-complete-refund").click();
    await expect(admin.page.getByTestId("deposit-complete-refund-modal")).toBeVisible();
    await admin.page.getByTestId("deposit-complete-refund-note").fill("Đã chuyển khoản hoàn cọc");
    await admin.page.getByTestId("deposit-complete-refund-submit").click();

    await expect
      .poll(() => mock.getCompletePendingRefundPayload(), { timeout: 10000 })
      .toMatchObject({
        note: "Đã chuyển khoản hoàn cọc",
      });
    expect(mock.getCompletePendingRefundOperationId()).toBe("operation-refund-pending-1");
    expect(mock.getCompletePendingRefundIdempotencyKey()).toMatch(/^complete-refund-/);
  });

  test("refunds a paid deposit immediately with explicit amount", async ({ admin }) => {
    const mock = await mockDeposits(admin.page);

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });

    await admin.page.locator("[data-testid='deposit-card']:visible").filter({ hasText: "DEP-PAID" }).first().click({
      position: { x: 10, y: 10 },
    });

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();

    await admin.page.getByTestId("deposit-action-refund").click();
    await expect(admin.page.getByTestId("deposit-refund-modal")).toBeVisible();
    await admin.page.getByTestId("deposit-refund-reason").fill("Hoàn cọc theo thỏa thuận");
    await admin.page.getByTestId("deposit-refund-amount").fill("3200000");
    await admin.page.getByTestId("deposit-refund-status").selectOption("COMPLETED");
    await admin.page.getByTestId("deposit-refund-submit").click();

    await expect
      .poll(() => mock.getRefundPayload(), { timeout: 10000 })
      .toMatchObject({
        reason: "Hoàn cọc theo thỏa thuận",
        receiptStatus: "COMPLETED",
        refundAmount: 3200000,
      });
    expect(mock.getRefundIdempotencyKey()).toMatch(/^refund-/);
  });

  test("cancels an unpaid deposit without paid-resolution payload", async ({ admin }) => {
    const mock = await mockDeposits(admin.page);

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });

    await admin.page.locator("[data-testid='deposit-card']:visible").filter({ hasText: "DEP-PENDING" }).first().click({
      position: { x: 10, y: 10 },
    });

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();

    await admin.page.getByTestId("deposit-action-cancel").click();
    await expect(admin.page.getByTestId("deposit-cancel-modal")).toBeVisible();
    await admin.page.getByTestId("deposit-cancel-reason").fill("Khách không chuyển cọc đúng hạn");
    await admin.page.getByTestId("deposit-cancel-submit").click();

    await expect
      .poll(() => mock.getCancelPayload(), { timeout: 10000 })
      .toMatchObject({
        reason: "Khách không chuyển cọc đúng hạn",
      });

    await expect
      .poll(() => mock.getCancelPayload(), { timeout: 10000 })
      .not.toMatchObject({
        refundAmount: expect.anything(),
      });
    expect(mock.getCancelIdempotencyKey()).toMatch(/^cancel-/);
  });
});
