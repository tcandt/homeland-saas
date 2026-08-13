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
    expect(overviewRoomHotspots["1"]!.right).toBe("721,769 949,748 1030,1026 778,1047");
  });

  it("matches the overview redlines for every floor and room boundary", () => {
    expect(overviewFloorHotspots).toMatchObject({
      "3": "129,35 934,9 1023,300 222,360",
      "2": "243,433 944,380 1034,663 232,723",
      "1": "233,800 944,748 1023,1027 241,1086",
      ground: "242,1137 983,1080 1045,1362 247,1417",
    });
    expect(overviewRoomHotspots).toMatchObject({
      "3": {
        left: "125,38 499,29 583,336 216,364",
        right: "712,19 931,11 1016,292 773,323",
      },
      "2": {
        left: "244,431 518,412 592,699 238,725",
        right: "721,401 940,380 1023,667 778,679",
      },
      "1": {
        left: "244,799 520,786 594,1054 238,1083",
        right: "721,769 949,748 1030,1026 778,1047",
      },
      ground: {
        right: "702,1104 986,1081 1039,1353 757,1373",
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

    expect(floorHotspots["3"]).toBe("105,73 930,30 1003,309 173,360");
    expect(floorHotspots["1"]).toBe("188,778 933,729 1005,1014 192,1075");
    expect(floorHotspots["2"]).toBe("188,421 932,376 1008,662 189,722");
    expect(floorHotspots.ground).toBe("205,1129 958,1075 1003,1338 215,1401");
    expect(roomHotspots["3"]?.left).toBe("112,78 367,58 409,349 172,366");
    expect(roomHotspots["3"]?.middle).toBe("368,58 614,45 651,266 399,283");
    expect(roomHotspots["3"]?.right).toBe("734,38 926,27 1003,308 792,324");
    expect(roomHotspots["2"]?.left).toBe("379,409 185,421 185,722 421,704");
    expect(roomHotspots["2"]?.middle).toBe("624,396 376,409 413,638 660,621");
    expect(roomHotspots["2"]?.right).toBe("734,385 930,371 1007,660 801,676");
    expect(roomHotspots["1"]?.left).toBe("391,763 627,745 667,971 425,990");
    expect(roomHotspots["1"]?.middle).toBe("187,770 391,764 432,1054 187,1072");
    expect(roomHotspots["1"]?.right).toBe("742,740 937,725 1011,1013 805,1028");
    expect(roomHotspots.ground?.right).toBe("668,1095 959,1074 1002,1340 720,1361");
    expect(getOverviewFloorHotspots("LK01_STANDARD")["3"]).toBe("129,35 934,9 1023,300 222,360");
    expect(getOverviewFloorHotspots("LK01_STANDARD")["1"]).toBe("233,800 944,748 1023,1027 241,1086");
    expect(getOverviewFloorHotspots("LK01_STANDARD")["2"]).toBe("243,433 944,380 1034,663 232,723");
    expect(getOverviewFloorHotspots("LK01_STANDARD").ground).toBe("242,1137 983,1080 1045,1362 247,1417");

    expect(containsPoint(floorHotspots["3"], 720, 190)).toBe(true);
    expect(containsPoint(floorHotspots["3"], 968, 292)).toBe(true);
    expect(containsPoint(floorHotspots["3"], 995, 220)).toBe(false);
    expect(containsPoint(floorHotspots["3"], 920, 34)).toBe(true);
    expect(containsPoint(floorHotspots["3"], 145, 82)).toBe(true);
    expect(containsPoint(floorHotspots["3"], 190, 360)).toBe(false);
    expect(containsPoint(floorHotspots["1"], 720, 850)).toBe(true);
    expect(containsPoint(floorHotspots["1"], 930, 735)).toBe(true);
    expect(containsPoint(floorHotspots["1"], 1005, 900)).toBe(false);
    expect(containsPoint(floorHotspots["1"], 225, 760)).toBe(false);
    expect(containsPoint(floorHotspots["1"], 224, 1068)).toBe(true);
    expect(containsPoint(floorHotspots["1"], 720, 1078)).toBe(false);
    expect(containsPoint(floorHotspots["2"], 720, 496)).toBe(true);
    expect(containsPoint(floorHotspots["2"], 918, 381)).toBe(true);
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
    expect(containsPoint(roomHotspots["1"]!.left!, 500, 880)).toBe(true);
    expect(containsPoint(roomHotspots["1"]!.middle!, 300, 880)).toBe(true);
    expect(containsPoint(roomHotspots["1"]!.right!, 900, 880)).toBe(true);
    expect(containsPoint(roomHotspots.ground!.right!, 870, 1210)).toBe(true);
    expect(containsPoint(roomHotspots.ground!.right!, 620, 1210)).toBe(false);
  });

  it("keeps the LK08 ground-floor 2.5D room hotspot aligned to the room walls", () => {
    const map = getFloorImageMap("LK08_STANDARD", "ground", "P24");
    const room = map.rooms[0];

    expect(room.paths[0]).toBe("M 1038 122 L 1510 122 L 1562 512 L 1058 512 Z");
    expect(room.paths.some((path) => containsPoint(path, 1316, 320))).toBe(true);
    expect(room.paths.some((path) => containsPoint(path, 1018, 320))).toBe(false);
    expect(room.paths.some((path) => containsPoint(path, 1515, 320))).toBe(true);
    expect(room.paths.some((path) => containsPoint(path, 1560, 500))).toBe(true);
    expect(room.paths.some((path) => containsPoint(path, 1580, 320))).toBe(false);
    expect(room.paths.some((path) => containsPoint(path, 1062, 500))).toBe(true);
    expect(room.paths.some((path) => containsPoint(path, 1316, 100))).toBe(false);
    expect(room.paths.some((path) => containsPoint(path, 1316, 540))).toBe(false);
  });

  it("keeps LK08 room hotspots off balconies and stair cores", () => {
    const map = getFloorImageMap("LK08_STANDARD", "2", "P24");
    const [right, middle, left] = map.rooms;

    expect(right.paths.some((path) => containsPoint(path, 1265, 300))).toBe(true);
    expect(right.paths.some((path) => containsPoint(path, 1265, 92))).toBe(false);
    expect(right.paths.some((path) => containsPoint(path, 1265, 530))).toBe(true);
    expect(right.paths.some((path) => containsPoint(path, 1265, 565))).toBe(false);
    expect(right.paths.some((path) => containsPoint(path, 1040, 300))).toBe(false);
    expect(right.paths.some((path) => containsPoint(path, 1165, 300))).toBe(true);
    expect(right.paths.some((path) => containsPoint(path, 1535, 300))).toBe(false);
    expect(middle.paths.some((path) => containsPoint(path, 740, 285))).toBe(true);
    expect(middle.paths.some((path) => containsPoint(path, 740, 90))).toBe(false);
    expect(middle.paths.some((path) => containsPoint(path, 740, 420))).toBe(true);
    expect(middle.paths.some((path) => containsPoint(path, 740, 450))).toBe(false);
    expect(middle.paths.some((path) => containsPoint(path, 995, 300))).toBe(false);
    expect(middle.paths.some((path) => containsPoint(path, 930, 300))).toBe(true);
    expect(left.paths.some((path) => containsPoint(path, 320, 300))).toBe(true);
    expect(left.paths.some((path) => containsPoint(path, 20, 300))).toBe(false);
    expect(left.paths.some((path) => containsPoint(path, 80, 300))).toBe(true);
    expect(left.paths.some((path) => containsPoint(path, 70, 120))).toBe(false);
    expect(left.paths.some((path) => containsPoint(path, 100, 120))).toBe(true);
    expect(left.paths.some((path) => containsPoint(path, 320, 86))).toBe(false);
    expect(left.paths.some((path) => containsPoint(path, 320, 520))).toBe(true);
    expect(left.paths.some((path) => containsPoint(path, 320, 558))).toBe(false);
  });

  it("syncs LK08 upper-floor 2.5D polygons across floors and building prefixes", () => {
    const expectedBySuffix = {
      "02": "M 1152 97 L 1467 99 L 1527 550 L 1176 550 Z",
      "03": "M 500 95 L 933 97 L 945 432 L 495 429 Z",
      "04": "M 78 100 L 501 98 L 498 546 L 36 555 Z",
    } as const;
    const floors = [
      { floorId: "1", suffixes: ["02", "03", "04"] },
      { floorId: "2", suffixes: ["05", "06", "07"] },
      { floorId: "3", suffixes: ["08", "09", "10"] },
    ] as const;

    for (const prefix of ["P24", "P25"]) {
      for (const { floorId, suffixes } of floors) {
        const map = getFloorImageMap("LK08_STANDARD", floorId, prefix);
        suffixes.forEach((suffix, index) => {
          const templateSuffix = String(Number(suffix) - (floorId === "1" ? 0 : floorId === "2" ? 3 : 6)).padStart(2, "0") as keyof typeof expectedBySuffix;
          expect(map.rooms[index].roomId).toBe(`${prefix}-${suffix}`);
          expect(map.rooms[index].paths[0]).toBe(expectedBySuffix[templateSuffix]);
        });
      }
    }
  });
});
