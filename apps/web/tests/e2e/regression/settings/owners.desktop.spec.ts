import { expect } from "@playwright/test";
import { test } from "../../fixtures/admin.fixture";

type OwnerSettings = {
  ownerAName: string;
  ownerBName: string;
  ownerAAccountEmail: string;
  ownerBAccountEmail: string;
  ownerAContactEmail: string;
  ownerBContactEmail: string;
  ownerAPhone: string;
  ownerBPhone: string;
  ownerABuildings: string[];
  ownerBBuildings: string[];
};

type OwnerBankDefaults = {
  defaults: Record<string, string>;
};

function createOwnersSettings(): OwnerSettings {
  return {
    ownerAName: "Tinh",
    ownerBName: "The",
    ownerAAccountEmail: "adminA@homeland.local",
    ownerBAccountEmail: "adminB@homeland.local",
    ownerAContactEmail: "tinh@example.com",
    ownerBContactEmail: "the@example.com",
    ownerAPhone: "0901000001",
    ownerBPhone: "0901000002",
    ownerABuildings: ["LK01-31", "LK08-25"],
    ownerBBuildings: ["LK01-32", "LK08-24"],
  };
}

function createOwnerBankDefaults(): OwnerBankDefaults {
  return {
    defaults: {
      "owner-a": "bank-a-1",
    },
  };
}

function createOwners() {
  return [
    {
      id: "owner-a",
      name: "Tinh",
      buildings: [
        { id: "building-31", code: "LK01-31", name: "LK01-31" },
        { id: "building-25", code: "LK08-25", name: "LK08-25" },
      ],
      bankAccounts: [
        {
          id: "bank-a-1",
          bankName: "VCB",
          accountName: "Tinh Main",
          accountNumber: "1234567890",
          isActive: true,
          usage: { requestCount: 3, pendingCount: 0, confirmedCount: 3, inUse: true },
        },
        {
          id: "bank-a-2",
          bankName: "MB",
          accountName: "Tinh Backup",
          accountNumber: "9988776655",
          isActive: true,
          usage: { requestCount: 1, pendingCount: 0, confirmedCount: 1, inUse: false },
        },
      ],
    },
    {
      id: "owner-b",
      name: "The",
      buildings: [
        { id: "building-32", code: "LK01-32", name: "LK01-32" },
        { id: "building-24", code: "LK08-24", name: "LK08-24" },
      ],
      bankAccounts: [
        {
          id: "bank-b-1",
          bankName: "ACB",
          accountName: "The Main",
          accountNumber: "111122223333",
          isActive: true,
          usage: { requestCount: 2, pendingCount: 1, confirmedCount: 1, inUse: true },
        },
      ],
    },
  ];
}

function createAuditLogs() {
  return [
    {
      id: "audit-1",
      createdAt: "2026-08-11T08:00:00.000Z",
      module: "Buildings",
      action: "UPDATE",
      entity: "Building",
      entityId: "LK01-31",
      ip: "127.0.0.1",
      before: { ownerId: "owner-a" },
      after: { ownerId: "owner-b" },
      user: {
        id: "user-1",
        email: "admin@homeland.local",
        fullName: "Admin Homeland",
      },
    },
  ];
}

