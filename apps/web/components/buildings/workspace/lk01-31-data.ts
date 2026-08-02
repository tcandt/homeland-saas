import type { Building, Floor, Room, Tenant, Contract, Invoice } from "../building.types";

const mockTenants: Record<string, Tenant> = {
  "tenant-01": {
    id: "tenant-01",
    name: "Nguyễn Văn A",
    phone: "0901234567",
    email: "vana@example.com",
    cccd: "123456789012",
    idImages: [],
    tempResidence: true
  },
  "tenant-03": {
    id: "tenant-03",
    name: "Trần Thị B",
    phone: "0909876543",
    email: "thib@example.com",
    cccd: "987654321098",
    idImages: [],
    tempResidence: true
  },
  "tenant-04": {
    id: "tenant-04",
    name: "Phạm Văn C",
    phone: "0912345678",
    email: "vanc@example.com",
    cccd: "567890123456",
    idImages: [],
    tempResidence: false
  },
  "tenant-07": {
    id: "tenant-07",
    name: "Lê Thị D",
    phone: "0987654321",
    email: "thid@example.com",
    cccd: "345678901234",
    idImages: [],
    tempResidence: true
  }
};

const mockContracts: Record<string, Contract> = {
  "contract-01": {
    id: "contract-01",
    code: "HD-31-01-2026",
    startDate: "2026-01-01",
    endDate: "2027-01-01",
    deposit: 9750000,
    rentPrice: 6500000
  },
  "contract-03": {
    id: "contract-03",
    code: "HD-31-03-2026",
    startDate: "2026-02-15",
    endDate: "2027-02-15",
    deposit: 9750000,
    rentPrice: 6500000
  },
  "contract-04": {
    id: "contract-04",
    code: "HD-31-04-2026",
    startDate: "2026-03-01",
    endDate: "2027-03-01",
    deposit: 14250000,
    rentPrice: 9500000
  },
  "contract-07": {
    id: "contract-07",
    code: "HD-31-07-2026",
    startDate: "2026-04-01",
    endDate: "2027-04-01",
    deposit: 9750000,
    rentPrice: 6500000
  }
};

export function adaptBuildingForLK01_31(building: Building): Building {
  // Deep copy to prevent modifying the query cache directly
  const copy = JSON.parse(JSON.stringify(building)) as Building;
  copy.name = "LK01-31";
  copy.code = "LK01-31";
  copy.address = "Khu đô thị Ân Phú, Phường Tân An, Buôn Ma Thuột";
  
  // Custom 4 floors matching mapping
  const customFloors: Floor[] = [];
  
  // Floor levels
  const floorData = [
    { level: 1, name: "Tầng trệt", rooms: [
      { id: "room-pn-31-01", code: "PN 31-01", name: "PN 31-01", status: "occupied" as const, monthlyPrice: 6500000, capacity: 1, area: 25, type: "1PN" as const, tenant: mockTenants["tenant-01"], contract: mockContracts["contract-01"] }
    ]},
    { level: 2, name: "Tầng 2", rooms: [
      { id: "room-pn-31-02", code: "PN 31-02", name: "PN 31-02", status: "vacant" as const, monthlyPrice: 9500000, capacity: 2, area: 50, type: "2PN" as const, tenant: null, contract: undefined },
      { id: "room-pn-31-03", code: "PN 31-03", name: "PN 31-03", status: "occupied" as const, monthlyPrice: 6500000, capacity: 1, area: 25, type: "1PN" as const, tenant: mockTenants["tenant-03"], contract: mockContracts["contract-03"] }
    ]},
    { level: 3, name: "Tầng 3", rooms: [
      { id: "room-pn-31-04", code: "PN 31-04", name: "PN 31-04", status: "occupied" as const, monthlyPrice: 9500000, capacity: 2, area: 50, type: "2PN" as const, tenant: mockTenants["tenant-04"], contract: mockContracts["contract-04"] },
      { id: "room-pn-31-05", code: "PN 31-05", name: "PN 31-05", status: "vacant" as const, monthlyPrice: 6500000, capacity: 1, area: 25, type: "1PN" as const, tenant: null, contract: undefined }
    ]},
    { level: 4, name: "Tầng 4", rooms: [
      { id: "room-pn-31-06", code: "PN 31-06", name: "PN 31-06", status: "vacant" as const, monthlyPrice: 9500000, capacity: 2, area: 50, type: "2PN" as const, tenant: null, contract: undefined },
      { id: "room-pn-31-07", code: "PN 31-07", name: "PN 31-07", status: "occupied" as const, monthlyPrice: 6500000, capacity: 1, area: 25, type: "1PN" as const, tenant: mockTenants["tenant-07"], contract: mockContracts["contract-07"] }
    ]}
  ];

  // Build the floors array
  floorData.forEach((f, idx) => {
    // Attempt to preserve the real database floor ID if available
    const dbFloor = copy.floors[idx];
    const floorId = dbFloor?.id || `floor-lk01-31-f${f.level}`;
    
    const rooms = f.rooms.map((r, rIdx) => {
      // Attempt to map to real DB room ID to ensure operations like Modal work
      const dbRoom = dbFloor?.rooms[rIdx];
      return {
        ...r,
        id: dbRoom?.id || r.id,
        images: r.type === "2PN" 
          ? ["https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=400&q=80"]
          : ["https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=400&q=80"],
        rentalType: "whole" as const,
        price: r.monthlyPrice,
        number: r.code.replace("PN ", ""),
        bedCount: r.type === "2PN" ? 2 : 1
      };
    });

    customFloors.push({
      id: floorId,
      number: f.level,
      notes: `${f.name} của LK01-31`,
      rooms
    });
  });

  copy.floors = customFloors;
  return copy;
}

export function adaptBuildingGeneral(building: Building, code: string, name: string): Building {
  const copy = JSON.parse(JSON.stringify(building)) as Building;
  copy.code = code;
  copy.name = name;
  copy.address = `Đường Đào Trí, Quận 7, TP.HCM`;
  return copy;
}
