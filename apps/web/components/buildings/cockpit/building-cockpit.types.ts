import type { Contract, Room, RoomStatus } from "../building.types";
import type { FloorLayoutSpec, Point2D, SpaceSpec } from "../views/visualizer/geometry/floor-layout.types";
import type { BuildingLayoutStatus, BuildingTemplateId } from "./building-template-registry";

export type CockpitFloorId = "ground" | "1" | "2" | "3";
export type CockpitViewMode = "blueprint" | "model";

export interface RoomImageMap {
  roomId: string;
  floorId: CockpitFloorId;
  label: string;
  paths: string[];
  labelPosition: {
    x: number;
    y: number;
  };
}

export interface FloorImageMap {
  src: string;
  width: number;
  height: number;
  viewBox: string;
  rooms: RoomImageMap[];
}

export interface CockpitRoomSpace {
  id: string;
  name: string;
  type: SpaceSpec["type"];
  roomCode: string;
  polygon: Point2D[];
}

export interface CockpitRoomSpec {
  id: string;
  code: string;
  urlCode: string;
  floorId: CockpitFloorId;
  name: string;
  type: string;
  status: RoomStatus;
  estimatedArea: number;
  capacity: number;
  occupants: number;
  monthlyRent?: number;
  entryDoorCount: number;
  amenities: string[];
  polygon: Point2D[];
  childSpaces?: CockpitRoomSpace[];
  sourceRoom?: Room;
  contract?: Contract;
}

export interface CockpitFloorSpec {
  id: CockpitFloorId;
  dbNumber: number;
  label: string;
  shortLabel: string;
  roomCodes: string[];
  heightMeters: number;
  layout: FloorLayoutSpec;
  imageMap: FloorImageMap;
  rooms: CockpitRoomSpec[];
}

export interface CockpitBuildingSpec {
  id: string;
  code: string;
  name: string;
  statusLabel: string;
  templateId: BuildingTemplateId;
  layoutStatus: BuildingLayoutStatus;
  address: string;
  widthMeters: number;
  lengthMeters: number;
  overviewImage: {
    src: string;
    width: number;
    height: number;
  };
  floors: CockpitFloorSpec[];
  updatedAtLabel: string;
}
