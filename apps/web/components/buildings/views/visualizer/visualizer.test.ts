import { describe, it, expect } from "vitest";
import { 
  mapRoomStatus, 
  toRoomOperationalItem, 
  toFloorOperationalViewModel 
} from "./buildingOperationalAdapter";
import type { Room, Floor, Tenant, Invoice } from "../../building.types";
import dayjs from "dayjs";

describe("Building Visualizer Adapter & Logic Tests", () => {

  // Test mapRoomStatus translations
  it("maps room statuses correctly", () => {
    expect(mapRoomStatus("OCCUPIED")).toBe("occupied");
    expect(mapRoomStatus("VACANT")).toBe("vacant");
    expect(mapRoomStatus("DEPOSITED")).toBe("deposited");
    expect(mapRoomStatus("MAINTENANCE")).toBe("maintenance");
    expect(mapRoomStatus("INVALID_STATUS")).toBe("unknown");
  });

  // Test toRoomOperationalItem with vacant room
  it("adapts vacant rooms with fallback default values", () => {
    const mockRoom: Room = {
      id: "room-1",
      name: "101",
      code: "101",
      number: "101",
      type: "Studio",
      rentalType: "whole",
      price: 5000000,
      monthlyPrice: 5000000,
      status: "vacant",
      images: []
    };

    const result = toRoomOperationalItem(mockRoom);
    expect(result.primaryStatus).toBe("vacant");
    expect(result.currentOccupants).toBe(0);
    expect(result.warnings).toEqual([]);
    expect(result.paymentStatus).toBe("unknown");
    expect(result.tempResidenceStatus).toBe("unknown");
  });

  // Test toRoomOperationalItem with active contract and remaining contract days
  it("calculates remaining contract days timezone-safely", () => {
    const today = dayjs().startOf("day");
    const endDate = today.add(10, "day").toISOString();

    const mockRoom: Room = {
      id: "room-2",
      name: "102",
      code: "102",
      number: "102",
      type: "Studio",
      rentalType: "whole",
      price: 6000000,
      monthlyPrice: 6000000,
      status: "occupied",
      images: [],
      tenant: {
        id: "tenant-1",
        name: "Nguyen Van A",
        phone: "0900000000",
        email: "a@test.com",
        cccd: "123456789",
        idImages: [],
        tempResidence: true
      },
      contract: {
        id: "contract-1",
        code: "C-1",
        startDate: today.subtract(20, "day").toISOString(),
        endDate: endDate,
        deposit: 6000000,
        rentPrice: 6000000
      }
    };

    const result = toRoomOperationalItem(mockRoom);
    expect(result.remainingContractDays).toBe(10);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].id).toBe("contract_expiring");
  });

  // Test unpaid invoices before/after due dates
  it("distinguishes unpaid invoices before and after due date correctly", () => {
    const today = dayjs().startOf("day");
    
    const mockRoom: Room = {
      id: "room-3",
      name: "103",
      code: "103",
      number: "103",
      type: "Studio",
      rentalType: "whole",
      price: 4500000,
      monthlyPrice: 4500000,
      status: "occupied",
      images: []
    };

    // Invoice not yet due (due tomorrow)
    const dueInvoice: Invoice = {
      id: "inv-1",
      code: "103",
      amount: 4500000,
      dueDate: today.add(1, "day").toISOString(),
      status: "unpaid",
      type: "rent"
    };

    const resultDue = toRoomOperationalItem(mockRoom, [dueInvoice]);
    expect(resultDue.paymentStatus).toBe("due");
    expect(resultDue.warnings.some(w => w.id === "payment_overdue")).toBe(false);

    // Invoice overdue (due yesterday)
    const overdueInvoice: Invoice = {
      id: "inv-2",
      code: "103",
      amount: 4500000,
      dueDate: today.subtract(1, "day").toISOString(),
      status: "unpaid",
      type: "rent"
    };

    const resultOverdue = toRoomOperationalItem(mockRoom, [overdueInvoice]);
    expect(resultOverdue.paymentStatus).toBe("overdue");
    expect(resultOverdue.warnings.some(w => w.id === "payment_overdue")).toBe(true);
  });

  // Test temporary residence status declaration configurations
  it("calculates temporary residence statuses correctly", () => {
    const mockRoom: Room = {
      id: "room-4",
      name: "104",
      code: "104",
      number: "104",
      type: "Studio",
      rentalType: "whole",
      price: 5000000,
      monthlyPrice: 5000000,
      status: "occupied",
      images: [],
      tenant: {
        id: "tenant-2",
        name: "Nguyen Van B",
        phone: "0900000001",
        email: "b@test.com",
        cccd: "123456780",
        idImages: [],
        tempResidence: false // missing declaration
      },
      roommates: [
        {
          id: "rm-1",
          name: "Nguyen Van C",
          phone: "0900000002",
          email: "c@test.com",
          cccd: "123456781",
          idImages: [],
          tempResidence: true // declared
        }
      ]
    };

    const result = toRoomOperationalItem(mockRoom);
    expect(result.tempResidenceStatus).toBe("partial");
    expect(result.warnings.some(w => w.id === "temp_residence_missing")).toBe(true);
  });

  // Test aggregate floor metrics calculations
  it("aggregates floor metrics correct-functionally", () => {
    const today = dayjs().startOf("day");
    const mockFloor: Floor = {
      id: "floor-1",
      number: 2,
      rooms: [
        {
          id: "r1",
          name: "201",
          code: "201",
          number: "201",
          type: "Studio",
          rentalType: "whole",
          price: 5000000,
          monthlyPrice: 5000000,
          status: "vacant",
          images: []
        },
        {
          id: "r2",
          name: "202",
          code: "202",
          number: "202",
          type: "Studio",
          rentalType: "whole",
          price: 6000000,
          monthlyPrice: 6000000,
          status: "occupied",
          images: [],
          tenant: {
            id: "t1",
            name: "John Doe",
            phone: "123",
            email: "",
            cccd: "",
            idImages: [],
            tempResidence: true
          }
        }
      ]
    };

    const result = toFloorOperationalViewModel(mockFloor);
    expect(result.totalRooms).toBe(2);
    expect(result.occupiedRooms).toBe(1);
    expect(result.vacantRooms).toBe(1);
    expect(result.occupancyRate).toBe(50);
    expect(result.residentCount).toBe(1);
    expect(result.alertCount).toBe(0);
  });

});
