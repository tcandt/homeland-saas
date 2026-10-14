import { expect } from "@playwright/test";
import { test } from "../../fixtures/admin.fixture";

test.describe("Backup Safe State Desktop Regression", () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), "Desktop-only regression");
    await admin.page.goto("/settings?section=backup", { waitUntil: "domcontentloaded" });
  });

  test("shows only backend-backed backup status and locks unavailable actions", async ({ admin }) => {
    const safeState = admin.page.getByTestId("settings-backup-safe-state");

    await expect(safeState).toBeVisible();
    await expect(safeState.getByRole("button", { name: "Tạo bản sao lưu" })).toBeVisible();
    await expect(safeState.getByRole("button", { name: "Làm mới dữ liệu" })).toBeVisible();
    await expect(safeState.getByRole("button", { name: "Tải bản lưu mới nhất" })).toBeVisible();
    await expect(safeState.getByRole("button", { name: "Khôi phục dữ liệu" })).toBeDisabled();
    await expect(safeState.getByRole("switch")).toBeVisible();
    await expect(safeState).not.toContainText("homeland_db_auto_20260811_020000.sql.gz");
    await expect(safeState).not.toContainText("homeland-backups-prod");
    await expect(safeState).not.toContainText("1.24 GB / 5 GB");
    await expect(safeState).not.toContainText("Đã hoàn tất sao lưu dữ liệu thủ công");
    await expect(safeState).not.toContainText("Đã khôi phục hệ thống thành công");
  });
});
