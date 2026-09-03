import type { Building, Floor, Room } from '@/components/buildings/building.types';
import { BuildingResponse } from '../api/buildings.api';
import { FloorResponse } from '../api/floors.api';
import { RoomResponse } from '../api/rooms.api';

const toOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const mapApiRentalTypeToUi = (value: unknown): "whole" | "shared" => {
  if (typeof value !== "string") return "whole";
  const normalized = value.toUpperCase();
  if (normalized === "SHARED") return "shared";
  return "whole";
};

// Map API building to UI building
export const adaptBuilding = (apiBuilding: any): Building => {
  return {
    id: apiBuilding.id,
    name: apiBuilding.name || apiBuilding.code,
    code: apiBuilding.code,
    address: apiBuilding.address || "Chưa có địa chỉ",
    images: apiBuilding.images && apiBuilding.images.length > 0 ? apiBuilding.images : [],
    notes: apiBuilding.notes,
    status: apiBuilding.deletedAt ? "inactive" : "active",
    displayOrder: Number(apiBuilding.displayOrder) || 0,
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

export const isTempResidenceDeclared = (customer: any, roomId?: string): boolean => {
  if (!customer) return false;
  if (Array.isArray(customer.idImages) && customer.idImages.includes("TEMP_RESIDENCE_DECLARED")) {
    return true;
  }
  if (typeof window !== "undefined") {
    if (customer.id && localStorage.getItem(`homeland_temp_residence_${customer.id}`) === "true") {
      return true;
    }
  }
  return false;
};

export const adaptRoom = (apiRoom: any): Room => {
  const allContracts = (apiRoom.contracts && apiRoom.contracts.length > 0)
    ? apiRoom.contracts.filter((c: any) => !c.deletedAt)
    : [];
  const activeContract = allContracts.length > 0 ? allContracts[0] : null;
  // Map Prisma status to UI status, but prefer active/active-like contract data when available
  let uiStatus = "vacant" as any;
  if (activeContract) {
    const endDateMs = activeContract.endDate ? new Date(activeContract.endDate).getTime() : 0;
    const daysRemaining = Number.isFinite(endDateMs) ? Math.ceil((endDateMs - Date.now()) / (1000 * 3600 * 24)) : null;
    if (activeContract.status === "EXPIRING" || (daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 30)) {
      uiStatus = "expiring_soon";
    } else {
      uiStatus = "occupied";
    }
  } else if (apiRoom.status === "OCCUPIED") uiStatus = "occupied";
  else if (apiRoom.status === "MAINTENANCE") uiStatus = "maintenance";
  else if (apiRoom.status === "RESERVED") uiStatus = "deposited";
  else if (apiRoom.status === "AVAILABLE" || apiRoom.status === "CLEANING") uiStatus = "vacant";

  const tenant = activeContract && activeContract.customer ? {
    id: activeContract.customer.id,
    name: activeContract.customer.fullName,
    phone: activeContract.customer.phone,
    email: activeContract.customer.email || "",
    cccd: activeContract.customer.identityNo || "",
    gender: activeContract.customer.gender || "",
    birthDate: activeContract.customer.birthDate || "",
    nationality: activeContract.customer.nationality || "",
    address: activeContract.customer.address || "",
    emergencyPhone: activeContract.customer.emergencyPhone || "",
    idImages: activeContract.customer.idImages || [],
    tempResidence: isTempResidenceDeclared(activeContract.customer, apiRoom.id),
  } : undefined;

  const contract = activeContract ? {
    id: activeContract.id,
    code: activeContract.code,
    startDate: activeContract.startDate,
    endDate: activeContract.endDate,
    deposit: Number(activeContract.depositMoney) || 0,
    rentPrice: Number(activeContract.monthlyRent) || 0,
    firstPaymentDate: activeContract.firstPaymentDate,
    signedAt: activeContract.signedAt,
    purpose: activeContract.purpose
  } : undefined;
  const activeRent = contract?.rentPrice && contract.rentPrice > 0 ? contract.rentPrice : 0;

  // Additional contract holders (2nd, 3rd, etc.) => sharedTenants with isRep: true
  const additionalContractTenants = allContracts.slice(1).map((c: any) => c.customer ? {
    id: c.customer.id,
    name: c.customer.fullName,
    phone: c.customer.phone,
    email: c.customer.email || "",
    cccd: c.customer.identityNo || "",
    gender: c.customer.gender || "",
    birthDate: c.customer.birthDate || "",
    nationality: c.customer.nationality || "",
    address: c.customer.address || "",
    emergencyPhone: c.customer.emergencyPhone || "",
    idImages: c.customer.idImages || [],
    tempResidence: isTempResidenceDeclared(c.customer, apiRoom.id),
    isRep: true,
    contractId: c.id,
    contractCode: c.code,
    startDate: c.startDate,
    endDate: c.endDate,
    deposit: Number(c.depositMoney) || 0,
    rentPrice: Number(c.monthlyRent) || 0,
    firstPaymentDate: c.firstPaymentDate,
    signedAt: c.signedAt,
    purpose: c.purpose,
    remainingDays: c.endDate ? Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (1000 * 3600 * 24)) : 0,
    bedPosition: "",
    invoices: [],
    paymentHistory: [],
    debt: 0,
    paymentStatus: "paid" as any
  } : null).filter(Boolean);

  // Co-representatives on any contract (e.g. 2nd representative on same contract)
  const contractCoReps = allContracts.flatMap((c: any) =>
    (c.coRepresentatives || []).map((rep: any) => ({
      id: rep.id,
      name: rep.fullName || rep.name,
      phone: rep.phone || "",
      email: rep.email || "",
      cccd: rep.identityNo || rep.cccd || "",
      gender: rep.gender || "",
      birthDate: rep.birthDate || "",
      nationality: rep.nationality || "",
      address: rep.address || "",
      emergencyPhone: rep.emergencyPhone || "",
      idImages: rep.idImages || [],
      tempResidence: isTempResidenceDeclared(rep, apiRoom.id),
      isRep: true,
      contractId: c.id,
      contractCode: c.code,
      startDate: c.startDate,
      endDate: c.endDate,
      deposit: Number(c.depositMoney) || 0,
      rentPrice: Number(c.monthlyRent) || 0,
      firstPaymentDate: c.firstPaymentDate,
      signedAt: c.signedAt,
      purpose: c.purpose,
      remainingDays: c.endDate ? Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (1000 * 3600 * 24)) : 0,
      bedPosition: "",
      invoices: [],
      paymentHistory: [],
      debt: 0,
      paymentStatus: "paid" as any
    }))
  );

  // Combine additional contract tenants and co-representatives, avoiding primary tenant duplication
  const allCoRepresentatives = [...additionalContractTenants, ...contractCoReps].filter(
    (item, index, self) =>
      item &&
      item.id !== tenant?.id &&
      self.findIndex((other) => other?.id === item.id) === index
  );

  // Roommates (people in room without own contract)
  const roommatesList = (apiRoom.roommates || []).map((r: any) => ({
    id: r.id,
    name: r.fullName,
    phone: r.phone || "",
    email: r.email || "",
    cccd: r.identityNo || "",
    gender: r.gender || "",
    birthDate: r.birthDate || "",
    nationality: r.nationality || "",
    address: r.address || "",
    emergencyPhone: r.emergencyPhone || "",
    idImages: r.idImages || [],
    tempResidence: isTempResidenceDeclared(r, apiRoom.id),
    isRep: false,
    bedPosition: "",
    invoices: [],
    paymentHistory: [],
    debt: 0,
    paymentStatus: "paid" as any,
    remainingDays: 0
  }));

  const isShared = mapApiRentalTypeToUi(apiRoom.rentalType) === "shared";
  const sharedTenants = isShared ? [...allCoRepresentatives, ...roommatesList] : allCoRepresentatives;
  const roommates = isShared ? [] : roommatesList;

  return {
    id: apiRoom.id,
    name: apiRoom.name || apiRoom.code,
    code: apiRoom.code,
    number: apiRoom.name || apiRoom.code,
    type: "1PN",
    rentalType: mapApiRentalTypeToUi(apiRoom.rentalType),
    price: activeRent,
    status: uiStatus,
    monthlyPrice: activeRent,
    area: toOptionalNumber(apiRoom.area),
    capacity: toOptionalNumber(apiRoom.capacity),
    bedCount: toOptionalNumber(apiRoom.bedCount),
    images: apiRoom.images && apiRoom.images.length > 0 ? apiRoom.images : [],
    notes: apiRoom.notes,
    building: apiRoom.building,
    buildingName: apiRoom.building?.name || apiRoom.building?.code || apiRoom.buildingCode || "",
    tenant,
    roommates,
    contract,
    invoices: [],
    paymentHistory: [],
    debt: 0,
    sharedTenants,
    attachments: []
  };
};
