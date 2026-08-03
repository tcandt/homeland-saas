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

export const overviewFloorHotspots: Record<CockpitFloorId, string> = {
  "3": "136,34 934,9 1023,300 222,360",
  "2": "233,432 944,380 1023,659 241,718",
  "1": "233,800 944,748 1023,1027 241,1086",
  ground: "242,1137 983,1080 1021,1363 247,1417",
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
