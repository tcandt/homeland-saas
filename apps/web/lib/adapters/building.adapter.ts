import { Building, Floor, Room } from '@/components/buildings/mockData';
import { BuildingResponse } from '../api/buildings.api';
import { FloorResponse } from '../api/floors.api';
import { RoomResponse } from '../api/rooms.api';

// Map API building to UI building
export const adaptBuilding = (apiBuilding: any): Building => {
  return {
    id: apiBuilding.id,
    name: apiBuilding.name || apiBuilding.code,
    code: apiBuilding.code,
    address: apiBuilding.address || "Chưa có địa chỉ",
    images: apiBuilding.images && apiBuilding.images.length > 0 ? apiBuilding.images : [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop"
    ],
    notes: apiBuilding.notes,
    status: apiBuilding.deletedAt ? "inactive" : "active",
    floors: (apiBuilding.floors || []).map((f: any) => adaptFloor(f, apiBuilding.rooms || []))
  };
};

export const adaptFloor = (apiFloor: any, allRooms: any[] = []): Floor => {
  // If the backend returned rooms flattened on the building, we need to filter them for this floor
  const floorRooms = apiFloor.rooms || allRooms.filter((r: any) => r.floorId === apiFloor.id);
  
  return {
    id: apiFloor.id,
    number: apiFloor.level || apiFloor.number || 1,
    notes: apiFloor.usageNote || apiFloor.notes,
    rooms: floorRooms.map((r: any) => adaptRoom(r))
  };
};

export const adaptRoom = (apiRoom: any): Room => {
  return {
    id: apiRoom.id,
    name: apiRoom.name,
    code: apiRoom.code,
    status: apiRoom.status || "AVAILABLE",
    monthlyPrice: Number(apiRoom.monthlyPrice) || 0,
    area: apiRoom.area,
    capacity: apiRoom.capacity,
    bedCount: apiRoom.bedCount,
    images: [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=450&fit=crop"
    ],
    notes: apiRoom.notes,
    tenant: apiRoom.tenant,
    roommates: [],
    contract: apiRoom.contract,
    invoices: [],
    paymentHistory: [],
    debt: 0,
    sharedTenants: [],
    attachments: []
  };
};
