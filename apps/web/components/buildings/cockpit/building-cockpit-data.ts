import type { Building, Floor, Room } from "../building.types";
import type {
  ApartmentUnitSpec,
  DoorOpening,
  FloorLayoutSpec,
  FurnitureItemSpec,
  SpaceSpec,
  WallSegment,
} from "../views/visualizer/geometry/floor-layout.types";
import { floor2Layout } from "../views/visualizer/layouts/floor-2.layout";
import { floor3Layout } from "../views/visualizer/layouts/floor-3.layout";
import { floor4Layout } from "../views/visualizer/layouts/floor-4.layout";
import type { CockpitBuildingSpec, CockpitFloorId, CockpitFloorSpec, CockpitRoomSpec, CockpitRoomSpace } from "./building-cockpit.types";
import { floorImageMaps, getBuildingOverviewImage, getFloorImageMap } from "./building-image-maps";
import { normalizeBuildingCode, resolveBuildingTemplate } from "./building-template-registry";
import type { BuildingTemplateDescriptor } from "./building-template-registry";

const WIDTH = 5;
const LENGTH = 20;

const rect = (minX: number, minY: number, maxX: number, maxY: number) => [
  { x: minX, y: minY },
  { x: maxX, y: minY },
  { x: maxX, y: maxY },
  { x: minX, y: maxY },
];

const item = (
  id: string,
  type: FurnitureItemSpec["type"],
  x: number,
  y: number,
  rotation = 0,
): FurnitureItemSpec => ({ id, type, x, y, rotation });

const wall = (id: string, startX: number, startY: number, endX: number, endY: number, thickness = 0.14): WallSegment => ({
  id,
  start: { x: startX, y: startY },
  end: { x: endX, y: endY },
  thickness,
  height: 1.2,
});

const door = (
  id: string,
  wallId: string,
  offset: number,
  width: number,
  connects: [string, string],
  hinge: "start" | "end" = "start",
  swingDirection: "clockwise" | "counter-clockwise" = "clockwise",
): DoorOpening => ({
  id,
  wallId,
  offset,
  width,
  hinge,
  swingDirection,
  openAngle: 90,
  connects,
});

const roomCodeToUrl = (code: string) => code.trim().replace(/\s+/g, "-").toUpperCase();
const normalizeCode = (code: string) => {
  const clean = code.trim().toUpperCase().replace(/^PN\s*/, "");
  return clean.replace(/\s+/g, "-").replace(/[^A-Z0-9-]/g, "");
};

const groundSpaces: SpaceSpec[] = [
  {
    id: "ground-parking",
    type: "parking",
    boundary: rect(0, 0, WIDTH, 9.1),
    furniture: Array.from({ length: 7 }, (_, index) => item(`ground-bike-${index + 1}`, "motorbike", 0.9 + (index % 2) * 1.85, 1.15 + Math.floor(index / 2) * 1.65, 90)),
  },
  {
    id: "ground-common-wc",
    type: "bathroom",
    boundary: rect(0, 9.1, 2.05, 11.35),
    furniture: [item("ground-common-toilet", "toilet", 0.58, 10.08), item("ground-common-sink", "sink", 1.55, 10.62)],
  },
  {
    id: "ground-stair-core",
    type: "stair-core",
    boundary: rect(2.05, 9.1, WIDTH, 13.25),
    furniture: [item("ground-stair-cabinet", "wardrobe", 4.55, 12.3, 90)],
  },
  {
    id: "ground-room-kitchen",
    type: "kitchen",
    boundary: rect(0, 13.25, WIDTH, 15.7),
    furniture: [item("pn-3101-counter", "kitchen-counter", 4.45, 14.35, 90), item("pn-3101-desk", "desk", 2.0, 14.22)],
  },
  {
    id: "ground-room-bedroom",
    type: "single-bedroom",
    boundary: rect(1.55, 15.7, WIDTH, LENGTH),
    furniture: [item("pn-3101-bed", "single-bed", 3.0, 18.42, 90), item("pn-3101-wardrobe", "wardrobe", 4.55, 17.55, 90)],
  },
  {
    id: "ground-room-bathroom",
    type: "bathroom",
    boundary: rect(0, 15.7, 1.55, LENGTH),
    furniture: [item("pn-3101-toilet", "toilet", 0.55, 18.95), item("pn-3101-sink", "sink", 0.55, 16.55)],
  },
];

