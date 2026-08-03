import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile-390", width: 390, height: 844, mobile: true },
  { name: "mobile-430", width: 430, height: 932, mobile: true },
  { name: "tablet-768", width: 768, height: 1024, mobile: false },
  { name: "tablet-1024", width: 1024, height: 768, mobile: false },
  { name: "laptop-1366", width: 1366, height: 768, mobile: false },
  { name: "desktop-1920", width: 1920, height: 1080, mobile: false },
] as const;

const PORTFOLIO_BUILDING_CODES = ["LK01-31", "LK01-32", "LK08-24", "LK08-25"] as const;

const makeRoom = (floorId: string, suffix: string, status: string) => ({
  id: `room-${suffix}`,
  floorId,
  name: `PN 31-${suffix}`,
  code: `PN 31-${suffix}`,
  monthlyPrice: suffix === "02" || suffix === "04" || suffix === "06" ? 9_500_000 : 6_500_000,
  area: suffix === "02" || suffix === "04" || suffix === "06" ? 50 : 25,
  capacity: suffix === "02" || suffix === "04" || suffix === "06" ? 2 : 1,
  status,
  contracts: [],
  roommates: [],
});

const floors = [
  { id: "floor-ground", level: 1, rooms: [makeRoom("floor-ground", "01", "OCCUPIED")] },
  { id: "floor-1", level: 2, rooms: [makeRoom("floor-1", "02", "AVAILABLE"), makeRoom("floor-1", "03", "OCCUPIED")] },
  { id: "floor-2", level: 3, rooms: [makeRoom("floor-2", "04", "OCCUPIED"), makeRoom("floor-2", "05", "AVAILABLE")] },
  { id: "floor-3", level: 4, rooms: [makeRoom("floor-3", "06", "AVAILABLE"), makeRoom("floor-3", "07", "OCCUPIED")] },
];

const building = {
  id: "building-lk01-31",
  code: "LK01-31",
  name: "LK01-31",
  address: "Khu đô thị An Phú, Phường Tân An, TP. Buôn Ma Thuột, Đắk Lắk",
  images: [],
  floors,
  rooms: floors.flatMap((floor) => floor.rooms),
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-08-03T00:00:00.000Z",
};

test.describe("Buildings responsive presentation isolation", () => {
  test("keeps one presentation, one data request and no horizontal overflow at six sizes", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop 1920", "The matrix runs once and controls all six viewports itself.");

    let buildingRequests = 0;
    await page.addInitScript(() => {
      localStorage.setItem("auth-storage", JSON.stringify({
        state: {
          user: { id: "visual-admin", email: "visual@homeland.local", fullName: "System Admin", permissions: ["building.read", "room.read"] },
          accessToken: "visual-token",
          refreshToken: "visual-refresh",
          isAuthenticated: true,
        },
        version: 0,
      }));
      localStorage.setItem("theme", "light");
    });

    await page.route("**/api/v1/**", async (route) => {
      const url = new URL(route.request().url());
      if (/\/buildings\/?$/.test(url.pathname)) {
        buildingRequests += 1;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { items: [building], total: 1 } }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { items: [], total: 0, count: 0 } }) });
    });

    const requestsBeforeMatrix = buildingRequests;
    for (const viewport of VIEWPORTS) {
      const beforeRequests = buildingRequests;
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(process.env.BUILDINGS_QA_BASE_URL || "/buildings/LK01-31", { waitUntil: "networkidle" });
      await expect(page.locator(viewport.mobile ? ".mobile-buildings-stable" : ".building-cockpit-theme")).toBeVisible();

      const state = await page.evaluate(() => ({
        cockpitCount: document.querySelectorAll(".building-cockpit-theme").length,
        mobileCount: document.querySelectorAll(".mobile-buildings-stable").length,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      // A hard navigation may reuse React Query/Next data in the same browser
      // context. The invariant is no duplicate building fetch per presentation.
      expect(buildingRequests - beforeRequests).toBeLessThanOrEqual(1);
      expect(state.scrollWidth).toBe(state.clientWidth);
      expect(state.mobileCount).toBe(viewport.mobile ? 1 : 0);
      expect(state.cockpitCount).toBe(viewport.mobile ? 0 : 1);

      if (!viewport.mobile) {
        const modelViewer = page.getByTestId("building-model-viewer");
        const floorWorkspace = page.getByTestId("floor-workspace-panel");
        await expect(modelViewer).toHaveCount(1);
        await expect(floorWorkspace).toHaveCount(1);
        await expect(modelViewer).toBeVisible();
        await expect(floorWorkspace).toBeVisible();

        const [modelBox, workspaceBox] = await Promise.all([
          modelViewer.boundingBox(),
          floorWorkspace.boundingBox(),
        ]);
        expect(modelBox).not.toBeNull();
        expect(workspaceBox).not.toBeNull();
        if (viewport.width >= 1024) {
          expect(Math.abs(modelBox!.y - workspaceBox!.y)).toBeLessThanOrEqual(2);
          expect(workspaceBox!.x).toBeGreaterThan(modelBox!.x);
        } else {
          expect(workspaceBox!.y).toBeGreaterThan(modelBox!.y + modelBox!.height);
        }

        const portfolio = page.getByRole("region", { name: "Danh mục tòa nhà", exact: true });
        await expect(portfolio).toBeVisible();
        for (const code of PORTFOLIO_BUILDING_CODES) {
          await expect(portfolio.getByRole("heading", { name: code, exact: true })).toHaveCount(1);
        }
      }

      await testInfo.attach(`buildings-${viewport.name}.png`, {
        body: await page.screenshot({ fullPage: false }),
        contentType: "image/png",
      });
    }

    expect(buildingRequests - requestsBeforeMatrix).toBeGreaterThanOrEqual(1);
    expect(buildingRequests - requestsBeforeMatrix).toBeLessThanOrEqual(VIEWPORTS.length);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${process.env.BUILDINGS_QA_BASE_URL || "/buildings/LK01-31"}?floor=2`, { waitUntil: "networkidle" });
    const keyboardHotspot = page.locator('[data-room-id="PN-31-04"] path[tabindex="0"]');
    await keyboardHotspot.focus();
    await keyboardHotspot.press("Enter");
    await expect(page).toHaveURL(/floor=2.*room=PN-31-04/);
    await expect(keyboardHotspot).toHaveAttribute("aria-pressed", "true");

    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await expect(page.locator(".building-cockpit-theme")).toBeVisible();
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reducedMotionDuration = await page.getByRole("button", { name: "Đặt lại góc nhìn" }).evaluate((element) => getComputedStyle(element).transitionDuration);
    const reducedMotionMilliseconds = reducedMotionDuration.endsWith("ms") ? Number.parseFloat(reducedMotionDuration) : Number.parseFloat(reducedMotionDuration) * 1000;
    expect(reducedMotionMilliseconds).toBeLessThanOrEqual(1);
    await testInfo.attach("buildings-floor-room-dark.png", {
      body: await page.screenshot({ fullPage: false }),
      contentType: "image/png",
    });
  });
});
