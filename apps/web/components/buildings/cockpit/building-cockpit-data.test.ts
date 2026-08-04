import { describe, expect, it } from "vitest";
import type { Building, Room } from "../building.types";
import { createCockpitBuildingSpec } from "./building-cockpit-data";
import { buildingTemplateRegistry, normalizeBuildingCode, resolveBuildingTemplate } from "./building-template-registry";
import { getBuildingMetrics } from "./building-cockpit-metrics";

const floors = [1, 2, 3, 4].map((number) => ({ id: `floor-${number}`, number, rooms: [] }));
const building = (code: string): Building => ({
  id: `building-${code}`,
  code,
  name: code,
  address: "HomeLand Premium",
  images: [],
  status: "active",
  floors,
});

const operationalRoom = (overrides: Partial<Room>): Room => ({
  id: "room-31-01",
  name: "PN 31-01",
  code: "PN 31-01",
  number: "31-01",
  type: "Studio",
  rentalType: "whole",
  price: 5_000_000,
  status: "vacant",
  monthlyPrice: 5_000_000,
  images: [],
  ...overrides,
});

describe("building cockpit template resolver", () => {
  it("resolves exactly four managed buildings across dot and dash aliases", () => {
    expect(buildingTemplateRegistry).toHaveLength(4);
    expect(normalizeBuildingCode("lk01.32")).toBe("LK01-32");
    expect(resolveBuildingTemplate("LK08.25")?.layoutStatus).toBe("configured");
  });

  it("maps LK01-32 to the shared topology without copying operational data", () => {
    const spec = createCockpitBuildingSpec([building("LK01.32")], "LK01-32");
    expect(spec?.templateId).toBe("LK01_STANDARD");
    expect(spec?.floors).toHaveLength(4);
    expect(spec?.floors.flatMap((floor) => floor.rooms).map((room) => room.code)).toEqual([
      "32-01", "32-02", "32-03", "32-04", "32-05", "32-06", "32-07",
    ]);
    expect(spec?.floors.flatMap((floor) => floor.rooms).every((room) => room.status === "vacant" && room.contract === undefined && room.monthlyRent === undefined)).toBe(true);
    expect(spec?.floors.flatMap((floor) => floor.rooms).every((room) => room.entryDoorCount >= 1)).toBe(true);
    expect(spec?.floors.flatMap((floor) => floor.rooms).some((room) => room.type === "Căn 2PN mini + phòng khách")).toBe(true);
    expect(spec && getBuildingMetrics(spec)).toMatchObject({
      totalRooms: 0,
      occupiedRooms: 0,
      vacantRooms: 0,
      monthlyRevenue: 0,
    });
  });

  it("aggregates only rooms synchronized from operational data", () => {
    const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const source = building("LK01-31");
    source.floors = [
      {
        id: "floor-1",
        number: 1,
        rooms: [
          operationalRoom({
            status: "occupied",
            tenant: {
              id: "tenant-1",
              name: "Nguyễn Văn A",
              phone: "0900000000",
              email: "tenant@example.com",
              cccd: "001000000001",
              idImages: [],
              tempResidence: true,
            },
            contract: {
              id: "contract-1",
              code: "HD-001",
              startDate: "2025-01-01",
              endDate: tenDaysFromNow,
              deposit: 10_000_000,
              rentPrice: 5_000_000,
            },
            invoices: [{
              id: "invoice-1",
              code: "INV-001",
              amount: 5_000_000,
              dueDate: yesterday,
              status: "unpaid",
              type: "rent",
            }],
          }),
        ],
      },
      {
        id: "floor-2",
        number: 2,
        rooms: [operationalRoom({ id: "room-31-02", name: "PN 31-02", code: "PN 31-02", number: "31-02" })],
      },
      { id: "floor-3", number: 3, rooms: [] },
      { id: "floor-4", number: 4, rooms: [] },
    ];

    const spec = createCockpitBuildingSpec([source], "LK01-31");

    expect(spec?.floors.flatMap((floor) => floor.rooms)).toHaveLength(7);
    expect(spec?.floors.flatMap((floor) => floor.rooms).filter((room) => room.sourceRoom)).toHaveLength(2);
    expect(spec && getBuildingMetrics(spec)).toMatchObject({
      totalRooms: 2,
      occupiedRooms: 1,
      vacantRooms: 1,
      residentCount: 1,
      monthlyRevenue: 5_000_000,
      depositTotal: 10_000_000,
      occupancyRate: 50,
      expiringContracts: 1,
      declaredTemporaryResidence: 1,
      incompleteTemporaryResidence: 0,
      overduePayments: 1,
    });
  });

  it("counts only temporary residence registrations and derives max occupancy from beds", () => {
    const source = building("LK01-31");
    source.floors = [
      {
        id: "floor-1",
        number: 1,
        rooms: [
          operationalRoom({
            status: "occupied",
            bedCount: 1,
            tenant: {
              id: "tenant-without-temp-residence",
              name: "Nguyen Van B",
              phone: "0900000001",
              email: "tenant-b@example.com",
              cccd: "001000000002",
              idImages: [],
              tempResidence: false,
            },
            contract: {
              id: "contract-2",
              code: "HD-002",
              startDate: "2025-01-01",
              endDate: "2026-01-01",
              deposit: 10_000_000,
              rentPrice: 6_000_000,
            },
          }),
        ],
      },
      {
        id: "floor-2",
        number: 2,
        rooms: [
          operationalRoom({
            id: "room-31-02",
            name: "PN 31-02",
            code: "PN 31-02",
            number: "31-02",
            bedCount: 2,
            status: "occupied",
            tenant: {
              id: "tenant-with-temp-residence",
              name: "Nguyen Van C",
              phone: "0900000002",
              email: "tenant-c@example.com",
              cccd: "001000000003",
              idImages: [],
              tempResidence: true,
            },
          }),
        ],
      },
      { id: "floor-3", number: 3, rooms: [] },
      { id: "floor-4", number: 4, rooms: [] },
    ];

    const rooms = createCockpitBuildingSpec([source], "LK01-31")?.floors.flatMap((floor) => floor.rooms);
    expect(rooms?.find((room) => room.code === "31-01")).toMatchObject({ capacity: 2, occupants: 0 });
    expect(rooms?.find((room) => room.code === "31-02")).toMatchObject({ capacity: 4, occupants: 1 });
  });

  it("maps LK08 fixed room topology while keeping metrics tied to operational data", () => {
    const lk0824 = createCockpitBuildingSpec([building("LK08.24")], "LK08-24");
    expect(lk0824?.layoutStatus).toBe("configured");
    expect(lk0824?.templateId).toBe("LK08_STANDARD");
    expect(lk0824?.floors).toHaveLength(4);
    expect(lk0824?.floors.map((floor) => floor.roomCodes)).toEqual([
      ["P24-01"],
      ["P24-02", "P24-03", "P24-04"],
      ["P24-05", "P24-06", "P24-07"],
      ["P24-08", "P24-09", "P24-10"],
    ]);
    expect(lk0824?.floors.flatMap((floor) => floor.rooms).map((room) => room.code)).toEqual([
      "P24-01", "P24-02", "P24-03", "P24-04", "P24-05", "P24-06", "P24-07", "P24-08", "P24-09", "P24-10",
    ]);
    expect(lk0824 && getBuildingMetrics(lk0824)).toMatchObject({
      totalRooms: 0,
      occupiedRooms: 0,
      vacantRooms: 0,
      monthlyRevenue: 0,
    });

    const lk0825 = createCockpitBuildingSpec([building("LK08.25")], "LK08-25");
    expect(lk0825?.floors.map((floor) => floor.roomCodes)).toEqual([
      ["P25-01"],
      ["P25-02", "P25-03", "P25-04"],
      ["P25-05", "P25-06", "P25-07"],
      ["P25-08", "P25-09", "P25-10"],
    ]);
    expect(lk0824?.floors.flatMap((floor) => floor.rooms)).toHaveLength(10);
    expect(lk0825?.floors.flatMap((floor) => floor.rooms)).toHaveLength(10);
  });

  it("marks LK08 as coming soon when the building is missing from DB", () => {
    const spec = createCockpitBuildingSpec([building("LK01.31")], "LK08-24");
    expect(spec).toBeNull();
  });

  it("syncs LK08 rooms from DB when operational records exist", () => {
    const source = building("LK08.24");
    source.floors = [
      {
        id: "floor-1",
        number: 1,
        rooms: [operationalRoom({ id: "room-p24-01", code: "P24-01", name: "P24-01", number: "P24-01" })],
      },
      { id: "floor-2", number: 2, rooms: [] },
      { id: "floor-3", number: 3, rooms: [] },
      { id: "floor-4", number: 4, rooms: [] },
    ];
    const spec = createCockpitBuildingSpec([source], "LK08-24");
    expect(spec?.floors).toHaveLength(4);
    expect(spec?.floors.flatMap((floor) => floor.rooms).filter((room) => room.sourceRoom)).toHaveLength(1);
    expect(spec && getBuildingMetrics(spec)).toMatchObject({
      totalRooms: 1,
      occupiedRooms: 0,
      vacantRooms: 1,
      monthlyRevenue: 0,
    });
  });
});