export const groundFloorLayout: FloorLayoutSpec = {
  id: "ground-floor-layout",
  floorNumber: 1,
  width: WIDTH,
  length: LENGTH,
  units: [
    {
      id: "unit-pn-3101",
      roomCode: "PN 31-01",
      type: "single-room",
      boundary: [
        { x: 0, y: 13.25 },
        { x: WIDTH, y: 13.25 },
        { x: WIDTH, y: LENGTH },
        { x: 0, y: LENGTH },
      ],
      spaceIds: ["ground-room-kitchen", "ground-room-bedroom", "ground-room-bathroom"],
    },
  ],
  spaces: groundSpaces,
  walls: [
    wall("g-outer-left", 0, 0, 0, LENGTH),
    wall("g-outer-right", WIDTH, 0, WIDTH, LENGTH),
    wall("g-front", 0, 0, WIDTH, 0),
    wall("g-rear", 0, LENGTH, WIDTH, LENGTH),
    wall("g-parking-core", 0, 9.1, WIDTH, 9.1),
    wall("g-wc-stair", 2.05, 9.1, 2.05, 11.35, 0.1),
    wall("g-room-main", 0, 13.25, WIDTH, 13.25),
    wall("g-room-wet", 1.55, 15.7, 1.55, LENGTH, 0.1),
    wall("g-room-bed-divider", 0, 15.7, WIDTH, 15.7, 0.1),
  ],
  doors: [
    door("g-door-common-wc", "g-parking-core", 0.65, 0.75, ["ground-parking", "ground-common-wc"]),
    door("g-door-stair", "g-parking-core", 3.1, 0.95, ["ground-parking", "ground-stair-core"], "end", "counter-clockwise"),
    door("g-door-room", "g-room-main", 3.7, 0.9, ["ground-stair-core", "ground-room-kitchen"], "end", "clockwise"),
    door("g-door-room-bath", "g-room-bed-divider", 0.35, 0.75, ["ground-room-kitchen", "ground-room-bathroom"]),
  ],
};

type FloorMeta = { id: CockpitFloorId; dbNumber: number; label: string; shortLabel: string; layout: FloorLayoutSpec; roomSuffixes: string[] };

