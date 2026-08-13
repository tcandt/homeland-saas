import { expect } from "@playwright/test";
import { test } from "../../fixtures/admin.fixture";

type DepositItem = {
  id: string;
  code: string;
  type: string;
  status: string;
  amount: number;
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
  return {
    id: overrides.id || "dep-1",
    code: overrides.code || "DEP-001",
    type: overrides.type || "SECURITY",
    status: overrides.status || "PENDING",
    amount: overrides.amount ?? 5000000,
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
  let completePendingRefundPayload: any = null;
  let refundPayload: any = null;

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
    }),
  ];

  await page.route("**/api/v1/deposits*", async (route: any) => {
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

  await page.route("**/api/v1/deposits/*/refund", async (route: any) => {
    refundPayload = route.request().postDataJSON?.() || {};
    const id = route.request().url().split("/").slice(-2)[0];
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

  await page.route("**/api/v1/deposits/*/cancel", async (route: any) => {
    cancelPayload = route.request().postDataJSON?.() || {};
    const id = route.request().url().split("/").slice(-2)[0];
    const current = deposits.find((deposit) => deposit.id === id);

    if (current) {
      const resolutionAmount = Number(cancelPayload.resolutionAmount || 0);
      const refundableAmount =
        cancelPayload.resolutionAction === "REFUND"
          ? resolutionAmount
          : Math.max(Number(current.amount || 0) - resolutionAmount, 0);

      current.status = "CANCELLED";
      current.note = cancelPayload.reason || current.note;
      current.updatedAt = "2026-08-12T08:00:00.000Z";
      current.refundSummary =
        refundableAmount > 0
          ? {
              receiptId: `receipt-${id}`,
              receiptCode: `RC-${current.code}`,
              receiptStatus: cancelPayload.receiptStatus || "PENDING",
              receiptAmount: refundableAmount,
              receiptDescription: `Hoàn phần dư cọc ${current.code}`,
              taskId: `task-${id}`,
              taskTitle: `Hoàn cọc ${current.code}`,
              taskStatus: cancelPayload.receiptStatus === "COMPLETED" ? "DONE" : "IN_PROGRESS",
              pending: cancelPayload.receiptStatus !== "COMPLETED",
              completed: cancelPayload.receiptStatus === "COMPLETED",
            }
          : null;
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

  await page.route("**/api/v1/deposits/*/refund/complete", async (route: any) => {
    completePendingRefundPayload = route.request().postDataJSON?.() || {};
    const id = route.request().url().split("/").slice(-3)[0];
    const current = deposits.find((deposit) => deposit.id === id);

    if (current?.refundSummary) {
      current.refundSummary = {
        ...current.refundSummary,
        receiptStatus: "COMPLETED",
        taskStatus: "DONE",
        pending: false,
        completed: true,
      };
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

  await page.route("**/api/v1/deposits/*", async (route: any) => {
    const id = route.request().url().split("/").pop();
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
    getCompletePendingRefundPayload: () => completePendingRefundPayload,
    getRefundPayload: () => refundPayload,
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
    await expect(admin.page.getByTestId("refund-center-item-dep-cancelled")).toBeVisible();

    await admin.page.getByTestId("refund-center-item-dep-cancelled").click();

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();
    await expect(admin.page.getByText("RC-001")).toBeVisible();
    await expect(admin.page.getByText("Hoàn một phần tiền cọc")).toBeVisible();
  });

  test("cancels paid deposit with deduct flow payload", async ({ admin }) => {
    const mock = await mockDeposits(admin.page);

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });

    await admin.page.locator("[data-testid='deposit-card']:visible").filter({ hasText: "DEP-PAID" }).first().click({
      position: { x: 10, y: 10 },
    });

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();

    await admin.page.evaluate(() => {
      const promptQueue = ["Khách đổi kế hoạch", "DEDUCT", "2500000"];
      const confirmQueue = [false];

      window.prompt = () => promptQueue.shift() ?? null;
      window.confirm = () => confirmQueue.shift() ?? true;
      window.alert = () => undefined;
    });

    await admin.page.getByTestId("deposit-action-cancel").click();

    await expect
      .poll(() => mock.getCancelPayload(), { timeout: 10000 })
      .toMatchObject({
        reason: "Khách đổi kế hoạch",
        resolutionAction: "DEDUCT",
        resolutionAmount: 2500000,
        receiptStatus: "PENDING",
      });
  });

  test("cancels paid deposit with keep flow payload", async ({ admin }) => {
    const mock = await mockDeposits(admin.page);

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });

    await admin.page.locator("[data-testid='deposit-card']:visible").filter({ hasText: "DEP-PAID" }).first().click({
      position: { x: 10, y: 10 },
    });

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();

    await admin.page.evaluate(() => {
      const promptQueue = ["Giu coc theo chinh sach", "KEEP", "4000000"];
      window.prompt = () => promptQueue.shift() ?? null;
      window.confirm = () => true;
      window.alert = () => undefined;
    });

    await admin.page.getByTestId("deposit-action-cancel").click();

    await expect
      .poll(() => mock.getCancelPayload(), { timeout: 10000 })
      .toMatchObject({
        reason: "Giu coc theo chinh sach",
        resolutionAction: "KEEP",
        resolutionAmount: 4000000,
        receiptStatus: "COMPLETED",
      });
  });

  test("tracks the pending refund remainder after keeping part of a paid deposit", async ({ admin }) => {
    const mock = await mockDeposits(admin.page);

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });
    await admin.page.locator("[data-testid='deposit-card']:visible").filter({ hasText: "DEP-PAID" }).first().click({
      position: { x: 10, y: 10 },
    });

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();

    await admin.page.evaluate(() => {
      const promptQueue = ["Giữ một phần theo chính sách", "KEEP", "4000000"];
      window.prompt = () => promptQueue.shift() ?? null;
      window.confirm = () => false;
      window.alert = () => undefined;
    });

    await admin.page.getByTestId("deposit-action-cancel").click();

    await expect
      .poll(() => mock.getCancelPayload(), { timeout: 10000 })
      .toMatchObject({
        reason: "Giữ một phần theo chính sách",
        resolutionAction: "KEEP",
        resolutionAmount: 4000000,
        receiptStatus: "PENDING",
      });

    await expect(admin.page.getByTestId("refund-center-item-dep-paid")).toBeVisible();
    await admin.page.getByTestId("deposit-detail-close").click();
    await expect(admin.page.getByTestId("deposit-detail-drawer")).not.toBeVisible();
    await admin.page.getByTestId("refund-center-item-dep-paid").click();

    const drawer = admin.page.getByTestId("deposit-detail-drawer");
    await expect(drawer.getByText("RC-DEP-PAID")).toBeVisible();
    await expect(drawer.getByText("6.000.000đ")).toBeVisible();
    await expect(drawer.getByTestId("deposit-action-complete-refund")).toBeVisible();

    await admin.page.evaluate(() => {
      window.prompt = () => "Đã chuyển khoản hoàn dư cọc";
      window.confirm = () => true;
    });
    await drawer.getByTestId("deposit-action-complete-refund").click();

    await expect
      .poll(() => mock.getCompletePendingRefundPayload(), { timeout: 10000 })
      .toMatchObject({ note: "Đã chuyển khoản hoàn dư cọc" });
    await expect(drawer.getByTestId("deposit-action-complete-refund")).not.toBeVisible();
  });

  test("completes a pending refund from refund center", async ({ admin }) => {
    const mock = await mockDeposits(admin.page);

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });

    await admin.page.getByTestId("refund-center-item-dep-cancelled").click();

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();
    await expect(admin.page.getByTestId("deposit-action-complete-refund")).toBeVisible();

    await admin.page.evaluate(() => {
      const promptQueue = ["Da chuyen khoan hoan coc"];
      window.prompt = () => promptQueue.shift() ?? null;
      window.confirm = () => true;
      window.alert = () => undefined;
    });

    await admin.page.getByTestId("deposit-action-complete-refund").click();

    await expect
      .poll(() => mock.getCompletePendingRefundPayload(), { timeout: 10000 })
      .toMatchObject({
        note: "Da chuyen khoan hoan coc",
      });
  });

  test("refunds a paid deposit immediately with explicit amount", async ({ admin }) => {
    const mock = await mockDeposits(admin.page);

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });

    await admin.page.locator("[data-testid='deposit-card']:visible").filter({ hasText: "DEP-PAID" }).first().click({
      position: { x: 10, y: 10 },
    });

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();

    await admin.page.evaluate(() => {
      const promptQueue = ["Hoan coc theo thoa thuan", "3200000"];
      window.prompt = () => promptQueue.shift() ?? null;
      window.confirm = () => true;
      window.alert = () => undefined;
    });

    await admin.page.getByTestId("deposit-action-refund").click();

    await expect
      .poll(() => mock.getRefundPayload(), { timeout: 10000 })
      .toMatchObject({
        reason: "Hoan coc theo thoa thuan",
        receiptStatus: "COMPLETED",
        refundAmount: 3200000,
      });
  });

  test("cancels an unpaid deposit without paid-resolution payload", async ({ admin }) => {
    const mock = await mockDeposits(admin.page);

    await admin.page.goto("/deposits", { waitUntil: "domcontentloaded" });

    await admin.page.locator("[data-testid='deposit-card']:visible").filter({ hasText: "DEP-PENDING" }).first().click({
      position: { x: 10, y: 10 },
    });

    await expect(admin.page.getByTestId("deposit-detail-drawer")).toBeVisible();

    await admin.page.evaluate(() => {
      const promptQueue = ["Khach khong chuyen coc dung han"];
      window.prompt = () => promptQueue.shift() ?? null;
      window.confirm = () => true;
      window.alert = () => undefined;
    });

    await admin.page.getByTestId("deposit-action-cancel").click();

    await expect
      .poll(() => mock.getCancelPayload(), { timeout: 10000 })
      .toMatchObject({
        reason: "Khach khong chuyen coc dung han",
      });

    await expect
      .poll(() => mock.getCancelPayload(), { timeout: 10000 })
      .not.toMatchObject({
        resolutionAction: expect.anything(),
      });
  });
});
