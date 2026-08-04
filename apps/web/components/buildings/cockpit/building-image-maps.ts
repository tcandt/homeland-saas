import type { CockpitFloorId, FloorImageMap, RoomImageMap } from "./building-cockpit.types";
import type { BuildingTemplateId } from "./building-template-registry";

const upperFloorPaths = {
  left: [
    "M 42 42 L 746 42 L 746 642 L 30 642 Z",
  ],
  right: [
    "M 1068 42 L 1500 42 L 1510 642 L 1068 642 Z",
  ],
};

function upperFloorRoom(roomId: string, floorId: CockpitFloorId, side: "left" | "right"): RoomImageMap {
  return {
    roomId,
    floorId,
    label: roomId.replace("PN-", ""),
    paths: upperFloorPaths[side],
    labelPosition: side === "left" ? { x: 390, y: 340 } : { x: 1290, y: 340 },
  };
}

export const buildingOverviewImage = {
  src: "/buildings/lk01-31/overview/building-overview-transparent.png",
  width: 1059,
  height: 1486,
} as const;

export const lk08BuildingOverviewImage = {
  src: "/buildings/lk08/overview/building-overview.png",
  width: 1059,
  height: 1486,
} as const;

export const floorImageMaps: Record<CockpitFloorId, FloorImageMap> = {
  ground: {
    src: "/buildings/lk01-31/floors/ground-floor.webp",
    width: 1600,
    height: 680,
    viewBox: "0 0 1600 680",
    rooms: [
      {
        roomId: "PN-31-01",
        floorId: "ground",
        label: "31-01",
        paths: [
          "M 1018 42 L 1542 42 L 1580 606 L 1092 606 L 1092 474 L 1056 474 L 1056 366 L 1018 366 Z",
        ],
        labelPosition: { x: 1300, y: 320 },
      },
    ],
  },
  "1": {
    src: "/buildings/lk01-31/floors/floor-1.webp",
    width: 1536,
    height: 710,
    viewBox: "0 0 1536 710",
    rooms: [
      upperFloorRoom("PN-31-02", "1", "left"),
      upperFloorRoom("PN-31-03", "1", "right"),
    ],
  },
  "2": {
    src: "/buildings/lk01-31/floors/floor-2.webp",
    width: 1536,
    height: 710,
    viewBox: "0 0 1536 710",
    rooms: [
      upperFloorRoom("PN-31-04", "2", "left"),
      upperFloorRoom("PN-31-05", "2", "right"),
    ],
  },
  "3": {
    src: "/buildings/lk01-31/floors/floor-3.webp",
    width: 1536,
    height: 710,
    viewBox: "0 0 1536 710",
    rooms: [
      upperFloorRoom("PN-31-06", "3", "left"),
      upperFloorRoom("PN-31-07", "3", "right"),
    ],
  },
};

const lk08RoomHotspots: Record<string, Pick<RoomImageMap, "paths" | "labelPosition">> = {
  "02": { paths: ["M 1088 104 L 1358 104 L 1392 548 L 1108 548 Z"], labelPosition: { x: 1240, y: 304 } },
  "03": { paths: ["M 558 104 L 898 104 L 910 432 L 550 432 Z"], labelPosition: { x: 738, y: 283 } },
  "04": { paths: ["M 212 96 L 548 96 L 548 540 L 167 540 Z"], labelPosition: { x: 358, y: 300 } },
  "05": { paths: ["M 1088 104 L 1358 104 L 1392 548 L 1108 548 Z"], labelPosition: { x: 1240, y: 304 } },
  "06": { paths: ["M 558 104 L 898 104 L 910 432 L 550 432 Z"], labelPosition: { x: 738, y: 283 } },
  "07": { paths: ["M 212 96 L 548 96 L 548 540 L 167 540 Z"], labelPosition: { x: 358, y: 300 } },
  "08": { paths: ["M 1088 104 L 1358 104 L 1392 548 L 1108 548 Z"], labelPosition: { x: 1240, y: 304 } },
  "09": { paths: ["M 558 104 L 898 104 L 910 432 L 550 432 Z"], labelPosition: { x: 738, y: 283 } },
  "10": { paths: ["M 212 96 L 548 96 L 548 540 L 167 540 Z"], labelPosition: { x: 358, y: 300 } },
};