function lk08Layout(prefix: string, floorId: CockpitFloorId, suffixes: string[]): FloorLayoutSpec {
  const isGround = floorId === "ground";
  const upperUnits = [
    { suffix: suffixes[0], slot: "right", boundary: rect(11.9, 0, 16, 9) },
    { suffix: suffixes[1], slot: "middle", boundary: rect(5.85, 0, 10.05, 9) },
    { suffix: suffixes[2], slot: "left", boundary: rect(0, 0, 5.65, 9) },
  ].filter((unit) => unit.suffix);

  const spaces: SpaceSpec[] = isGround
    ? [
      { id: `${prefix}-ground-parking`, type: "parking", boundary: rect(0, 0, 9.8, 9), furniture: [] },
      { id: `${prefix}-ground-room`, type: "single-bedroom", boundary: rect(10.1, 0, 16, 9), furniture: [item(`${prefix}-01-bed`, "single-bed", 13.5, 4.8)] },
      { id: `${prefix}-ground-bath`, type: "bathroom", boundary: rect(14.5, 0, 16, 2.5), furniture: [item(`${prefix}-01-toilet`, "toilet", 15.2, 1.2)] },
      { id: `${prefix}-ground-kitchen`, type: "kitchen", boundary: rect(10.1, 6.8, 16, 9), furniture: [item(`${prefix}-01-counter`, "kitchen-counter", 12.8, 8)] },
    ]
    : [
      { id: `${prefix}-${floorId}-corridor`, type: "corridor", boundary: rect(10.1, 0, 11.75, 9), furniture: [] },
      ...upperUnits.flatMap((unit) => ([
        { id: `${prefix}-${floorId}-${unit.slot}-room`, type: "single-bedroom" as const, boundary: unit.boundary, furniture: [item(`${prefix}-${unit.suffix}-bed`, "single-bed", (unit.boundary[0].x + unit.boundary[2].x) / 2, 4.6)] },
      ])),
    ];

  const units: ApartmentUnitSpec[] = isGround
    ? [{
      id: `unit-${prefix}-01`,
      roomCode: `${prefix}-01`,
      type: "single-room",
      boundary: rect(10.1, 0, 16, 9),
      spaceIds: [`${prefix}-ground-room`, `${prefix}-ground-bath`, `${prefix}-ground-kitchen`],
    }]
    : upperUnits.map((unit) => ({
      id: `unit-${prefix}-${unit.suffix}`,
      roomCode: `${prefix}-${unit.suffix}`,
      type: "single-room",
      boundary: unit.boundary,
      spaceIds: [`${prefix}-${floorId}-${unit.slot}-room`],
    }));

  const walls: WallSegment[] = [
    wall(`${prefix}-${floorId}-outer-top`, 0, 0, 16, 0),
    wall(`${prefix}-${floorId}-outer-bottom`, 0, 9, 16, 9),
    wall(`${prefix}-${floorId}-outer-left`, 0, 0, 0, 9),
    wall(`${prefix}-${floorId}-outer-right`, 16, 0, 16, 9),
    wall(`${prefix}-${floorId}-stair-left`, 10.1, 0, 10.1, 9),
    wall(`${prefix}-${floorId}-stair-right`, 11.75, 0, 11.75, 9),
  ];

  const doors: DoorOpening[] = units.map((unit, index) => door(
    `${unit.id}-door`,
    `${prefix}-${floorId}-stair-left`,
    1 + index * 2,
    0.85,
    [isGround ? `${prefix}-ground-room` : `${prefix}-${floorId}-corridor`, unit.spaceIds[0]],
  ));

  return {
    id: `lk08-${prefix}-${floorId}-layout`,
    floorNumber: isGround ? 1 : Number(floorId) + 1,
    width: 16,
    length: 9,
    units,
    spaces,
    walls,
    doors,
  };
}

const lk01FloorMeta: FloorMeta[] = [
  { id: "ground", dbNumber: 1, label: "Tầng trệt", shortLabel: "Trệt", layout: groundFloorLayout, roomSuffixes: ["01"] },
  { id: "1", dbNumber: 2, label: "Tầng 1", shortLabel: "Tầng 1", layout: floor2Layout, roomSuffixes: ["02", "03"] },
  { id: "2", dbNumber: 3, label: "Tầng 2", shortLabel: "Tầng 2", layout: floor3Layout, roomSuffixes: ["04", "05"] },
  { id: "3", dbNumber: 4, label: "Tầng 3", shortLabel: "Tầng 3", layout: floor4Layout, roomSuffixes: ["06", "07"] },
];

function getFloorMeta(descriptor: BuildingTemplateDescriptor): FloorMeta[] {
  if (descriptor.templateId !== "LK08_STANDARD") return lk01FloorMeta;
  const prefix = descriptor.roomPrefix || "P24";
  return [
    { id: "ground", dbNumber: 1, label: "Tầng trệt", shortLabel: "Trệt", layout: lk08Layout(prefix, "ground", ["01"]), roomSuffixes: ["01"] },
    { id: "1", dbNumber: 2, label: "Tầng 1", shortLabel: "Tầng 1", layout: lk08Layout(prefix, "1", ["02", "03", "04"]), roomSuffixes: ["02", "03", "04"] },
    { id: "2", dbNumber: 3, label: "Tầng 2", shortLabel: "Tầng 2", layout: lk08Layout(prefix, "2", ["05", "06", "07"]), roomSuffixes: ["05", "06", "07"] },
    { id: "3", dbNumber: 4, label: "Tầng 3", shortLabel: "Tầng 3", layout: lk08Layout(prefix, "3", ["08", "09", "10"]), roomSuffixes: ["08", "09", "10"] },
  ];
}

function roomCode(prefix: string, suffix: string) {
  return `${prefix}-${suffix}`;
}

function remapLayout(layout: FloorLayoutSpec, prefix: string): FloorLayoutSpec {
  return {
    ...layout,
    id: layout.id.replace("31", prefix),
    units: layout.units.map((unit) => ({
      ...unit,
      id: unit.id.replace(/31(?=\d{2})/g, prefix),
      roomCode: unit.roomCode.replace(/PN\s*31-/i, `${prefix}-`).replace(/31-/g, `${prefix}-`),
    })),
  };
}

