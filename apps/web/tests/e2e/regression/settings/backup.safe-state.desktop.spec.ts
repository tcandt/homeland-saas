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
    await expect(safeState).toContainText("Chưa kết nối backend");
    await expect(safeState).toContainText("Chưa có dữ liệu từ máy chủ");

    const disabledActions = safeState.getByTestId("backup-disabled-action");
    await expect(disabledActions).toHaveCount(4);
    for (let index = 0; index < 4; index += 1) {
      await expect(disabledActions.nth(index)).toBeDisabled();
    }

    await expect(safeState.getByTestId("backup-schedule-disabled")).toBeDisabled();
    await expect(safeState).not.toContainText("homeland_db_auto_20260811_020000.sql.gz");
    await expect(safeState).not.toContainText("homeland-backups-prod");
    await expect(safeState).not.toContainText("1.24 GB / 5 GB");
    await expect(safeState).not.toContainText("Đã hoàn tất sao lưu dữ liệu thủ công");
    await expect(safeState).not.toContainText("Đã khôi phục hệ thống thành công");
  });
});
