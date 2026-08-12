import { expect } from "@playwright/test";
import { test } from "../../fixtures/admin.fixture";

test.describe("Maintenance Safe State Desktop Regression", () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), "Desktop-only regression");
  });

  test("labels the standalone maintenance screen as preview without simulated status", async ({ admin }) => {
    await admin.page.goto("/maintenance", { waitUntil: "domcontentloaded" });

    const preview = admin.page.getByTestId("maintenance-screen-preview");
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("BẢN XEM TRƯỚC");
    await expect(preview).toContainText("Chế độ bảo trìChưa kích hoạt");
    await expect(preview).not.toContainText("85% Hoàn tất");
    await expect(preview).not.toContainText("30 - 60");
    await expect(preview).not.toContainText("Sao lưu dữ liệu an toàn");
    await expect(preview).not.toContainText("Nhận thông báo khi hệ thống mở lại");
  });

  test("locks registration and maintenance controls without saving access-control settings", async ({ admin }) => {
    let patchCount = 0;
    await admin.page.route("**/api/v1/settings/access-control*", async (route) => {
      if (route.request().method() === "PATCH") patchCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { key: "access-control", scope: "TENANT", value: {} } }),
      });
    });

    await admin.page.goto("/settings?section=license", { waitUntil: "domcontentloaded" });

    await expect(admin.page.getByTestId("registration-control-disabled")).toBeDisabled();
    await expect(admin.page.getByTestId("maintenance-control-disabled")).toBeDisabled();
    await expect(admin.page.getByTestId("settings-license-root")).toContainText("Kiểm soát truy cập chưa được kết nối");
    expect(patchCount).toBe(0);
  });

  test("opens the preview modal and switches between light and dark samples", async ({ admin }) => {
    await admin.page.goto("/settings?section=license", { waitUntil: "domcontentloaded" });
    await admin.page.getByTestId("maintenance-preview-open").click();

    const modal = admin.page.getByTestId("maintenance-preview-modal");
    const preview = modal.getByTestId("maintenance-screen-preview");
    await expect(modal).toBeVisible();
    await expect(preview).toHaveAttribute("data-theme", "dark");

    await admin.page.getByTestId("maintenance-modal-theme-light").click();
    await expect(preview).toHaveAttribute("data-theme", "light");

    await admin.page.getByTestId("maintenance-modal-theme-dark").click();
    await expect(preview).toHaveAttribute("data-theme", "dark");
  });
});
