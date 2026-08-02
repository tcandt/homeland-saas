import type { FloorLayoutSpec, FurnitureItemSpec, SpaceSpec } from "../geometry/floor-layout.types";

const WIDTH = 5;
const LENGTH = 20;
const SUITE_END = 11.33;
const STAIR_END = 14.83;
const WET_WIDTH = 1.63;
const BEDROOM_WIDTH = 3.15;

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

export function createUpperFloorLayout(
  floorNumber: 2 | 3 | 4,
  suiteRoomCode: string,
  singleRoomCode: string,
): FloorLayoutSpec {
  const suite = `pn-${suiteRoomCode.replace(/\D/g, "")}`;
  const single = `pn-${singleRoomCode.replace(/\D/g, "")}`;

  const suiteBedroom2 = `${suite}-bedroom-2`;
  const suiteBedroom1 = `${suite}-bedroom-1`;
  const suiteLiving = `${suite}-living`;
  const suiteKitchen = `${suite}-kitchen`;
  const suiteUtility = `${suite}-utility`;
  const suiteBathroom = `${suite}-bathroom`;
  const stairCore = `floor-${floorNumber}-stair-core`;
  const singleUtility = `${single}-utility`;
  const singleKitchen = `${single}-kitchen`;
  const singleBathroom = `${single}-bathroom`;
  const singleBedroom = `${single}-bedroom`;

  const spaces: SpaceSpec[] = [
    {
      id: suiteBedroom2,
      type: "mini-bedroom",
      boundary: rect(0, 0, WIDTH, 3.3),
      furniture: [
        item(`${suite}-bed-2`, "single-bed", 1.3, 2.1, 90),
        item(`${suite}-wardrobe-2`, "wardrobe", 4.55, 1.7, 90),
      ],
    },
    {
      id: suiteBedroom1,
      type: "mini-bedroom",
      boundary: rect(0, 3.3, BEDROOM_WIDTH, 6.64),
      furniture: [
        item(`${suite}-bed-1`, "single-bed", 1.25, 4.55, 90),
        item(`${suite}-desk-1`, "desk", 0.65, 5.95, 90),
        item(`${suite}-wardrobe-1`, "wardrobe", 2.75, 5.15, 90),
      ],
    },
    {
      id: suiteKitchen,
      type: "kitchen",
      boundary: rect(3.9, 3.3, WIDTH, 6.64),
      furniture: [
        item(`${suite}-counter`, "kitchen-counter", 4.48, 4.72, 90),
        item(`${suite}-fridge`, "refrigerator", 4.48, 6.18, 90),
      ],
    },
    {
      id: suiteLiving,
      type: "living-room",
      boundary: [
        { x: BEDROOM_WIDTH, y: 3.3 },
        { x: 3.9, y: 3.3 },
        { x: 3.9, y: 6.64 },
        { x: WIDTH, y: 6.64 },
        { x: WIDTH, y: SUITE_END },
        { x: WET_WIDTH, y: SUITE_END },
        { x: WET_WIDTH, y: 6.64 },
        { x: BEDROOM_WIDTH, y: 6.64 },
      ],
      furniture: [
        item(`${suite}-sofa`, "sofa", 2.2, 9.55, 90),
        item(`${suite}-coffee-table`, "coffee-table", 3.15, 9.15, 90),
        item(`${suite}-tv-console`, "wardrobe", 4.65, 9.6, 90),
      ],
    },
    {
      id: suiteUtility,
      type: "utility",
      boundary: rect(0, 6.64, WET_WIDTH, 8.83),
      furniture: [
        item(`${suite}-washer`, "washer", 0.48, 7.15, 0),
        item(`${suite}-utility-sink`, "sink", 0.45, 8.2, 0),
      ],
    },
    {
      id: suiteBathroom,
      type: "bathroom",
      boundary: rect(0, 8.83, WET_WIDTH, SUITE_END),
      furniture: [
        item(`${suite}-toilet`, "toilet", 0.55, 9.8, 0),
        item(`${suite}-bath-sink`, "sink", 0.45, 10.65, 0),
      ],
    },
    {
      id: stairCore,
      type: "stair-core",
      boundary: rect(0, SUITE_END, WIDTH, STAIR_END),
      furniture: [item(`floor-${floorNumber}-shoe-cabinet`, "wardrobe", 4.65, 13.05, 90)],
    },
    {
      id: singleUtility,
      type: "utility",
      boundary: rect(0, STAIR_END, WET_WIDTH, 17),
      furniture: [
        item(`${single}-washer`, "washer", 1.15, 15.35, 0),
        item(`${single}-utility-sink`, "sink", 0.45, 16.25, 0),
      ],
    },
    {
      id: singleKitchen,
      type: "kitchen",
      boundary: rect(WET_WIDTH, STAIR_END, WIDTH, 17),
      furniture: [
        item(`${single}-counter`, "kitchen-counter", 4.48, 15.85, 90),
        item(`${single}-desk`, "desk", 2.2, 15.75, 0),
      ],
    },
    {
      id: singleBathroom,
      type: "bathroom",
      boundary: rect(0, 17, WET_WIDTH, LENGTH),
      furniture: [
        item(`${single}-toilet`, "toilet", 0.55, 18.85, 180),
        item(`${single}-bath-sink`, "sink", 0.45, 17.55, 0),
      ],
    },
    {
      id: singleBedroom,
      type: "single-bedroom",
      boundary: rect(WET_WIDTH, 17, WIDTH, LENGTH),
      furniture: [
        item(`${single}-bed`, "single-bed", 2.85, 18.85, 90),
        item(`${single}-wardrobe`, "wardrobe", 4.55, 18.5, 90),
      ],
    },
  ];

  return {
    id: `floor-${floorNumber}-autocad-layout`,
    floorNumber,
    width: WIDTH,
    length: LENGTH,
    units: [
      {
        id: `unit-${suite}`,
        roomCode: suiteRoomCode,
        type: "large-suite",
        boundary: rect(0, 0, WIDTH, SUITE_END),
        spaceIds: [suiteBedroom2, suiteBedroom1, suiteLiving, suiteKitchen, suiteUtility, suiteBathroom],
      },
      {
        id: `unit-${single}`,
        roomCode: singleRoomCode,
        type: "single-room",
        boundary: rect(0, STAIR_END, WIDTH, LENGTH),
        spaceIds: [singleUtility, singleKitchen, singleBathroom, singleBedroom],
      },
    ],
    spaces,
    walls: [
      { id: `f${floorNumber}-outer-top`, start: { x: 0, y: 0 }, end: { x: 0, y: LENGTH }, thickness: 0.15, height: 1.2 },
      { id: `f${floorNumber}-outer-bottom`, start: { x: WIDTH, y: 0 }, end: { x: WIDTH, y: LENGTH }, thickness: 0.15, height: 1.2 },
      { id: `f${floorNumber}-outer-front`, start: { x: 0, y: 0 }, end: { x: WIDTH, y: 0 }, thickness: 0.15, height: 1.2 },
      { id: `f${floorNumber}-outer-rear`, start: { x: 0, y: LENGTH }, end: { x: WIDTH, y: LENGTH }, thickness: 0.15, height: 1.2 },
      { id: `f${floorNumber}-bedroom2-divider`, start: { x: 0, y: 3.3 }, end: { x: WIDTH, y: 3.3 }, thickness: 0.1, height: 1.2 },
      { id: `f${floorNumber}-bedroom1-side`, start: { x: BEDROOM_WIDTH, y: 3.3 }, end: { x: BEDROOM_WIDTH, y: 6.64 }, thickness: 0.1, height: 1.2 },
      { id: `f${floorNumber}-bedroom1-end`, start: { x: 0, y: 6.64 }, end: { x: BEDROOM_WIDTH, y: 6.64 }, thickness: 0.1, height: 1.2 },
      { id: `f${floorNumber}-suite-wet-split`, start: { x: 0, y: 8.83 }, end: { x: WET_WIDTH, y: 8.83 }, thickness: 0.1, height: 1.2 },
      { id: `f${floorNumber}-suite-wet-bottom`, start: { x: WET_WIDTH, y: 8 }, end: { x: WET_WIDTH, y: SUITE_END }, thickness: 0.1, height: 1.2 },
      { id: `f${floorNumber}-suite-stair`, start: { x: 0, y: SUITE_END }, end: { x: WIDTH, y: SUITE_END }, thickness: 0.15, height: 1.2 },
      { id: `f${floorNumber}-stair-single`, start: { x: 0, y: STAIR_END }, end: { x: WIDTH, y: STAIR_END }, thickness: 0.15, height: 1.2 },
      { id: `f${floorNumber}-single-wet-split`, start: { x: 0, y: 17 }, end: { x: WET_WIDTH, y: 17 }, thickness: 0.1, height: 1.2 },
      { id: `f${floorNumber}-single-wet-bottom`, start: { x: WET_WIDTH, y: 17 }, end: { x: WET_WIDTH, y: LENGTH }, thickness: 0.1, height: 1.2 },
    ],
    doors: [
      { id: `f${floorNumber}-door-bedroom2`, wallId: `f${floorNumber}-bedroom2-divider`, offset: 3.3, width: 0.85, hinge: "start", swingDirection: "counter-clockwise", openAngle: 90, connects: [suiteBedroom2, suiteLiving] },
      { id: `f${floorNumber}-door-bedroom1`, wallId: `f${floorNumber}-bedroom1-side`, offset: 2.15, width: 0.8, hinge: "end", swingDirection: "clockwise", openAngle: 90, connects: [suiteBedroom1, suiteLiving] },
      { id: `f${floorNumber}-door-suite-bath`, wallId: `f${floorNumber}-suite-wet-split`, offset: 0.7, width: 0.75, hinge: "start", swingDirection: "clockwise", openAngle: 90, connects: [suiteUtility, suiteBathroom] },
      { id: `f${floorNumber}-door-suite-main`, wallId: `f${floorNumber}-suite-stair`, offset: 3.95, width: 0.9, hinge: "end", swingDirection: "clockwise", openAngle: 90, connects: [suiteLiving, stairCore] },
      { id: `f${floorNumber}-door-single-main`, wallId: `f${floorNumber}-stair-single`, offset: 3.25, width: 0.9, hinge: "start", swingDirection: "counter-clockwise", openAngle: 90, connects: [stairCore, singleKitchen] },
      { id: `f${floorNumber}-door-single-bath`, wallId: `f${floorNumber}-single-wet-split`, offset: 0.7, width: 0.75, hinge: "end", swingDirection: "counter-clockwise", openAngle: 90, connects: [singleUtility, singleBathroom] },
    ],
  };
}

export const floor2Layout = createUpperFloorLayout(2, "PN 31-02", "PN 31-03");
export const floor3Layout = createUpperFloorLayout(3, "PN 31-04", "PN 31-05");
export const floor4Layout = createUpperFloorLayout(4, "PN 31-06", "PN 31-07");
