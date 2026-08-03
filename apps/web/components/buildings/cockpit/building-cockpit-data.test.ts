import { describe, expect, it } from "vitest";
import type { Building } from "../building.types";
import { createCockpitBuildingSpec } from "./building-cockpit-data";
import { buildingTemplateRegistry, normalizeBuildingCode, resolveBuildingTemplate } from "./building-template-registry";
import { getBuildingMetrics } from "./building-cockpit-metrics";

const floors = [1, 2, 3, 4].map((number) => ({ id: `floor-${number}`, number, rooms: [] }));
const building = (code: string): Building => ({
  id: `building-${code}`,
  code,
  name: code,
  address: "HomeLand Premium",
  images: [],
  status: "active",
  floors,
});

describe("building cockpit template resolver", () => {
  it("resolves exactly four managed buildings across dot and dash aliases", () => {
    expect(buildingTemplateRegistry).toHaveLength(4);
    expect(normalizeBuildingCode("lk01.32")).toBe("LK01-32");
    expect(resolveBuildingTemplate("LK08.25")?.layoutStatus).toBe("pending");
  });

  it("maps LK01-32 to the shared topology without copying operational data", () => {
    const spec = createCockpitBuildingSpec([building("LK01.32")], "LK01-32");
    expect(spec?.templateId).toBe("LK01_STANDARD");
    expect(spec?.floors).toHaveLength(4);
    expect(spec?.floors.flatMap((floor) => floor.rooms).map((room) => room.code)).toEqual([
      "PN 32-01", "PN 32-02", "PN 32-03", "PN 32-04", "PN 32-05", "PN 32-06", "PN 32-07",
    ]);
    expect(spec?.floors.flatMap((floor) => floor.rooms).every((room) => room.status === "vacant" && room.contract === undefined && room.monthlyRent === undefined)).toBe(true);
    expect(spec?.floors.flatMap((floor) => floor.rooms).every((room) => room.entryDoorCount >= 1)).toBe(true);
    expect(spec?.floors.flatMap((floor) => floor.rooms).some((room) => room.type === "Căn 2PN mini + phòng khách")).toBe(true);
  });

  it("keeps LK08 as a four-floor pending shell with no fake rooms or metrics", () => {
    const spec = createCockpitBuildingSpec([building("LK08.24")], "LK08-24");
    expect(spec?.layoutStatus).toBe("pending");
    expect(spec?.floors).toHaveLength(4);
    expect(spec?.floors.every((floor) => floor.rooms.length === 0)).toBe(true);
    expect(spec && getBuildingMetrics(spec)).toMatchObject({ totalRooms: 0, monthlyRevenue: 0, depositTotal: 0, temporaryResidenceRate: 0 });
  });
});
