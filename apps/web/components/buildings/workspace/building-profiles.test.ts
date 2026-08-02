import { describe, expect, it } from "vitest";
import type { Building, Floor, Room } from "../building.types";
import { floor2Layout } from "../views/visualizer/layouts/floor-2.layout";
import { floor3Layout } from "../views/visualizer/layouts/floor-3.layout";
import { floor4Layout } from "../views/visualizer/layouts/floor-4.layout";
import { validateFloorLayout } from "../views/visualizer/geometry/layout-validator";
import { resolveFloorLayoutSpec } from "./building-profiles";

function room(id: string, code: string): Room {
  return {
    id,
    code,
    name: code,
    number: code,
    type: code === "PN 31-02" ? "2PN" : "1PN",
    rentalType: "whole",
    price: 1,
    monthlyPrice: 1,
    status: "vacant",
    images: [],
  };
}

const configuredFloor: Floor = {
  id: "database-floor-2",
  number: 2,
  rooms: [room("database-room-suite", "PN 31-02"), room("database-room-single", "PN 31-03")],
};

const configuredFloor3: Floor = {
  id: "database-floor-3",
  number: 3,
  rooms: [room("database-room-04", "PN 31-04"), room("database-room-05", "PN 31-05")],
};

const configuredFloor4: Floor = {
  id: "database-floor-4",
  number: 4,
  rooms: [room("database-room-06", "PN 31-06"), room("database-room-07", "PN 31-07")],
};

function building(code = "LK01-31"): Building {
  return {
    id: "database-building",
    code,
    name: code,
    address: "Test",
    images: [],
    status: "active",
    floors: [{ id: "database-floor-1", number: 1, rooms: [] }, configuredFloor, configuredFloor3, configuredFloor4],
  };
}

describe("resolveFloorLayoutSpec", () => {
  it("resolves only the real LK01-31 Floor 2 database record", () => {
    expect(resolveFloorLayoutSpec(building("lk01.31"), configuredFloor)).toBe(floor2Layout);
  });

  it("resolves the repeated AutoCAD geometry with the correct room codes on Floors 3 and 4", () => {
    expect(resolveFloorLayoutSpec(building(), configuredFloor3)).toBe(floor3Layout);
    expect(resolveFloorLayoutSpec(building(), configuredFloor4)).toBe(floor4Layout);
    expect(floor3Layout.units.map((unit) => unit.roomCode)).toEqual(["PN 31-04", "PN 31-05"]);
    expect(floor4Layout.units.map((unit) => unit.roomCode)).toEqual(["PN 31-06", "PN 31-07"]);
  });

  it("matches the measured AutoCAD block proportions and validates all three floors", () => {
    for (const layout of [floor2Layout, floor3Layout, floor4Layout]) {
      expect(layout.units[0].boundary[2].y).toBe(11.33);
      const stair = layout.spaces.find((space) => space.type === "stair-core");
      expect(stair?.boundary).toEqual([
        { x: 0, y: 11.33 },
        { x: 5, y: 11.33 },
        { x: 5, y: 14.83 },
        { x: 0, y: 14.83 },
      ]);
      expect(validateFloorLayout(layout)).toEqual({ isValid: true, issues: [] });
    }
  });

  it("rejects a detached floor object even when its display number is 2", () => {
    expect(resolveFloorLayoutSpec(building(), { ...configuredFloor, id: "not-in-building" })).toBeNull();
  });

  it("falls back for other buildings and unconfigured floors", () => {
    expect(resolveFloorLayoutSpec(building("LK01-32"), configuredFloor)).toBeNull();
    expect(resolveFloorLayoutSpec(building(), building().floors[0])).toBeNull();
  });
});
