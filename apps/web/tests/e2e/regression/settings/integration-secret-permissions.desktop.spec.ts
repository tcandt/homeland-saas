import { expect } from "@playwright/test";
import { test } from "../../fixtures/admin.fixture";

const settingsByKey: Record<string, Record<string, unknown>> = {
  sepay: {
    enabled: true,
    paymentCodePrefix: "HL",
    webhookApiKey: "server-secret-that-must-not-reach-the-browser",
  },
  "zalo-provider": {
    enabled: true,
    officialAccountId: "oa-1",
    accessToken: "zalo-token",
    appSecret: "zalo-secret",
  },
  "email-provider": {
    enabled: true,
    smtpHost: "smtp.example.test",
    smtpPort: 587,
    smtpPassword: "smtp-secret",
  },
  "telegram-provider": {
    enabled: true,
    defaultChatId: "-1001",
    botToken: "telegram-secret",
  },
  hunonic: { enabled: true },
};

test.describe("Integration Secret Permissions Desktop Regression", () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), "Desktop-only regression");
  });

  test("locks integration secrets and omits them from regular admin saves", async ({ admin }) => {
    let sePayPatchBody: any = null;

    await admin.page.route("**/api/v1/settings/*", async (route) => {
      const url = new URL(route.request().url());
      const key = url.pathname.split("/settings/")[1] || "";
      const method = route.request().method();

      if (method === "PATCH") {
        const body = route.request().postDataJSON();
        if (key === "sepay") sePayPatchBody = body;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              key,
              scope: "TENANT",
              value: body?.value || {},
              updatedAt: "2026-08-12T11:00:00.000Z",
            },
          }),
        });
        return;
      }

      const value = { ...(settingsByKey[key] || {}) };
      delete value.webhookApiKey;
      delete value.accessToken;
      delete value.appSecret;
      delete value.smtpPassword;
      delete value.botToken;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            key,
            scope: "TENANT",
            value,
            updatedAt: "2026-08-12T10:00:00.000Z",
          },
        }),
      });
    });

    await admin.page.goto("/settings?section=integrations", { waitUntil: "domcontentloaded" });

    const main = admin.page.locator("main");
    const secretFields = main.getByTestId("integration-secret-field");
    await expect(secretFields).toHaveCount(5);
    for (let index = 0; index < 5; index += 1) {
      await expect(secretFields.nth(index)).toBeDisabled();
      await expect(secretFields.nth(index)).toHaveValue("");
    }

    await main.getByRole("button", { name: "Lưu SePay" }).click();
    await expect.poll(() => sePayPatchBody).not.toBeNull();

    expect(sePayPatchBody).toMatchObject({
      scope: "TENANT",
      value: {
        enabled: true,
        paymentCodePrefix: "HL",
      },
    });
    expect(sePayPatchBody.value).not.toHaveProperty("webhookApiKey");
  });
});
