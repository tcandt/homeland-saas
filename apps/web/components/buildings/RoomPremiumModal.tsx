"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import useSWR from "swr";
import { createPortal } from "react-dom";
import type {
  Building,
  Room,
  Tenant,
  SharedTenant,
  Invoice,
  PaymentHistoryItem,
  Contract,
  RoomAttachment,
} from "./building.types";
import {
  X,
  Save,
  Trash2,
  LayoutDashboard,
  Image as ImageIcon,
  Users,
  FileText,
  CreditCard,
  AlignLeft,
  Upload,
  Plus,
  ShieldAlert,
  Check,
  Calendar,
  DollarSign,
  Eye,
  UserPlus,
  Paperclip,
  Edit2,
  Loader2,
  Camera,
  QrCode,
  ChevronDown,
  MoreHorizontal,
  Zap,
  SlidersHorizontal,
  Maximize2,
  Star,
  RefreshCw,
  Download,
  Droplets,
  AlertTriangle,
  DoorOpen,
  User,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";
import { numberToWordsVietnamese } from "../../lib/utils/number-to-words";
import { Modal } from "../ui/Modal";
import { PreviewContractModal } from "../contracts/PreviewContractModal";
import { CccdUploadScannerModal } from "../common/CccdUploadScannerModal";
import { Button } from "../ui/Button";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  parseCccdQrPayload,
} from "@/lib/utils/cccd-qr";
import {
  CCCD_LIVE_SCAN_CONFIG,
  optimizeCccdCameraTrack,
  safeStopAndClearScanner,
  stopCccdCameraTracks,
} from "@/lib/utils/cccd-camera";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import InvoiceCreateModal from "../invoices/InvoiceCreateModal";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";
import { useCustomersQuery } from "@/lib/queries/customers.queries";
import {
  useCreateContractMutation,
  useTerminateContractMutation,
  useExpireContractMutation,
} from "@/lib/mutations/contracts.mutations";
import { useDeleteRoomMutation } from "@/lib/mutations/rooms.mutations";
import { customersApi } from "@/lib/api/customers.api";
import { roomsApi } from "@/lib/api/rooms.api";
import { contractsApi } from "@/lib/api/contracts.api";
import { hunonicApi } from "@/lib/api/hunonic.api";
import { getAuthorizationHeader } from "@/lib/auth/auth-header";
import { getRoomDisplayName } from "./building-labels";
import { formatRoomDisplayLabel } from "../tenants/TenantFormModal";

interface Props {
  roomId: string;
  buildings: Building[];
  onClose: () => void;
  onUpdateRoom?: (
    roomId: string,
    updatedRoom: Partial<Room>,
  ) => void | Promise<void>;
  initialTab?: string;
}

type TabKey =
  | "rental_flow"
  | "finances"
  | "contract"
  | "temp_residence"
  | "overview";

type TenantDraft = {
  id?: string;
  name: string;
  phone: string;
  emergencyPhone: string;
  email?: string;
  cccd: string;
  address: string;
  gender: string;
  birthDate: string;
  nationality: string;
  relationship?: string;
  zaloChatId?: string;
  zaloUserId?: string;
  notes?: string;
};

type CT01Member = {
  id: string;
  name: string;
  birthDate: string;
  gender: string;
  cccd: string;
  relationship: string;
};

type CT01Draft = {
  hoTenChuHo: string;
  quanHeVoiChuHo: string;
  thanhVien: CT01Member[];
};

type ContractDraft = {
  mucDichThue: string;
  tienThue: string;
  tienCoc: string;
  ngayBatDau: string;
  ngayKetThuc: string;
  soPhongNgu: string;
  thoiHanThue: string;
  chuNha: "TINH" | "THE";
  ngayKyhopdong: string;
  ngayThanhToanDauTien: string;
};

export const LANDLORDS: Record<string, any> = {
  TINH: {
    hoTenChuNha: "NGUYỄN ĐỨC TÍNH",
    ngaySinhChuNha: "13/03/1997",
    cccdChuNha: "054097010677",
    diaChiChuNha: "LK01.31 Khu đô thị Ân Phú , phường Tân An , tỉnh Đắk Lắk",
    dienThoaiChuNha: "0373129295 - 0567867889 ( Tính )",
    chuTaiKhoan: "HKD NGUYEN DUC TINH",
    soTaiKhoan: "8818406081",
    nganHang: "BIDV",
  },
  THE: {
    hoTenChuNha: "PHAN VĂN THỂ",
    ngaySinhChuNha: "24/11/1994",
    cccdChuNha: "066094006596 , Cấp ngày: 15/10/2025 tại Cục cảnh sát",
    diaChiChuNha: "LK01.31 Khu đô thị Ân Phú , phường Tân An , tỉnh Đắk Lắk",
    dienThoaiChuNha: "0373129295 - 0567.79.2222 ( Thể )",
    chuTaiKhoan: "HKD PHAN VAN THE",
    soTaiKhoan: "8827905414",
    nganHang: "BIDV",
  },
};

export const resolveBuildingLandlord = (
  building?: Building | any | null,
  room?: Room | any | null
): "TINH" | "THE" => {
  const ownerName = String(
    building?.owner?.name ||
    building?.ownerName ||
    room?.building?.owner?.name ||
    room?.building?.ownerName ||
    ""
  ).toLowerCase();

  if (ownerName.includes("thể") || ownerName.includes("the")) {
    return "THE";
  }
  if (ownerName.includes("tính") || ownerName.includes("tinh")) {
    return "TINH";
  }

  const bCode = String(
    building?.code ||
    building?.name ||
    room?.building?.code ||
    room?.building?.name ||
    room?.buildingName ||
    ""
  ).toUpperCase();

  if (
    bCode.includes("32") ||
    bCode.includes("24") ||
    bCode.includes("LK01-32") ||
    bCode.includes("LK01.32") ||
    bCode.includes("LK08-24") ||
    bCode.includes("LK08.24")
  ) {
    return "THE";
  }
  if (
    bCode.includes("31") ||
    bCode.includes("25") ||
    bCode.includes("LK01-31") ||
    bCode.includes("LK01.31") ||
    bCode.includes("LK08-25") ||
    bCode.includes("LK08.25")
  ) {
    return "TINH";
  }

  return "TINH";
};

export const ROOM_TYPE_OPTIONS = [
  { label: "1 Phòng ngủ", value: "1 phòng ngủ" },
  { label: "2 Phòng ngủ", value: "2 phòng ngủ" },
  { label: "Văn Phòng", value: "Văn phòng" },
  { label: "Khác", value: "Khác" },
];

const ROOM_RENTAL_TYPE_OPTIONS = [
  { label: "Thuê nguyên căn", value: "whole" },
  { label: "Ở ghép", value: "shared" },
];

const getRoomRentalTypeSettingLabel = (rentalType?: Room["rentalType"]) =>
  ROOM_RENTAL_TYPE_OPTIONS.find((option) => option.value === rentalType)?.label ||
  ROOM_RENTAL_TYPE_OPTIONS[0].label;

export const getStoredRoomType = (rId: string, fallback?: string) => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(`homeland_room_type_${rId}`);
    if (stored) return stored;
  }
  return fallback || "1 phòng ngủ";
};

const EMPTY_TENANT_DRAFT: TenantDraft = {
  name: "",
  phone: "",
  emergencyPhone: "",
  email: "",
  cccd: "",
  address: "",
  gender: "",
  birthDate: "",
  nationality: "Việt Nam",
  relationship: "",
  zaloChatId: "",
  zaloUserId: "",
  notes: "",
};

type QrMode = "camera" | "upload" | null;
const QR_CAMERA_ELEMENT_ID = "qr-camera-reader";

const normalizeVietnameseDate = (value: string) => {
  const text = value.trim();
  if (!text) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})[T\s].*$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month}-${day}`;
  }

  const slashMatch = text.match(/^(\d{2})[/.:-](\d{2})[/.:-](\d{4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month}-${day}`;
  }

  const compact = text.replace(/[^\d]/g, "");
  if (/^\d{8}$/.test(compact)) {
    const day = compact.slice(0, 2);
    const month = compact.slice(2, 4);
    const year = compact.slice(4, 8);
    return `${year}-${month}-${day}`;
  }

  return text;
};

const formatBirthDateForDisplay = (value: string) => {
  const normalized = normalizeVietnameseDate(value);
  if (!normalized) return "";
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value.trim();
  return `${match[3]}/${match[2]}/${match[1]}`;
};

