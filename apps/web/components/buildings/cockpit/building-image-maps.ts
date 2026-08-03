import type { CockpitFloorId, FloorImageMap, RoomImageMap } from "./building-cockpit.types";

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
    label: roomId.replaceAll("-", " "),
    paths: upperFloorPaths[side],
    labelPosition: side === "left" ? { x: 390, y: 604 } : { x: 1288, y: 604 },
  };
}

export const buildingOverviewImage = {
  src: "/buildings/lk01-31/overview/building-overview-transparent.png",
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
        label: "PN 31-01",
        paths: [
          "M 1018 42 L 1542 42 L 1580 606 L 1092 606 L 1092 474 L 1056 474 L 1056 366 L 1018 366 Z",
        ],
        labelPosition: { x: 1320, y: 566 },
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

export const overviewFloorHotspots: Record<CockpitFloorId, string> = {
  "3": "138,20 978,8 1048,338 216,378",
  "2": "238,432 980,392 1048,700 252,750",
  "1": "242,814 986,764 1049,1074 254,1118",
  ground: "246,1122 1006,1092 1048,1418 258,1468",
};