async function mockOwnerManagement(page: any) {
  let ownerSettings = createOwnersSettings();
  let bankDefaults = createOwnerBankDefaults();
  let owners = createOwners();
  const auditLogs = createAuditLogs();

  let ownerSettingsPatchPayload: any = null;
  let bankDefaultsPatchPayload: any = null;
  let buildingPatchPayload: any = null;

  await page.route("**/api/v1/settings/owners*", async (route: any) => {
    const method = route.request().method();

    if (method === "PATCH") {
      const body = route.request().postDataJSON?.() || {};
      ownerSettingsPatchPayload = body;
      ownerSettings = { ...ownerSettings, ...(body?.value || {}) };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          key: "owners",
          scope: "TENANT",
          value: ownerSettings,
          updatedAt: "2026-08-11T09:00:00.000Z",
        },
      }),
    });
  });

  await page.route("**/api/v1/settings/owner-bank-defaults*", async (route: any) => {
    const method = route.request().method();

    if (method === "PATCH") {
      const body = route.request().postDataJSON?.() || {};
      bankDefaultsPatchPayload = body;
      bankDefaults = {
        defaults: {
          ...(body?.value?.defaults || {}),
        },
      };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          key: "owner-bank-defaults",
          scope: "TENANT",
          value: bankDefaults,
          updatedAt: "2026-08-11T09:00:00.000Z",
        },
      }),
    });
  });

  await page.route("**/api/v1/finance/owners*", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: owners,
      }),
    });
  });

  await page.route("**/api/v1/audit/logs*", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: auditLogs,
      }),
    });
  });

  await page.route("**/api/v1/buildings/*", async (route: any) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    const id = route.request().url().split("/").pop();
    const body = route.request().postDataJSON?.() || {};
    buildingPatchPayload = { id, ...body };

    if (id === "building-31" && body.ownerId === "owner-b") {
      const sourceOwner = owners.find((owner) => owner.id === "owner-a");
      const targetOwner = owners.find((owner) => owner.id === "owner-b");
      const movedBuilding = sourceOwner?.buildings.find((building) => building.id === "building-31");
      if (sourceOwner && targetOwner && movedBuilding) {
        sourceOwner.buildings = sourceOwner.buildings.filter((building) => building.id !== "building-31");
        targetOwner.buildings = [...targetOwner.buildings, movedBuilding];
      }
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id,
          ownerId: body.ownerId,
        },
      }),
    });
  });

  return {
    getOwnerSettingsPatchPayload: () => ownerSettingsPatchPayload,
    getBankDefaultsPatchPayload: () => bankDefaultsPatchPayload,
    getBuildingPatchPayload: () => buildingPatchPayload,
  };
}

test.describe("Settings Owners Desktop Regression", () => {
  test.beforeEach(async ({ admin }, testInfo) => {
    test.skip(!/Desktop|Laptop/.test(testInfo.project.name), "Desktop-only regression");
  });

  test("reassigns building owner through confirmation modal", async ({ admin }) => {
    const mock = await mockOwnerManagement(admin.page);

    await admin.page.goto("/settings?section=owners", { waitUntil: "domcontentloaded" });

    await expect(admin.page.getByTestId("settings-owners-root")).toBeVisible();
    await expect(admin.page.getByTestId("settings-owners-building-table")).toBeVisible();

    await admin.page.getByTestId("settings-owner-select-building-31").selectOption("owner-b");
    await admin.page.getByTestId("settings-owner-save-building-31").click();

    await expect(admin.page.getByTestId("settings-owner-confirm-modal")).toBeVisible();
    await expect(admin.page.getByTestId("settings-owner-confirm-modal")).toContainText("LK01-31");

    await admin.page.getByTestId("settings-owner-confirm-submit").click();

    await expect
      .poll(() => mock.getBuildingPatchPayload(), { timeout: 10000 })
      .toMatchObject({
        id: "building-31",
        ownerId: "owner-b",
      });
  });

  test("saves owner bank defaults and renders audit logs", async ({ admin }) => {
    const mock = await mockOwnerManagement(admin.page);

    await admin.page.goto("/settings?section=owners", { waitUntil: "domcontentloaded" });

    await expect(admin.page.getByTestId("settings-owner-bank-grid")).toBeVisible();
    await expect(admin.page.getByTestId("settings-owner-audit-table")).toBeVisible();
    await expect(admin.page.getByTestId("settings-owner-audit-row-audit-1")).toBeVisible();

    await admin.page.getByTestId("settings-owner-bank-default-owner-a").selectOption("bank-a-2");
    await admin.page.getByTestId("settings-owner-bank-defaults-save").click();

    await expect
      .poll(() => mock.getBankDefaultsPatchPayload(), { timeout: 10000 })
      .toMatchObject({
        scope: "TENANT",
        value: {
          defaults: {
            "owner-a": "bank-a-2",
          },
        },
      });
  });

  test("saves owner profile settings", async ({ admin }) => {
    const mock = await mockOwnerManagement(admin.page);

    await admin.page.goto("/settings?section=owners", { waitUntil: "domcontentloaded" });

    await admin.page.getByTestId("settings-owner-a-name").fill("Tinh Updated");

    await admin.page.getByTestId("settings-owner-config-save").click();

    await expect
      .poll(() => mock.getOwnerSettingsPatchPayload(), { timeout: 10000 })
      .toMatchObject({
        scope: "TENANT",
        value: {
          ownerAName: "Tinh Updated",
        },
      });
  });
});