function remapImageMap(floorId: CockpitFloorId, prefix: string) {
  const imageMap = floorImageMaps[floorId];
  return {
    ...imageMap,
    rooms: imageMap.rooms.map((room) => ({
      ...room,
      roomId: room.roomId.replace(/31(?=-?\d{2})/g, prefix),
      label: room.label.replace("PN ", "").replace(/31-/g, `${prefix}-`),
    })),
  };
}

const spaceLabel: Record<SpaceSpec["type"], string> = {
  "mini-bedroom": "Phòng ngủ mini",
  "living-room": "Phòng khách",
  "single-bedroom": "Phòng ngủ",
  bathroom: "WC / Tắm",
  kitchen: "Khu bếp",
  "stair-core": "Cầu thang",
  corridor: "Sảnh chung",
  utility: "Khu phụ trợ",
  parking: "Khu vực để xe",
};

function getRoomType(code: string, floorId: CockpitFloorId) {
  if (code.startsWith("P24-") || code.startsWith("P25-")) return "Studio 1 giường";
  if (floorId === "ground") return "Studio 1 giường";
  return code.endsWith("02") || code.endsWith("04") || code.endsWith("06") ? "Căn 2PN mini + phòng khách" : "Studio 1 giường";
}

function getAmenities(roomCode: string, floorId: CockpitFloorId) {
  if (roomCode.startsWith("P24-") || roomCode.startsWith("P25-")) return ["1 giường", "Khu bếp", "WC/Tắm riêng trong phòng", "Tủ quần áo"];
  if (floorId === "ground") return ["1 giường đơn", "Bàn làm việc", "Khu bếp", "WC/Tắm riêng trong phòng", "Quyền sử dụng khu để xe"];
  if (roomCode.endsWith("02") || roomCode.endsWith("04") || roomCode.endsWith("06")) {
    return ["2 phòng ngủ mini", "Phòng khách", "Khu bếp", "WC/Tắm riêng"];
  }
  return ["1 giường đơn", "Bàn làm việc", "Khu bếp", "WC/Tắm riêng trong phòng", "Tủ quần áo"];
}

function getMaxOccupancy(unit: ApartmentUnitSpec, sourceRoom?: Room) {
  const bedCount = Number(sourceRoom?.bedCount || (unit.type === "large-suite" ? 2 : 1));
  return Math.max(1, bedCount) * 2;
}

function countTemporaryResidents(room?: Room) {
  if (!room) return 0;
  const residents = [
    room.tenant,
    ...(room.roommates || []),
    ...(room.sharedTenants || []),
  ].filter(Boolean);
  return residents.filter((resident) => resident?.tempResidence).length;
}

function buildRoomSpecs(layout: FloorLayoutSpec, floor: Floor | undefined, floorId: CockpitFloorId): CockpitRoomSpec[] {
  const roomsByCode = new Map((floor?.rooms || []).map((room) => [normalizeCode(room.code), room]));
  return layout.units.map((unit: ApartmentUnitSpec): CockpitRoomSpec => {
    const dbRoom = roomsByCode.get(normalizeCode(unit.roomCode));
    const sourceRoom = dbRoom;
    const spaces = layout.spaces.filter((space) => unit.spaceIds.includes(space.id));
    const childSpaces: CockpitRoomSpace[] = spaces.map((space) => ({
      id: space.id.replace(/^pn-\d+-/, "").replace(/^ground-room-/, ""),
      name: spaceLabel[space.type],
      type: space.type,
      roomCode: unit.roomCode,
      polygon: space.boundary,
    }));
    const spaceIds = new Set(unit.spaceIds);
    const entryDoorCount = layout.doors.filter((item) => {
      const connectedInside = item.connects.filter((spaceId) => spaceIds.has(spaceId)).length;
      return connectedInside === 1;
    }).length;
    const activeRent = sourceRoom?.contract?.rentPrice;

    return {
      id: sourceRoom?.id || `structure-${roomCodeToUrl(unit.roomCode)}`,
      code: unit.roomCode,
      urlCode: roomCodeToUrl(unit.roomCode),
      floorId,
      name: sourceRoom?.name || unit.roomCode,
      type: getRoomType(unit.roomCode, floorId),
      status: sourceRoom?.status || "vacant",
      estimatedArea: sourceRoom?.area || (unit.type === "large-suite" ? 50 : 18),
      capacity: getMaxOccupancy(unit, sourceRoom),
      occupants: countTemporaryResidents(sourceRoom),
      monthlyRent: typeof activeRent === "number" && activeRent > 0 ? activeRent : undefined,
      entryDoorCount,
      amenities: getAmenities(unit.roomCode, floorId),
      polygon: unit.boundary,
      childSpaces: unit.type === "large-suite" || floorId === "ground" ? childSpaces : childSpaces,
      sourceRoom,
      contract: sourceRoom?.contract,
    };
  });
}