function lk08Room(roomId: string, floorId: CockpitFloorId, suffix: string): RoomImageMap {
  const hotspot = lk08RoomHotspots[suffix] || lk08RoomHotspots["04"];
  return {
    roomId,
    floorId,
    label: roomId,
    paths: hotspot.paths,
    labelPosition: hotspot.labelPosition,
  };
}

function lk08UpperFloorMap(floorId: CockpitFloorId, prefix: string, suffixes: string[]): FloorImageMap {
  return {
    src: "/buildings/lk08/floors/upper-floor.png",
    width: 1536,
    height: 710,
    viewBox: "0 0 1536 710",
    rooms: suffixes.map((suffix) => lk08Room(`${prefix}-${suffix}`, floorId, suffix)),
  };
}

export function getBuildingOverviewImage(templateId: BuildingTemplateId) {
  return templateId === "LK08_STANDARD" ? lk08BuildingOverviewImage : buildingOverviewImage;
}

export function getFloorImageMap(templateId: BuildingTemplateId, floorId: CockpitFloorId, prefix: string): FloorImageMap {
  if (templateId !== "LK08_STANDARD") return floorImageMaps[floorId];
  if (floorId === "ground") {
    return {
      src: "/buildings/lk08/floors/ground-floor.png",
      width: 1600,
      height: 680,
      viewBox: "0 0 1600 680",
      rooms: [{
        roomId: `${prefix}-01`,
        floorId,
        label: `${prefix}-01`,
        paths: ["M 988 122 L 1348 122 L 1376 512 L 1006 512 Z"],
        labelPosition: { x: 1204, y: 316 },
      }],
    };
  }
  if (floorId === "3") return lk08UpperFloorMap(floorId, prefix, ["08", "09", "10"]);
  if (floorId === "1") return lk08UpperFloorMap(floorId, prefix, ["02", "03", "04"]);
  return lk08UpperFloorMap(floorId, prefix, ["05", "06", "07"]);
}

export const overviewFloorHotspots: Record<CockpitFloorId, string> = {
  "3": "136,34 934,9 1023,300 222,360",
  "2": "233,432 944,380 1023,659 241,718",
  "1": "233,800 944,748 1023,1027 241,1086",
  ground: "242,1137 983,1080 1021,1363 247,1417",
};

export const lk08OverviewFloorHotspots: Record<CockpitFloorId, string> = {
  ...overviewFloorHotspots,
  "3": "130,72 910,28 972,308 188,370",
  "2": "210,418 898,366 972,658 214,724",
  "1": "210,772 910,720 984,1012 214,1078",
  ground: "220,1132 948,1076 972,1338 225,1400",
};

export const overviewRoomHotspots: Partial<Record<CockpitFloorId, Partial<Record<"left" | "right", string>>>> = {
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
};

export const lk08OverviewRoomHotspots: Partial<Record<CockpitFloorId, Partial<Record<"left" | "right", string>>>> = {
  ...overviewRoomHotspots,
  ground: {
    right: "705,1094 966,1068 1001,1322 758,1348",
  },
};

export function getOverviewFloorHotspots(templateId: BuildingTemplateId) {
  return templateId === "LK08_STANDARD" ? lk08OverviewFloorHotspots : overviewFloorHotspots;
}

export function getOverviewRoomHotspots(templateId: BuildingTemplateId) {
  return templateId === "LK08_STANDARD" ? lk08OverviewRoomHotspots : overviewRoomHotspots;
}
