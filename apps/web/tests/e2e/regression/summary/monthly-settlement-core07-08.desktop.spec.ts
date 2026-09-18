import { expect, type Page } from "@playwright/test";
import { test } from "../../fixtures/admin.fixture";

const PERIOD = "2026-09";
const USAGE_PERIOD = "2026-08";
const LOCKED_ROOM_ID = "room-locked-zero";
const UNLOCKED_ROOM_ID = "room-unlocked-live";

function settlementItem(overrides: Record<string, unknown>) {
  return {
    roomId: "room-default",
    roomCode: "P.101",
    roomName: "Phòng 101",
    buildingId: "building-a",
    buildingCode: "TOA-A",
    buildingName: "Tòa A",
    floorName: "Tầng 1",
    floorLevel: 1,
    roomRentalType: "WHOLE",
    roomCapacity: 2,
    contractId: "contract-default",
    contractCode: "HD-DEFAULT",
    contractStatus: "ACTIVE",
    hasContract: true,
    representative: {
      id: "customer-default",
      fullName: "Nguyễn Đại Diện",
      phone: "0900000000",
      hasZalo: true,
    },
    membersCount: 1,
    members: [
      {
        id: "customer-default",
        fullName: "Nguyễn Đại Diện",
        phone: "0900000000",
        role: "TENANT",
        isRepresentative: true,
        relationship: "Đại diện",
        hasZalo: true,
      },
    ],
    period: PERIOD,
    usagePeriod: USAGE_PERIOD,
    invoiceId: "invoice-default",
    invoiceCode: "HD-DEFAULT",
    roomPrice: 0,
    electricityKwh: 0,
    electricityAmount: 0,
    meterReading: {
      oldReading: 100,
      newReading: 100,
      powerW: 0,
      isOnline: true,
      rateMode: "custom",
      customRateVnd: 4000,
      rateModeLabel: "Giá tùy chỉnh",
    },
    waterAmount: 0,
    serviceAmount: 0,
    totalAmount: 0,
    notificationStatus: "PENDING",
    notificationSentAt: null,
    notificationError: null,
    paymentStatus: "UNPAID",
    paidAmount: 0,
    ...overrides,
  };
}

const overview = {
  period: PERIOD,
  usagePeriod: USAGE_PERIOD,
  buildings: [{ id: "building-a", code: "TOA-A", name: "Tòa A" }],
  settings: {
    autoCloseEnabled: false,
    closingDay: "LAST_DAY",
    autoSendNotification: false,
    notificationHour: 9,
    notificationMinute: 0,
    notificationDay: 1,
    notificationChannel: "ZALO",
  },
  stats: {
    totalRooms: 2,
    occupiedRooms: 2,
    totalAmount: 44000,
    sentZaloCount: 0,
    pendingCount: 2,
    failedCount: 0,
    paidCount: 0,
    totalPaidAmount: 0,
    collectionRate: 0,
  },
  items: [
    settlementItem({
      roomId: LOCKED_ROOM_ID,
      roomCode: "L-101",
      contractId: "contract-locked-zero",
      contractCode: "HD-LOCKED-0",
      invoiceId: "invoice-locked-zero",
      invoiceCode: "HD-LOCKED-0",
      billingDataSource: "LOCKED_SNAPSHOT",
      billingSnapshotId: "snapshot-locked-zero-2026-08",
      electricityReconciliation: {
        currentKwh: 15.5,
        currentAmount: 62000,
        deltaKwh: 15.5,
        deltaAmount: 62000,
        status: "MISMATCHED",
      },
    }),
    settlementItem({
      roomId: UNLOCKED_ROOM_ID,
      roomCode: "U-102",
      contractId: "contract-unlocked",
      contractCode: "HD-UNLOCKED",
      invoiceId: "invoice-unlocked",
      invoiceCode: "HD-UNLOCKED",
      billingDataSource: "LIVE_MAPPING",
      electricityKwh: 11,
      electricityAmount: 44000,
      totalAmount: 44000,
      electricityReconciliation: {
        currentKwh: 11,
        currentAmount: 44000,
        deltaKwh: 0,
        deltaAmount: 0,
        status: "MATCHED",
      },
    }),
  ],
};

function json(data: unknown) {
  return {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ success: true, data }),
  };
}

async function mockSummaryDependencies(page: Page) {
  await page.route("**/api/v1/monthly-settlement/overview**", (route) =>
    route.fulfill(json(overview)),
  );
  await page.route("**/api/v1/monthly-settlement/settings**", (route) =>
    route.fulfill(json(overview.settings)),
  );
  await page.route("**/api/v1/settings/access-control**", (route) =>
    route.fulfill(
      json({
        key: "access-control",
        scope: "TENANT",
        value: { maintenanceEnabled: false },
      }),
    ),
  );
  await page.route("**/api/v1/notifications/unread-count", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ count: 0 }),
    }),
  );
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    }),
  );
}

test.describe("CORE-07.08 monthly settlement snapshot desktop", () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), "Desktop-only regression");
    await mockSummaryDependencies(admin.page);
  });

  test("renders locked and unlocked provenance without allowing a billing overwrite", async ({ admin }) => {
    const page = admin.page;
    await page.goto("/summary", { waitUntil: "domcontentloaded" });

    const lockedProvenance = page.getByTestId(`settlement-provenance-${LOCKED_ROOM_ID}`);
    const unlockedProvenance = page.getByTestId(`settlement-provenance-${UNLOCKED_ROOM_ID}`);
    const lockedMismatch = page.getByTestId(`settlement-electricity-mismatch-${LOCKED_ROOM_ID}`);

    await expect(lockedProvenance).toHaveText("Snapshot đã khóa");
    await expect(unlockedProvenance).toHaveText("Dữ liệu chưa khóa");
    await expect(lockedProvenance.locator("xpath=ancestor::tr")).toContainText("0 đ");
    await expect(lockedMismatch).toHaveAttribute("role", "alert");
    await expect(lockedMismatch).toHaveClass(/text-red-700/);
    await expect(lockedMismatch).toContainText("15,5 kWh");
    await expect(lockedMismatch).toContainText("62.000 đ");

    await lockedProvenance.click();
    await page.getByRole("button", { name: "Bóc tách tiền phòng & điện nước" }).click();

    const lockedNotice = page.getByTestId("settlement-invoice-snapshot-notice");
    await expect(lockedNotice).toContainText("Hóa đơn giữ nguyên snapshot đã chốt");
    await expect(lockedNotice).toContainText("không ghi đè hóa đơn");
    await expect(page.getByTestId("settlement-invoice-snapshot-trace")).toContainText(
      "snapshot-locked-zero-2026-08 · kỳ 2026-08",
    );
    await expect(page.getByTestId(`settlement-detail-electricity-mismatch-${LOCKED_ROOM_ID}`)).toContainText(
      "15,5 kWh · 62.000 đ",
    );
    await expect(
      page.getByRole("button", { name: /ghi đè|điều chỉnh.*hóa đơn|cập nhật.*hóa đơn/i }),
    ).toHaveCount(0);

    await page.getByTestId("settlement-detail-close").click();
    await unlockedProvenance.click();
    await page.getByRole("button", { name: "Bóc tách tiền phòng & điện nước" }).click();

    await expect(page.getByTestId("settlement-invoice-snapshot-notice")).toContainText(
      "Dữ liệu chưa khóa, chỉ tạm tính; cần chốt",
    );
    await expect(page.getByTestId("settlement-invoice-snapshot-trace")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /ghi đè|điều chỉnh.*hóa đơn|cập nhật.*hóa đơn/i }),
    ).toHaveCount(0);
  });
});
