import { describe, expect, it } from "vitest";
import {
  buildingOverviewImage,
  floorImageMaps,
  getBuildingOverviewImage,
  getFloorImageMap,
  getOverviewFloorHotspots,
  getOverviewRoomHotspots,
  overviewFloorHotspots,
  overviewRoomHotspots,
} from "./building-image-maps";

function pathPoints(path: string) {
  const values = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  return Array.from({ length: Math.floor(values.length / 2) }, (_, index) => ({ x: values[index * 2], y: values[index * 2 + 1] }));
}

function containsPoint(path: string, x: number, y: number) {
  const points = pathPoints(path);
  let inside = false;
  for (let current = 0, previous = points.length - 1; current < points.length; previous = current++) {
    const a = points[current];
    const b = points[previous];
    const crosses = (a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

describe("LK01-31 image maps", () => {
  it("maps each business room exactly once", () => {
    const ids = Object.values(floorImageMaps).flatMap((floor) => floor.rooms.map((room) => room.roomId));
    expect(ids.sort()).toEqual(["PN-31-01", "PN-31-02", "PN-31-03", "PN-31-04", "PN-31-05", "PN-31-06", "PN-31-07"]);
  });

  it("keeps every polygon vertex inside its source image viewBox", () => {
    for (const floor of Object.values(floorImageMaps)) {
      for (const room of floor.rooms) {
        for (const point of room.paths.flatMap(pathPoints)) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(floor.width);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(floor.height);
        }
      }
    }
  });

  it("does not make the shared stair cores clickable", () => {
    const upperPaths = floorImageMaps["1"].rooms.flatMap((room) => room.paths);
    expect(upperPaths.some((path) => containsPoint(path, 850, 350))).toBe(false);

    const groundPaths = floorImageMaps.ground.rooms.flatMap((room) => room.paths);
    expect(groundPaths.some((path) => containsPoint(path, 850, 350))).toBe(false);
  });

  it("includes representative furniture positions inside the owning room", () => {
    const leftRoom = floorImageMaps["1"].rooms[0];
    const rightRoom = floorImageMaps["1"].rooms[1];
    expect(leftRoom.paths.some((path) => containsPoint(path, 380, 610))).toBe(true);
    expect(rightRoom.paths.some((path) => containsPoint(path, 1320, 420))).toBe(true);
    expect(floorImageMaps.ground.rooms[0].paths.some((path) => containsPoint(path, 1320, 330))).toBe(true);
  });

  it("keeps the 3D overview floor polygons on the main floor slabs", () => {
    for (const points of Object.values(overviewFloorHotspots)) {
      for (const point of points.split(/\s+/).map((pair) => {
        const [x, y] = pair.split(",").map(Number);
        return { x, y };
      })) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(buildingOverviewImage.width);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(buildingOverviewImage.height);
      }
    }

    const groundPoints = overviewFloorHotspots.ground.split(/\s+/).map((pair) => Number(pair.split(",")[0]));
    expect(Math.min(...groundPoints)).toBeGreaterThan(200);
  });

  it("keeps the first-floor overview hotspot off the ground-floor slab", () => {
    const firstFloorPoints = pathPoints(overviewFloorHotspots["1"]);
    const groundPoints = pathPoints(overviewFloorHotspots.ground);

    expect(Math.max(...firstFloorPoints.map((point) => point.y))).toBeLessThan(1090);
    expect(Math.min(...groundPoints.map((point) => point.y))).toBeGreaterThan(1070);
    expect(Math.max(...firstFloorPoints.map((point) => point.x))).toBeLessThan(1030);
  });

  it("uses wall-aligned overview room polygons instead of covering stair cores", () => {
    for (const roomHotspots of Object.values(overviewRoomHotspots)) {
      for (const points of Object.values(roomHotspots)) {
        for (const point of pathPoints(points)) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(buildingOverviewImage.width);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(buildingOverviewImage.height);
        }
      }
    }

    expect(containsPoint(overviewRoomHotspots["1"]!.left!, 705, 920)).toBe(false);
    expect(containsPoint(overviewRoomHotspots["1"]!.right!, 705, 920)).toBe(false);
    expect(containsPoint(overviewRoomHotspots["1"]!.left!, 500, 990)).toBe(true);
    expect(containsPoint(overviewRoomHotspots["1"]!.right!, 900, 920)).toBe(true);
  });

  it("matches the first-floor LK01-03 room boundary from the overview redline", () => {
    expect(overviewRoomHotspots["1"]!.right).toBe("721,769 940,748 1030,1026 778,1047");
  });

  it("matches the overview redlines for every floor and room boundary", () => {
    expect(overviewFloorHotspots).toMatchObject({
      "3": "136,34 934,9 1023,300 222,360",
      "2": "233,432 944,380 1023,659 241,718",
      "1": "233,800 944,748 1023,1027 241,1086",
      ground: "242,1137 983,1080 1021,1363 247,1417",
    });
    expect(overviewRoomHotspots).toMatchObject({
      "3": {
        left: "125,38 499,29 580,341 216,364",
        right: "699,17 931,11 1015,304 766,324",
      },
      "2": {
        left: "244,431 525,411 588,691 225,716",
        right: "721,401 940,380 1030,658 778,679",
      },
      "1": {
        left: "244,799 525,779 588,1059 225,1084",
        right: "721,769 940,748 1030,1026 778,1047",
      },
      ground: {
        right: "702,1104 986,1081 1020,1362 760,1388",
      },
    });
  });
});

