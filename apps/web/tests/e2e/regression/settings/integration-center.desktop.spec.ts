import { expect } from "@playwright/test";
import { test } from "../../fixtures/admin.fixture";

async function mockIntegrationSettings(page: any) {
  const values: Record<string, Record<string, unknown>> = {
    sepay: { enabled: true, paymentCodePrefix: "HL" },
    "zalo-provider": { enabled: true, baseUrl: "https://homeland.ductinh.one" },
    "email-provider": { enabled: false, smtpHost: "smtp.example.test", smtpPort: 587 },
    "telegram-provider": { enabled: true, defaultChatId: "-1001" },
    hunonic: { enabled: true, mode: "mobile" },
  };

  await page.route("**/api/v1/settings/*", async (route: any) => {
    const url = new URL(route.request().url());
    const key = url.pathname.split("/settings/")[1] || "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          key,
          scope: "TENANT",
          value: values[key] || {},
          updatedAt: "2026-08-13T03:00:00.000Z",
        },
      }),
    });
  });
}

test.describe("Integration Center Desktop Regression", () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), "Desktop-only regression");
    await mockIntegrationSettings(admin.page);
    await admin.page.goto("/settings?section=integrations", { waitUntil: "domcontentloaded" });
  });

  test("filters real integration panels by category and search", async ({ admin }) => {
    const center = admin.page.getByTestId("settings-integration-center");

    await expect(center).toContainText("Trung tâm tích hợp");
    await expect(center).toContainText("Đã lưu cấu hình5/5");
    await expect(center).toContainText("Đang bật trong cấu hình4/5");
    await expect(center).not.toContainText("Integration Center");
    await expect(center).not.toContainText("Configured");

    await center.getByRole("tab", { name: "Thanh toán" }).click();
    await expect(center.getByText("Tích hợp thanh toán SePay", { exact: true })).toBeVisible();
    await expect(center.getByText("Cấu hình gửi Zalo", { exact: true })).toHaveCount(0);
    await expect(center.getByText("Điện Hunonic", { exact: true })).toHaveCount(0);

    await center.getByRole("tab", { name: "Tin nhắn" }).click();
    await expect(center.getByText("Cấu hình gửi Zalo", { exact: true })).toBeVisible();
    await expect(center.getByText("Cấu hình gửi Email", { exact: true })).toBeVisible();
    await expect(center.getByText("Cấu hình Telegram", { exact: true })).toBeVisible();
    await expect(center.getByText("Tích hợp thanh toán SePay", { exact: true })).toHaveCount(0);

    await center.getByRole("tab", { name: "Tất cả" }).click();
    await center.getByLabel("Tìm tích hợp").fill("telegram");
    await expect(center.getByText("Cấu hình Telegram", { exact: true })).toBeVisible();
    await expect(center.getByText("Cấu hình gửi Email", { exact: true })).toHaveCount(0);

    await center.getByLabel("Tìm tích hợp").fill("không tồn tại");
    await expect(center.getByTestId("integration-filter-empty")).toBeVisible();
  });
});
