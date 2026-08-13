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
    src: "/buildings/lk01-31/floors/ground-floor-trans.webp",
    width: 1600,
    height: 680,
    viewBox: "0 0 1600 680",
    rooms: [
      {
        roomId: "PN-31-01",
        floorId: "ground",
        label: "31-01",
        paths: [
          "M 1005 40 L 1542 42 L 1593 575 L 1156 573 L 1062 573 L 1065 373 L 1018 379 L 1018 366 Z",
        ],
        labelPosition: { x: 1300, y: 320 },
      },
    ],
  },
  "1": {
    src: "/buildings/lk01-31/floors/floor-1-trans.webp",
    width: 1536,
    height: 710,
    viewBox: "0 0 1536 710",
    rooms: [
      {
        roomId: "PN-31-02",
        floorId: "1",
        label: "31-02",
        paths: ["M 42 42 L 763 42 L 763 664 L 22 660 Z"],
        labelPosition: { x: 390, y: 340 },
      },
      {
        roomId: "PN-31-03",
        floorId: "1",
        label: "31-03",
        paths: ["M 1068 42 L 1500 42 L 1516 666 L 1074 660 Z"],
        labelPosition: { x: 1290, y: 340 },
      },
    ],
  },
  "2": {
    src: "/buildings/lk01-31/floors/floor-2-trans.webp",
    width: 1536,
    height: 710,
    viewBox: "0 0 1536 710",
    rooms: [
      {
        roomId: "PN-31-04",
        floorId: "2",
        label: "31-04",
        paths: ["M 51 44 L 758 38 L 761 664 L 21 656 Z"],
        labelPosition: { x: 390, y: 340 },
      },
      {
        roomId: "PN-31-05",
        floorId: "2",
        label: "31-05",
        paths: ["M 1068 42 L 1486 44 L 1515 648 L 1079 650 Z"],
        labelPosition: { x: 1290, y: 340 },
      },
    ],
  },
  "3": {
    src: "/buildings/lk01-31/floors/floor-3-trans.webp",
    width: 1536,
    height: 710,
    viewBox: "0 0 1536 710",
    rooms: [
      {
        roomId: "PN-31-06",
        floorId: "3",
        label: "31-06",
        paths: ["M 42 42 L 763 44 L 765 654 L 22 656 Z"],
        labelPosition: { x: 390, y: 340 },
      },
      {
        roomId: "PN-31-07",
        floorId: "3",
        label: "31-07",
        paths: ["M 1068 42 L 1487 40 L 1517 656 L 1072 660 Z"],
        labelPosition: { x: 1290, y: 340 },
      },
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
  "3": "129,35 934,9 1023,300 222,360",
  "2": "243,433 944,380 1034,663 232,723",
  "1": "233,800 944,748 1023,1027 241,1086",
  ground: "242,1137 983,1080 1045,1362 247,1417",
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
