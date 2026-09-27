import { expect } from "@playwright/test";
import { test } from "../../fixtures/admin.fixture";

const sourceContract = {
  id: "contract-renew-source",
  code: "HD-RENEW-001",
  status: "EXPIRING",
  startDate: "2025-10-01T00:00:00.000Z",
  endDate: "2026-09-30T00:00:00.000Z",
  monthlyRent: 2_000_000,
  depositMoney: 2_000_000,
  memberCount: 2,
  customer: {
    id: "customer-renew-source",
    fullName: "Khach gia han E2E",
    phone: "0901000001",
  },
  room: {
    id: "room-renew-source",
    code: "R-RENEW-01",
    status: "OCCUPIED",
    building: { id: "building-renew-source", name: "Toa E2E" },
  },
  attachments: [],
  coRepresentatives: [],
};

test.describe("Contract renewal", () => {
  test("creates a draft successor from the contract drawer with one idempotency key", async ({ admin }) => {
    const renewalRequests: Array<{ body: any; idempotencyKey: string | null }> = [];

    await admin.page.route("**/api/v1/contracts**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;

      if (request.method() === "POST" && path.endsWith("/renew")) {
        renewalRequests.push({
          body: request.postDataJSON(),
          idempotencyKey: request.headers()["idempotency-key"] || null,
        });
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              ...sourceContract,
              id: "contract-renew-successor",
              code: "RN-RENEW-001",
              status: "DRAFT",
              startDate: "2026-10-01T00:00:00.000Z",
              endDate: "2027-09-30T00:00:00.000Z",
            },
          }),
        });
        return;
      }

      if (request.method() === "GET" && path.endsWith("/contracts")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: { items: [sourceContract], total: 1 } }),
        });
        return;
      }

      if (request.method() === "GET" && path.endsWith(`/${sourceContract.id}`)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: sourceContract }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [] }),
      });
    });

    await admin.page.goto("/contracts");
    const contractCard = admin.page
      .locator('[data-testid="contract-card"]:visible')
      .filter({ hasText: "Khach gia han E2E" })
      .first();
    await expect(contractCard).toBeVisible();
    await contractCard.click();

    const drawer = admin.page.getByTestId("contract-detail-drawer");
    await expect(drawer).toBeVisible();
    await drawer.getByTestId("btn-renew-contract").click();

    const modal = admin.page.getByTestId("contract-renewal-modal");
    await expect(modal).toBeVisible();
    await modal.getByTestId("contract-renewal-rent").fill("2500000");
    await modal.getByTestId("contract-renewal-member-count").fill("3");
    await modal.getByTestId("contract-renewal-submit").click();

    await expect.poll(() => renewalRequests.length).toBe(1);
    const [renewal] = renewalRequests;
    expect(renewal.idempotencyKey).toMatch(/^contract-renew-/);
    expect(renewal.body).toMatchObject({
      startDate: "2026-10-01",
      endDate: "2027-10-01",
      rentAmount: 2_500_000,
      depositAmount: 2_000_000,
      memberCount: 3,
      firstPaymentDate: "2026-10-01",
      idempotencyKey: renewal.idempotencyKey,
    });
    await expect(modal).not.toBeVisible();
    await expect(admin.page.getByText("Đã tạo hợp đồng gia hạn ở trạng thái nháp")).toBeVisible();
  });
});
