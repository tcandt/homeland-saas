import type { CockpitFloorId, FloorImageMap, RoomImageMap } from "./building-cockpit.types";
import type { BuildingTemplateId } from "./building-template-registry";

type OverviewRoomHotspotSide = "left" | "middle" | "right";

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
  "02": { paths: ["M 1152 97 L 1467 99 L 1527 550 L 1176 550 Z"], labelPosition: { x: 1240, y: 304 } },
  "03": { paths: ["M 500 95 L 933 97 L 945 432 L 495 429 Z"], labelPosition: { x: 738, y: 283 } },
  "04": { paths: ["M 78 100 L 501 98 L 498 546 L 36 555 Z"], labelPosition: { x: 358, y: 300 } },
  "05": { paths: ["M 1152 97 L 1467 99 L 1527 550 L 1176 550 Z"], labelPosition: { x: 1240, y: 304 } },
  "06": { paths: ["M 500 95 L 933 97 L 945 432 L 495 429 Z"], labelPosition: { x: 738, y: 283 } },
  "07": { paths: ["M 78 100 L 501 98 L 498 546 L 36 555 Z"], labelPosition: { x: 358, y: 300 } },
  "08": { paths: ["M 1152 97 L 1467 99 L 1527 550 L 1176 550 Z"], labelPosition: { x: 1240, y: 304 } },
  "09": { paths: ["M 500 95 L 933 97 L 945 432 L 495 429 Z"], labelPosition: { x: 738, y: 283 } },
  "10": { paths: ["M 78 100 L 501 98 L 498 546 L 36 555 Z"], labelPosition: { x: 358, y: 300 } },
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
        paths: ["M 1038 122 L 1510 122 L 1562 512 L 1058 512 Z"],
        labelPosition: { x: 1316, y: 316 },
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
  "3": "105,73 930,30 1003,309 173,360",
  "2": "188,421 932,376 1008,662 189,722",
  "1": "188,778 933,729 1005,1014 192,1075",
  ground: "205,1129 958,1075 1003,1338 215,1401",
};

export const overviewRoomHotspots: Partial<Record<CockpitFloorId, Partial<Record<OverviewRoomHotspotSide, string>>>> = {
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

export const lk08OverviewRoomHotspots: Partial<Record<CockpitFloorId, Partial<Record<OverviewRoomHotspotSide, string>>>> = {
  ...overviewRoomHotspots,
  "3": {
    left: "112,78 367,58 409,349 172,366",
    middle: "368,58 614,45 651,266 399,283",
    right: "734,38 926,27 1003,308 792,324",
  },
  "2": {
    left: "379,409 185,421 185,722 421,704",
    middle: "624,396 376,409 413,638 660,621",
    right: "734,385 930,371 1007,660 801,676",
  },
  "1": {
    left: "391,763 627,745 667,971 425,990",
    middle: "187,770 391,764 432,1054 187,1072",
    right: "742,740 937,725 1011,1013 805,1028",
  },
  ground: {
    right: "668,1095 959,1074 1002,1340 720,1361",
  },
};

export function getOverviewFloorHotspots(templateId: BuildingTemplateId) {
  return templateId === "LK08_STANDARD" ? lk08OverviewFloorHotspots : overviewFloorHotspots;
}

export function getOverviewRoomHotspots(templateId: BuildingTemplateId) {
  return templateId === "LK08_STANDARD" ? lk08OverviewRoomHotspots : overviewRoomHotspots;
}