export function createCockpitBuildingSpec(buildings: Building[], requestedCode: string): CockpitBuildingSpec | null {
  const descriptor = resolveBuildingTemplate(requestedCode);
  if (!descriptor) return null;
  const raw = buildings.find((building) => normalizeBuildingCode(building.code || building.name) === descriptor.code);
  if (!raw) return null;
  const floorMeta = getFloorMeta(descriptor);
  const floors: CockpitFloorSpec[] = floorMeta.map((meta) => {
    const sourceFloor = raw.floors.find((floor) => floor.number === meta.dbNumber);
    const prefix = descriptor.roomPrefix || "31";
    const layout = descriptor.templateId === "LK08_STANDARD" ? meta.layout : remapLayout(meta.layout, prefix);
    return {
      id: meta.id,
      dbNumber: meta.dbNumber,
      label: meta.label,
      shortLabel: meta.shortLabel,
      roomCodes: descriptor.layoutStatus === "pending" ? [] : meta.roomSuffixes.map((suffix) => roomCode(prefix, suffix)),
      heightMeters: 3.6,
      layout,
      imageMap: descriptor.templateId === "LK08_STANDARD" ? getFloorImageMap(descriptor.templateId, meta.id, prefix) : remapImageMap(meta.id, prefix),
      rooms: descriptor.layoutStatus === "pending" ? [] : buildRoomSpecs(layout, sourceFloor, meta.id),
    };
  });

  return {
    id: raw.id,
    code: descriptor.code,
    name: raw.name || descriptor.code,
    statusLabel: "Đang hoạt động",
    templateId: descriptor.templateId,
    layoutStatus: descriptor.layoutStatus,
    address: raw.address || "Chưa cập nhật địa chỉ",
    widthMeters: descriptor.templateId === "LK08_STANDARD" ? 16 : WIDTH,
    lengthMeters: descriptor.templateId === "LK08_STANDARD" ? 9 : LENGTH,
    overviewImage: getBuildingOverviewImage(descriptor.templateId),
    floors,
    updatedAtLabel: "09:45  •  24/05/2025",
  };
}

export function createLk0131CockpitSpec(buildings: Building[]) {
  return createCockpitBuildingSpec(buildings, "LK01-31");
}

export function resolveFloorLayoutSpec(building: CockpitBuildingSpec, floorId: string | null) {
  return resolveFloorSpec(building, floorId)?.layout || null;
}

export function resolveFloorSpec(building: CockpitBuildingSpec, floorId: string | null) {
  if (!floorId) return null;
  return building.floors.find((floor) => floor.id === floorId) || null;
}

export function resolveRoomSpec(building: CockpitBuildingSpec, floorId: string | null, roomId: string | null) {
  const floor = resolveFloorSpec(building, floorId);
  if (!floor || !roomId) return null;
  const normalized = normalizeCode(roomId);
  return floor.rooms.find((room) => room.id === roomId || normalizeCode(room.code) === normalized || normalizeCode(room.urlCode) === normalized) || null;
}

export function findRoomFloor(building: CockpitBuildingSpec, roomId: string | null) {
  if (!roomId) return null;
  const normalized = normalizeCode(roomId);
  for (const floor of building.floors) {
    const room = floor.rooms.find((candidate) => candidate.id === roomId || normalizeCode(candidate.code) === normalized || normalizeCode(candidate.urlCode) === normalized);
    if (room) return { floor, room };
  }
  return null;
}
