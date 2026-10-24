import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BuildingDirectory from "../../components/buildings/cockpit/BuildingDirectory";
import type { Building } from "../../components/buildings/building.types";
import fs from "node:fs";

const building = { id: "new-building", name: "Tòa nhà mới", code: "NEW-01", address: "Địa chỉ mới", floors: [] } as unknown as Building;
const render = (buildings: Building[], requestedCode = "", canCreate = true) => renderToStaticMarkup(
  <BuildingDirectory buildings={buildings} requestedCode={requestedCode} onSelect={() => {}} onAdd={canCreate ? () => {} : undefined} onEdit={() => {}} />,
);

describe("building directory on a fresh database", () => {
  it("offers creation instead of a missing hardcoded building", () => {
    const html = render([]);
    expect(html).toContain("Chưa có tòa nhà nào.");
    expect(html).toContain("Thêm tòa nhà");
    expect(html).not.toContain("LK01-31");
  });
  it("does not expose create to a read-only user", () => {
    expect(render([], "", false)).not.toContain("Thêm tòa nhà");
  });
  it("offers actual buildings and creation on a stale deep link", () => {
    const html = render([building], "LK01-31");
    expect(html).toContain("Không tìm thấy tòa nhà LK01-31");
    expect(html).toContain("Tòa nhà mới");
    expect(html).toContain("Thêm tòa nhà");
  });
  it("displays a newly created non-template building without a missing-data error", () => {
    const html = render([building], "NEW-01");
    expect(html).not.toContain("Không tìm thấy");
    expect(html).toContain("NEW-01");
    expect(html).toContain("0 tầng");
    expect(html).toContain("Chỉnh sửa Tòa nhà mới");
  });
  it("wires permission-gated creation and navigates to the saved building", () => {
    const source = fs.readFileSync("components/buildings/MasterDetailBuildings.tsx", "utf8");
    expect(source).toContain("onAddBuilding={permissions.canCreateBuilding ? handleOpenAddBuilding : undefined}");
    expect(source).toContain("if (!permissions.canCreateBuilding) return;");
    expect(source).toContain("router.push(`/buildings/${encodeURIComponent(normalizeBuildingCode(data.code || data.name))}`)");
    expect(source).toContain("if (isError)");
  });
});
