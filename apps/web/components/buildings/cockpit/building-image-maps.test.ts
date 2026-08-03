import { describe, expect, it } from "vitest";
import { buildingOverviewImage, floorImageMaps, overviewFloorHotspots, overviewRoomHotspots } from "./building-image-maps";

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
