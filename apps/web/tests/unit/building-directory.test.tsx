import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import BuildingDirectory from "../../components/buildings/cockpit/BuildingDirectory";
import type { Building } from "../../components/buildings/building.types";
import fs from "node:fs";

const buildings = ["LK01-31", "LK01-32", "LK08-24", "LK08-25"].map(code => ({
  id: code, name: code, code, address: "Địa chỉ tòa nhà", floors: [],
})) as unknown as Building[];
const render = (items: Building[], requestedCode = "") => renderToStaticMarkup(
  <BuildingDirectory buildings={items} requestedCode={requestedCode} onSelect={() => {}} />,
);

describe("fixed building directory", () => {
  it("displays all four buildings without building CRUD controls", () => {
    const html = render(buildings);
    for (const building of buildings) expect(html).toContain(building.code);
    expect((html.match(/<button\b/g) || []).length).toBe(4);
    expect(html).not.toMatch(/Thêm tòa nhà|Chỉnh sửa|Xóa tòa nhà/);
  });
  it("shows an informative empty state without offering creation", () => {
    const html = render([]);
    expect(html).toContain("Chưa có tòa nhà nào.");
    expect(html).not.toContain("Thêm tòa nhà");
  });
  it("keeps existing buildings selectable on a stale deep link", () => {
    const html = render(buildings, "UNKNOWN");
    expect(html).toContain("Không tìm thấy tòa nhà UNKNOWN");
    for (const building of buildings) expect(html).toContain(building.code);
    expect(html).not.toContain("Thêm tòa nhà");
  });
  it("recognizes an existing building without a missing-data error", () => {
    const html = render(buildings, "LK01-31");
    expect(html).not.toContain("Không tìm thấy");
    expect(html).toContain("0 tầng");
  });
  it("does not wire building creation or editing into the active desktop cockpit", () => {
    const source = fs.readFileSync("components/buildings/MasterDetailBuildings.tsx", "utf8");
    const cockpit = source.match(/<BuildingCockpit\b[\s\S]*?\/>/)?.[0];
    expect(cockpit).toBeDefined();
    expect(cockpit).not.toMatch(/onAddBuilding|onEditBuilding/);
    expect(source).not.toContain(">Thêm tòa nhà</Button>");
    expect(source).not.toMatch(/useCreateBuildingMutation|useUpdateBuildingMutation|useDeleteBuildingMutation|handleSaveBuilding|bname-input/);
    expect(source).toContain("if (isError)");
  });
  it("does not offer building mutation actions on mobile", () => {
    const source = fs.readFileSync("components/buildings/MobileBuildingsFlow.tsx", "utf8");
    expect(source).not.toMatch(/useDeleteBuildingMutation|useMoveBuildingMutation|setEditingBuilding|itemName="tòa nhà"/);
    expect(source).toContain("setEditingRoom");
    expect(source).toContain("setEditingFloor");
  });
});