describe("LK08 image maps", () => {
  it("maps 10 business rooms for both LK08 buildings", () => {
    const p24Ids = (["ground", "1", "2", "3"] as const).flatMap((floorId) => getFloorImageMap("LK08_STANDARD", floorId, "P24").rooms.map((room) => room.roomId));
    const p25Ids = (["ground", "1", "2", "3"] as const).flatMap((floorId) => getFloorImageMap("LK08_STANDARD", floorId, "P25").rooms.map((room) => room.roomId));

    expect(p24Ids).toEqual(["P24-01", "P24-02", "P24-03", "P24-04", "P24-05", "P24-06", "P24-07", "P24-08", "P24-09", "P24-10"]);
    expect(p25Ids).toEqual(["P25-01", "P25-02", "P25-03", "P25-04", "P25-05", "P25-06", "P25-07", "P25-08", "P25-09", "P25-10"]);
  });

  it("uses the same overview frame as LK01 and keeps LK08 hotspots in bounds", () => {
    expect(getBuildingOverviewImage("LK08_STANDARD")).toMatchObject({
      width: buildingOverviewImage.width,
      height: buildingOverviewImage.height,
    });

    for (const floorId of ["ground", "1", "2", "3"] as const) {
      const map = getFloorImageMap("LK08_STANDARD", floorId, "P24");
      for (const room of map.rooms) {
        for (const point of room.paths.flatMap(pathPoints)) {
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(map.width);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(map.height);
        }
      }
    }
  });

  it("uses LK08-specific ground-floor overview polygons", () => {
    const floorHotspots = getOverviewFloorHotspots("LK08_STANDARD");
    const roomHotspots = getOverviewRoomHotspots("LK08_STANDARD");

    expect(floorHotspots["3"]).toBe("130,72 910,38 972,306 188,370");
    expect(floorHotspots["1"]).toBe("210,772 910,720 984,1012 214,1078");
    expect(floorHotspots["2"]).toBe("210,418 898,366 972,658 214,724");
    expect(floorHotspots.ground).toBe("220,1132 948,1076 972,1338 225,1400");
    expect(roomHotspots.ground?.right).toBe("705,1094 966,1068 1001,1322 758,1348");
    expect(getOverviewFloorHotspots("LK01_STANDARD")["3"]).toBe("136,34 934,9 1023,300 222,360");
    expect(getOverviewFloorHotspots("LK01_STANDARD")["1"]).toBe("233,800 944,748 1023,1027 241,1086");
    expect(getOverviewFloorHotspots("LK01_STANDARD")["2"]).toBe("233,432 944,380 1023,659 241,718");
    expect(getOverviewFloorHotspots("LK01_STANDARD").ground).toBe("242,1137 983,1080 1021,1363 247,1417");

    expect(containsPoint(floorHotspots["3"], 720, 190)).toBe(true);
    expect(containsPoint(floorHotspots["3"], 968, 292)).toBe(true);
    expect(containsPoint(floorHotspots["3"], 995, 220)).toBe(false);
    expect(containsPoint(floorHotspots["3"], 920, 34)).toBe(false);
    expect(containsPoint(floorHotspots["3"], 145, 82)).toBe(true);
    expect(containsPoint(floorHotspots["3"], 190, 360)).toBe(true);
    expect(containsPoint(floorHotspots["1"], 720, 850)).toBe(true);
    expect(containsPoint(floorHotspots["1"], 930, 735)).toBe(false);
    expect(containsPoint(floorHotspots["1"], 1005, 900)).toBe(false);
    expect(containsPoint(floorHotspots["1"], 225, 760)).toBe(false);
    expect(containsPoint(floorHotspots["1"], 224, 1068)).toBe(true);
    expect(containsPoint(floorHotspots["1"], 720, 1078)).toBe(false);
    expect(containsPoint(floorHotspots["2"], 720, 496)).toBe(true);
    expect(containsPoint(floorHotspots["2"], 918, 381)).toBe(false);
    expect(containsPoint(floorHotspots["2"], 993, 546)).toBe(false);
    expect(containsPoint(floorHotspots["2"], 224, 714)).toBe(true);
    expect(containsPoint(floorHotspots.ground, 720, 1210)).toBe(true);
    expect(containsPoint(floorHotspots.ground, 720, 1095)).toBe(true);
    expect(containsPoint(floorHotspots.ground, 720, 1350)).toBe(true);
    expect(containsPoint(floorHotspots.ground, 720, 1062)).toBe(false);
    expect(containsPoint(floorHotspots.ground, 720, 1412)).toBe(false);
    expect(containsPoint(floorHotspots.ground, 205, 1240)).toBe(false);
    expect(containsPoint(floorHotspots.ground, 1010, 1220)).toBe(false);
    expect(containsPoint(floorHotspots.ground, 960, 1328)).toBe(true);
    expect(containsPoint(floorHotspots.ground, 980, 1352)).toBe(false);
    expect(containsPoint(roomHotspots.ground!.right!, 870, 1210)).toBe(true);
    expect(containsPoint(roomHotspots.ground!.right!, 620, 1210)).toBe(false);
  });

  it("keeps the LK08 ground-floor 2.5D room hotspot aligned to the room walls", () => {
    const map = getFloorImageMap("LK08_STANDARD", "ground", "P24");
    const room = map.rooms[0];

    expect(room.paths[0]).toBe("M 988 122 L 1348 122 L 1376 512 L 1006 512 Z");
    expect(room.paths.some((path) => containsPoint(path, 1204, 320))).toBe(true);
    expect(room.paths.some((path) => containsPoint(path, 970, 320))).toBe(false);
    expect(room.paths.some((path) => containsPoint(path, 1358, 320))).toBe(true);
    expect(room.paths.some((path) => containsPoint(path, 1400, 320))).toBe(false);
    expect(room.paths.some((path) => containsPoint(path, 1204, 100))).toBe(false);
    expect(room.paths.some((path) => containsPoint(path, 1204, 540))).toBe(false);
  });

  it("keeps LK08 room hotspots off balconies and stair cores", () => {
    const map = getFloorImageMap("LK08_STANDARD", "2", "P24");
    const [right, middle, left] = map.rooms;

    expect(right.paths.some((path) => containsPoint(path, 1265, 300))).toBe(true);
    expect(right.paths.some((path) => containsPoint(path, 1265, 92))).toBe(false);
    expect(right.paths.some((path) => containsPoint(path, 1265, 530))).toBe(true);
    expect(right.paths.some((path) => containsPoint(path, 1265, 565))).toBe(false);
    expect(right.paths.some((path) => containsPoint(path, 1040, 300))).toBe(false);
    expect(right.paths.some((path) => containsPoint(path, 1098, 300))).toBe(true);
    expect(right.paths.some((path) => containsPoint(path, 1405, 300))).toBe(false);
    expect(middle.paths.some((path) => containsPoint(path, 740, 285))).toBe(true);
    expect(middle.paths.some((path) => containsPoint(path, 740, 90))).toBe(false);
    expect(middle.paths.some((path) => containsPoint(path, 740, 420))).toBe(true);
    expect(middle.paths.some((path) => containsPoint(path, 740, 450))).toBe(false);
    expect(middle.paths.some((path) => containsPoint(path, 995, 300))).toBe(false);
    expect(middle.paths.some((path) => containsPoint(path, 930, 300))).toBe(false);
    expect(left.paths.some((path) => containsPoint(path, 320, 300))).toBe(true);
    expect(left.paths.some((path) => containsPoint(path, 60, 300))).toBe(false);
    expect(left.paths.some((path) => containsPoint(path, 120, 300))).toBe(false);
    expect(left.paths.some((path) => containsPoint(path, 180, 120))).toBe(false);
    expect(left.paths.some((path) => containsPoint(path, 215, 120))).toBe(true);
    expect(left.paths.some((path) => containsPoint(path, 320, 86))).toBe(false);
    expect(left.paths.some((path) => containsPoint(path, 320, 520))).toBe(true);
    expect(left.paths.some((path) => containsPoint(path, 320, 552))).toBe(false);
  });
});
