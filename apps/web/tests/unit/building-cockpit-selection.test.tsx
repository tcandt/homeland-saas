import React, { type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Building } from "../../components/buildings/building.types";
import type UnifiedBuildingCockpit from "../../components/buildings/cockpit/UnifiedBuildingCockpit";
import BuildingCockpit from "../../components/buildings/cockpit/BuildingCockpit";

type CockpitProps = ComponentProps<typeof UnifiedBuildingCockpit>;
const state = vi.hoisted(() => ({
  pathname: "/buildings",
  query: "",
  cockpit: undefined as CockpitProps | undefined,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.query),
}));
vi.mock("../../components/buildings/cockpit/UnifiedBuildingCockpit", () => ({
  default: (props: CockpitProps) => {
    state.cockpit = props;
    return <div data-selected-building={props.building.code} />;
  },
}));
vi.mock("../../components/buildings/cockpit/FloorPlanCanvas", () => ({ default: () => null }));
vi.mock("../../components/buildings/cockpit/RoomInspectorDrawer", () => ({ default: () => null }));
vi.mock("../../components/buildings/cockpit/BuildingSwitcher", () => ({ default: () => null }));

const codes = ["LK01-31", "LK01-32", "LK08-24", "LK08-25"];
const building = (code: string): Building => ({
  id: `building-${code}`, code, name: code, address: "HomeLand Premium",
  images: [], status: "active",
  floors: [1, 2, 3, 4].map(number => ({ id: `floor-${number}`, number, rooms: [] })),
});
const render = (items = codes.map(building)) => renderToStaticMarkup(<BuildingCockpit buildings={items} />);

beforeEach(() => {
  state.pathname = "/buildings";
  state.query = "";
  state.cockpit = undefined;
});
afterEach(() => vi.unstubAllGlobals());

describe("fixed building cockpit selection", () => {
  it("opens the first fixed building immediately instead of the directory", () => {
    expect(render()).toContain('data-selected-building="LK01-31"');
    expect(state.cockpit?.floor?.id).toBe("2");
  });

  it("uses registry order and excludes unsupported buildings", () => {
    render([building("EXTRA"), ...codes.toReversed().map(building)]);
    expect(state.cockpit?.building.code).toBe("LK01-31");
    expect(state.cockpit?.portfolioBuildings.map(item => item.code)).toEqual(codes);
  });

  it("preserves normalized building, floor and room deep links", () => {
    state.pathname = "/buildings/lk01.32";
    state.query = "floor=2&room=32-04";
    render();
    expect(state.cockpit?.building.code).toBe("LK01-32");
    expect(state.cockpit?.floor?.id).toBe("2");
    expect(state.cockpit?.room?.code).toBe("32-04");
  });

  it("falls back to the first available fixed building for stale links", () => {
    state.pathname = "/buildings/UNKNOWN";
    render([building("LK08-25"), building("LK01-32")]);
    expect(state.cockpit?.building.code).toBe("LK01-32");
  });

  it("does not offer creation or fabricate buildings when data is missing", () => {
    const html = render([building("EXTRA")]);
    expect(html).toContain('role="status"');
    expect(html).toContain("4 tòa nhà cố định");
    expect(html).not.toContain("Thêm tòa nhà");
    expect(state.cockpit).toBeUndefined();
  });

  it("uses the resolved default building in floor and room navigation", () => {
    const pushState = vi.fn();
    vi.stubGlobal("window", { location: { search: "?space=old&viewMode=old" }, history: { pushState } });
    render();
    const cockpit = state.cockpit!;
    cockpit.onSelectFloor("1");
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/buildings/LK01-31?floor=1");
    const room = cockpit.building.floors.flatMap(item => item.rooms)[0];
    cockpit.onSelectRoom(room);
    expect(pushState).toHaveBeenLastCalledWith(null, "", `/buildings/LK01-31?floor=${room.floorId}&room=${encodeURIComponent(room.urlCode)}`);
    cockpit.onCloseRoom();
    expect(pushState).toHaveBeenLastCalledWith(null, "", "/buildings/LK01-31?floor=2");
  });

  it("switches to available fixed buildings but ignores unknown codes", () => {
    const pushState = vi.fn();
    vi.stubGlobal("window", { location: { search: "" }, history: { pushState } });
    render();
    state.cockpit!.onSelectBuilding("lk08.25");
    expect(pushState).toHaveBeenCalledWith(null, "", "/buildings/LK08-25");
    state.cockpit!.onSelectBuilding("EXTRA");
    expect(pushState).toHaveBeenCalledTimes(1);
  });
});
