import { Building, Floor, Room } from '@/components/buildings/mockData';
import { BuildingResponse } from '../api/buildings.api';
import { FloorResponse } from '../api/floors.api';
import { RoomResponse } from '../api/rooms.api';

// Map API building to UI building
export const adaptBuilding = (apiBuilding: BuildingResponse): Building => {
  return {
    id: apiBuilding.id,
    name: apiBuilding.name,
    address: apiBuilding.address,
    images: apiBuilding.images && apiBuilding.images.length > 0 ? apiBuilding.images : [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop"
    ],
    notes: apiBuilding.notes,
    status: apiBuilding.status,
    floors: (apiBuilding.floors || []).map(f => adaptFloor(f))
  };
};

export const adaptFloor = (apiFloor: any): Floor => {
  return {
    id: apiFloor.id,
    number: apiFloor.number,
    notes: apiFloor.notes,
    rooms: (apiFloor.rooms || []).map((r: any) => adaptRoom(r))
  };
};

export const adaptRoom = (apiRoom: any): Room => {
  return {
    id: apiRoom.id,
    number: apiRoom.code || apiRoom.name || apiRoom.number,
    status: apiRoom.status || 'vacant',
    type: apiRoom.type as any || 'Studio',
    price: apiRoom.price || 0,
    area: apiRoom.area || 0,
    capacity: apiRoom.capacity || 2,
    images: apiRoom.images && apiRoom.images.length > 0 ? apiRoom.images : [
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=450&fit=crop"
    ],
    rentalType: apiRoom.rentalType || 'whole',
    notes: apiRoom.notes,
    tenant: apiRoom.tenant,
    roommates: apiRoom.roommates || [],
    contract: apiRoom.contract,
    invoices: apiRoom.invoices || [],
    paymentHistory: apiRoom.paymentHistory || [],
    debt: apiRoom.debt || 0,
    sharedTenants: apiRoom.sharedTenants || [],
    attachments: apiRoom.attachments || []
  };
};
