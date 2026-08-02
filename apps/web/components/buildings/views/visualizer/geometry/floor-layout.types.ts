export interface Point2D {
  x: number;
  y: number;
}

export interface WallSegment {
  id: string;
  start: Point2D;
  end: Point2D;
  thickness: number; // in meters (e.g. 0.1, 0.2)
  height: number;    // in meters (e.g. 1.2)
}

export interface DoorOpening {
  id: string;
  wallId: string;
  offset: number;     // position along the wall from start point (m)
  width: number;      // door width (m)
  hinge: "start" | "end";
  swingDirection: "clockwise" | "counter-clockwise";
  openAngle: number;  // in degrees (e.g. 90)
  connects: [string, string]; // ID of the two spaces it connects
}

export interface SpaceSpec {
  id: string;
  type:
    | "mini-bedroom"
    | "living-room"
    | "single-bedroom"
    | "bathroom"
    | "kitchen"
    | "stair-core"
    | "corridor"
    | "utility"
    | "parking";
  boundary: Point2D[]; // closed polygon path
  furniture: FurnitureItemSpec[];
}

export interface FurnitureItemSpec {
  id: string;
  type:
    | "single-bed"
    | "double-bed"
    | "sofa"
    | "coffee-table"
    | "desk"
    | "toilet"
    | "sink"
    | "kitchen-counter"
    | "washer"
    | "wardrobe"
    | "refrigerator"
    | "motorbike";
  x: number;          // center X position (m)
  y: number;          // center Y position (m)
  rotation: number;   // angle in degrees (0-360)
}

export interface ApartmentUnitSpec {
  id: string;
  roomCode: string;   // Room name/code like "PN 31-02"
  type: "large-suite" | "single-room";
  boundary: Point2D[]; // overall boundary of the apartment unit
  spaceIds: string[]; // references to SpaceSpec.id inside this unit
}

export interface FloorLayoutSpec {
  id: string;
  floorNumber: number;
  width: number;      // 5
  length: number;     // 20
  units: ApartmentUnitSpec[];
  walls: WallSegment[];
  doors: DoorOpening[];
  spaces: SpaceSpec[];
}
