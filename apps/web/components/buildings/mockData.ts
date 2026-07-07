export type RoomStatus = "AVAILABLE" | "RENTED" | "RESERVED" | "MAINTENANCE" | "UNAVAILABLE";

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string;
  cccd: string;
  idImages: string[]; // CCCD images
  tempResidence: boolean; // Khai báo tạm trú
}

export interface Invoice {
  id: string;
  code: string;
  amount: number;
  dueDate: string;
  status: "paid" | "unpaid" | "partial";
  type: "rent" | "service" | "deposit";
}

export interface PaymentHistoryItem {
  id: string;
  month: string;
  amount: number;
  date: string;
  method: string;
  status: "paid" | "partial";
}

export interface Contract {
  id: string;
  code: string;
  startDate: string;
  endDate: string;
  deposit: number;
  rentPrice: number;
  contractPdfUrl?: string;
}

export interface SharedTenant extends Tenant {
  bedPosition: string; // Vị trí giường
  deposit: number; // Tiền cọc riêng
  rentPrice: number; // Tiền thuê riêng
  startDate: string;
  endDate: string;
  remainingDays: number;
  contractPdfUrl?: string;
  invoices: Invoice[];
  paymentHistory: PaymentHistoryItem[];
  debt: number;
  paymentStatus: "paid" | "unpaid" | "partial";
}

export interface RoomAttachment {
  id: string;
  name: string;
  url: string;
  size: string;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  status: RoomStatus;
  monthlyPrice: number;
  area?: number;
  capacity?: number;
  bedCount?: number;
  images: string[];
  
  tenant?: Tenant;
  roommates?: Tenant[];
  contract?: Contract;
  invoices?: Invoice[];
  paymentHistory?: PaymentHistoryItem[];
  debt?: number;
  sharedTenants?: SharedTenant[];
  
  notes?: string;
  attachments?: RoomAttachment[];
}

export interface Floor {
  id: string;
  number: number;
  notes?: string;
  rooms: Room[];
}

export interface Building {
  id: string;
  name: string;
  code?: string;
  address: string;
  images: string[];
  notes?: string;
  status: "active" | "inactive";
  floors: Floor[];
}

// Generate realistic mock data for buildings
const generateSharedTenants = (roomId: string, count: number, pricePerBed: number): SharedTenant[] => {
  const names = [
    ["Trần Minh Anh", "0912345678", "minhanh@gmail.com"],
    ["Lê Hồng Sơn", "0987654321", "hongson@gmail.com"],
    ["Nguyễn Hải Đăng", "0905556677", "haidang@gmail.com"],
    ["Phạm Quốc Bảo", "0933445566", "quocbao@gmail.com"]
  ];
  
  return Array.from({ length: count }).map((_, i) => {
    const isUnpaid = (i % 3 === 0);
    const isPartial = !isUnpaid && (i % 4 === 1);
    const paymentStatus = isUnpaid ? "unpaid" : isPartial ? "partial" : "paid";
    
    return {
      id: `${roomId}-st-${i + 1}`,
      name: names[i % names.length][0],
      phone: names[i % names.length][1],
      email: names[i % names.length][2],
      cccd: `07920100${1234 + i}`,
      idImages: [
        "https://images.unsplash.com/photo-1557683316-973673baf926?w=200&h=150&fit=crop",
        "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=200&h=150&fit=crop"
      ],
      tempResidence: i % 4 !== 0, // 75% have temp residence registered
      bedPosition: `Giường ${String.fromCharCode(65 + i)}`,
      deposit: pricePerBed * 1.5,
      rentPrice: pricePerBed,
      startDate: "2025-09-01",
      endDate: "2026-09-01",
      remainingDays: 10 + ((i * 15) % 90),
      contractPdfUrl: "#",
      invoices: [
        { id: `inv-${roomId}-st-${i}-1`, code: `HD-${roomId}-ST${i}-0626`, amount: pricePerBed, dueDate: "2026-06-05", status: paymentStatus, type: "rent" },
        { id: `inv-${roomId}-st-${i}-2`, code: `HD-${roomId}-ST${i}-0526`, amount: pricePerBed, dueDate: "2026-05-05", status: "paid", type: "rent" }
      ],
      paymentHistory: [
        { id: `pay-${roomId}-st-${i}-1`, month: "05/2026", amount: pricePerBed, date: "2026-05-03", method: "Chuyển khoản", status: "paid" }
      ],
      debt: paymentStatus === "unpaid" ? pricePerBed : paymentStatus === "partial" ? pricePerBed / 2 : 0,
      paymentStatus
    };
  });
};