const DateMaskInput = ({ value, onChange, placeholder = "DD/MM/YYYY" }: { value: string, onChange: (val: string) => void, placeholder?: string }) => {
  const toDisplay = (v: string) => {
    if (!v) return "";
    const parts = v.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return v;
  };
  const [internalVal, setInternalVal] = useState(toDisplay(value));

  useEffect(() => {
    if (value && value.includes("-")) {
      const parts = value.split("-");
      if (parts.length === 3) {
        const expected = `${parts[2]}/${parts[1]}/${parts[0]}`;
        if (internalVal !== expected) setInternalVal(expected);
      }
    } else if (!value) {
      setInternalVal("");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (raw.length > 8) raw = raw.slice(0, 8);
    let formatted = raw;
    if (raw.length >= 3) {
      formatted = raw.slice(0, 2) + "/" + raw.slice(2);
    }
    if (raw.length >= 5) {
      formatted = formatted.slice(0, 5) + "/" + raw.slice(4);
    }
    setInternalVal(formatted);
    if (formatted.length === 10) {
      const [d, m, y] = formatted.split("/");
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange(value); // Keep old valid value while typing
    }
  };

  return <Input type="text" placeholder={placeholder} value={internalVal} onChange={handleChange} />;
};

const getLocalYMD = (date: Date = new Date()) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function RoomPremiumModal({
  roomId,
  buildings,
  onClose,
  onUpdateRoom,
  initialTab = "rental_flow",
}: Props) {
  const normalizeInitialTab = (tab: string): TabKey => {
    if (tab === "finances" || tab === "contract" || tab === "temp_residence" || tab === "overview" || tab === "rental_flow") {
      return tab;
    }
    return "rental_flow";
  };
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(normalizeInitialTab(initialTab));
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const [openContractMenuId, setOpenContractMenuId] = useState<string | null>(null);
  const [previewContractData, setPreviewContractData] = useState<any | null>(null);
  const [isPreviewContractModalOpen, setIsPreviewContractModalOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<string | null>(null);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isQrMenuOpen, setIsQrMenuOpen] = useState(false);
  const [isQrSupported, setIsQrSupported] = useState(true);
  const [qrMode, setQrMode] = useState<QrMode>(null);
  const [qrSupportMessage, setQrSupportMessage] = useState("");
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [scannerFile, setScannerFile] = useState<File | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);
  const [tenantDraft, setTenantDraft] =
    useState<TenantDraft>(EMPTY_TENANT_DRAFT);
  const [tenantViewMode, setTenantViewMode] = useState<"basic" | "detailed">("basic");
  const [tenantModalStep, setTenantModalStep] = useState<1 | 2>(1);
  const [isContractRepresentative, setIsContractRepresentative] = useState(false);
  const [householdRepId, setHouseholdRepId] = useState("");
  const [isRemoveTenantConfirmOpen, setIsRemoveTenantConfirmOpen] = useState(false);
  const [isRemovingTenant, setIsRemovingTenant] = useState(false);
  const [occupantToDelete, setOccupantToDelete] = useState<any | null>(null);
  const [isTempResidenceConfirmOpen, setIsTempResidenceConfirmOpen] = useState(false);
  const [occupantToConfirmTempResidence, setOccupantToConfirmTempResidence] = useState<any | null>(null);
  const [isSingleTempResidenceConfirmOpen, setIsSingleTempResidenceConfirmOpen] = useState(false);
  const [isSavingTempResidence, setIsSavingTempResidence] = useState(false);
  const [isSavingRoom, setIsSavingRoom] = useState(false);
  const [isUpdatingElectricity, setIsUpdatingElectricity] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  let currentRoom: Room | null = null;
  let currentBuilding: Building | null = null;
  for (const b of buildings) {
    for (const f of b.floors) {
      const r = f.rooms.find((r) => r.id === roomId);
      if (r) {
        currentRoom = r;
        currentBuilding = b;
        break;
      }
    }
    if (currentRoom) break;
  }

  const resolvedLandlordKey = useMemo(() => {
    return resolveBuildingLandlord(currentBuilding, currentRoom);
  }, [currentBuilding, currentRoom]);

  const [contractDraft, setContractDraft] = useState<ContractDraft>(() => ({
    mucDichThue: "Ở",
    tienThue: "",
    tienCoc: "",
    ngayBatDau: getLocalYMD(),
    ngayKetThuc: getLocalYMD(new Date(new Date().setFullYear(new Date().getFullYear() + 1))),
    soPhongNgu: getStoredRoomType(roomId, (currentRoom as any)?.roomType || (currentRoom as any)?.type),
    thoiHanThue: "1 năm",
    chuNha: resolveBuildingLandlord(currentBuilding, currentRoom),
    ngayKyhopdong: getLocalYMD(),
    ngayThanhToanDauTien: getLocalYMD(),
  }));

  useEffect(() => {
    setContractDraft((prev) => ({
      ...prev,
      chuNha: resolvedLandlordKey,
    }));
  }, [resolvedLandlordKey]);

  const [isExporting, setIsExporting] = useState(false);
  const [contractCustomerId, setContractCustomerId] = useState("");
  const [contractCode, setContractCode] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [contractRent, setContractRent] = useState<number>(0);
  const [contractDeposit, setContractDeposit] = useState<number>(0);
  const [tenantFieldErrors, setTenantFieldErrors] = useState<{
    name: boolean;
    phone: boolean;
    cccd?: boolean;
    relationship?: boolean;
  }>({ name: false, phone: false, cccd: false, relationship: false });
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const { showToast } = useToast();
  const createContractMutation = useCreateContractMutation();
  const terminateContractMutation = useTerminateContractMutation();
  const expireContractMutation = useExpireContractMutation();
  const deleteRoomMutation = useDeleteRoomMutation();

  const { data: invoicesResponse } = useInvoicesQuery({ roomId });
  const {
    data: electricityResponse,
    isLoading: isElectricityLoading,
    mutate: mutateElectricity,
  } = useSWR(
    roomId ? ["hunonic-room-electricity", roomId] : null,
    () => hunonicApi.roomElectricity(roomId),
    { revalidateOnFocus: false, refreshInterval: 60 * 60 * 1000 },
  );

  const handleUpdateElectricity = async () => {
    setIsUpdatingElectricity(true);
    try {
      await mutateElectricity();
      showToast("Đã cập nhật chỉ số điện mới nhất từ công tơ!", "success");
    } catch (err) {
      showToast("Không thể cập nhật chỉ số điện lúc này.", "error");
    } finally {
      setIsUpdatingElectricity(false);
    }
  };
  const { data: customersResponse } = useCustomersQuery({ limit: 100 });
  const realInvoices = (invoicesResponse as any)?.data?.items || [];
  const electricity = electricityResponse as any;
  const customers = useMemo(() => {
    const payload = customersResponse as any;
    const items = payload?.data?.items || payload?.data || payload?.items || [];
    return Array.isArray(items) ? items : [];
  }, [customersResponse]);

  const handleToggleOccupantTempResidence = async (occupant: any) => {
    if (!roomData) return;
    setIsSavingTempResidence(true);
    const occupantId = occupant.id;
    const currentStatus = Boolean(occupant.tempResidence);
    const nextVal = !currentStatus;

    try {
      // 1. Save to localStorage
      if (typeof window !== "undefined") {
        if (occupantId) localStorage.setItem(`homeland_temp_residence_${occupantId}`, String(nextVal));
        if (roomId) localStorage.removeItem(`homeland_temp_residence_room_${roomId}`);
      }

      // 2. Persist to DB for this customer if real ID
      if (occupantId && !occupantId.startsWith("t-")) {
        const existing = customers.find((c: any) => c.id === occupantId);
        const curImages = Array.isArray(existing?.idImages) ? [...existing.idImages] : [];
        const nextImages = nextVal
          ? Array.from(new Set([...curImages, "TEMP_RESIDENCE_DECLARED"]))
          : curImages.filter((img: string) => img !== "TEMP_RESIDENCE_DECLARED");
        await customersApi.update(occupantId, { idImages: nextImages });
      }

      // 3. Update local React state
      setRoomData((prev) => {
        if (!prev) return null;
        let nextTenant = prev.tenant;
        if (
          prev.tenant &&
          (prev.tenant.id === occupantId ||
            (!occupantId && occupant.isRep) ||
            (prev.tenant.name === occupant.name && prev.tenant.cccd === occupant.cccd))
        ) {
          nextTenant = { ...prev.tenant, tempResidence: nextVal };
        }
        const nextRoommates = (prev.roommates || []).map((rm: any) => {
          if (
            rm.id === occupantId ||
            (rm.name === occupant.name && (rm.cccd === occupant.cccd || rm.phone === occupant.phone))
          ) {
            return { ...rm, tempResidence: nextVal };
          }
          return rm;
        });
        const nextShared = (prev.sharedTenants || []).map((st: any) => {
          if (
            st.id === occupantId ||
            (st.name === occupant.name && (st.cccd === occupant.cccd || st.phone === occupant.phone))
          ) {
            return { ...st, tempResidence: nextVal };
          }
          return st;
        });
        return {
          ...prev,
          tenant: nextTenant,
          roommates: nextRoommates,
          sharedTenants: nextShared,
        };
      });

      // 4. Invalidate Query Cache
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rooms"] }),
        queryClient.invalidateQueries({ queryKey: ["buildings"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
      ]);

      const occupantName = occupant.name || occupant.fullName || "Khách thuê";
      showToast(
        nextVal
          ? `Đã xác nhận khai báo tạm trú cho "${occupantName}"!`
          : `Đã hủy khai báo tạm trú cho "${occupantName}"!`,
        "success"
      );
    } catch (err) {
      console.error("Failed to update occupant temporary residence:", err);
      showToast("Có lỗi xảy ra khi cập nhật trạng thái tạm trú", "error");
    } finally {
      setIsSavingTempResidence(false);
    }
  };

  const handleConfirmToggleTempResidence = async () => {
    if (!roomData) return;
    setIsSavingTempResidence(true);
    const occupants = getOccupantsList();
    const isAllDeclared = occupants.length > 0 && occupants.every((occ: any) => Boolean(occ.tempResidence));
    const nextVal = !isAllDeclared;

    try {
      // 1. Save to localStorage
      if (typeof window !== "undefined") {
        if (roomId) localStorage.removeItem(`homeland_temp_residence_room_${roomId}`);
        occupants.forEach((occ: any) => {
          if (occ.id) localStorage.setItem(`homeland_temp_residence_${occ.id}`, String(nextVal));
        });
      }

      // 2. Persist to DB for all related customers
      const cids = occupants
        .map((occ: any) => occ.id)
        .filter((id: string) => id && !id.startsWith("t-"));

      await Promise.all(
        cids.map(async (cid: string) => {
          const existing = customers.find((c: any) => c.id === cid);
          const curImages = Array.isArray(existing?.idImages) ? [...existing.idImages] : [];
          const nextImages = nextVal
            ? Array.from(new Set([...curImages, "TEMP_RESIDENCE_DECLARED"]))
            : curImages.filter((img: string) => img !== "TEMP_RESIDENCE_DECLARED");
          return customersApi.update(cid, { idImages: nextImages });
        })
      );

      // 3. Update local React state
      setRoomData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          tenant: prev.tenant ? { ...prev.tenant, tempResidence: nextVal } : prev.tenant,
          roommates: (prev.roommates || []).map((rm: any) => ({ ...rm, tempResidence: nextVal })),
          sharedTenants: (prev.sharedTenants || []).map((st: any) => ({ ...st, tempResidence: nextVal })),
        };
      });

      // 4. Invalidate Query Cache
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rooms"] }),
        queryClient.invalidateQueries({ queryKey: ["buildings"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
      ]);

      setIsTempResidenceConfirmOpen(false);
      showToast(
        nextVal
          ? "Đã xác nhận ĐÃ KHAI BÁO tạm trú cho tất cả khách trong phòng!"
          : "Đã hủy khai báo tạm trú cho tất cả khách trong phòng!",
        "success"
      );
    } catch (err) {
      console.error("Failed to update temporary residence in DB:", err);
      showToast("Có lỗi xảy ra khi cập nhật trạng thái tạm trú", "error");
    } finally {
      setIsSavingTempResidence(false);
    }
  };

  const [roomData, setRoomData] = useState<Room | null>(
    currentRoom
      ? ({
        ...currentRoom,
        rentalType: currentRoom.rentalType || "whole",
        roomType: getStoredRoomType(roomId, (currentRoom as any)?.roomType || (currentRoom as any)?.type),
      } as any)
      : currentRoom,
  );

  useEffect(() => {
    setMounted(true);
    setRoomData(
      currentRoom
        ? ({
          ...currentRoom,
          rentalType: currentRoom.rentalType || "whole",
          roomType: getStoredRoomType(roomId, (currentRoom as any)?.roomType || (currentRoom as any)?.type),
        } as any)
        : currentRoom,
    );
  }, [roomId, currentRoom]);

  useEffect(() => {
    setActiveTab(normalizeInitialTab(initialTab));
  }, [initialTab]);

  useEffect(() => {
    if (!openContractMenuId) return;
    const handleDocClick = () => setOpenContractMenuId(null);
    window.addEventListener("click", handleDocClick);
    return () => window.removeEventListener("click", handleDocClick);
  }, [openContractMenuId]);

  useEffect(() => {
    if (isTenantModalOpen && tenantModalStep === 1) {
      const start = new Date();
      const end = new Date(start);
      end.setFullYear(start.getFullYear() + 1);
      const configuredRoomType =
        (roomData as any)?.roomType || getStoredRoomType(roomId, (currentRoom as any)?.roomType);
      setContractDraft((prev) => ({
        ...prev,
        thoiHanThue: "1 năm",
        soPhongNgu: configuredRoomType || prev.soPhongNgu || "1 phòng ngủ",
        ngayBatDau: getLocalYMD(start),
        ngayKetThuc: getLocalYMD(end),
        tienThue: prev.tienThue || (roomData?.monthlyPrice ? Number(roomData.monthlyPrice).toLocaleString("vi-VN") : ""),
        tienCoc: prev.tienCoc || (roomData?.monthlyPrice ? (Number(roomData.monthlyPrice) * 2).toLocaleString("vi-VN") : ""),
      }));
    }
  }, [isTenantModalOpen, tenantModalStep, roomData?.monthlyPrice, (roomData as any)?.roomType, roomId, currentRoom]);

  useEffect(() => {
    if (!roomData?.tenant) {
      setTenantDraft(EMPTY_TENANT_DRAFT);
      return;
    }

    setTenantDraft({
      id: roomData.tenant.id,
      name: roomData.tenant.name || "",
      phone: roomData.tenant.phone || "",
      cccd: roomData.tenant.cccd || "",
      address: roomData.tenant.address || "",
      gender: roomData.tenant.gender || "",
      birthDate: roomData.tenant.birthDate || "",
      nationality: roomData.tenant.nationality || "",
      emergencyPhone: (roomData.tenant as any).emergencyPhone || "",
    });
  }, [roomData?.tenant, roomId]);

  useEffect(() => {
    if (isTenantModalOpen) {
      setTenantFieldErrors({ name: false, phone: false });
    }
  }, [isTenantModalOpen]);

  const handleUploadSuccess = (decodedText: string) => {
    const parsed = parseCccdQrPayload(decodedText);
    if (!parsed) {
      showToast("Mã QR không đúng định dạng CCCD.", "error");
      return;
    }

    setTenantDraft((prev) => ({
      ...prev,
      name: parsed.fullName || "",
      cccd: parsed.citizenId || "",
      address: parsed.address || "",
      gender: parsed.gender || "",
      birthDate: parsed.birthDate ? formatBirthDateForDisplay(parsed.birthDate) : "",
      nationality: parsed.nationality || "Việt Nam",
    }));

    showToast("Đã quét QR và điền thông tin.", "success");
    setIsScannerOpen(false);
    setScannerFile(null);
  };

  useEffect(() => {
    if (!isQrScannerOpen || qrMode !== "camera") {
      qrScannerRef.current = null;
      return;
    }

    setQrSupportMessage("");
    const cameraSupported =
      typeof window !== "undefined" && !!navigator?.mediaDevices?.getUserMedia;
    setIsQrSupported(cameraSupported);
    if (!cameraSupported) {
      setQrSupportMessage(
        "Trình duyệt hiện không hỗ trợ mở camera. Bạn vẫn có thể tải ảnh CCCD có QR để nhận diện.",
      );
      return;
    }

    const startScanner = async () => {
      try {
        const container = document.getElementById(QR_CAMERA_ELEMENT_ID);
        if (!container) {
          setQrSupportMessage("Đang khởi tạo camera QR, vui lòng thử lại.");
          return;
        }

        if (qrScannerRef.current) {
          try {
            await qrScannerRef.current.stop();
          } catch {
            // ignore stale scanner state
          }
          try {
            await qrScannerRef.current.clear();
          } catch {
            // ignore stale scanner state
          }
        }

        const scanner = new Html5Qrcode(QR_CAMERA_ELEMENT_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
          useBarCodeDetectorIfSupported: true,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });
        qrScannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          CCCD_LIVE_SCAN_CONFIG,
          async (decodedText) => {
            const parsed = parseCccdQrPayload(decodedText?.trim() || "");
            if (!parsed) {
              showToast("QR không đúng định dạng CCCD.", "error");
              return;
            }

            setTenantDraft((prev) => ({
              ...prev,
              name: parsed.fullName || "",
              cccd: parsed.citizenId || "",
              address: parsed.address || "",
              gender: parsed.gender || "",
              birthDate: parsed.birthDate ? formatBirthDateForDisplay(parsed.birthDate) : "",
              nationality: parsed.nationality || "Việt Nam",
            }));
            closeQrScanner();
            showToast(
              "Đã nhận diện QR CCCD và điền nhanh thông tin.",
              "success",
            );
          },
          () => { },
        );
        await optimizeCccdCameraTrack(QR_CAMERA_ELEMENT_ID);
      } catch (error: any) {
        console.error(error);
        setQrSupportMessage(
          "Không thể mở camera quét QR. Bạn có thể tải ảnh CCCD có QR để hệ thống tự điền thông tin.",
        );
        showToast("Không thể mở camera quét QR.", "error");
      }
    };

    void startScanner();

    return () => {
      const scanner = qrScannerRef.current;
      qrScannerRef.current = null;
      void safeStopAndClearScanner(scanner, QR_CAMERA_ELEMENT_ID);
    };
  }, [isQrScannerOpen, qrMode, showToast]);

  const closeQrScanner = () => {
    const scanner = qrScannerRef.current;
    qrScannerRef.current = null;
    void safeStopAndClearScanner(scanner, QR_CAMERA_ELEMENT_ID);
    setIsQrScannerOpen(false);
    setIsQrMenuOpen(false);
    setQrMode(null);
    setQrSupportMessage("");
  };

  const openQrScanner = () => {
    setIsQrMenuOpen(false);
    setQrSupportMessage("");
    setQrMode("camera");
    setIsQrScannerOpen(true);
  };

  const openQrUpload = () => {
    setIsQrMenuOpen(false);
    window.requestAnimationFrame(() => {
      qrFileInputRef.current?.click();
    });
  };

  const retryQrScan = () => {
    if (qrMode === "camera") {
      openQrScanner();
    } else {
      openQrUpload();
    }
  };

  useEffect(() => {
    if (!mounted || !roomData) return;
    if (!contractStartDate) {
      const start = new Date();
      const end = new Date(start);
      end.setFullYear(start.getFullYear() + 1);
      setContractStartDate(start.toISOString().slice(0, 10));
      setContractEndDate(end.toISOString().slice(0, 10));
      setContractCode(
        `HD-${roomData.code || roomData.name || roomId}-${Date.now().toString().slice(-4)}`,
      );
      setContractRent(roomData.monthlyPrice || 0);
      setContractDeposit(Math.max(roomData.monthlyPrice || 0, 0) * 2);
    }
  }, [mounted, roomData, roomId, contractCode, contractStartDate]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);


  if (!mounted || !roomData) return null;

  const handleSave = async () => {
    if (!roomData) {
      onClose();
      return;
    }
    setIsSavingRoom(true);

    const mapUiStatusToApi = (s: string) => {
      if (s === "occupied" || s === "expiring_soon" || s === "RENTED") return "OCCUPIED";
      if (s === "maintenance" || s === "MAINTENANCE") return "MAINTENANCE";
      if (s === "deposited" || s === "RESERVED") return "RESERVED";
      if (s === "vacant" || s === "available" || s === "AVAILABLE") return "AVAILABLE";
      if (s === "cleaning" || s === "CLEANING") return "CLEANING";
      return s?.toUpperCase() || "AVAILABLE";
    };

    const payload: Partial<Room> = {
      name: roomData.name,
      code: roomData.code,
      status: mapUiStatusToApi(roomData.status) as any,
      monthlyPrice: roomData.monthlyPrice !== undefined ? Number(roomData.monthlyPrice) : undefined,
      area: roomData.area !== undefined ? Number(roomData.area) : undefined,
      capacity: roomData.capacity !== undefined ? Number(roomData.capacity) : undefined,
      rentalType: roomData.rentalType || "whole",
      notes: roomData.notes || "",
      images: roomData.images || [],
    };

    if (typeof window !== "undefined" && (roomData as any)?.roomType) {
      localStorage.setItem(`homeland_room_type_${roomData.id}`, (roomData as any).roomType);
    }

    try {
      if (onUpdateRoom) {
        await onUpdateRoom(roomData.id, payload);
      } else {
        await roomsApi.update(roomData.id, payload);
        showToast("Đã lưu thông tin phòng thành công!", "success");
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rooms"] }),
        queryClient.invalidateQueries({ queryKey: ["buildings"] }),
      ]);
      setRoomData((prev) => (prev ? ({ ...prev, ...payload } as Room) : prev));
      onClose();
    } catch (err) {
      console.error("Failed to save room:", err);
      showToast("Có lỗi xảy ra khi lưu thông tin phòng", "error");
    } finally {
      setIsSavingRoom(false);
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    const newImages: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > 10 * 1024 * 1024) {
          showToast(`File ${file.name} vượt quá 10MB.`, "error");
          continue;
        }
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newImages.push(dataUrl);
      }

      if (newImages.length > 0) {
        const updatedImages = [...(roomData.images || []), ...newImages];
        setRoomData((prev) => (prev ? { ...prev, images: updatedImages } : null));
        await roomsApi.update(roomData.id, { images: updatedImages });
        await queryClient.invalidateQueries({ queryKey: ["rooms"] });
        await queryClient.invalidateQueries({ queryKey: ["buildings"] });
        showToast(`Đã tải lên và lưu ${newImages.length} ảnh phòng!`, "success");
      }
    } catch (err) {
      console.error("Upload image error:", err);
      showToast("Không thể lưu ảnh phòng vào hệ thống.", "error");
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const handleDeleteImage = async (indexToDelete: number) => {
    const updatedImages = (roomData.images || []).filter((_, idx) => idx !== indexToDelete);
    setRoomData((prev) => (prev ? { ...prev, images: updatedImages } : null));

    try {
      await roomsApi.update(roomData.id, { images: updatedImages });
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      await queryClient.invalidateQueries({ queryKey: ["buildings"] });
      showToast("Đã xóa ảnh thành công!", "success");
    } catch (err) {
      console.error("Delete image error:", err);
      showToast("Lỗi khi xóa ảnh khỏi cơ sở dữ liệu.", "error");
    }
  };

  const handleSetCoverImage = async (index: number) => {
    const currentImages = [...(roomData.images || [])];
    if (index === 0 || index >= currentImages.length) return;
    const selected = currentImages.splice(index, 1)[0];
    const updatedImages = [selected, ...currentImages];
    setRoomData((prev) => (prev ? { ...prev, images: updatedImages } : null));

    try {
      await roomsApi.update(roomData.id, { images: updatedImages });
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      await queryClient.invalidateQueries({ queryKey: ["buildings"] });
      showToast("Đã đặt làm ảnh đại diện phòng!", "success");
    } catch (err) {
      console.error("Set cover image error:", err);
    }
  };

  const handleSaveNotes = async () => {
    if (!roomData) return;
    setIsSavingNotes(true);
    try {
      await roomsApi.update(roomData.id, { notes: roomData.notes || "" });
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      await queryClient.invalidateQueries({ queryKey: ["buildings"] });
      showToast("Đã lưu ghi chú phòng thành công!", "success");
    } catch (err) {
      console.error("Save notes error:", err);
      showToast("Lỗi khi lưu ghi chú", "error");
    } finally {
      setIsSavingNotes(false);
    }
  };
  const handleFieldChange = (field: keyof Room | "roomType", value: any) => {
    if (field === "roomType") {
      if (typeof window !== "undefined") {
        localStorage.setItem(`homeland_room_type_${roomId}`, value);
      }
      setContractDraft((prev) => ({ ...prev, soPhongNgu: value }));
    }
    setRoomData((prev) => (prev ? { ...prev, [field]: value } : null));
  };
  const shouldStartAsRepresentative = roomData?.rentalType === "shared" || !roomData?.tenant;
  const roomRentalTypeLabel = roomData?.rentalType === "shared" ? "Phòng ghép" : "Nguyên căn";
  const getRepresentativeCandidates = () => {
    const list: any[] = [];
    if (roomData?.tenant) list.push(roomData.tenant);
    (roomData?.sharedTenants || []).forEach((st: any) => {
      if (st.isRep && !list.some((existing) => (st.id && existing.id === st.id) || (st.name && existing.name === st.name))) {
        list.push(st);
      }
    });
    ((roomData as any)?.contract?.coRepresentatives || []).forEach((cr: any) => {
      const crName = cr.fullName || cr.name;
      if (!list.some((existing) => (cr.id && existing.id === cr.id) || (crName && existing.name === crName))) {
        list.push({ ...cr, name: crName });
      }
    });
    return list;
  };

  const getOccupantsList = () => {
    if (roomData?.rentalType === "shared") {
      return [
        ...(roomData.sharedTenants || []).map((tenant: any) => ({
          ...tenant,
          role: tenant.isRep ? "Đại diện HĐ chính" : "Người ở cùng",
          isRep: !!tenant.isRep,
        })),
      ];
    }

    // Cho thuê nguyên căn (Whole rental):
    // 1. Đại diện HĐ chính (roomData.tenant)
    const primaryTenant = roomData?.tenant
      ? [{ ...roomData.tenant, role: "Đại diện HĐ chính", isRep: true }]
      : [];

    // 2. Đại diện HĐ thứ 2, 3... (từ sharedTenants có isRep hoặc contract.coRepresentatives)
    const coRepsFromShared = (roomData?.sharedTenants || [])
      .filter(
        (st: any) =>
          st.isRep &&
          st.id !== roomData?.tenant?.id &&
          (!roomData?.tenant?.name || st.name !== roomData.tenant.name)
      )
      .map((st: any) => ({
        ...st,
        role: "Đại diện HĐ phụ",
        isRep: true,
      }));

    const contractCoReps = ((roomData as any)?.contract?.coRepresentatives || [])
      .filter(
        (cr: any) =>
          cr.id !== roomData?.tenant?.id &&
          (!roomData?.tenant?.name || (cr.fullName || cr.name) !== roomData.tenant.name)
      )
      .map((cr: any) => ({
        id: cr.id,
        name: cr.fullName || cr.name,
        phone: cr.phone || "",
        email: cr.email || "",
        cccd: cr.identityNo || cr.cccd || "",
        gender: cr.gender || "",
        birthDate: cr.birthDate || "",
        nationality: cr.nationality || "",
        address: cr.address || "",
        emergencyPhone: cr.emergencyPhone || "",
        idImages: cr.idImages || [],
        tempResidence: (cr as any).tempResidence || false,
        role: "Đại diện HĐ phụ",
        isRep: true,
      }));

    const allCoReps: any[] = [];
    [...coRepsFromShared, ...contractCoReps].forEach((rep) => {
      if (
        !allCoReps.some(
          (existing) =>
            (rep.id && existing.id === rep.id) || (rep.name && existing.name === rep.name)
        )
      ) {
        allCoReps.push(rep);
      }
    });

    // 3. Người ở cùng (roommates)
    const roommates = (roomData?.roommates || [])
      .filter(
        (rm: any) =>
          rm.id !== roomData?.tenant?.id &&
          !allCoReps.some((cr) => (rm.id && cr.id === rm.id) || (rm.name && cr.name === rm.name))
      )
      .map((tenant: any) => ({
        ...tenant,
        role: "Người ở cùng",
        isRep: false,
      }));

    return [...primaryTenant, ...allCoReps, ...roommates];
  };

  const getDefaultMemberCount = () => {
    return Math.max(1, getOccupantsList().length);
  };
  const handleTenantChange = (field: keyof Tenant, value: any) => {
    setRoomData((prev) => {
      if (!prev) return null;
      const tenant = prev.tenant
        ? { ...prev.tenant, [field]: value }
        : {
          id: `t-${prev.id}`,
          name: "",
          phone: "",
          email: "",
          cccd: "",
          idImages: [],
          tempResidence: false,
          [field]: value,
        };
      return { ...prev, tenant };
    });
  };

  const updateTenantDraft = (field: keyof TenantDraft, value: string) => {
    if (field === "name" && tenantFieldErrors.name) {
      setTenantFieldErrors((prev) => ({ ...prev, name: false }));
    }
    if (field === "phone" && tenantFieldErrors.phone) {
      setTenantFieldErrors((prev) => ({ ...prev, phone: false }));
    }
    if (field === "cccd" && tenantFieldErrors.cccd) {
      setTenantFieldErrors((prev) => ({ ...prev, cccd: false }));
    }
    if (field === "relationship" && tenantFieldErrors.relationship) {
      setTenantFieldErrors((prev) => ({ ...prev, relationship: false }));
    }
    if (field === "phone" || field === "cccd") {
      setDuplicateWarning(null);
    }
    setTenantDraft((prev) => ({ ...prev, [field]: value }));
  };



  const commitTenantDraft = async (isCustomContract?: boolean) => {
    setIsExporting(true);
    try {
      const isSharedRoom = roomData?.rentalType === "shared";
      const name = tenantDraft.name.trim();
      const phone = tenantDraft.phone.trim();
      const birthDate = normalizeVietnameseDate(tenantDraft.birthDate.trim());
      const nextErrors = {
        name: !name,
        phone: !phone,
      };

      if (nextErrors.name || nextErrors.phone) {
        setTenantFieldErrors(nextErrors);
        return;
      }

      const payload: any = {
        fullName: name,
        phone,
        email: tenantDraft.email?.trim() || roomData?.tenant?.email?.trim() || null,
        citizenId: tenantDraft.cccd.trim() || null,
        gender: tenantDraft.gender.trim() || null,
        birthDate: birthDate || null,
        nationality: tenantDraft.nationality.trim() || null,
        address: tenantDraft.address.trim() || null,
        emergencyPhone: tenantDraft.emergencyPhone.trim() || null,
        zaloChatId: tenantDraft.zaloChatId?.trim() || null,
        zaloUserId: tenantDraft.zaloUserId?.trim() || null,
        notes: tenantDraft.notes?.trim() || null,
        status: "ACTIVE",
        roomId: !isContractRepresentative ? roomId : null,
        relationship: (!isContractRepresentative && tenantDraft.relationship?.trim()) || null,
      };

      let customerId = tenantDraft.id || "";
      try {
        if (customerId && !customerId.startsWith("t-")) {
          const updatedCustomer = await customersApi.update(
            customerId,
            payload,
          );
          customerId =
            (updatedCustomer as any)?.data?.id ||
            (updatedCustomer as any)?.id ||
            customerId;
        } else {
          const created = await customersApi.create(payload);
          customerId =
            (created as any)?.data?.id || (created as any)?.id || customerId;
        }
      } catch (error: any) {
        console.warn("[SaveTenant]", error);
        let errMsg = error?.message || "Không thể lưu khách thuê vào hệ thống.";
        if (typeof errMsg === "string" && errMsg.startsWith("{")) {
          try {
            const parsed = JSON.parse(errMsg);
            if (parsed.error || parsed.message) errMsg = parsed.error || parsed.message;
          } catch {}
        }
        showToast(errMsg, "error");
        if (isCustomContract) throw error;
        return;
      }

      let existingContractId: string | null | undefined = undefined;
      if (tenantDraft.id) {
        if (!isSharedRoom) {
          existingContractId = (tenantDraft.id === roomData?.tenant?.id) ? roomData?.contract?.id : undefined;
        } else {
          existingContractId = roomData?.sharedTenants?.find((st: any) => st.id === tenantDraft.id)?.contractId;
        }
      }

      const existingCoReps = (roomData?.sharedTenants || []).filter((st: any) => st.isRep && st.id !== customerId).map((st: any) => st.id);
      if (isContractRepresentative && customerId !== roomData?.tenant?.id && !existingCoReps.includes(customerId)) {
        existingCoReps.push(customerId);
      }

      const shouldCreateContract = isContractRepresentative && !existingContractId;
      let createdContract: any = null;
      let updatedContract: any = null;

      if (shouldCreateContract && customerId) {
        try {
          createdContract = await contractsApi.create({
            customerId,
            roomId,
            contractCode: `HD-${roomData?.code || roomData?.name || roomId}-${Date.now().toString().slice(-4)}`,
            startDate: isCustomContract && contractDraft.ngayBatDau ? contractDraft.ngayBatDau : new Date().toISOString().slice(0, 10),
            endDate: isCustomContract && contractDraft.ngayKetThuc ? contractDraft.ngayKetThuc : new Date(
              new Date().setFullYear(new Date().getFullYear() + 1),
            )
              .toISOString()
              .slice(0, 10),
            signedAt: isCustomContract && contractDraft.ngayKyhopdong ? new Date(contractDraft.ngayKyhopdong).toISOString() : new Date().toISOString(),
            firstPaymentDate: isCustomContract && contractDraft.ngayThanhToanDauTien ? new Date(contractDraft.ngayThanhToanDauTien).toISOString() : new Date().toISOString(),
            rentAmount: isCustomContract ? Number(contractDraft.tienThue.replace(/\D/g, "")) : Number(roomData?.monthlyPrice || 0),
            depositAmount: isCustomContract ? Number(contractDraft.tienCoc.replace(/\D/g, "")) : Number(roomData?.monthlyPrice || 0) * 2,
            memberCount: getDefaultMemberCount(),
            status: "ACTIVE",
            purpose: isCustomContract ? contractDraft.mucDichThue : "Tạo nhanh từ luồng thêm khách thuê vào phòng",
            coRepresentativeIds: existingCoReps,
          });
        } catch (error: any) {
          console.warn("[CreateContract]", error);
          let errMsg = error?.message || "Đã lưu khách thuê nhưng chưa thể liên kết vào phòng.";
          if (typeof errMsg === "string" && errMsg.startsWith("{")) {
            try {
              const parsed = JSON.parse(errMsg);
              if (parsed.error || parsed.message) errMsg = parsed.error || parsed.message;
            } catch {}
          }
          showToast(errMsg, "error");
          if (isCustomContract) throw error;
          return;
        }
      } else if (isContractRepresentative && tenantDraft.id && existingContractId) {
        try {
          const updatePayload: any = { coRepresentativeIds: existingCoReps, memberCount: getDefaultMemberCount() };
          if (isCustomContract) {
            updatePayload.startDate = contractDraft.ngayBatDau ? new Date(contractDraft.ngayBatDau) : undefined;
            updatePayload.endDate = contractDraft.ngayKetThuc ? new Date(contractDraft.ngayKetThuc) : undefined;
            updatePayload.signedAt = contractDraft.ngayKyhopdong ? new Date(contractDraft.ngayKyhopdong) : undefined;
            updatePayload.firstPaymentDate = contractDraft.ngayThanhToanDauTien ? new Date(contractDraft.ngayThanhToanDauTien) : undefined;
            updatePayload.rentAmount = Number(contractDraft.tienThue.replace(/\D/g, ""));
            updatePayload.depositAmount = Number(contractDraft.tienCoc.replace(/\D/g, ""));
            updatePayload.purpose = contractDraft.mucDichThue;
          }
          updatedContract = await contractsApi.update(existingContractId, updatePayload);
        } catch (error) {
          console.error(error);
          showToast("Không thể cập nhật thông tin hợp đồng.", "error");
        }
      }

      if (onUpdateRoom) {
        await onUpdateRoom(roomId, {
          status: "occupied",
        } as any);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["rooms"] }),
        queryClient.invalidateQueries({ queryKey: ["buildings"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["contracts"] }),
      ]);

      setRoomData((prev) => {
        if (!prev) return null;

        if (isContractRepresentative && !isSharedRoom && (!prev.tenant || tenantDraft.id === prev.tenant.id)) {
          return {
            ...prev,
            status: shouldCreateContract ? "occupied" : prev.status,
            tenant: {
              ...prev.tenant,
              id: customerId || prev.tenant?.id || `t-${prev.id}`,
              name,
              phone,
              email: prev.tenant?.email || "",
              cccd: tenantDraft.cccd.trim(),
              gender: tenantDraft.gender.trim(),
              birthDate,
              nationality: tenantDraft.nationality.trim(),
              address: tenantDraft.address.trim(),
              emergencyPhone: tenantDraft.emergencyPhone.trim(),
              idImages: prev.tenant?.idImages || [],
              tempResidence: prev.tenant?.tempResidence || false,
            },
            contract: shouldCreateContract && createdContract ? {
              id: (createdContract as any)?.data?.id || (createdContract as any)?.id || "",
              code: (createdContract as any)?.data?.code || (createdContract as any)?.code || "",
              startDate: isCustomContract ? contractDraft.ngayBatDau : new Date().toISOString().slice(0, 10),
              endDate: isCustomContract ? contractDraft.ngayKetThuc : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10),
              deposit: isCustomContract ? Number(contractDraft.tienCoc.replace(/\D/g, "")) : Number(roomData?.monthlyPrice || 0) * 2,
              rentPrice: isCustomContract ? Number(contractDraft.tienThue.replace(/\D/g, "")) : Number(roomData?.monthlyPrice || 0),
            } : (updatedContract && (updatedContract as any).data) ? {
              id: (updatedContract as any).data.id || prev.contract?.id || "",
              code: (updatedContract as any).data.code || prev.contract?.code || "",
              startDate: (updatedContract as any).data.startDate || prev.contract?.startDate || "",
              endDate: (updatedContract as any).data.endDate || prev.contract?.endDate || "",
              deposit: (updatedContract as any).data.depositAmount !== undefined ? Number((updatedContract as any).data.depositAmount) : prev.contract?.deposit || 0,
              rentPrice: (updatedContract as any).data.rentAmount !== undefined ? Number((updatedContract as any).data.rentAmount) : prev.contract?.rentPrice || 0,
              firstPaymentDate: (updatedContract as any).data.firstPaymentDate || prev.contract?.firstPaymentDate,
              signedAt: (updatedContract as any).data.signedAt || prev.contract?.signedAt,
              purpose: (updatedContract as any).data.purpose || prev.contract?.purpose,
            } : prev.contract,
          };
        } else if (isContractRepresentative && (isSharedRoom || (prev.tenant && tenantDraft.id !== prev.tenant.id))) {
          const sharedTenants = [...(prev.sharedTenants || [])];
          const newRepTenant = {
            id: customerId || `t-${Date.now()}`,
            name, phone, email: "",
            cccd: tenantDraft.cccd.trim(),
            gender: tenantDraft.gender.trim(),
            birthDate,
            nationality: tenantDraft.nationality.trim(),
            address: tenantDraft.address.trim(),
            emergencyPhone: tenantDraft.emergencyPhone.trim(),
            idImages: [],
            tempResidence: false,
            isRep: true,
            contractId: (createdContract as any)?.data?.id || (createdContract as any)?.id || "",
            contractCode: (createdContract as any)?.data?.code || (createdContract as any)?.code || "",
            bedPosition: "", invoices: [], paymentHistory: [], debt: 0, paymentStatus: "paid" as any, remainingDays: 0,
            startDate: isCustomContract ? contractDraft.ngayBatDau : new Date().toISOString().slice(0, 10),
            endDate: isCustomContract ? contractDraft.ngayKetThuc : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10),
            deposit: isCustomContract ? Number(contractDraft.tienCoc.replace(/\D/g, "")) : Number(roomData?.monthlyPrice || 0) * 2,
            rentPrice: isCustomContract ? Number(contractDraft.tienThue.replace(/\D/g, "")) : Number(roomData?.monthlyPrice || 0),
          };
          const existingIdx = sharedTenants.findIndex((st) => st.id === customerId || st.id === tenantDraft.id);
          if (existingIdx >= 0) {
            const updContractObj = (updatedContract && (updatedContract as any).data) ? (updatedContract as any).data : null;
            sharedTenants[existingIdx] = {
              ...sharedTenants[existingIdx],
              ...newRepTenant,
              contractId: sharedTenants[existingIdx].contractId || newRepTenant.contractId,
              contractCode: sharedTenants[existingIdx].contractCode || newRepTenant.contractCode,
              startDate: updContractObj?.startDate || sharedTenants[existingIdx].startDate || newRepTenant.startDate,
              endDate: updContractObj?.endDate || sharedTenants[existingIdx].endDate || newRepTenant.endDate,
              deposit: updContractObj?.depositAmount !== undefined ? Number(updContractObj.depositAmount) : (sharedTenants[existingIdx].deposit || 0),
              rentPrice: updContractObj?.rentAmount !== undefined ? Number(updContractObj.rentAmount) : (sharedTenants[existingIdx].rentPrice || 0),
              firstPaymentDate: updContractObj?.firstPaymentDate || sharedTenants[existingIdx].firstPaymentDate,
              signedAt: updContractObj?.signedAt || sharedTenants[existingIdx].signedAt,
              purpose: updContractObj?.purpose || sharedTenants[existingIdx].purpose,
            };
          } else {
            sharedTenants.push(newRepTenant);
          }
          return {
            ...prev,
            tenant: isSharedRoom ? null : prev.tenant,
            status: shouldCreateContract ? "occupied" : prev.status,
            contract: shouldCreateContract && createdContract ? {
              id: (createdContract as any)?.data?.id || (createdContract as any)?.id || prev.contract?.id || "",
              code: (createdContract as any)?.data?.code || (createdContract as any)?.code || prev.contract?.code || "",
              startDate: isCustomContract ? contractDraft.ngayBatDau : new Date().toISOString().slice(0, 10),
              endDate: isCustomContract ? contractDraft.ngayKetThuc : new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10),
              deposit: isCustomContract ? Number(contractDraft.tienCoc.replace(/\D/g, "")) : Number(roomData?.monthlyPrice || 0) * 2,
              rentPrice: isCustomContract ? Number(contractDraft.tienThue.replace(/\D/g, "")) : Number(roomData?.monthlyPrice || 0),
            } : prev.contract,
            sharedTenants,
          };
        } else if (isSharedRoom) {
          const sharedTenants = [...(prev.sharedTenants || [])];
          const existingIdx = sharedTenants.findIndex((st) => st.id === customerId || st.id === tenantDraft.id);
          const newTenant = {
            id: customerId || `t-${Date.now()}`,
            name,
            phone,
            email: "",
            cccd: tenantDraft.cccd.trim(),
            gender: tenantDraft.gender.trim(),
            birthDate,
            nationality: tenantDraft.nationality.trim(),
            address: tenantDraft.address.trim(),
            emergencyPhone: tenantDraft.emergencyPhone.trim(),
            idImages: [],
            bedPosition: "",
            deposit: 0,
            rentPrice: 0,
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            remainingDays: 0,
            invoices: [],
            paymentHistory: [],
            debt: 0,
            isRep: false,
            contractId: householdRepId ? (
              householdRepId === prev.tenant?.id
                ? prev.contract?.id
                : prev.sharedTenants?.find(st => st.id === householdRepId)?.contractId
            ) : undefined,
            relationship: tenantDraft.relationship?.trim() || "",
          } as any;
          if (existingIdx >= 0) {
            sharedTenants[existingIdx] = { ...sharedTenants[existingIdx], ...newTenant, idImages: sharedTenants[existingIdx].idImages || [] };
          } else {
            sharedTenants.push(newTenant);
          }
          return {
            ...prev,
            sharedTenants,
          };
        } else {
          const roommates = [...(prev.roommates || [])];
          const existingIdx = roommates.findIndex((rm) => rm.id === customerId || rm.id === tenantDraft.id);
          const newRoommate = {
            id: customerId || `t-${Date.now()}`,
            name,
            phone,
            email: "",
            cccd: tenantDraft.cccd.trim(),
            gender: tenantDraft.gender.trim(),
            birthDate,
            nationality: tenantDraft.nationality.trim(),
            address: tenantDraft.address.trim(),
            emergencyPhone: tenantDraft.emergencyPhone.trim(),
            idImages: existingIdx >= 0 ? roommates[existingIdx].idImages || [] : [],
            tempResidence: existingIdx >= 0 ? roommates[existingIdx].tempResidence || false : false,
          } as any;
          if (existingIdx >= 0) {
            roommates[existingIdx] = {
              ...roommates[existingIdx],
              ...newRoommate,
            };
          } else {
            roommates.push(newRoommate);
          }
          return {
            ...prev,
            roommates,
          };
        }
      });
      setIsTenantModalOpen(false);
      setTenantModalStep(1);
      setIsContractRepresentative(false);
      if (!(onUpdateRoom && isContractRepresentative)) {
        showToast("Đã cập nhật thông tin khách hàng.", "success");
      }
    } catch (error) {
      console.error("Error in commitTenantDraft:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveTenant = async () => {
    const name = tenantDraft.name.trim();
    const phone = tenantDraft.phone.trim();
    const cccd = tenantDraft.cccd.trim();
    const relationship = tenantDraft.relationship?.trim();
    const nextErrors = {
      name: !name,
      phone: !phone,
      cccd: false,
      relationship: !isContractRepresentative ? !relationship : false
    };
    if (nextErrors.name || nextErrors.phone || nextErrors.relationship) {
      setTenantFieldErrors(nextErrors as any);
      showToast("Vui lòng điền các trường bắt buộc.", "error");
      return;
    }

    if (!isContractRepresentative && !householdRepId) {
      showToast("Vui lòng chọn người đại diện hợp đồng.", "error");
      return;
    }

    // 1. Kiểm tra trùng cục bộ trong phòng hiện tại
    const cleanPhone = phone.replace(/[\s.()-]/g, "");
    const cleanCccd = cccd.replace(/[\s.-]/g, "");
    const currentDraftId = tenantDraft.id;

    const allOccupants: any[] = [
      roomData?.tenant,
      ...(roomData?.sharedTenants || []),
      ...(roomData?.roommates || []),
    ].filter(Boolean);

    for (const occ of allOccupants) {
      if (!occ) continue;
      if (occ.id && (occ.id === currentDraftId || occ.id === `t-${currentDraftId}`)) continue;
      const occPhone = (occ.phone || "").replace(/[\s.()-]/g, "");
      const occCccd = (occ.cccd || (occ as any).identityNo || "").replace(/[\s.-]/g, "");

      if (cleanPhone && occPhone && occPhone === cleanPhone) {
        setTenantFieldErrors((prev) => ({ ...prev, phone: true }));
        const msg = `Số điện thoại "${phone}" đã trùng với người lưu trú "${occ.name || occ.fullName}" trong phòng này.`;
        setDuplicateWarning(msg);
        showToast(msg, "error");
        return;
      }
      if (cleanCccd && occCccd && occCccd === cleanCccd) {
        setTenantFieldErrors((prev) => ({ ...prev, cccd: true }));
        const msg = `Số CCCD/CMND "${cccd}" đã trùng với người lưu trú "${occ.name || occ.fullName}" trong phòng này.`;
        setDuplicateWarning(msg);
        showToast(msg, "error");
        return;
      }
    }

    // 2. Kiểm tra trùng toàn hệ thống qua API checkDuplicate tối ưu (không tải toàn bộ danh sách)
    try {
      setIsCheckingDuplicate(true);
      const dupRes: any = await customersApi.checkDuplicate({
        phone: cleanPhone || undefined,
        identityNo: cleanCccd || undefined,
        excludeId: currentDraftId || undefined,
      });

      const dupData = dupRes?.data || dupRes;
      if (dupData?.isDuplicate) {
        if (dupData.duplicateField === "phone" || dupData.duplicateField === "both") {
          setTenantFieldErrors((prev) => ({ ...prev, phone: true }));
        }
        if (dupData.duplicateField === "identityNo" || dupData.duplicateField === "both") {
          setTenantFieldErrors((prev) => ({ ...prev, cccd: true }));
        }
        const warningMsg = dupData.message || "Thông tin SĐT hoặc CCCD đã tồn tại trong hệ thống.";
        setDuplicateWarning(warningMsg);
        showToast(warningMsg, "error");
        return;
      }
    } catch (err) {
      console.warn("Could not check duplicate customer:", err);
    } finally {
      setIsCheckingDuplicate(false);
    }

    setDuplicateWarning(null);

    if (isContractRepresentative && tenantModalStep === 1) {
      setTenantModalStep(2);
      return;
    }

    if (isContractRepresentative && tenantModalStep === 2) {
      commitTenantDraft(true);
      return;
    }

    commitTenantDraft();
  };

  const formatCompactMoney = (amount: number) => {
    if (amount === 0) return "0";
    if (amount >= 1000000) {
      return (
        (amount / 1000000).toLocaleString("en-US", {
          maximumFractionDigits: 2,
        }) + "M"
      );
    }
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  let tenantName = "Trống";
  let daysLeft = "-";
  let rDebt = roomData.debt || 0;
  if (roomData.tenant) {
    tenantName = roomData.tenant.name;
    if (roomData.contract) {
      const diff = Math.ceil(
        (new Date(roomData.contract.endDate).getTime() - new Date().getTime()) /
        (1000 * 3600 * 24),
      );
      daysLeft = diff > 0 ? `${diff}d` : "0d";
    }
  } else {
    const count = roomData.sharedTenants?.length || 0;
    tenantName = count > 0 ? `${count} khách ghép` : "Trống";
    if (count > 0) {
      rDebt =
        roomData.sharedTenants?.reduce((acc, st) => acc + (st.debt || 0), 0) ||
        0;
      const minDays = Math.min(
        ...(roomData.sharedTenants?.map((st) => st.remainingDays) || [0]),
      );
      daysLeft = `${minDays}d`;
    }
  }

  const occupantsCount = getOccupantsList().length;

  const tabs = [
    {
      id: "rental_flow",
      label: "Khách thuê",
      icon: <Users size={16} className="shrink-0" />,
      badge: occupantsCount > 0 ? occupantsCount : undefined,
    },
    {
      id: "finances",
      label: "Tài chính",
      icon: <DollarSign size={16} className="shrink-0" />,
      badge: rDebt > 0 ? "Nợ" : undefined,
    },
    {
      id: "contract",
      label: "Hợp đồng",
      icon: <FileText size={16} className="shrink-0" />,
    },
    {
      id: "temp_residence",
      label: "Tạm trú",
      icon: <ShieldAlert size={16} className="shrink-0" />,
      badge: (() => {
        if (occupantsCount === 0) return undefined;
        const occs = getOccupantsList();
        const declared = occs.filter((o: any) => Boolean(o.tempResidence)).length;
        if (declared === occs.length && occs.length > 0) return "✓";
        if (declared > 0) return `${declared}/${occs.length}`;
        return "!";
      })(),
    },
    {
      id: "overview",
      label: "Cài đặt phòng",
      icon: <SlidersHorizontal size={16} className="shrink-0" />,
    },
  ];

  const openCreateContractModal = () => {
    const start = new Date();
    const end = new Date(start);
    end.setFullYear(start.getFullYear() + 1);
    setContractCustomerId(roomData?.tenant?.id || customers[0]?.id || "");
    setContractStartDate(start.toISOString().slice(0, 10));
    setContractEndDate(end.toISOString().slice(0, 10));
    setContractCode(
      `HD-${roomData?.code || roomData?.name || roomId}-${Date.now().toString().slice(-4)}`,
    );
    setContractRent(roomData?.monthlyPrice || 0);
    setContractDeposit(Math.max(roomData?.monthlyPrice || 0, 0) * 2);
    setIsContractModalOpen(true);
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 md:p-8 overflow-hidden box-border max-w-full w-full">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-200"
          onClick={onClose}
        />
        <div className="relative z-10 w-full max-w-[1360px] h-[92dvh] md:h-[88vh] max-h-[880px] bg-card border border-border/70 shadow-[0_24px_70px_rgba(0,0,0,0.22)] rounded-[24px] flex flex-col overflow-hidden animate-in zoom-in-[0.98] duration-200 box-border">
          {/* Header */}
          <div className="flex items-center justify-between px-5 md:px-7 py-3 border-b border-border/60 bg-card shrink-0 w-full gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <LayoutDashboard size={18} />
              </div>
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h2 className="font-bold text-base md:text-[17px] tracking-tight text-text leading-none">
                  {getRoomDisplayName(roomData)}
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-surface border border-border/60 text-muted uppercase">
                  {roomRentalTypeLabel}
                </span>
                {roomData.status === "occupied" ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Đang thuê
                  </span>
                ) : roomData.status === "expiring_soon" ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Sắp hết hạn
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface text-muted border border-border">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted/60" />
                    Phòng trống
                  </span>
                )}
              </div>
            </div>

            {/* Middle/Right Quick Meta Info & Close */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted">
                <div className="flex items-center gap-1.5 font-bold text-text bg-surface/70 border border-border/50 px-2.5 py-1 rounded-lg">
                  <User size={12} className="text-primary shrink-0" />
                  <span className="truncate max-w-[170px]">{tenantName || "Chưa có người ở"}</span>
                </div>
                {rDebt > 0 ? (
                  <div className="flex items-center gap-1 font-bold text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>Nợ: {formatCompactMoney(rDebt)}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 size={12} className="shrink-0" />
                    <span>Không nợ</span>
                  </div>
                )}
                {daysLeft !== "-" && (
                  <div className="flex items-center gap-1 bg-surface/70 border border-border/50 px-2.5 py-1 rounded-lg">
                    <Calendar size={12} className="text-muted shrink-0" />
                    <span>HĐ còn: <strong className="text-text font-bold">{daysLeft}</strong></span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="h-8.5 w-8.5 rounded-xl bg-surface hover:bg-surface/80 border border-border/60 text-muted hover:text-text flex items-center justify-center transition-colors cursor-pointer"
                title="Đóng popup (Esc)"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex flex-1 min-h-0 overflow-hidden flex-col md:flex-row w-full box-border max-w-full">
            {/* Sidebar Navigation */}
            <div className="w-full md:w-[200px] lg:w-[210px] border-b md:border-b-0 md:border-r border-border/60 bg-surface/20 p-2.5 shrink-0 flex flex-col justify-between overflow-hidden">
              <div className="overflow-x-auto md:overflow-x-hidden md:overflow-y-auto max-w-full flex gap-1 p-0.5 md:flex-col md:p-0 md:gap-1 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabKey)}
                      className={`group flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl font-bold text-[12px] md:text-[13px] transition-all whitespace-nowrap shrink-0 text-left border cursor-pointer ${
                        isActive
                          ? "bg-primary text-white border-primary shadow-xs font-black"
                          : "text-muted border-transparent hover:bg-surface hover:text-text"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`transition-colors ${isActive ? "text-white" : "text-muted group-hover:text-primary"}`}>
                          {tab.icon}
                        </span>
                        <span>{tab.label}</span>
                      </div>
                      {tab.badge !== undefined && (
                        <span
                          className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                            isActive
                              ? "bg-white/25 text-white"
                              : tab.badge === "Nợ" || tab.badge === "!"
                              ? "bg-rose-500 text-white"
                              : "bg-primary/10 text-primary border border-primary/15"
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 relative w-full box-border max-w-full">
              {/* TAB 1: KHÁCH THUÊ */}
              {activeTab === "rental_flow" && (
                <div className="flex flex-col gap-5 animate-in w-full box-border">
                  {/* Tenant List Header & Actions */}
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-[14px] uppercase text-text tracking-wide">
                          Danh sách khách thuê
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                          {occupantsCount} người
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-surface border border-border/50 rounded-xl p-0.5">
                          <button
                            type="button"
                            onClick={() => setTenantViewMode("basic")}
                            className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${tenantViewMode === "basic" ? "bg-card shadow-sm text-text font-black" : "text-muted hover:text-text"
                              }`}
                          >
                            Cơ bản
                          </button>
                          <button
                            type="button"
                            onClick={() => setTenantViewMode("detailed")}
                            className={`px-3 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${tenantViewMode === "detailed" ? "bg-card shadow-sm text-text font-black" : "text-muted hover:text-text"
                              }`}
                          >
                            Chi tiết
                          </button>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => {
                            setIsContractRepresentative(shouldStartAsRepresentative);
                            setHouseholdRepId("");
                            setTenantDraft({ ...EMPTY_TENANT_DRAFT });
                            setTenantModalStep(1);
                            setIsTenantModalOpen(true);
                          }}
                          className="bg-primary text-white hover:bg-primary/90 shadow-sm"
                        >
                          <UserPlus size={14} className="mr-1.5" />
                          {roomData?.rentalType === "shared" ? "Thêm khách ghép" : roomData?.tenant ? "Thêm người ở cùng" : "Thêm khách thuê"}
                        </Button>
                      </div>
                    </div>

                    {/* Tenant Table / Empty State */}
                    {(() => {
                      const allTenantsList = getOccupantsList();

                      if (allTenantsList.length === 0) {
                        return (
                          <div className="p-10 text-center border-2 border-dashed border-border/60 rounded-2xl flex flex-col items-center justify-center bg-card shadow-sm">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                              <Users size={24} />
                            </div>
                            <h5 className="text-[15px] font-black text-text">Chưa có khách thuê trong phòng</h5>
                            <p className="text-xs text-muted max-w-sm mt-1 leading-relaxed">
                              {roomData.rentalType === "shared"
                                ? "Phòng này cho thuê ở ghép. Hãy thêm khách thuê đầu tiên để tạo hợp đồng."
                                : "Phòng hiện đang trống. Thêm khách thuê để lập hợp đồng và kích hoạt khai báo tạm trú."}
                            </p>
                            <Button
                              size="sm"
                              className="mt-4"
                              onClick={() => {
                                setIsContractRepresentative(true);
                                setHouseholdRepId("");
                                setTenantDraft({ ...EMPTY_TENANT_DRAFT });
                                setTenantModalStep(1);
                                setIsTenantModalOpen(true);
                              }}
                            >
                              <UserPlus size={14} className="mr-1.5" /> Thêm khách thuê ngay
                            </Button>
                          </div>
                        );
                      }

                      return (
                        <div className="border border-border/60 rounded-2xl overflow-hidden bg-card shadow-sm">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                              <thead className="bg-surface/50 text-[11px] font-black uppercase text-muted tracking-wider border-b border-border/40">
                                <tr>
                                  <th className="px-4 py-3">STT</th>
                                  <th className="px-4 py-3">Họ và tên</th>
                                  <th className="px-4 py-3">Số điện thoại</th>
                                  <th className="px-4 py-3">SĐT Người thân</th>
                                  <th className="px-4 py-3">CCCD / CMND</th>
                                  {tenantViewMode === "detailed" && <th className="px-4 py-3">Giới tính</th>}
                                  <th className="px-4 py-3">Ngày sinh</th>
                                  {tenantViewMode === "detailed" && <th className="px-4 py-3">Quốc tịch</th>}
                                  {tenantViewMode === "detailed" && <th className="px-4 py-3">Thường trú</th>}
                                  <th className="px-4 py-3">Vai trò</th>
                                  <th className="px-4 py-3 text-right">Thao tác</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/40">
                                {allTenantsList.map((t, index) => (
                                  <tr key={t.id || index} className="hover:bg-surface/40 transition-colors">
                                    <td className="px-4 py-3 font-semibold text-muted text-xs">{index + 1}</td>
                                    <td className="px-4 py-3 font-bold text-text">{t.name || "-"}</td>
                                    <td className="px-4 py-3 text-text font-mono text-xs">{t.phone || "-"}</td>
                                    <td className="px-4 py-3 text-muted font-mono text-xs">{(t as any).emergencyPhone || "-"}</td>
                                    <td className="px-4 py-3 text-text font-mono text-xs">{t.cccd || (t as any).citizenId || "-"}</td>
                                    {tenantViewMode === "detailed" && <td className="px-4 py-3 text-muted text-xs">{(t as any).gender || "-"}</td>}
                                    <td className="px-4 py-3 text-muted text-xs">{formatBirthDateForDisplay(t.birthDate || "") || "-"}</td>
                                    {tenantViewMode === "detailed" && <td className="px-4 py-3 text-muted text-xs">{t.nationality || "-"}</td>}
                                    {tenantViewMode === "detailed" && <td className="px-4 py-3 max-w-[160px] truncate text-muted text-xs" title={t.address}>{t.address || "-"}</td>}
                                    <td className="px-4 py-3">
                                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${t.isRep ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface text-muted border border-border/40'
                                        }`}>
                                        {t.role}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setTenantDraft({
                                              id: t.id,
                                              name: t.name || (t as any).fullName || "",
                                              phone: t.phone || "",
                                              email: t.email || "",
                                              cccd: (t as any).citizenId || t.cccd || "",
                                              birthDate: t.birthDate || "",
                                              gender: (t as any).gender || "",
                                              nationality: t.nationality || "Việt Nam",
                                              address: t.address || "",
                                              emergencyPhone: (t as any).emergencyPhone || "",
                                              relationship: (t as any).relationship || "",
                                              zaloChatId: (t as any).zaloChatId || "",
                                              zaloUserId: (t as any).zaloUserId || "",
                                              notes: (t as any).notes || "",
                                            });
                                            setTenantModalStep(1);
                                            setIsTenantModalOpen(true);
                                          }}
                                          className="p-1.5 hover:bg-surface rounded-lg text-muted hover:text-text transition-colors cursor-pointer"
                                          title="Sửa thông tin"
                                        >
                                          <Edit2 size={14} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setOccupantToDelete(t);
                                            setIsRemoveTenantConfirmOpen(true);
                                          }}
                                          className="p-1.5 hover:bg-rose-500/10 rounded-lg text-muted hover:text-rose-500 transition-colors cursor-pointer"
                                          title="Xóa cư dân"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* TAB 2: TÀI CHÍNH */}
              {activeTab === "finances" && (
                <div className="flex flex-col gap-5 animate-in w-full box-border">
                  {/* Financial KPI Summary Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl border border-border/60 bg-card shadow-sm">
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Dư nợ hiện tại</span>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className={`text-[20px] font-black ${rDebt > 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {rDebt > 0 ? formatCompactMoney(rDebt) : "0 đ"}
                        </span>
                        <span className="text-xs text-muted font-medium">{rDebt > 0 ? "Cần thanh toán" : "Đã thanh toán đủ"}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-border/60 bg-card shadow-sm">
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Giá thuê niêm yết</span>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-[20px] font-black text-text">
                          {(roomData.monthlyPrice || 0).toLocaleString("vi-VN")} đ
                        </span>
                        <span className="text-xs text-muted font-medium">/ tháng</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl border border-border/60 bg-card shadow-sm">
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Hóa đơn đã lập</span>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-[20px] font-black text-primary">
                          {realInvoices?.length || 0}
                        </span>
                        <span className="text-xs text-muted font-medium">hóa đơn ghi nhận</span>
                      </div>
                    </div>
                  </div>

                  {/* Invoices List */}
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-[14px] uppercase text-text tracking-wide flex items-center gap-2">
                        <CreditCard size={15} className="text-primary" /> Danh sách hóa đơn
                      </h4>
                      <Button
                        size="sm"
                        onClick={() => setIsCreateInvoiceModalOpen(true)}
                        className="bg-primary text-white hover:bg-primary/90 shadow-sm"
                      >
                        <Plus size={13} className="mr-1" /> Tạo hóa đơn
                      </Button>
                    </div>

                    <div className="border border-border/60 rounded-2xl overflow-hidden bg-card shadow-sm">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-surface/50 text-[11px] font-black uppercase text-muted tracking-wider border-b border-border/40">
                            <th className="px-4 py-3">Mã HĐ</th>
                            <th className="px-4 py-3">Số tiền</th>
                            <th className="px-4 py-3">Hạn thanh toán</th>
                            <th className="px-4 py-3 text-right">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {realInvoices && realInvoices.length > 0 ? (
                            realInvoices.map((inv: any) => (
                              <tr
                                key={inv.id}
                                className="hover:bg-surface/40 transition-colors"
                              >
                                <td className="px-4 py-3 font-bold text-text">{inv.code}</td>
                                <td className="px-4 py-3 font-black text-text">
                                  {(inv.total || inv.amount || 0).toLocaleString()} đ
                                </td>
                                <td className="px-4 py-3 text-muted text-xs">
                                  {new Date(inv.dueDate).toLocaleDateString("vi-VN")}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${["PAID", "paid"].includes(inv.status)
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                                      }`}
                                  >
                                    {["PAID", "paid"].includes(inv.status) ? "Đã trả" : "Chưa trả"}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={4}
                                className="p-8 text-center text-muted font-medium italic"
                              >
                                Chưa có hóa đơn nào cho phòng này
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Payment History */}
                  <div className="flex flex-col gap-3">
                    <h4 className="font-black text-[14px] uppercase text-text tracking-wide flex items-center gap-2">
                      Lịch sử thanh toán
                    </h4>
                    <div className="border border-border/60 rounded-2xl overflow-hidden bg-card shadow-sm">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-surface/50 text-[11px] font-black uppercase text-muted tracking-wider border-b border-border/40">
                            <th className="px-4 py-3">Tháng</th>
                            <th className="px-4 py-3">Số tiền</th>
                            <th className="px-4 py-3">Ngày thanh toán</th>
                            <th className="px-4 py-3 text-right">Hình thức</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {roomData.paymentHistory && roomData.paymentHistory.length > 0 ? (
                            roomData.paymentHistory.map((pay) => (
                              <tr
                                key={pay.id}
                                className="hover:bg-surface/40 transition-colors"
                              >
                                <td className="px-4 py-3 font-bold text-text">{pay.month}</td>
                                <td className="px-4 py-3 font-black text-emerald-600 dark:text-emerald-400">
                                  {pay.amount.toLocaleString()} đ
                                </td>
                                <td className="px-4 py-3 text-muted text-xs">{pay.date}</td>
                                <td className="px-4 py-3 text-right text-muted text-xs font-semibold">{pay.method}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={4}
                                className="p-8 text-center text-muted font-medium italic"
                              >
                                Chưa có lịch sử thanh toán
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: HỢP ĐỒNG */}
              {activeTab === "contract" && (
                <div className="flex flex-col gap-5 animate-in w-full box-border">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <h4 className="font-black text-[14px] uppercase text-text tracking-wide flex items-center gap-2">
                      <FileText size={16} className="text-primary" /> Thông tin hợp đồng thuê
                    </h4>
                    <Button
                      size="sm"
                      onClick={openCreateContractModal}
                      className="bg-primary text-white hover:bg-primary/90 shadow-sm"
                    >
                      <Plus size={13} className="mr-1" /> Tạo hợp đồng mới
                    </Button>
                  </div>

                  {(() => {
                    const reps = [
                      ...(roomData.tenant ? [{ ...roomData.tenant, contract: roomData.contract }] : []),
                      ...(roomData.sharedTenants || []).filter((t: any) => t.isRep).map(t => ({
                        ...t,
                        contract: {
                          id: t.contractId,
                          code: t.contractCode || `HĐ-${roomData.code || roomData.name}-${t.name ? t.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "-").toUpperCase() : Date.now().toString().slice(-4)}`,
                          deposit: t.deposit,
                          rentPrice: t.rentPrice,
                          startDate: t.startDate,
                          endDate: t.endDate
                        }
                      }))
                    ];

                    if (reps.length === 0 || !roomData.contract) {
                      return (
                        <div className="p-10 text-center border-2 border-dashed border-border/60 rounded-2xl flex flex-col items-center justify-center bg-card shadow-sm my-2">
                          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                            <FileText size={24} />
                          </div>
                          <h5 className="text-[15px] font-black text-text">Phòng này hiện chưa có hợp đồng</h5>
                          <p className="text-xs text-muted max-w-sm mt-1 leading-relaxed">
                            Lập hợp đồng thuê mới để quản lý thời hạn, tiền phòng, tiền cọc và tự động phát sinh hóa đơn định kỳ.
                          </p>
                          <Button
                            size="sm"
                            className="mt-4"
                            onClick={openCreateContractModal}
                          >
                            <Plus size={13} className="mr-1" /> Tạo hợp đồng ngay
                          </Button>
                        </div>
                      );
                    }

                    return (
                      <div className="border border-border/60 rounded-2xl bg-card shadow-sm overflow-visible">
                        <div className="overflow-visible min-h-[140px]">
                          <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-surface/50 uppercase text-[11px] font-black text-muted tracking-wider border-b border-border/40">
                              <tr>
                                <th className="px-4 py-3 w-[50px]">STT</th>
                                <th className="px-4 py-3">Đại diện HĐ</th>
                                <th className="px-4 py-3">Mã Hợp Đồng</th>
                                <th className="px-4 py-3">Tiền phòng</th>
                                <th className="px-4 py-3">Tiền cọc</th>
                                <th className="px-4 py-3">Ngày bắt đầu</th>
                                <th className="px-4 py-3">Ngày kết thúc</th>
                                <th className="px-4 py-3 text-right w-[100px]">Thao tác</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {(() => {
                                const currentBuilding = buildings?.find(b => Array.isArray(b.floors) && b.floors.some(f => Array.isArray(f.rooms) && f.rooms.some(r => r.id === roomId)));
                                const currentRoomType = (roomData as any)?.roomType || getStoredRoomType(roomId, (currentRoom as any)?.roomType);

                                const buildContractPayload = (rep: any) => {
                                  const c = rep.contract || {} as any;
                                  const rentVal = Number(c.rentPrice || roomData.monthlyPrice || 0);
                                  const depositVal = Number(c.deposit || 0);
                                  const landlordKey = contractDraft.chuNha || "TINH";
                                  const landlordInfo = LANDLORDS[landlordKey] || LANDLORDS["TINH"];

                                  const signedDate = c.signedAt ? new Date(c.signedAt) : new Date();
                                  const ngayKyHD = String(signedDate.getDate()).padStart(2, "0");
                                  const thangKyHD = String(signedDate.getMonth() + 1).padStart(2, "0");
                                  const namKyHD = String(signedDate.getFullYear());

                                  return {
                                    hoTen: rep.name || rep.fullName || "..........................",
                                    ngaySinh: rep.birthDate ? formatBirthDateForDisplay(rep.birthDate) : "..........................",
                                    cccd: rep.citizenId || rep.identityNo || rep.cccd || "..........................",
                                    diaChi: rep.address || rep.hometown || rep.permanentAddress || "..........................",
                                    dienThoai: rep.phone || rep.phoneNumber || "..........................",
                                    dienThoaiNguoithan: rep.relativePhone || rep.dienThoaiNguoithan || "-",
                                    tienThue: rentVal,
                                    tienCoc: depositVal,
                                    ngayBatDau: c.startDate ? formatBirthDateForDisplay(c.startDate) : "..........................",
                                    ngayKetThuc: c.endDate ? formatBirthDateForDisplay(c.endDate) : "..........................",
                                    maPhong: roomData.code || roomData.name || "..........................",
                                    soPhongNgu: currentRoomType || "1 phòng ngủ",
                                    thoiHanThue: contractDraft.thoiHanThue || "1 năm",
                                    toaNha: currentBuilding?.name || "..........................",
                                    diachiToanha: currentBuilding?.address || "..........................",
                                    chuNha: landlordKey,
                                    ngayKyHD,
                                    thangKyHD,
                                    namKyHD,
                                    ngayKyhopdong: c.signedAt ? formatBirthDateForDisplay(c.signedAt) : `${ngayKyHD}/${thangKyHD}/${namKyHD}`,
                                    ngayThanhToanDauTien: c.firstPaymentDate ? formatBirthDateForDisplay(c.firstPaymentDate) : `${ngayKyHD}/${thangKyHD}/${namKyHD}`,
                                    ...landlordInfo,
                                    signedAt: c.signedAt,
                                    firstPaymentDate: c.firstPaymentDate,
                                    contractCode: c.code,
                                  };
                                };

                                const handleDownloadContractPdf = async (rep: any) => {
                                  const rowKey = rep.contract?.id || rep.id || "current";
                                  setIsDownloadingPdf(rowKey);
                                  showToast("Đang chuẩn bị và kết xuất file PDF hợp đồng...", "info");
                                  try {
                                    const payload = buildContractPayload(rep);
                                    const res = await fetch("/api/export-contract?format=pdf", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json", ...getAuthorizationHeader() },
                                      body: JSON.stringify(payload),
                                    });
                                    if (!res.ok) {
                                      const errData = await res.json().catch(() => null);
                                      throw new Error(errData?.error || "Không thể tải tệp PDF từ server");
                                    }
                                    const blob = await res.blob();
                                    const url = window.URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.style.display = "none";
                                    a.href = url;
                                    const isPdf = blob.type.includes("pdf");
                                    const ext = isPdf ? "pdf" : "docx";
                                    const safeCustomer = (payload.hoTen || "KhachHang")
                                      .normalize("NFD")
                                      .replace(/[\u0300-\u036f]/g, "")
                                      .replace(/đ/g, "d")
                                      .replace(/Đ/g, "D")
                                      .replace(/[^a-zA-Z0-9\s]/g, "")
                                      .trim()
                                      .replace(/\s+/g, "_");
                                    const safeRoom = (payload.maPhong || "").replace(/[^a-zA-Z0-9]/g, "");
                                    const filename = `HopDong_${safeCustomer}${safeRoom ? `_${safeRoom}` : ""}.${ext}`;
                                    a.download = filename;
                                    document.body.appendChild(a);
                                    a.click();
                                    setTimeout(() => {
                                      document.body.removeChild(a);
                                      window.URL.revokeObjectURL(url);
                                    }, 250);

                                    if (isPdf) {
                                      showToast(`Đã tải xuống ${filename} thành công!`, "success");
                                    } else {
                                      showToast(`Đã tải xuống ${filename} (Word) thành công!`, "success");
                                    }
                                  } catch (err: any) {
                                    console.warn("[DownloadContractPdf]", err);
                                    showToast(err?.message || "Có lỗi xảy ra khi tải xuống hợp đồng", "error");
                                  } finally {
                                    setIsDownloadingPdf(null);
                                  }
                                };

                                return reps.map((rep, index) => {
                                  const c = rep.contract || {} as any;
                                  const tName = rep.name || rep.fullName || "";
                                  const cleanName = tName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "-").toUpperCase();
                                  const contractCode = c.code || `HĐ-${roomData.code || roomData.name}${cleanName ? `-${cleanName}` : ""}`;
                                  const rowKey = c.id || rep.id || String(index);

                                  return (
                                    <tr key={rowKey} className="hover:bg-surface/40 transition-colors">
                                      <td className="px-4 py-3 font-semibold text-muted text-xs">{index + 1}</td>
                                      <td className="px-4 py-3 font-bold text-text">{tName || "Chưa có"}</td>
                                      <td className="px-4 py-3">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const payload = buildContractPayload(rep);
                                            setPreviewContractData(payload);
                                            setIsPreviewContractModalOpen(true);
                                          }}
                                          className="font-bold text-primary hover:underline font-mono text-xs cursor-pointer inline-flex items-center gap-1.5 group text-left"
                                          title="Nhấn để xem trực tiếp PDF hợp đồng"
                                        >
                                          <span>{contractCode}</span>
                                          <Eye size={13} className="text-primary/70 group-hover:text-primary transition-colors" />
                                        </button>
                                      </td>
                                      <td className="px-4 py-3 font-black text-text">{(c.rentPrice || roomData.monthlyPrice || 0).toLocaleString()} đ</td>
                                      <td className="px-4 py-3 font-bold text-text">{(c.deposit || 0).toLocaleString()} đ</td>
                                      <td className="px-4 py-3 text-muted text-xs">{c.startDate ? new Date(c.startDate).toLocaleDateString("vi-VN") : "-"}</td>
                                      <td className="px-4 py-3 text-muted text-xs">{c.endDate ? new Date(c.endDate).toLocaleDateString("vi-VN") : "-"}</td>
                                      <td className="px-4 py-3 text-right">
                                        <div className="relative inline-flex items-center justify-end gap-1.5">
                                          <button
                                            type="button"
                                            disabled={isDownloadingPdf === rowKey}
                                            onClick={() => handleDownloadContractPdf(rep)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-all cursor-pointer disabled:opacity-60 shadow-2xs"
                                            title="Tải xuống PDF hợp đồng"
                                          >
                                            {isDownloadingPdf === rowKey ? (
                                              <>
                                                <Loader2 size={13} className="animate-spin text-primary shrink-0" />
                                                <span>Đang chuẩn bị file...</span>
                                              </>
                                            ) : (
                                              <>
                                                <Download size={13} className="shrink-0" />
                                                <span className="hidden sm:inline">Tải PDF</span>
                                              </>
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setOpenContractMenuId((prev) => (prev === rowKey ? null : rowKey));
                                            }}
                                            className={`p-1.5 rounded-xl transition-colors cursor-pointer outline-none ${
                                              openContractMenuId === rowKey ? "bg-surface text-primary shadow-sm" : "hover:bg-surface text-muted hover:text-text"
                                            }`}
                                            title="Tùy chọn khác"
                                          >
                                            <MoreHorizontal size={16} />
                                          </button>
                                          {openContractMenuId === rowKey && (
                                            <div
                                              onClick={(e) => e.stopPropagation()}
                                              className="absolute right-0 top-full mt-1.5 z-[10020] w-[200px] rounded-2xl border border-border bg-card shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150 text-left"
                                            >
                                              <button
                                                type="button"
                                                className="flex w-full items-center px-3 py-2 rounded-xl text-left text-[12px] font-bold text-text hover:bg-surface transition-colors cursor-pointer"
                                                onClick={() => {
                                                  setOpenContractMenuId(null);
                                                  const payload = buildContractPayload(rep);
                                                  setPreviewContractData(payload);
                                                  setIsPreviewContractModalOpen(true);
                                                }}
                                              >
                                                <Eye size={14} className="mr-2 text-primary" /> Xem PDF trực tiếp
                                              </button>
                                              <button
                                                type="button"
                                                className="flex w-full items-center px-3 py-2 rounded-xl text-left text-[12px] font-bold text-text hover:bg-surface transition-colors cursor-pointer"
                                                onClick={() => {
                                                  setOpenContractMenuId(null);
                                                  handleDownloadContractPdf(rep);
                                                }}
                                              >
                                                <Download size={14} className="mr-2 text-muted" /> Tải xuống PDF
                                              </button>
                                              <button
                                                type="button"
                                                className="flex w-full items-center px-3 py-2 rounded-xl text-left text-[12px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                                onClick={() => {
                                                  setOpenContractMenuId(null);
                                                  if (c.id) expireContractMutation.mutate(c.id);
                                                }}
                                              >
                                                <FileText size={14} className="mr-2" /> Gia hạn hợp đồng
                                              </button>
                                              <button
                                                type="button"
                                                className="flex w-full items-center px-3 py-2 rounded-xl text-left text-[12px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                                onClick={() => {
                                                  setOpenContractMenuId(null);
                                                  if (c.id) terminateContractMutation.mutate(c.id);
                                                }}
                                              >
                                                <Trash2 size={14} className="mr-2" /> Chấm dứt hợp đồng
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 4: TẠM TRÚ */}
              {activeTab === "temp_residence" && (
                <div className="flex flex-col gap-4 animate-in w-full box-border">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={17} className="text-primary" />
                      <h4 className="font-bold text-sm uppercase text-text tracking-wide">
                        Khai báo tạm trú (Mẫu CT01)
                      </h4>
                    </div>
                    <span className="text-xs text-muted">
                      Đồng bộ dữ liệu cư dân
                    </span>
                  </div>

                  {(() => {
                    const occupants = getOccupantsList();

                    if (occupants.length === 0) {
                      return (
                        <div className="p-10 text-center border border-dashed border-border/60 rounded-xl flex flex-col items-center justify-center bg-card my-2">
                          <div className="h-12 w-12 rounded-xl bg-muted/10 text-muted flex items-center justify-center mb-2.5">
                            <ShieldAlert size={24} />
                          </div>
                          <h4 className="text-sm font-bold text-text">Chưa có khách thuê</h4>
                          <p className="text-xs text-muted max-w-sm mt-1 leading-relaxed">
                            Phòng hiện đang trống. Sau khi thêm khách thuê hoặc ký hợp đồng, bạn có thể thực hiện thủ tục khai báo tạm trú (Mẫu CT01) cho cư dân tại đây.
                          </p>
                          <Button
                            size="sm"
                            className="mt-3.5 bg-primary text-white hover:bg-primary/90 font-bold"
                            onClick={() => setActiveTab("rental_flow")}
                          >
                            <UserPlus size={13} className="mr-1.5" /> Thêm khách thuê ngay
                          </Button>
                        </div>
                      );
                    }

                    const declaredCount = occupants.filter((occ: any) => Boolean(occ.tempResidence)).length;
                    const isAllDeclared = declaredCount === occupants.length && occupants.length > 0;
                    const isPartialDeclared = declaredCount > 0 && declaredCount < occupants.length;
                    const isNoneDeclared = declaredCount === 0;

                    return (
                      <div className="flex flex-col gap-3.5">
                        {/* Main room-wide status card */}
                        <div className="border border-border/60 rounded-xl p-3.5 bg-surface/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-text">
                                Khai báo tạm trú với Công an sở tại
                              </span>
                              {isAllDeclared && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  ✓ Đã khai báo ({declaredCount}/{occupants.length})
                                </span>
                              )}
                              {isPartialDeclared && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  ⚠ Khai báo 1 phần ({declaredCount}/{occupants.length})
                                </span>
                              )}
                              {isNoneDeclared && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                  • Chưa khai báo (0/{occupants.length})
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted">
                              Quy định bắt buộc đối với khách thuê lưu trú qua đêm. Bạn có thể khai báo cho từng khách hoặc khai báo toàn bộ.
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant={isAllDeclared ? "outline" : "primary"}
                              onClick={() => setIsTempResidenceConfirmOpen(true)}
                              disabled={isSavingTempResidence}
                              className="shrink-0 h-8 font-bold text-xs"
                            >
                              {isAllDeclared ? "Hủy khai báo tất cả" : "Xác nhận đã khai báo tất cả"}
                            </Button>
                          </div>
                        </div>

                        {/* Occupants list breakdown */}
                        <div className="flex flex-col gap-2 mt-1">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[11px] font-bold uppercase text-muted tracking-wider">
                              Danh sách người lưu trú ({occupants.length})
                            </h5>
                            <span className="text-xs font-medium text-muted">
                              Đã khai báo: <strong className="text-text font-bold">{declaredCount}/{occupants.length}</strong> khách
                            </span>
                          </div>
                          <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
                            <table className="w-full text-left border-collapse text-sm">
                              <thead>
                                <tr className="bg-surface/50 text-[11px] font-bold uppercase text-muted tracking-wider border-b border-border/40">
                                  <th className="px-4 py-2.5">Họ và tên</th>
                                  <th className="px-4 py-2.5">CCCD / Định danh</th>
                                  <th className="px-4 py-2.5">Vai trò</th>
                                  <th className="px-4 py-2.5 text-center">Trạng thái tạm trú</th>
                                  <th className="px-4 py-2.5 text-right">Thao tác</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/40">
                                {occupants.map((occ: any, idx: number) => {
                                  const isDeclared = Boolean(occ.tempResidence);
                                  return (
                                    <tr key={occ.id || idx} className="hover:bg-surface/40 transition-colors">
                                      <td className="px-4 py-2.5">
                                        <div className="flex flex-col">
                                          <span className="font-bold text-text">{occ.name || occ.fullName || "Khách thuê"}</span>
                                          {occ.phone && <span className="text-[11px] text-muted font-mono">{occ.phone}</span>}
                                        </div>
                                      </td>
                                      <td className="px-4 py-2.5 text-text font-mono text-xs">{occ.cccd || occ.identityNo || "—"}</td>
                                      <td className="px-4 py-2.5">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${occ.isRep ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface text-muted border border-border/40'}`}>
                                          {occ.role || (occ.isRep ? "Đại diện HĐ" : "Người ở cùng")}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold ${isDeclared
                                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                          }`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${isDeclared ? "bg-emerald-500" : "bg-rose-500"}`} />
                                          {isDeclared ? "Đã khai báo" : "Chưa khai báo"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2.5 text-right">
                                        <Button
                                          size="sm"
                                          variant={isDeclared ? "outline" : "primary"}
                                          onClick={() => {
                                            setOccupantToConfirmTempResidence(occ);
                                            setIsSingleTempResidenceConfirmOpen(true);
                                          }}
                                          disabled={isSavingTempResidence}
                                          className={`h-7 text-xs font-bold gap-1 px-2.5 ${
                                            isDeclared
                                              ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/40"
                                              : ""
                                          }`}
                                        >
                                          {isDeclared ? (
                                            <>
                                              <X size={12} /> Hủy khai báo
                                            </>
                                          ) : (
                                            <>
                                              <Check size={12} /> Khai báo
                                            </>
                                          )}
                                        </Button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 5: CÀI ĐẶT PHÒNG */}
              {activeTab === "overview" && (
                <div className="flex flex-col gap-4 animate-in w-full box-border">
                  <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal size={17} className="text-primary" />
                      <h3 className="font-bold text-sm uppercase tracking-wide text-text">
                        Cài đặt & Thông số phòng
                      </h3>
                    </div>
                    <span className="text-xs text-muted font-mono">Mã: {roomData.code}</span>
                  </div>

                  {/* Hunonic IoT & Utilities Card */}
                  <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text">
                        <Zap size={15} className="text-amber-500" /> Công tơ điện thông minh & Định mức tiện ích
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          ● Tự động đồng bộ
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleUpdateElectricity}
                          disabled={isUpdatingElectricity || isElectricityLoading}
                          className="h-7 text-xs font-bold gap-1 text-muted hover:text-text cursor-pointer"
                        >
                          <RefreshCw size={11} className={isUpdatingElectricity || isElectricityLoading ? "animate-spin" : ""} />
                          {isUpdatingElectricity ? "Đang cập nhật..." : "Cập nhật chỉ số"}
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {electricity ? (
                        <>
                          <div className="rounded-lg border border-border/40 bg-surface/40 p-3">
                            <div className="text-[10px] font-bold uppercase text-muted">Thiết bị đo</div>
                            <div className="mt-1 text-sm font-black text-text truncate">{electricity.deviceName || electricity.displayName}</div>
                          </div>
                          <div className="rounded-lg border border-border/40 bg-surface/40 p-3">
                            <div className="text-[10px] font-bold uppercase text-muted">Số điện tháng này</div>
                            <div className="mt-1 text-sm font-black text-text">{Number(electricity.energyMonthKwh || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} kWh</div>
                          </div>
                          <div className="rounded-lg border border-border/40 bg-surface/40 p-3">
                            <div className="text-[10px] font-bold uppercase text-muted">Tiền điện tạm tính</div>
                            <div className="mt-1 text-sm font-black text-emerald-600 dark:text-emerald-400">{formatCompactMoney(Number(electricity.moneyMonthVnd || 0))}</div>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2 sm:col-span-3 rounded-lg border border-dashed border-border/60 bg-surface/20 p-3 text-xs text-muted text-center flex items-center justify-center">
                          {isElectricityLoading ? "Đang tải dữ liệu công tơ điện..." : "Chưa liên kết công tơ Hunonic cho phòng này."}
                        </div>
                      )}
                      <div className="rounded-lg border border-border/40 bg-surface/40 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase text-muted">Định mức nước</span>
                          <Droplets size={12} className="text-sky-500" />
                        </div>
                        <div className="mt-1 text-sm font-black text-sky-600 dark:text-sky-400">100.000 đ / người</div>
                        <div className="text-[10px] text-muted font-medium mt-0.5">Thu theo số người ở</div>
                      </div>
                    </div>
                  </div>

                  {/* Form Specifications Card */}
                  {(() => {
                    const displayRent = (roomData.contract?.rentPrice ? Number(roomData.contract.rentPrice) : (roomData.monthlyPrice || roomData.price || 0)).toLocaleString("vi-VN") + " đ";
                    const displayStatus = roomData.status === "occupied" ? "Đang thuê" : roomData.status === "expiring_soon" ? "Hợp đồng sắp hết hạn" : roomData.status === "deposited" ? "Đã đặt cọc" : roomData.status === "maintenance" ? "Đang bảo trì" : "Trống (Có thể thuê)";
                    const currentRoomType = (roomData as any)?.roomType || getStoredRoomType(roomId, (currentRoom as any)?.roomType);

                    return (
                      <div className="rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted border-b border-border/40 pb-2">
                          Thông số cấu hình phòng
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                          {/* 1. Tên phòng */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-muted uppercase">
                              Tên phòng
                            </label>
                            <Input
                              readOnly
                              disabled
                              value={roomData.name}
                              className="bg-surface/50 cursor-not-allowed font-bold text-text h-9 text-xs border-border/60"
                            />
                          </div>

                          {/* 2. Mã định danh phòng */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-muted uppercase">
                              Mã phòng
                            </label>
                            <Input
                              readOnly
                              disabled
                              value={roomData.code}
                              className="bg-surface/50 cursor-not-allowed font-bold text-text h-9 text-xs border-border/60"
                            />
                          </div>

                          {/* 3. Giá thuê niêm yết */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-muted uppercase">
                              Giá thuê niêm yết
                            </label>
                            <Input
                              readOnly
                              disabled
                              value={displayRent}
                              className="bg-surface/50 cursor-not-allowed font-bold text-text h-9 text-xs border-border/60"
                            />
                          </div>

                          {/* 4. Trạng thái phòng */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-muted uppercase">
                              Trạng thái phòng
                            </label>
                            <Input
                              readOnly
                              disabled
                              value={displayStatus}
                              className="bg-surface/50 cursor-not-allowed font-bold text-text h-9 text-xs border-border/60"
                            />
                          </div>

                          {/* 5. Kiểu thuê phòng */}
                          <div className="flex flex-col gap-1">
                            <label
                              htmlFor="room-rental-type"
                              className="text-[11px] font-bold text-text uppercase"
                            >
                              Kiểu thuê phòng
                            </label>
                            <div className="relative">
                              <Select
                                id="room-rental-type"
                                value={roomData.rentalType || "whole"}
                                onChange={(event) =>
                                  handleFieldChange(
                                    "rentalType",
                                    event.target.value as Room["rentalType"],
                                  )
                                }
                                options={ROOM_RENTAL_TYPE_OPTIONS}
                                className="cursor-pointer pr-8 h-9 text-xs font-semibold"
                              />
                              <ChevronDown
                                aria-hidden="true"
                                size={14}
                                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
                              />
                            </div>
                          </div>

                          {/* 6. Loại phòng */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-text uppercase">
                              Loại phòng
                            </label>
                            <Select
                              value={currentRoomType}
                              onChange={(e) => handleFieldChange("roomType" as any, e.target.value)}
                              options={ROOM_TYPE_OPTIONS}
                              className="cursor-pointer h-9 text-xs font-semibold"
                            />
                          </div>

                          {/* 7. Diện tích */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-text uppercase">
                              Diện tích (m²)
                            </label>
                            <Input
                              type="number"
                              value={roomData.area ?? ""}
                              onChange={(e) => handleFieldChange(
                                "area",
                                e.target.value === "" ? undefined : Number(e.target.value),
                              )}
                              placeholder="m²"
                              className="h-9 text-xs"
                            />
                          </div>

                          {/* 8. Sức chứa */}
                          <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-text uppercase">
                              Sức chứa (người)
                            </label>
                            <Input
                              type="number"
                              value={roomData.capacity ?? ""}
                              onChange={(e) => handleFieldChange(
                                "capacity",
                                e.target.value === "" ? undefined : Number(e.target.value),
                              )}
                              placeholder="Số người"
                              className="h-9 text-xs"
                            />
                          </div>
                        </div>

                        {/* Dedicated Save Button for Room Settings */}
                        <div className="flex justify-end pt-3 border-t border-border/40">
                          <Button onClick={handleSave} disabled={isSavingRoom} className="bg-primary text-white hover:bg-primary/90 font-bold px-5 h-9 text-xs">
                            {isSavingRoom ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Save size={14} className="mr-1.5" />}
                            {isSavingRoom ? "Đang lưu..." : "Lưu cài đặt phòng"}
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isTenantModalOpen}
        onClose={() => setIsTenantModalOpen(false)}
        title={tenantDraft.id ? "Cập nhật thông tin khách thuê" : `Thêm khách thuê ${getOccupantsList().length + 1}`}
        maxWidth="max-w-xl"
        headerActions={
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsQrMenuOpen((prev) => !prev)}
              aria-label="Quét QR"
              title="Quét QR CCCD"
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-xs font-black text-primary transition-all hover:bg-primary/20 hover:border-primary/40 shadow-xs cursor-pointer"
            >
              <QrCode size={14} className="shrink-0 text-primary" />
              <span>Quét QR</span>
              <ChevronDown size={13} className="shrink-0 text-primary opacity-80" />
            </button>
            {isQrMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-[10010]"
                  onClick={() => setIsQrMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-[10020] w-[180px] overflow-hidden rounded-[14px] border border-border bg-background shadow-xl">
                  <button
                    type="button"
                    onClick={openQrScanner}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold text-text hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <Camera size={14} className="text-[#6366f1]" />
                    Mở camera
                  </button>
                  <button
                    type="button"
                    onClick={openQrUpload}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold text-text hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <Upload size={14} className="text-indigo-500" />
                    Tải ảnh lên
                  </button>
                </div>
              </>
            )}
          </div>
        }
        footer={
          <div className="flex gap-3 justify-end w-full">
            {tenantModalStep === 2 && (
              <Button
                variant="outline"
                onClick={() => setTenantModalStep(1)}
              >
                Quay lại
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setIsTenantModalOpen(false);
                setTenantModalStep(1);
                setIsContractRepresentative(false);
              }}
            >
              Hủy
            </Button>
            <Button onClick={handleSaveTenant} disabled={isExporting || isCheckingDuplicate}>
              {isExporting || isCheckingDuplicate ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              {tenantModalStep === 1 && isContractRepresentative ? "Tiếp tục" : "Lưu khách thuê"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 py-2">
          {duplicateWarning && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-200 bg-rose-50/90 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200 text-xs leading-relaxed shadow-sm animate-in fade-in-50 duration-200">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="flex-1 font-semibold">{duplicateWarning}</div>
            </div>
          )}

          {tenantModalStep === 1 && (
            <>
              <div className="flex items-center justify-between bg-indigo-50/50 p-3 rounded-lg border border-emerald-100">
                <div className="flex flex-col mr-2">
                  <span className="text-[12px] md:text-[13px] font-bold text-emerald-900">
                    {roomData?.rentalType === "shared"
                      ? "Đại diện hợp đồng chính"
                      : (tenantDraft.id
                          ? (getOccupantsList().find((occ) => occ.id === tenantDraft.id)?.role === "Đại diện HĐ phụ"
                              ? "Đại diện hợp đồng phụ"
                              : "Đại diện hợp đồng chính")
                          : (getOccupantsList().length >= 1
                              ? "Đại diện hợp đồng phụ"
                              : "Đại diện hợp đồng chính")
                        )}
                  </span>
                  <span className="text-[10px] md:text-[11px] text-indigo-600">
                    {roomData?.rentalType === "shared"
                      ? "Ở ghép: mặc định mỗi người sẽ là đại diện hợp đồng chính"
                      : (tenantDraft.id
                          ? (getOccupantsList().find((occ) => occ.id === tenantDraft.id)?.role === "Đại diện HĐ phụ"
                              ? "Nguyên căn: khách này là người đại diện hợp đồng phụ"
                              : "Nguyên căn: khách này là người đại diện hợp đồng chính")
                          : (getOccupantsList().length >= 1
                              ? "Nguyên căn: người thứ 2 trở lên sẽ là đại diện hợp đồng phụ"
                              : "Nguyên căn: khách này sẽ là người đại diện hợp đồng chính")
                        )}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={isContractRepresentative}
                    onChange={(e) => {
                      setIsContractRepresentative(e.target.checked);
                      if (e.target.checked) {
                        setHouseholdRepId("");
                      }
                    }}
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>

              {!isContractRepresentative && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-bold text-text">THÀNH VIÊN CÙNG HỘ GĐ *</label>
                    <Select
                      value={householdRepId}
                      onChange={(e) => setHouseholdRepId(e.target.value)}
                      options={[
                        { label: "Chọn người đại diện...", value: "" },
                        ...getRepresentativeCandidates().map((rep: any) => ({ label: rep.name || rep.fullName || "", value: rep.id }))
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-bold text-text">
                      Mối quan hệ *
                    </label>
                    <Input
                      type="text"
                      list="relationship-options"
                      placeholder="Chọn hoặc điền mối quan hệ..."
                      value={tenantDraft.relationship || ""}
                      onChange={(event) =>
                        updateTenantDraft("relationship", event.target.value)
                      }
                      aria-invalid={tenantFieldErrors.relationship}
                      className={
                        tenantFieldErrors.relationship
                          ? "!border-danger !ring-danger focus-visible:!ring-danger"
                          : ""
                      }
                    />
                    <datalist id="relationship-options">
                      {[
                        "Anh", "Anh họ", "Anh rể", "Anh ruột", "Anh vợ", "Ba", "Bà", "Bà ngoại", "Bà nội", "Bác", "Bạn", "Bố", "Cậu", "Cha", "Cha chồng", "Cha đẻ", "Cha nuôi", "Cha vợ", "Cháu", "Cháu Dâu", "Cháu họ", "Cháu ngoại", "Cháu nội", "Cháu rể", "Chắt", "Chít", "Chị", "Chị Chồng", "Chị dâu", "Chị họ", "Chị ruột", "Chị vợ", "Chồng", "Chú", "Chưa có thông tin", "Con", "Con chồng", "Con dâu", "Con đẻ", "Con nuôi", "Con rể", "Con vợ", "Cô", "Cụ", "Cùng ở thuê", "Dì", "Đồng nghiệp - CA", "Đồng nghiệp - QĐ", "Em", "Em chồng", "Em dâu", "Em họ", "Em rể", "Em ruột", "Em vợ", "Khác", "Mẹ", "Mẹ chồng", "Mẹ đẻ", "Mẹ nuôi", "Mẹ vợ", "Người được chăm sóc", "Người được giám hộ", "Người được nuôi dưỡng", "Người được trợ giúp", "Người giám hộ", "Người mượn nhà", "Người ở nhờ", "Người thuê nhà", "Nhân khẩu tập thể", "Ông", "Ông ngoại", "Ông nội", "Thím", "Tía", "Vợ"
                      ].map((opt) => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Chọn phòng (Fixed / Readonly) */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">Chọn phòng</label>
                  <div className="relative">
                    <DoorOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <Input
                      type="text"
                      readOnly
                      disabled
                      value={formatRoomDisplayLabel(roomData)}
                      className="pl-9 bg-muted/10 dark:bg-muted/10 cursor-not-allowed font-medium text-text border-border"
                      title="Phòng hiện tại (cố định trong hồ sơ phòng)"
                    />
                  </div>
                </div>

                {/* 2. Kiểu thuê phòng (Fixed / Readonly) */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">Kiểu thuê phòng</label>
                  <div className="relative">
                    <select
                      disabled
                      value={roomData?.rentalType === "shared" ? "shared" : "whole"}
                      className="h-10 w-full rounded-xl border border-border bg-muted/10 px-3 pr-8 text-sm font-medium text-text appearance-none cursor-not-allowed"
                    >
                      <option value="whole">Thuê nguyên căn</option>
                      <option value="shared">Ở ghép</option>
                    </select>
                    <ChevronDown
                      size={15}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                    />
                  </div>
                </div>

                {/* 3. Họ và tên * */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">Họ và tên *</label>
                  <Input
                    type="text"
                    placeholder="Nhập họ và tên"
                    value={tenantDraft.name}
                    onChange={(event) =>
                      updateTenantDraft("name", event.target.value)
                    }
                    aria-invalid={tenantFieldErrors.name}
                    className={
                      tenantFieldErrors.name
                        ? "!border-danger !ring-danger focus-visible:!ring-danger"
                        : ""
                    }
                  />
                  {tenantFieldErrors.name && (
                    <span className="text-xs text-rose-500">Vui lòng nhập họ và tên</span>
                  )}
                </div>

                {/* 4. Số điện thoại * */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">Số điện thoại *</label>
                  <Input
                    type="tel"
                    placeholder="Nhập số điện thoại"
                    value={tenantDraft.phone}
                    onChange={(event) =>
                      updateTenantDraft("phone", event.target.value)
                    }
                    aria-invalid={tenantFieldErrors.phone}
                    className={
                      tenantFieldErrors.phone
                        ? "!border-danger !ring-danger focus-visible:!ring-danger"
                        : ""
                    }
                  />
                  {tenantFieldErrors.phone && (
                    <span className="text-xs text-rose-500">Vui lòng nhập số điện thoại</span>
                  )}
                </div>

                {/* 5. SĐT người thân */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">SĐT người thân</label>
                  <Input
                    type="tel"
                    placeholder="Nhập SĐT người thân / liên hệ khẩn cấp"
                    value={tenantDraft.emergencyPhone || ""}
                    onChange={(event) =>
                      updateTenantDraft("emergencyPhone", event.target.value)
                    }
                  />
                </div>

                {/* 6. Email */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">Email</label>
                  <Input
                    type="email"
                    placeholder="Nhập email"
                    value={tenantDraft.email || ""}
                    onChange={(event) =>
                      updateTenantDraft("email", event.target.value)
                    }
                  />
                </div>

                {/* 7. CCCD / CMND */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">CCCD / CMND</label>
                  <Input
                    type="text"
                    placeholder="Nhập số CCCD"
                    value={tenantDraft.cccd}
                    onChange={(event) =>
                      updateTenantDraft("cccd", event.target.value)
                    }
                    aria-invalid={tenantFieldErrors.cccd}
                    className={
                      tenantFieldErrors.cccd
                        ? "!border-danger !ring-danger focus-visible:!ring-danger"
                        : ""
                    }
                  />
                </div>

                {/* 8. Giới tính */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">Giới tính</label>
                  <div className="relative">
                    <select
                      value={tenantDraft.gender || ""}
                      onChange={(event) =>
                        updateTenantDraft("gender", event.target.value)
                      }
                      className="h-10 w-full rounded-xl border border-border bg-card px-3 pr-8 text-sm font-medium text-text appearance-none focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                    >
                      <option value="">Chọn giới tính</option>
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Khác">Khác</option>
                    </select>
                    <ChevronDown
                      size={15}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                    />
                  </div>
                </div>

                {/* 9. Ngày sinh */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">Ngày sinh</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="DD/MM/YYYY"
                    value={formatBirthDateForDisplay(tenantDraft.birthDate)}
                    onChange={(event) =>
                      updateTenantDraft("birthDate", event.target.value)
                    }
                    className="h-10 appearance-none [text-align:left] [font-variant-numeric:tabular-nums]"
                  />
                </div>

                {/* 10. Quốc tịch */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">Quốc tịch</label>
                  <Input
                    type="text"
                    list="nationality-options"
                    placeholder="Việt Nam"
                    value={tenantDraft.nationality || ""}
                    onChange={(event) =>
                      updateTenantDraft("nationality", event.target.value)
                    }
                  />
                  <datalist id="nationality-options">
                    {["Việt Nam", "Trung Quốc", "Đài Loan", "Ấn Độ"].map((opt) => (
                      <option key={opt} value={opt} />
                    ))}
                  </datalist>
                </div>

                {/* 11. Địa chỉ thường trú */}
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">Địa chỉ thường trú</label>
                  <Input
                    type="text"
                    placeholder="Nhập địa chỉ..."
                    value={tenantDraft.address || ""}
                    onChange={(event) =>
                      updateTenantDraft("address", event.target.value)
                    }
                  />
                </div>

                {/* 12. Zalo chat ID */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">Zalo chat ID</label>
                  <Input
                    type="text"
                    placeholder="Dán chat_id từ webhook Bot"
                    value={tenantDraft.zaloChatId || ""}
                    onChange={(event) =>
                      updateTenantDraft("zaloChatId", event.target.value)
                    }
                  />
                </div>

                {/* 13. Zalo user ID */}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">Zalo user ID</label>
                  <Input
                    type="text"
                    placeholder="Dán user_id từ webhook Bot"
                    value={tenantDraft.zaloUserId || ""}
                    onChange={(event) =>
                      updateTenantDraft("zaloUserId", event.target.value)
                    }
                  />
                </div>

                {/* 14. Ghi chú */}
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-bold text-text">Ghi chú</label>
                  <textarea
                    className="flex min-h-[88px] w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Nhập ghi chú"
                    value={tenantDraft.notes || ""}
                    onChange={(event) =>
                      updateTenantDraft("notes", event.target.value)
                    }
                  />
                </div>
              </div>
            </>
          )}

          {tenantModalStep === 2 && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-right-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-1">
                  <label className="text-[11px] font-black text-muted uppercase">
                    Loại phòng
                  </label>
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                    {getRoomRentalTypeSettingLabel(roomData?.rentalType)}
                  </span>
                </div>
                <Input
                  type="text"
                  readOnly
                  disabled
                  value={
                    ROOM_TYPE_OPTIONS.find(
                      (opt) =>
                        opt.value.toLowerCase() ===
                        (contractDraft.soPhongNgu || (roomData as any)?.roomType || "1 phòng ngủ").toLowerCase()
                    )?.label ||
                    contractDraft.soPhongNgu ||
                    (roomData as any)?.roomType ||
                    "1 Phòng ngủ"
                  }
                  className="bg-black/5 dark:bg-white/5 cursor-not-allowed font-bold text-text border-border/80"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">
                  Thời hạn thuê
                </label>
                <Select
                  value={contractDraft.thoiHanThue}
                  onChange={(e) => {
                    const val = e.target.value;
                    let months = 0;
                    if (val === "6 tháng") months = 6;
                    else if (val === "1 năm") months = 12;
                    else if (val === "2 năm") months = 24;
                    else if (val === "3 năm") months = 36;
                    else if (val === "4 năm") months = 48;
                    else if (val === "5 năm") months = 60;

                    setContractDraft((p) => {
                      let nextEnd = p.ngayKetThuc;
                      if (months > 0 && p.ngayBatDau) {
                        const d = new Date(p.ngayBatDau);
                        d.setMonth(d.getMonth() + months);
                        nextEnd = d.toISOString().slice(0, 10);
                      }
                      return { ...p, thoiHanThue: val, ngayKetThuc: nextEnd };
                    });
                  }}
                  options={[
                    { label: "6 tháng", value: "6 tháng" },
                    { label: "1 năm", value: "1 năm" },
                    { label: "2 năm", value: "2 năm" },
                    { label: "3 năm", value: "3 năm" },
                    { label: "4 năm", value: "4 năm" },
                    { label: "5 năm", value: "5 năm" },
                    { label: "Khác", value: "Khác" },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-1">
                  <label className="text-[11px] font-black text-muted uppercase whitespace-nowrap">
                    Chủ căn hộ
                  </label>
                  <span
                    className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full truncate max-w-[120px]"
                    title={currentBuilding?.name || currentBuilding?.code || "Tòa nhà"}
                  >
                    {currentBuilding?.code || currentBuilding?.name || "Tòa nhà"}
                  </span>
                </div>
                <Input
                  type="text"
                  readOnly
                  disabled
                  value={
                    (currentBuilding as any)?.owner?.name ||
                    (currentBuilding as any)?.ownerName ||
                    LANDLORDS[resolvedLandlordKey]?.hoTenChuNha ||
                    (resolvedLandlordKey === "THE" ? "PHAN VĂN THỂ" : "NGUYỄN ĐỨC TÍNH")
                  }
                  className="bg-black/5 dark:bg-white/5 cursor-not-allowed font-bold text-text border-border/80"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">
                  Mục đích thuê
                </label>
                <Input
                  type="text"
                  value={contractDraft.mucDichThue}
                  onChange={(e) => setContractDraft((p) => ({ ...p, mucDichThue: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">
                  Tiền thuê nhà (VNĐ)
                </label>
                <Input
                  type="text"
                  placeholder="0"
                  value={contractDraft.tienThue}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    const formatted = val ? Number(val).toLocaleString("en-US") : "";
                    setContractDraft((p) => ({ ...p, tienThue: formatted }));
                  }}
                />
                {contractDraft.tienThue && (
                  <span className="text-[10px] text-indigo-600 font-medium mt-[-2px]">
                    {numberToWordsVietnamese(Number(contractDraft.tienThue.replace(/\D/g, "")))}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">
                  Tiền cọc (VNĐ)
                </label>
                <Input
                  type="text"
                  placeholder="0"
                  value={contractDraft.tienCoc}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    const formatted = val ? Number(val).toLocaleString("en-US") : "";
                    setContractDraft((p) => ({ ...p, tienCoc: formatted }));
                  }}
                />
                {contractDraft.tienCoc && (
                  <span className="text-[10px] text-indigo-600 font-medium mt-[-2px]">
                    Bằng chữ: {numberToWordsVietnamese(Number(contractDraft.tienCoc.replace(/\D/g, "")))}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">
                  Ngày bắt đầu
                </label>
                <DateMaskInput
                  value={contractDraft.ngayBatDau}
                  onChange={(newStart) => {
                    setContractDraft((p) => {
                      let nextEnd = p.ngayKetThuc;
                      const val = p.thoiHanThue;
                      let months = 0;
                      if (val === "6 tháng") months = 6;
                      else if (val === "1 năm") months = 12;
                      else if (val === "2 năm") months = 24;
                      else if (val === "3 năm") months = 36;
                      else if (val === "4 năm") months = 48;
                      else if (val === "5 năm") months = 60;

                      if (months > 0 && newStart && newStart.length === 10) {
                        const d = new Date(newStart);
                        if (!isNaN(d.getTime())) {
                          d.setMonth(d.getMonth() + months);
                          nextEnd = d.toISOString().slice(0, 10);
                        }
                      }
                      return { ...p, ngayBatDau: newStart, ngayKetThuc: nextEnd };
                    });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">
                  Ngày kết thúc
                </label>
                <DateMaskInput
                  value={contractDraft.ngayKetThuc}
                  onChange={(newEnd) => setContractDraft((p) => ({ ...p, ngayKetThuc: newEnd, thoiHanThue: "Khác" }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">
                  Ngày ký hợp đồng
                </label>
                <DateMaskInput
                  value={contractDraft.ngayKyhopdong || ""}
                  onChange={(newDate) => setContractDraft((p) => ({ ...p, ngayKyhopdong: newDate }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">
                  Ngày thanh toán đầu tiên
                </label>
                <DateMaskInput
                  value={contractDraft.ngayThanhToanDauTien || ""}
                  onChange={(newDate) => setContractDraft((p) => ({ ...p, ngayThanhToanDauTien: newDate }))}
                />
              </div>
            </div>
          )}
        </div>
      </Modal>



      <Modal
        isOpen={isContractModalOpen}
        onClose={() => setIsContractModalOpen(false)}
        title="Tạo hợp đồng mới"
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button
              variant="outline"
              onClick={() => setIsContractModalOpen(false)}
              disabled={createContractMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              onClick={() => {
                if (!contractCustomerId) {
                  showToast("Vui lòng chọn khách thuê", "error");
                  return;
                }
                createContractMutation.mutate(
                  {
                    customerId: contractCustomerId,
                    roomId,
                    contractCode: contractCode.trim(),
                    startDate: contractStartDate,
                    endDate: contractEndDate,
                    rentAmount: Number(contractRent),
                    depositAmount: Number(contractDeposit),
                    memberCount: getDefaultMemberCount(),
                    status: "DRAFT",
                  },
                  {
                    onSuccess: () => {
                      setIsContractModalOpen(false);
                      onClose();
                    },
                  },
                );
              }}
              disabled={createContractMutation.isPending}
            >
              {createContractMutation.isPending ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <FileText size={16} className="mr-2" />
              )}
              Tạo hợp đồng
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-muted uppercase">
              Khách thuê
            </label>
            <Select
              value={contractCustomerId}
              onChange={(e) => setContractCustomerId(e.target.value)}
              options={[
                { label: "Chọn khách thuê", value: "" },
                ...customers.map((customer: any) => ({
                  label: `${customer.fullName || customer.name || customer.phone || customer.email || customer.id}${customer.phone ? ` - ${customer.phone}` : ""}`,
                  value: customer.id,
                })),
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-muted uppercase">
                Mã hợp đồng
              </label>
              <Input
                value={contractCode}
                onChange={(e) => setContractCode(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-muted uppercase">
                Giá thuê / tháng
              </label>
              <Input
                type="text"
                value={contractRent ? new Intl.NumberFormat("vi-VN").format(contractRent) : ""}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, "");
                  setContractRent(val ? Number(val) : 0);
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-muted uppercase">
                Ngày bắt đầu
              </label>
              <Input
                type="date"
                value={contractStartDate}
                onChange={(e) => setContractStartDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-black text-muted uppercase">
                Ngày kết thúc
              </label>
              <Input
                type="date"
                value={contractEndDate}
                onChange={(e) => setContractEndDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 col-span-2">
              <label className="text-[11px] font-black text-muted uppercase">
                Tiền cọc
              </label>
              <Input
                type="text"
                value={contractDeposit ? new Intl.NumberFormat("vi-VN").format(contractDeposit) : ""}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, "");
                  setContractDeposit(val ? Number(val) : 0);
                }}
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isRemoveTenantConfirmOpen}
        onClose={() => {
          setIsRemoveTenantConfirmOpen(false);
          setOccupantToDelete(null);
        }}
        title="Xác nhận xóa khách thuê"
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button
              variant="outline"
              onClick={() => {
                setIsRemoveTenantConfirmOpen(false);
                setOccupantToDelete(null);
              }}
              disabled={isRemovingTenant}
            >
              Hủy
            </Button>
            <Button
              onClick={async () => {
                setIsRemovingTenant(true);
                try {
                  const targetOccupant = occupantToDelete || (roomData?.tenant ? { ...roomData.tenant, isRep: true } : null);
                  const occId = targetOccupant?.id;
                  const isRep = Boolean(targetOccupant?.isRep);
                  const contractId = targetOccupant?.contractId || (isRep ? roomData?.contract?.id : undefined);

                  // 1. Delete contract if contract representative
                  if (contractId && !contractId.startsWith("c-")) {
                    try {
                      await contractsApi.delete(contractId);
                    } catch (err) {
                      console.warn("Could not delete contract:", err);
                    }
                  }

                  // 2. Delete or unlink customer from DB
                  if (occId && !occId.startsWith("t-")) {
                    try {
                      await customersApi.delete(occId);
                    } catch (err) {
                      console.warn("Could not delete customer via API, unlinking instead:", err);
                      try {
                        await customersApi.update(occId, { roomId: null });
                      } catch {}
                    }
                  }

                  // 3. Update local state
                  let nextTenant = roomData?.tenant;
                  if (nextTenant && (nextTenant.id === occId || isRep)) {
                    nextTenant = null;
                  }
                  const nextRoommates = (roomData?.roommates || []).filter((rm: any) => rm.id !== occId && (occId || rm.name !== targetOccupant?.name));
                  const nextSharedTenants = (roomData?.sharedTenants || []).filter((st: any) => st.id !== occId && (occId || st.name !== targetOccupant?.name));
                  const hasAnyOccupantLeft = Boolean(nextTenant || nextRoommates.length > 0 || nextSharedTenants.length > 0);
                  const nextStatus = hasAnyOccupantLeft ? (roomData?.status || "occupied") : "vacant";

                  setRoomData((prev) => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      tenant: nextTenant,
                      roommates: nextRoommates,
                      sharedTenants: nextSharedTenants,
                      contract: isRep && !prev.rentalType?.includes("shared") ? undefined : prev.contract,
                      status: nextStatus,
                    };
                  });

                  if (onUpdateRoom) {
                    await onUpdateRoom(roomId, {
                      tenant: nextTenant,
                      status: nextStatus,
                    } as any);
                  }

                  await Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["rooms"] }),
                    queryClient.invalidateQueries({ queryKey: ["buildings"] }),
                    queryClient.invalidateQueries({ queryKey: ["customers"] }),
                    queryClient.invalidateQueries({ queryKey: ["contracts"] }),
                  ]);

                  setIsRemoveTenantConfirmOpen(false);
                  setOccupantToDelete(null);
                  showToast("Đã xóa khách thuê thành công.", "success");
                } catch (err: any) {
                  console.error("Error deleting customer:", err);
                  showToast(err?.message || "Lỗi khi xóa khách thuê.", "error");
                } finally {
                  setIsRemovingTenant(false);
                }
              }}
              className="bg-rose-500 text-white hover:bg-rose-600"
              disabled={isRemovingTenant}
            >
              {isRemovingTenant ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <Trash2 size={16} className="mr-2" />
              )}
              Xóa khách thuê
            </Button>
          </div>
        }
      >
        <p className="text-[13px] text-muted-foreground py-2">
          {occupantToDelete?.name ? (
            <>Bạn có chắc chắn muốn xóa khách thuê <strong>{occupantToDelete.name}</strong> khỏi phòng này không?</>
          ) : (
            "Bạn có chắc chắn muốn xóa thông tin khách thuê này không?"
          )}
        </p>
      </Modal>

      <Modal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="Xác nhận xóa phòng"
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={deleteRoomMutation.isPending}
            >
              Hủy
            </Button>
            <Button
              onClick={() => {
                deleteRoomMutation.mutate(roomId, {
                  onSuccess: () => {
                    setIsDeleteConfirmOpen(false);
                    onClose();
                  },
                });
              }}
              className="bg-rose-500 text-white hover:bg-rose-600"
              disabled={deleteRoomMutation.isPending}
            >
              {deleteRoomMutation.isPending ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <Trash2 size={16} className="mr-2" />
              )}
              Xóa phòng
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-2">
          <p className="text-sm text-text font-medium">
            Bạn có chắc chắn muốn xóa phòng{" "}
            <span className="font-black">{getRoomDisplayName(roomData)}</span>{" "}
            không?
          </p>
          <p className="text-xs text-muted">
            Hành động này không thể hoàn tác. Nếu phòng đang có hợp đồng, hệ
            thống sẽ chặn xóa để tránh mất dữ liệu.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={isTempResidenceConfirmOpen}
        onClose={() => setIsTempResidenceConfirmOpen(false)}
        title={
          (() => {
            const occs = getOccupantsList();
            const allDeclared = occs.length > 0 && occs.every((occ: any) => Boolean(occ.tempResidence));
            return allDeclared
              ? "Xác nhận hủy khai báo tạm trú tất cả"
              : "Xác nhận đã khai báo tạm trú tất cả";
          })()
        }
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button
              variant="outline"
              onClick={() => setIsTempResidenceConfirmOpen(false)}
              disabled={isSavingTempResidence}
            >
              Hủy bỏ
            </Button>
            {(() => {
              const occs = getOccupantsList();
              const allDeclared = occs.length > 0 && occs.every((occ: any) => Boolean(occ.tempResidence));
              return (
                <Button
                  variant={allDeclared ? "danger" : "primary"}
                  onClick={handleConfirmToggleTempResidence}
                  disabled={isSavingTempResidence}
                >
                  {isSavingTempResidence ? (
                    <Loader2 size={16} className="animate-spin mr-2" />
                  ) : allDeclared ? (
                    <ShieldAlert size={16} className="mr-2" />
                  ) : (
                    <Check size={16} className="mr-2" />
                  )}
                  {allDeclared ? "Xác nhận hủy tất cả" : "Xác nhận khai báo tất cả"}
                </Button>
              );
            })()}
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-2">
          {(() => {
            const occs = getOccupantsList();
            const allDeclared = occs.length > 0 && occs.every((occ: any) => Boolean(occ.tempResidence));
            if (allDeclared) {
              return (
                <>
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-[13px]">
                    <ShieldAlert className="shrink-0 text-rose-600" size={18} />
                    <span>
                      Bạn có chắc chắn muốn hủy trạng thái khai báo tạm trú của tất cả khách trong phòng <strong>{getRoomDisplayName(roomData)}</strong>?
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Phòng sẽ được chuyển về trạng thái &quot;Chưa khai tạm trú&quot; và hiển thị lại cảnh báo trên danh sách phòng.
                  </p>
                </>
              );
            }
            return (
              <>
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[13px]">
                  <ShieldAlert className="shrink-0 text-emerald-600" size={18} />
                  <span>
                    Xác nhận tất cả ({occs.length}) cư dân phòng <strong>{getRoomDisplayName(roomData)}</strong> đã hoàn tất thủ tục đăng ký tạm trú với Công an sở tại.
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Sau khi xác nhận, tất cả khách lưu trú trong phòng sẽ được đánh dấu đã khai báo và trạng thái phòng sẽ là &quot;Đã khai báo&quot;.
                </p>
              </>
            );
          })()}
        </div>
      </Modal>

      {/* Modal Xác nhận khai báo tạm trú cho từng khách thuê */}
      <Modal
        isOpen={isSingleTempResidenceConfirmOpen && Boolean(occupantToConfirmTempResidence)}
        onClose={() => {
          if (!isSavingTempResidence) {
            setIsSingleTempResidenceConfirmOpen(false);
            setOccupantToConfirmTempResidence(null);
          }
        }}
        title={
          occupantToConfirmTempResidence?.tempResidence
            ? "Xác nhận hủy khai báo tạm trú"
            : "Xác nhận đã khai báo tạm trú"
        }
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button
              variant="outline"
              onClick={() => {
                setIsSingleTempResidenceConfirmOpen(false);
                setOccupantToConfirmTempResidence(null);
              }}
              disabled={isSavingTempResidence}
            >
              Hủy bỏ
            </Button>
            {(() => {
              const isDeclared = Boolean(occupantToConfirmTempResidence?.tempResidence);
              return (
                <Button
                  variant={isDeclared ? "danger" : "primary"}
                  onClick={async () => {
                    if (occupantToConfirmTempResidence) {
                      await handleToggleOccupantTempResidence(occupantToConfirmTempResidence);
                      setIsSingleTempResidenceConfirmOpen(false);
                      setOccupantToConfirmTempResidence(null);
                    }
                  }}
                  disabled={isSavingTempResidence}
                >
                  {isSavingTempResidence ? (
                    <Loader2 size={16} className="animate-spin mr-2" />
                  ) : isDeclared ? (
                    <ShieldAlert size={16} className="mr-2" />
                  ) : (
                    <Check size={16} className="mr-2" />
                  )}
                  {isDeclared ? "Xác nhận hủy khai báo" : "Xác nhận đã khai báo"}
                </Button>
              );
            })()}
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-2">
          {(() => {
            const occ = occupantToConfirmTempResidence;
            if (!occ) return null;
            const isDeclared = Boolean(occ.tempResidence);
            const occName = occ.name || occ.fullName || "Khách thuê";
            const occPhone = occ.phone || "";
            const occCccd = occ.cccd || occ.identityNo || "";

            if (isDeclared) {
              return (
                <>
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 text-[13px]">
                    <ShieldAlert className="shrink-0 text-rose-600" size={22} />
                    <div className="flex flex-col gap-0.5">
                      <div className="font-bold">
                        Hủy trạng thái khai báo tạm trú của khách thuê:
                      </div>
                      <div className="text-[14px] font-black text-rose-600 dark:text-rose-400">
                        {occName}
                      </div>
                      {(occPhone || occCccd) && (
                        <div className="text-[11px] opacity-80">
                          {occPhone ? `SĐT: ${occPhone}` : ""} {occPhone && occCccd ? "•" : ""} {occCccd ? `CCCD: ${occCccd}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Khách thuê này sẽ được chuyển về trạng thái &quot;Chưa khai báo&quot; tại phòng <strong>{getRoomDisplayName(roomData)}</strong>.
                  </p>
                </>
              );
            }

            return (
              <>
                <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[13px]">
                  <Check className="shrink-0 text-emerald-600" size={22} />
                  <div className="flex flex-col gap-0.5">
                    <div className="font-bold">
                      Xác nhận đã khai báo tạm trú (Mẫu CT01) cho khách thuê:
                    </div>
                    <div className="text-[14px] font-black text-emerald-600 dark:text-emerald-400">
                      {occName}
                    </div>
                    {(occPhone || occCccd) && (
                      <div className="text-[11px] opacity-80">
                        {occPhone ? `SĐT: ${occPhone}` : ""} {occPhone && occCccd ? "•" : ""} {occCccd ? `CCCD: ${occCccd}` : ""}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Sau khi xác nhận, hệ thống sẽ đánh dấu khách thuê này là &quot;Đã khai báo&quot; tại phòng <strong>{getRoomDisplayName(roomData)}</strong>.
                </p>
              </>
            );
          })()}
        </div>
      </Modal>

      <input
        ref={qrFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            setScannerFile(file);
            setIsScannerOpen(true);
          }
          event.target.value = "";
        }}
      />

      <CccdUploadScannerModal
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          setScannerFile(null);
        }}
        file={scannerFile}
        onSuccess={handleUploadSuccess}
      />

      {previewImage && (
        <Modal
          isOpen={Boolean(previewImage)}
          onClose={() => setPreviewImage(null)}
          title="Xem ảnh căn hộ"
          maxWidth="max-w-4xl"
        >
          <div className="flex items-center justify-center p-2 bg-black/5 dark:bg-white/5 rounded-xl">
            <img
              src={previewImage}
              alt="Room preview"
              className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-lg"
            />
          </div>
        </Modal>
      )}

      {isCreateInvoiceModalOpen && (
        <InvoiceCreateModal
          isOpen={isCreateInvoiceModalOpen}
          onClose={() => setIsCreateInvoiceModalOpen(false)}
          defaultRoomId={roomId}
        />
      )}

      {isPreviewContractModalOpen && previewContractData && (
        <PreviewContractModal
          isOpen={isPreviewContractModalOpen}
          onClose={() => {
            setIsPreviewContractModalOpen(false);
            setPreviewContractData(null);
          }}
          contract={previewContractData}
        />
      )}
    </>,
    document.body,
  );
}