const generateRooms = (floorNumber: number, buildingId: string): Room[] => {
  return Array.from({ length: 6 }).map((_, i) => {
    const roomNum = `${floorNumber}0${i + 1}`;
    const id = `${buildingId}-f${floorNumber}-r${i + 1}`;
    
    // Choose status
    let status: RoomStatus = "vacant";
    if (i === 0) status = "occupied";
    else if (i === 1) status = "vacant";
    else if (i === 2) status = "expiring_soon";
    else if (i === 3) status = "deposited";
    else if (i === 4) status = "maintenance";
    else status = "occupied"; // default occupancy mix

    const isShared = i === 2 || i === 5; // Room 3 & 6 are Dorm/Ở ghép
    const type: RoomType = isShared ? "Dorm" : ["1PN", "2PN", "Studio", "Office"][i % 4] as RoomType;
    const basePrice = isShared ? 1800000 : (5000000 + (i % 3) * 1500000);
    const capacity = isShared ? 4 : (i % 2 === 0 ? 2 : 3);
    const area = 18 + (i % 3) * 8;

    const baseRoom: Room = {
      id,
      number: roomNum,
      status,
      type,
      price: basePrice,
      area,
      capacity,
      images: [
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=450&fit=crop",
        "https://images.unsplash.com/photo-1502672260266-1c1cd2cb94ca?w=600&h=450&fit=crop",
        "https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=600&h=450&fit=crop"
      ],
      rentalType: isShared ? "shared" : "whole",
      notes: i === 4 ? "Điều hòa bị hỏng, đang đợi thợ bảo trì." : "Phòng view đẹp, sạch sẽ thoáng mát.",
      attachments: [
        { id: `${id}-att-1`, name: "Ban_giao_noi_that.pdf", url: "#", size: "1.2 MB" },
        { id: `${id}-att-2`, name: "Anh_hien_trang.jpg", url: "#", size: "850 KB" }
      ]
    };

    if (isShared) {
      if (status === "occupied" || status === "expiring_soon") {
        baseRoom.sharedTenants = generateSharedTenants(id, status === "expiring_soon" ? 2 : 3, basePrice);
      }
    } else {
      if (status === "occupied" || status === "expiring_soon" || status === "deposited") {
        baseRoom.tenant = {
          id: `${id}-tenant`,
          name: ["Nguyễn Văn An", "Trần Thị Bình", "Lê Văn Cường", "Phạm Thu Thảo"][i % 4],
          phone: "0901234567",
          email: "khachthe@homeland.com",
          cccd: "079201007890",
          idImages: [
            "https://images.unsplash.com/photo-1557683316-973673baf926?w=200&h=150&fit=crop",
            "https://images.unsplash.com/photo-1557683311-eac922347aa1?w=200&h=150&fit=crop"
          ],
          tempResidence: i !== 0 // Let's make one room missing temporary residence
        };

        baseRoom.roommates = status === "occupied" ? [
          {
            id: `${id}-rm-1`,
            name: "Nguyễn Thị Đào",
            phone: "0908888999",
            email: "dao@gmail.com",
            cccd: "079201007891",
            idImages: [],
            tempResidence: true
          }
        ] : [];

        baseRoom.contract = {
          id: `con-${id}`,
          code: `HD-WHOLE-${roomNum}`,
          startDate: "2025-06-01",
          endDate: status === "expiring_soon" ? "2026-07-01" : "2026-12-31",
          deposit: basePrice * 2,
          rentPrice: basePrice,
          contractPdfUrl: "#"
        };

        // Payment status / invoices
        const isUnpaid = i === 0; // Let one have an unpaid invoice
        const paymentStatus = isUnpaid ? "unpaid" : "paid";
        
        baseRoom.invoices = [
          { id: `inv-${id}-1`, code: `INV-${roomNum}-0626`, amount: basePrice + 350000, dueDate: "2026-06-05", status: paymentStatus, type: "rent" },
          { id: `inv-${id}-2`, code: `INV-${roomNum}-0526`, amount: basePrice + 400000, dueDate: "2026-05-05", status: "paid", type: "rent" }
        ];

        baseRoom.paymentHistory = [
          { id: `pay-${id}-1`, month: "05/2026", amount: basePrice + 400000, date: "2026-05-04", method: "Momo", status: "paid" }
        ];
        
        baseRoom.debt = isUnpaid ? (basePrice + 350000) : 0;
      }
    }

    return baseRoom;
  });
};

const generateFloors = (buildingId: string, count: number): Floor[] => {
  return Array.from({ length: count }).map((_, i) => ({
    id: `${buildingId}-f${i + 1}`,
    number: i + 1,
    notes: `Tầng ${i + 1} - Thiết kế dạng căn hộ dịch vụ mini cao cấp.`,
    rooms: generateRooms(i + 1, buildingId)
  }));
};

export const masterBuildings: Building[] = [
  {
    id: "b1",
    name: "LK01.31 - Riverside House",
    address: "01 Đường Đào Trí, Phú Thuận, Quận 7, TP.HCM",
    images: [
      "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop"
    ],
    notes: "Tòa nhà ven sông mát mẻ, đầy đủ tiện ích hồ bơi, phòng gym.",
    status: "active",
    floors: generateFloors("b1", 5)
  },
  {
    id: "b2",
    name: "LK01.32 - The Garden Mansion",
    address: "02 Đường Nguyễn Thị Thập, Tân Phong, Quận 7, TP.HCM",
    images: [
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop"
    ],
    notes: "Tòa nhà khu trung tâm sầm uất, thuận tiện di chuyển.",
    status: "active",
    floors: generateFloors("b2", 4)
  },
  {
    id: "b3",
    name: "LK08.24 - Central Park Suite",
    address: "Khu B, LK08 Nguyễn Hữu Thọ, Phước Kiển, Nhà Bè, TP.HCM",
    images: [
      "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&h=600&fit=crop"
    ],
    notes: "Khu compound an ninh 24/7, có bãi đỗ xe ô tô rộng rãi.",
    status: "active",
    floors: generateFloors("b3", 6)
  }
];
