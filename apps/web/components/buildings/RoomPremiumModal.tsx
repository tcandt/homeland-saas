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
  MoreHorizontal,
  Zap,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";
import { numberToWordsVietnamese } from "../../lib/utils/number-to-words";
import { Modal } from "../ui/Modal";
import { CccdUploadScannerModal } from "../common/CccdUploadScannerModal";
import { Button } from "../ui/Button";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  parseCccdQrPayload,
} from "@/lib/utils/cccd-qr";
import {
  CCCD_LIVE_SCAN_CONFIG,
  optimizeCccdCameraTrack,
  stopCccdCameraTracks,
} from "@/lib/utils/cccd-camera";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";
import { useCustomersQuery } from "@/lib/queries/customers.queries";
import {
  useCreateContractMutation,
  useTerminateContractMutation,
  useExpireContractMutation,
} from "@/lib/mutations/contracts.mutations";
import { useDeleteRoomMutation } from "@/lib/mutations/rooms.mutations";
import { customersApi } from "@/lib/api/customers.api";
import { contractsApi } from "@/lib/api/contracts.api";
import { hunonicApi } from "@/lib/api/hunonic.api";
import { getRoomDisplayName } from "./building-labels";

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
  | "images"
  | "notes"
  | "overview";

type TenantDraft = {
  id?: string;
  name: string;
  phone: string;
  emergencyPhone: string;
  cccd: string;
  address: string;
  gender: string;
  birthDate: string;
  nationality: string;
  relationship?: string;
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

const LANDLORDS = {
  TINH: {
    hoTenChuNha: "NGUYỄN ĐỨC TÍNH",
    ngaySinhChuNha: "13/03/1997",
    cccdChuNha: "054097010677",
    diaChiChuNha: "LK01.31 Khu đô thị \u00c2n Phú , phường Tân An , tỉnh Đắk Lắk",
    dienThoaiChuNha: "0373129295 - 0567867889 ( Tính )",
    chuTaiKhoan: "HKD NGUYEN DUC TINH",
    soTaiKhoan: "8818406081",
    nganHang: "BIDV",
  },
  THE: {
    hoTenChuNha: "PHAN VĂN THỂ",
    ngaySinhChuNha: "24/11/1994",
    cccdChuNha: "066094006596 , Cấp ngày: 15/10/2025 tại Cục cảnh sát",
    diaChiChuNha: "LK01.31 Khu đô thị \u00c2n Phú , phường Tân An , tỉnh Đắk Lắk",
    dienThoaiChuNha: "0373129295 - 0567.79.2222 ( Thể )",
    chuTaiKhoan: "HKD PHAN VAN THE",
    soTaiKhoan: "8827905414",
    nganHang: "BIDV",
  }
};

const EMPTY_TENANT_DRAFT: TenantDraft = {
  name: "",
  phone: "",
  emergencyPhone: "",
  cccd: "",
  address: "",
  gender: "",
  birthDate: "",
  nationality: "",
  relationship: "",
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
    if (tab === "finances" || tab === "contract" || tab === "temp_residence" || tab === "images" || tab === "notes" || tab === "overview" || tab === "rental_flow") {
      return tab;
    }
    return "rental_flow";
  };
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(normalizeInitialTab(initialTab));
  const [isTenantModalOpen, setIsTenantModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
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
  const [contractDraft, setContractDraft] = useState<ContractDraft>({
    mucDichThue: "Ở",
    tienThue: "",
    tienCoc: "",
    ngayBatDau: getLocalYMD(),
    ngayKetThuc: getLocalYMD(new Date(new Date().setFullYear(new Date().getFullYear() + 2))),
    soPhongNgu: "1 phòng ngủ",
    thoiHanThue: "2 năm",
    chuNha: "TINH",
    ngayKyhopdong: getLocalYMD(),
    ngayThanhToanDauTien: getLocalYMD(),
  });
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
    relationship?: boolean;
  }>({ name: false, phone: false, relationship: false });
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const { showToast } = useToast();
  const createContractMutation = useCreateContractMutation();
  const terminateContractMutation = useTerminateContractMutation();
  const expireContractMutation = useExpireContractMutation();
  const deleteRoomMutation = useDeleteRoomMutation();

  const { data: invoicesResponse } = useInvoicesQuery({ roomId });
  const { data: electricityResponse, isLoading: isElectricityLoading } = useSWR(
    roomId ? ["hunonic-room-electricity", roomId] : null,
    () => hunonicApi.roomElectricity(roomId),
    { revalidateOnFocus: false, refreshInterval: 60 * 60 * 1000 },
  );
  const { data: customersResponse } = useCustomersQuery({ limit: 100 });
  const realInvoices = (invoicesResponse as any)?.data?.items || [];
  const electricity = electricityResponse as any;
  const customers = useMemo(() => {
    const payload = customersResponse as any;
    const items = payload?.data?.items || payload?.data || payload?.items || [];
    return Array.isArray(items) ? items : [];
  }, [customersResponse]);

  let currentRoom: Room | null = null;
  for (const b of buildings) {
    for (const f of b.floors) {
      const r = f.rooms.find((r) => r.id === roomId);
      if (r) {
        currentRoom = r;
        break;
      }
    }
    if (currentRoom) break;
  }

  const [roomData, setRoomData] = useState<Room | null>(
    currentRoom ? { ...currentRoom, rentalType: currentRoom.rentalType || "whole" } : currentRoom,
  );

  useEffect(() => {
    setMounted(true);
    setRoomData(currentRoom ? { ...currentRoom, rentalType: currentRoom.rentalType || "whole" } : currentRoom);
  }, [roomId, currentRoom]);

  useEffect(() => {
    setActiveTab(normalizeInitialTab(initialTab));
  }, [initialTab]);

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
          () => {},
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
      if (scanner) {
        Promise.resolve(scanner.stop()).catch(() => undefined);
        Promise.resolve(scanner.clear()).catch(() => undefined);
      }
      stopCccdCameraTracks(QR_CAMERA_ELEMENT_ID);
    };
  }, [isQrScannerOpen, qrMode, showToast]);

  const closeQrScanner = () => {
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

    const mapUiStatusToApi = (s: string) => {
      if (s === "occupied" || s === "expiring_soon") return "OCCUPIED";
      if (s === "maintenance") return "MAINTENANCE";
      if (s === "deposited") return "RESERVED";
      if (s === "vacant" || s === "available") return "AVAILABLE";
      if (s === "cleaning") return "CLEANING";
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
      notes: roomData.notes,
    };

    if (onUpdateRoom) {
      await onUpdateRoom(roomData.id, payload);
    }
    setRoomData((prev) => (prev ? ({ ...prev, ...payload } as Room) : prev));
    onClose();
  };
  const handleFieldChange = (field: keyof Room, value: any) => {
    setRoomData((prev) => (prev ? { ...prev, [field]: value } : null));
  };
  const shouldStartAsRepresentative = roomData?.rentalType === "shared" || !roomData?.tenant;
  const roomRentalTypeLabel = roomData?.rentalType === "shared" ? "Phòng ghép" : "Nguyên căn";
  const getRepresentativeCandidates = () => [
    ...(roomData?.tenant ? [roomData.tenant] : []),
    ...(roomData?.sharedTenants || []).filter((tenant: any) => tenant.isRep),
  ];
  const getOccupantsList = () => {
    if (roomData?.rentalType === "shared") {
      return [
        ...(roomData.sharedTenants || []).map((tenant: any) => ({
          ...tenant,
          role: tenant.isRep ? "Đại diện HĐ" : "Người ở cùng",
          isRep: !!tenant.isRep,
        })),
      ];
    }

    return [
      ...(roomData?.tenant ? [{ ...roomData.tenant, role: "Đại diện HĐ", isRep: true }] : []),
      ...((roomData?.roommates || []).map((tenant: any) => ({
        ...tenant,
        role: "Người ở cùng",
        isRep: false,
      }))),
    ];
  };
  const getDefaultMemberCount = () => {
    if (roomData?.rentalType === "shared") {
      return Math.max(1, roomData.sharedTenants?.length || 1);
    }
    return Math.max(1, 1 + (roomData?.roommates?.length || 0));
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
    if (field === "relationship" && tenantFieldErrors.relationship) {
      setTenantFieldErrors((prev) => ({ ...prev, relationship: false }));
    }
    setTenantDraft((prev) => ({ ...prev, [field]: value }));
  };



  const commitTenantDraft = async (isCustomContract?: boolean) => {
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
        email: roomData?.tenant?.email?.trim() || null,
        citizenId: tenantDraft.cccd.trim(),
        gender: tenantDraft.gender.trim() || null,
        birthDate: birthDate || null,
        nationality: tenantDraft.nationality.trim() || null,
        address: tenantDraft.address.trim() || null,
        emergencyPhone: tenantDraft.emergencyPhone.trim() || null,
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
      } catch (error) {
        console.error(error);
        showToast("Không thể lưu khách thuê vào DB.", "error");
        return;
      }

      let existingContractId: string | null | undefined = roomData?.contract?.id;
      if (!existingContractId && tenantDraft.id) {
        existingContractId = tenantDraft.id === roomData?.tenant?.id
          ? roomData?.contract?.id
          : roomData?.sharedTenants?.find(st => st.id === tenantDraft.id)?.contractId;
      }

      const existingCoReps = (roomData?.sharedTenants || []).filter(st => st.isRep && st.id !== customerId).map(st => st.id);
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
            startDate: isCustomContract ? contractDraft.ngayBatDau : new Date().toISOString().slice(0, 10),
            endDate: isCustomContract ? contractDraft.ngayKetThuc : new Date(
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
        } catch (error) {
          console.error(error);
          showToast(
            "Đã lưu khách thuê nhưng chưa thể liên kết vào phòng.",
            "error",
          );
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

      if (onUpdateRoom && isContractRepresentative) {
        await onUpdateRoom(roomId, {
          status: shouldCreateContract ? "occupied" : roomData?.status === "occupied" ? "occupied" : "vacant",
        });
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
      if (!(onUpdateRoom && isContractRepresentative)) {
        showToast("Đã cập nhật thông tin khách hàng.", "success");
      }
    } catch (error) {
      console.error("Error in commitTenantDraft:", error);
    }
  };

  const handleSaveTenant = () => {
    const name = tenantDraft.name.trim();
    const phone = tenantDraft.phone.trim();
    const relationship = tenantDraft.relationship?.trim();
    const nextErrors = {
      name: !name,
      phone: !phone,
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

    if (isContractRepresentative && tenantModalStep === 1) {
      setTenantModalStep(2);
      return;
    }

    if (isContractRepresentative && tenantModalStep === 2) {
      exportContractAndSaveTenant();
      return;
    }

    commitTenantDraft();
  };

  const exportContractAndSaveTenant = async () => {
    setIsExporting(true);
    try {
      const landlordInfo = LANDLORDS[contractDraft.chuNha || "TINH"];
      const currentBuilding = buildings?.find(b => Array.isArray(b.floors) && b.floors.some(f => Array.isArray(f.rooms) && f.rooms.some(r => r.id === roomId)));

      const payloadData = {
        hoTen: tenantDraft.name.trim() || "..........................",
        ngaySinh: formatBirthDateForDisplay(tenantDraft.birthDate) || "..........................",
        cccd: tenantDraft.cccd.trim() || "..........................",
        diaChi: tenantDraft.address.trim() || "..........................",
        dienThoai: tenantDraft.phone.trim() || "..........................",
        dienThoaiNguoithan: tenantDraft.emergencyPhone.trim() || "-",
        mucDichThue: contractDraft.mucDichThue.trim() || "..........................",
        tienThue: Number(contractDraft.tienThue.replace(/\D/g, "")) || 0,
        tienThueChu: contractDraft.tienThue ? numberToWordsVietnamese(Number(contractDraft.tienThue.replace(/\D/g, ""))) : "..........................",
        tienCoc: Number(contractDraft.tienCoc.replace(/\D/g, "")) || 0,
        tienCocChu: contractDraft.tienCoc ? numberToWordsVietnamese(Number(contractDraft.tienCoc.replace(/\D/g, ""))) : "..........................",
        ngayBatDau: formatBirthDateForDisplay(contractDraft.ngayBatDau),
        ngayKetThuc: formatBirthDateForDisplay(contractDraft.ngayKetThuc),
        maPhong: roomData?.code || roomData?.name || "..........................",
        soPhongNgu: contractDraft.soPhongNgu || "..........................",
        thoiHanThue: contractDraft.thoiHanThue || "..........................",
        toaNha: currentBuilding?.name || "..........................",
        diachiToanha: currentBuilding?.address || "..........................",
        ngayKyHD: contractDraft.ngayKyhopdong ? contractDraft.ngayKyhopdong.split("-")[2] : "...",
        thangKyHD: contractDraft.ngayKyhopdong ? contractDraft.ngayKyhopdong.split("-")[1] : "...",
        namKyHD: contractDraft.ngayKyhopdong ? contractDraft.ngayKyhopdong.split("-")[0] : "....",
        ngayKyhopdong: formatBirthDateForDisplay(contractDraft.ngayKyhopdong),
        ngayThanhToanDauTien: formatBirthDateForDisplay(contractDraft.ngayThanhToanDauTien),
        ...landlordInfo,
      };

      const res = await fetch("/api/export-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadData),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Export failed");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `HopDong_${payloadData.hoTen}_${payloadData.maPhong}.docx`;
      link.click();
      window.URL.revokeObjectURL(url);

      await commitTenantDraft(true);
    } catch (error: any) {
      console.error(error);
      let errMsg = "Có lỗi xảy ra khi xuất hợp đồng.";
      if (error?.message) {
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.error) errMsg = parsed.error;
        } catch {
          errMsg = error.message;
        }
      }
      showToast(errMsg, "error");
    } finally {
      setIsExporting(false);
    }
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

  const tabs = [
    {
      id: "rental_flow",
      label: "Khách thuê",
      icon: <Users size={14} className="shrink-0" />,
    },
    {
      id: "finances",
      label: "Tài chính",
      icon: <DollarSign size={14} className="shrink-0" />,
    },
    {
      id: "contract",
      label: "Hợp đồng",
      icon: <FileText size={14} className="shrink-0" />,
    },
    {
      id: "temp_residence",
      label: "Tạm trú",
      icon: <ShieldAlert size={14} className="shrink-0" />,
    },
    {
      id: "images",
      label: "Ảnh",
      icon: <ImageIcon size={14} className="shrink-0" />,
    },
    {
      id: "notes",
      label: "Ghi chú",
      icon: <AlignLeft size={14} className="shrink-0" />,
    },
    {
      id: "overview",
      label: "Metadata",
      icon: <LayoutDashboard size={14} className="shrink-0" />,
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
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-8 overflow-hidden box-border max-w-full w-full">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-[4px] animate-in fade-in duration-300"
          onClick={onClose}
        />
        <div className="relative z-10 w-full max-w-[500px] md:max-w-[1450px] h-[85dvh] md:h-[85vh] max-h-[850px] bg-background md:bg-card/95 md:backdrop-blur-3xl border border-border/60 shadow-xl rounded-[20px] md:rounded-[24px] flex flex-col overflow-hidden animate-in zoom-in-[0.98] duration-300 box-border">
          <div className="flex flex-col p-4 md:px-8 md:py-5 border-b border-border/50 bg-black/[0.01] dark:bg-white/[0.01] shrink-0 w-full box-border max-w-full">
            <div className="flex items-start justify-between w-full min-w-0">
              <div className="flex flex-col flex-1 min-w-0 pr-2 overflow-hidden">
                <h2 className="font-black text-[16px] md:text-[22px] tracking-tight text-text leading-tight truncate">
                  {getRoomDisplayName(roomData)}
                </h2>
                <div className="flex flex-col mt-0.5 min-w-0 overflow-hidden text-[12px] font-bold">
                  <span className="text-text truncate w-full">
                    {tenantName}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 truncate w-full text-[11px]">
                    {rDebt > 0 ? (
                      <span className="text-rose-500">
                        Nợ: {formatCompactMoney(rDebt)}
                      </span>
                    ) : (
                      <span className="text-indigo-500">Không nợ</span>
                    )}
                    <span className="text-muted">•</span>
                    <span className="text-muted">
                      {daysLeft !== "-" ? `Còn: ${daysLeft}` : "Trống"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button onClick={handleSave}>
                  <Save size={16} />{" "}
                  <span className="hidden md:inline ml-2">Lưu thay đổi</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className="border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                >
                  <Trash2 size={16} />
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X size={18} />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 min-h-0 overflow-hidden flex-col md:flex-row w-full box-border max-w-full">
            <div className="w-full max-w-full border-b border-border/50 bg-black/[0.01] dark:bg-white/[0.01] shrink-0 box-border md:w-[250px] md:border-b-0 md:border-r md:flex-col md:overflow-y-auto">
              <div className="tabs-scroll overflow-x-auto max-w-full flex gap-[8px] px-[12px] py-[12px] scrollbar-hide md:flex-col md:px-4 md:py-4">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabKey)}
                    className={`flex items-center gap-2 px-3 py-2 md:px-4 md:py-3 rounded-[8px] md:rounded-[12px] font-bold text-[12px] md:text-[13px] transition-all whitespace-nowrap shrink-0 snap-start text-left border flex-[0_0_auto] ${activeTab === tab.id ? "bg-[#6366f1] text-white border-[#6366f1] md:bg-[#6366f1]/10 md:text-[#6366f1] shadow-sm" : "text-muted border-border/50 bg-card md:bg-transparent md:border-transparent hover:bg-black/5 dark:hover:bg-white/5"}`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 relative w-full box-border pb-[80px] max-w-full">
              {activeTab === "overview" && (
                <div className="flex flex-col gap-4 md:gap-6 animate-in w-full box-border">
                  <h3 className="font-black text-[14px] md:text-[15px] uppercase tracking-widest text-muted border-b border-border/40 pb-2">
                    Thông tin cơ bản phòng
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-[14px] border border-emerald-500/20 bg-emerald-500/[0.035] p-4">
                    <div className="sm:col-span-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-[13px] font-black text-text">
                        <Zap size={16} className="text-emerald-600" /> Điện Hunonic
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                        Sync 1 giờ
                      </span>
                    </div>
                    {electricity ? (
                      <>
                        <div className="rounded-xl border border-border/40 bg-card p-3">
                          <div className="text-[11px] font-bold uppercase text-muted">Công tơ</div>
                          <div className="mt-1 text-[14px] font-black text-text">{electricity.deviceName || electricity.displayName}</div>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-card p-3">
                          <div className="text-[11px] font-bold uppercase text-muted">kWh tháng này</div>
                          <div className="mt-1 text-[14px] font-black text-text">{Number(electricity.energyMonthKwh || 0).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} kWh</div>
                        </div>
                        <div className="rounded-xl border border-border/40 bg-card p-3">
                          <div className="text-[11px] font-bold uppercase text-muted">Tiền điện</div>
                          <div className="mt-1 text-[14px] font-black text-emerald-700">{formatCompactMoney(Number(electricity.moneyMonthVnd || 0))}</div>
                        </div>
                      </>
                    ) : (
                      <div className="sm:col-span-3 rounded-xl border border-dashed border-emerald-500/25 bg-card/70 px-3 py-3 text-[12px] font-semibold text-muted">
                        {isElectricityLoading ? "Đang tải dữ liệu công tơ..." : "Chưa có dữ liệu Hunonic cho phòng này. Kiểm tra Settings > Hunonic Electricity rồi chạy Sync ngay."}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-4 w-full">
                    <div className="flex flex-col gap-1 w-full">
                      <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">
                        Tên phòng
                      </label>
                      <Input
                        data-testid="room-name-input"
                        value={roomData.name}
                        onChange={(e) =>
                          handleFieldChange("name", e.target.value)
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                      <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">
                        Mã phòng
                      </label>
                      <Input
                        data-testid="room-code-input"
                        value={roomData.code}
                        onChange={(e) =>
                          handleFieldChange("code", e.target.value)
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                      <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">
                        Trạng thái
                      </label>
                      <Select
                        value={roomData.status}
                        onChange={(e) =>
                          handleFieldChange("status", e.target.value)
                        }
                        options={[
                          { label: "Trống", value: "AVAILABLE" },
                          { label: "Đang thuê", value: "RENTED" },
                          { label: "Đặt cọc", value: "RESERVED" },
                          { label: "Bảo trì", value: "MAINTENANCE" },
                          { label: "Không khả dụng", value: "UNAVAILABLE" },
                        ]}
                      />
                    </div>

                    <div className="flex flex-col gap-1 w-full">
                      <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">
                        Diện tích (m²)
                      </label>
                      <Input
                        type="number"
                        value={roomData.area ?? ""}
                        onChange={(e) => handleFieldChange(
                          "area",
                          e.target.value === "" ? undefined : Number(e.target.value),
                        )}
                      />
                    </div>
                    <div className="flex flex-col gap-1 w-full">
                      <label className="text-[10px] md:text-[11px] font-black text-muted uppercase">
                        Sức chứa (người)
                      </label>
                      <Input
                        type="number"
                        value={roomData.capacity ?? ""}
                        onChange={(e) => handleFieldChange(
                          "capacity",
                          e.target.value === "" ? undefined : Number(e.target.value),
                        )}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "rental_flow" && (
                <div className="flex flex-col gap-4 md:gap-6 animate-in w-full box-border">
                  <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-black/5 dark:bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-wide text-muted">Loại phòng hiện tại</div>
                        <div className="mt-1 text-[15px] font-black text-text">{roomRentalTypeLabel}</div>
                      </div>
                      <div className="rounded-full bg-white/80 dark:bg-[#1e1e1e] px-3 py-1 text-[11px] font-bold text-muted shadow-sm">
                        {roomData?.rentalType === "shared"
                          ? `Mặc định thêm cư dân theo đại diện hợp đồng`
                          : `Mặc định thêm khách vào hợp đồng chính`}
                      </div>
                    </div>
                    <div className="text-[11px] leading-relaxed text-muted">
                      Chọn lại loại phòng trước khi thêm khách để hệ thống áp dụng đúng logic hợp đồng, cư dân cùng phòng và thông báo Zalo/SePay.
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-black/5 dark:bg-white/5 p-4">
                    <label className="text-[11px] font-black text-muted uppercase">
                      Kiểu thuê phòng
                    </label>
                    <Select
                      value={roomData.rentalType || "whole"}
                      onChange={(e) => handleFieldChange("rentalType", e.target.value)}
                      options={[
                        { label: "Nguyên căn", value: "whole" },
                        { label: "Phòng ghép", value: "shared" },
                      ]}
                    />
                    <span className="text-[11px] text-muted leading-relaxed">
                      Chọn trước khi thêm khách thuê để hệ thống áp dụng đúng logic hợp đồng, cư dân cùng phòng và thông báo Zalo/SePay.
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-2 mb-2">
                    <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2">
                      Thông tin khách hàng
                    </h4>
                    <div className="flex items-center bg-black/5 dark:bg-white/5 rounded-[8px] p-1">
                      <button
                        onClick={() => setTenantViewMode("basic")}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-[6px] transition-all ${tenantViewMode === "basic" ? "bg-white dark:bg-[#1e1e1e] shadow-sm text-text" : "text-muted hover:text-text"}`}
                      >
                        Cơ bản
                      </button>
                      <button
                        onClick={() => setTenantViewMode("detailed")}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-[6px] transition-all ${tenantViewMode === "detailed" ? "bg-white dark:bg-[#1e1e1e] shadow-sm text-text" : "text-muted hover:text-text"}`}
                      >
                        Chi tiết
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 w-full box-border">
                    <div className="border border-border/60 rounded-xl overflow-x-auto bg-card pb-4">
                      <table className="w-full text-left text-sm whitespace-nowrap min-w-[700px]">
                        <thead className="bg-black/5 dark:bg-white/5 text-[11px] font-black uppercase text-muted tracking-wider border-b border-border/40">
                          <tr>
                            <th className="p-3">STT</th>
                            <th className="p-3">Họ và tên</th>
                            <th className="p-3">Số điện thoại</th>
                            <th className="p-3">SĐT Người thân</th>
                            <th className="p-3">CCCD/CMND</th>
                            {tenantViewMode === "detailed" && <th className="p-3">Giới tính</th>}
                            <th className="p-3">Ngày sinh</th>
                            {tenantViewMode === "detailed" && <th className="p-3">Quốc tịch</th>}
                            {tenantViewMode === "detailed" && <th className="p-3">Thường trú</th>}
                            <th className="p-3">Vai trò</th>
                            <th className="p-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const allTenantsList = getOccupantsList();

                            if (allTenantsList.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={tenantViewMode === "detailed" ? 11 : 7} className="p-6 text-center text-muted font-bold">
                                    Chưa có khách thuê
                                  </td>
                                </tr>
                              );
                            }

                            return allTenantsList.map((t, index) => (
                              <tr key={t.id || index} className="border-b border-border/40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                <td className="p-3">{index + 1}</td>
                                <td className="p-3 font-semibold">{t.name || "-"}</td>
                                <td className="p-3">{t.phone || "-"}</td>
                                <td className="p-3">{(t as any).emergencyPhone || "-"}</td>
                                <td className="p-3">{t.cccd || (t as any).citizenId || "-"}</td>
                                {tenantViewMode === "detailed" && <td className="p-3">{(t as any).gender || "-"}</td>}
                                <td className="p-3">{formatBirthDateForDisplay(t.birthDate || "") || "-"}</td>
                                {tenantViewMode === "detailed" && <td className="p-3">{t.nationality || "-"}</td>}
                                {tenantViewMode === "detailed" && <td className="p-3 max-w-[150px] truncate" title={t.address}>{t.address || "-"}</td>}
                                <td className="p-3">
                                  <span className={`px-2 py-1 rounded-[6px] text-[10px] font-bold ${t.isRep ? 'bg-[#6366f1]/10 text-[#6366f1]' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}`}>
                                    {t.role}
                                  </span>
                                </td>
                                <td className="p-3 flex justify-end gap-1">
                                  <button
                                    onClick={() => {
                                      setTenantDraft({
                                        id: t.id,
                                        name: t.name || "",
                                        phone: t.phone || "",
                                        cccd: (t as any).citizenId || t.cccd || "",
                                        birthDate: t.birthDate ? new Date(t.birthDate).toISOString().split('T')[0] : "",
                                        gender: (t as any).gender || "",
                                        nationality: (t as any).nationality || "",
                                        address: (t as any).address || "",
                                        emergencyPhone: (t as any).emergencyPhone || "",
                                        relationship: (t as any).relationship || "",
                                      });
                                      setIsContractRepresentative(t.isRep);
                                      if (!t.isRep && (t as any).contractId) {
                                        const repIdForContract = getRepresentativeCandidates().find((st: any) => (st as any).contractId === (t as any).contractId || (st.id === roomData?.tenant?.id && roomData?.contract?.id === (t as any).contractId))?.id;
                                        setHouseholdRepId(repIdForContract || "");
                                      } else {
                                        setHouseholdRepId("");
                                      }

                                      if (t.isRep) {
                                        const tContract = t.id === roomData?.tenant?.id ? roomData?.contract : (t as any);
                                        setContractDraft(prevDraft => ({
                                          ...prevDraft,
                                          ngayBatDau: tContract?.startDate ? new Date(tContract.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                          ngayKetThuc: tContract?.endDate ? new Date(tContract.endDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                          tienCoc: tContract?.deposit ? tContract.deposit.toLocaleString("vi-VN") : "0",
                                          tienThue: tContract?.rentPrice ? tContract.rentPrice.toLocaleString("vi-VN") : "0",
                                          ngayKyhopdong: tContract?.signedAt ? new Date(tContract.signedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                          ngayThanhToanDauTien: tContract?.firstPaymentDate ? new Date(tContract.firstPaymentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                          mucDichThue: tContract?.purpose || "Ở"
                                        }));
                                      }

                                      setTenantModalStep(1);
                                      setIsTenantModalOpen(true);
                                    }}
                                    className="w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-muted hover:text-text hover:bg-black/5 bg-transparent border border-transparent hover:border-border transition-colors"
                                    title="Chỉnh sửa"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  {t.isRep && (
                                    <button
                                      onClick={() => setIsRemoveTenantConfirmOpen(true)}
                                      className="w-[28px] h-[28px] flex items-center justify-center rounded-[8px] text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-transparent hover:border-rose-200 dark:hover:border-rose-500/30 transition-colors"
                                      title="Xóa đại diện hợp đồng"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsContractRepresentative(shouldStartAsRepresentative);
                        setHouseholdRepId("");
                        setTenantDraft({
                          id: undefined,
                          name: "",
                          phone: "",
                          cccd: "",
                          birthDate: "",
                          gender: "",
                          nationality: "",
                          address: "",
                          emergencyPhone: "",
                        });
                        setTenantModalStep(1);
                        setIsTenantModalOpen(true);
                      }}
                      className="w-full border-dashed border-[#6366f1]/40 bg-[#6366f1]/5 text-[#6366f1] hover:bg-[#6366f1]/10"
                    >
                      <UserPlus size={16} className="mr-2" /> {roomData?.rentalType === "shared" ? "Thêm khách ghép" : roomData?.tenant ? "Thêm người ở cùng" : "Thêm khách thuê"}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "finances" && (
                <div className="flex flex-col gap-6 animate-in w-full box-border">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2">
                      <CreditCard size={14} /> Danh sách hóa đơn
                    </h4>
                    <Button
                      size="sm"
                      onClick={() =>
                        showToast(
                          "Chức năng tạo hóa đơn thủ công đang được xử lý.",
                          "info",
                        )
                      }
                    >
                      <Plus size={12} className="mr-1" /> Tạo hóa đơn
                    </Button>
                  </div>

                  <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-black/5 dark:bg-white/5 text-[11px] font-black uppercase text-muted tracking-wider border-b border-border/40">
                          <th className="p-3">Mã HĐ</th>
                          <th className="p-3">Số tiền</th>
                          <th className="p-3">Hạn thanh toán</th>
                          <th className="p-3 text-right">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {realInvoices && realInvoices.length > 0 ? (
                          realInvoices.map((inv: any) => (
                            <tr
                              key={inv.id}
                              className="border-b border-border/40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            >
                              <td className="p-3 font-bold">{inv.code}</td>
                              <td className="p-3 font-black">
                                {(
                                  inv.total ||
                                  inv.amount ||
                                  0
                                ).toLocaleString()}{" "}
                                đ
                              </td>
                              <td className="p-3 text-muted">
                                {new Date(inv.dueDate).toLocaleDateString(
                                  "vi-VN",
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <span
                                  className={`px-2 py-0.5 rounded-[6px] text-[11px] font-bold uppercase ${["PAID", "paid"].includes(inv.status) ? "bg-indigo-500/10 text-indigo-500" : "bg-rose-500/10 text-rose-500"}`}
                                >
                                  {["PAID", "paid"].includes(inv.status)
                                    ? "Đã trả"
                                    : "Chưa trả"}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="p-4 text-center text-muted italic"
                            >
                              Chưa có hóa đơn nào
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-2">
                    <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2">
                      Lịch sử thanh toán
                    </h4>
                    <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-black/5 dark:bg-white/5 text-[11px] font-black uppercase text-muted tracking-wider border-b border-border/40">
                            <th className="p-3">Tháng</th>
                            <th className="p-3">Số tiền</th>
                            <th className="p-3">Ngày thanh toán</th>
                            <th className="p-3 text-right">Hình thức</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roomData.paymentHistory &&
                            roomData.paymentHistory.length > 0 ? (
                            roomData.paymentHistory.map((pay) => (
                              <tr
                                key={pay.id}
                                className="border-b border-border/40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                              >
                                <td className="p-3 font-bold">{pay.month}</td>
                                <td className="p-3 font-black">
                                  {pay.amount.toLocaleString()} đ
                                </td>
                                <td className="p-3 text-muted">
                                  {new Date(pay.date).toLocaleDateString(
                                    "vi-VN",
                                  )}
                                </td>
                                <td className="p-3 text-right text-muted">
                                  {pay.method}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={4}
                                className="p-4 text-center text-muted italic"
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

              {activeTab === "contract" && (
                <div className="flex flex-col gap-6 animate-in w-full box-border">
                  <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2 border-b border-border/40 pb-2">
                    <FileText size={14} /> Thông tin hợp đồng thuê
                  </h4>
                  {roomData.contract ? (
                    <div className="flex flex-col gap-4 pb-4 w-full">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-black/5 dark:bg-white/5 uppercase text-[10px] md:text-[11px] font-black text-muted">
                          <tr>
                            <th className="p-3 rounded-l-lg w-[50px]">STT</th>
                            <th className="p-3">Đại diện HĐ</th>
                            <th className="p-3">Mã Hợp Đồng</th>
                            <th className="p-3">Tiền phòng</th>
                            <th className="p-3">Tiền cọc</th>
                            <th className="p-3">Ngày bắt đầu</th>
                            <th className="p-3">Ngày kết thúc</th>
                            <th className="p-3 rounded-r-lg text-center w-[80px]">Action</th>
                          </tr>
                        </thead>
                        <tbody>
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

                            if (reps.length === 0) return null;

                            return reps.map((rep, index) => {
                              const c = rep.contract || {} as any;
                              const tName = rep.name || rep.fullName || "";
                              const cleanName = tName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "-").toUpperCase();
                              const contractCode = c.code || `HĐ-${roomData.code || roomData.name}${cleanName ? `-${cleanName}` : ""}`;

                              return (
                                <tr key={rep.id || index} className="border-b border-border/40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                                  <td className="p-3 font-bold">{index + 1}</td>
                                  <td className="p-3 font-bold">{tName || "Chưa có"}</td>
                                  <td className="p-3 font-bold text-indigo-600">{contractCode}</td>
                                  <td className="p-3 font-bold">{(c.rentPrice || roomData.monthlyPrice || 0).toLocaleString()} đ</td>
                                  <td className="p-3 font-bold">{(c.deposit || 0).toLocaleString()} đ</td>
                                  <td className="p-3 text-muted">{c.startDate ? new Date(c.startDate).toLocaleDateString("vi-VN") : "-"}</td>
                                  <td className="p-3 text-muted">{c.endDate ? new Date(c.endDate).toLocaleDateString("vi-VN") : "-"}</td>
                                  <td className="p-3 text-center">
                                    <div className="relative inline-flex items-center justify-center group">
                                      <button className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer outline-none">
                                        <MoreHorizontal size={16} className="text-muted" />
                                      </button>
                                      <div className="absolute right-4 top-full mt-1 z-[10020] w-[180px] overflow-hidden rounded-[12px] border border-border bg-background shadow-xl py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-200">
                                        <button className="flex w-full items-center px-4 py-2.5 text-left text-[13px] font-semibold text-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors outline-none" onClick={() => showToast("Đang tải tệp PDF...", "info")}><Paperclip size={14} className="mr-2" /> Xem PDF</button>
                                        <button className="flex w-full items-center px-4 py-2.5 text-left text-[13px] font-semibold text-amber-500 hover:bg-amber-500/10 transition-colors outline-none" onClick={() => { if (c.id) expireContractMutation.mutate(c.id); }}><FileText size={14} className="mr-2" /> Gia hạn hợp đồng</button>
                                        <button className="flex w-full items-center px-4 py-2.5 text-left text-[13px] font-semibold text-danger hover:bg-danger/10 transition-colors outline-none" onClick={() => { if (c.id) terminateContractMutation.mutate(c.id); }}><Trash2 size={14} className="mr-2" /> Chấm dứt hợp đồng</button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center">
                      <FileText
                        size={32}
                        className="text-muted opacity-40 mb-2"
                      />
                      <span className="text-sm font-bold text-muted">
                        Phòng này hiện chưa có hợp đồng
                      </span>
                      <Button
                        size="sm"
                        className="mt-4"
                        onClick={openCreateContractModal}
                      >
                        <Plus size={12} className="mr-1" /> Tạo hợp đồng ngay
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "temp_residence" && (
                <div className="flex flex-col gap-6 animate-in w-full box-border">
                  <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2 border-b border-border/40 pb-2">
                    <ShieldAlert size={14} /> Tình trạng khai báo tạm trú
                  </h4>
                  <div className="border border-border/60 rounded-xl p-5 bg-card flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-text">
                        Khai báo tạm trú (Công an sở tại)
                      </span>
                      <span className="text-xs text-muted mt-0.5">
                        Quy định bắt buộc đối với khách thuê lưu trú qua đêm
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        if (roomData.tenant) {
                          handleTenantChange(
                            "tempResidence",
                            !roomData.tenant.tempResidence,
                          );
                          showToast(
                            "Cập nhật trạng thái tạm trú thành công!",
                            "success",
                          );
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors ${roomData.tenant?.tempResidence ? "bg-indigo-500/10 text-indigo-500" : "bg-rose-500/10 text-rose-500"}`}
                    >
                      {roomData.tenant?.tempResidence
                        ? "Đã khai báo"
                        : "Chưa khai báo"}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "images" && (
                <div className="flex flex-col gap-6 animate-in w-full box-border">
                  <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2 border-b border-border/40 pb-2">
                    <ImageIcon size={14} /> Hình ảnh căn hộ và CCCD khách thuê
                  </h4>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {roomData.images && roomData.images.length > 0 ? (
                      roomData.images.map((img, idx) => (
                        <div
                          key={idx}
                          className="relative aspect-video rounded-xl overflow-hidden border border-border/60 bg-muted group"
                        >
                          <img
                            src={img}
                            alt={`Room image ${idx}`}
                            className="w-full h-full object-cover"
                          />
                          <button className="absolute top-2 right-2 w-[24px] h-[24px] bg-black/60 hover:bg-rose-500/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full p-8 text-center text-muted italic">
                        Chưa tải ảnh phòng lên
                      </div>
                    )}

                    <div className="border-2 border-dashed border-border rounded-xl aspect-video flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <Upload
                        size={24}
                        className="text-muted opacity-50 mb-1"
                      />
                      <span className="text-[11px] font-bold text-muted">
                        Tải ảnh lên (Max 5MB)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "notes" && (
                <div className="flex flex-col gap-6 animate-in w-full box-border">
                  <h4 className="font-black text-[13px] md:text-[14px] uppercase text-muted flex items-center gap-2 border-b border-border/40 pb-2">
                    <AlignLeft size={14} /> Ghi chú nội bộ
                  </h4>
                  <textarea
                    value={roomData.notes || ""}
                    onChange={(e) => handleFieldChange("notes", e.target.value)}
                    placeholder="Nhập các ghi chú quan trọng về khách thuê hoặc phòng..."
                    className="flex min-h-[150px] w-full rounded-xl border border-border bg-transparent px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 resize-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isTenantModalOpen}
        onClose={() => setIsTenantModalOpen(false)}
        title="Thông tin khách hàng"
        maxWidth="max-w-md"
        headerActions={
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsQrMenuOpen((prev) => !prev)}
              aria-label="Quét QR"
              title="Quét QR"
              className="h-10 w-10 p-0 rounded-full border-[#6366f1]/30 text-[#6366f1] hover:bg-[#6366f1]/10 shadow-sm flex items-center justify-center"
            >
              <QrCode size={18} />
            </Button>
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
            <Button onClick={handleSaveTenant} disabled={isExporting}>
              {isExporting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              {tenantModalStep === 1 && isContractRepresentative ? "Tiếp tục" : "Lưu thông tin"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 py-2">
              {tenantModalStep === 1 && (
                <>
              <div className="flex items-center justify-between bg-indigo-50/50 p-3 rounded-lg border border-emerald-100">
                <div className="flex flex-col mr-2">
                  <span className="text-[12px] md:text-[13px] font-bold text-emerald-900">Đại diện hợp đồng</span>
                  <span className="text-[10px] md:text-[11px] text-indigo-600">
                    {roomData?.rentalType === "shared"
                      ? "Phòng ghép: khách này sẽ là đại diện hợp đồng"
                      : "Nguyên căn: khách này sẽ là người thuê chính"}
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-black text-muted uppercase">THÀNH VIÊN CÙNG HỘ GĐ *</label>
                    <Select
                      value={householdRepId}
                      onChange={(e) => setHouseholdRepId(e.target.value)}
                      options={[
                        { label: "Chọn người đại diện...", value: "" },
                        ...getRepresentativeCandidates().map((rep: any) => ({ label: rep.name || rep.fullName || "", value: rep.id }))
                      ]}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-black text-muted uppercase">
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
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[11px] font-black text-muted uppercase">
                    Họ và tên *
                  </label>
                  <Input
                    type="text"
                    placeholder="Nguyễn Văn A"
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
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-muted uppercase">
                    Số điện thoại *
                  </label>
                  <Input
                    type="tel"
                    placeholder="0901234567"
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
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-muted uppercase">
                    SĐT người thân (-)
                  </label>
                  <Input
                    type="tel"
                    placeholder="0901234567"
                    value={tenantDraft.emergencyPhone}
                    onChange={(event) =>
                      updateTenantDraft("emergencyPhone", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-muted uppercase">
                    CCCD / CMND
                  </label>
                  <Input
                    type="text"
                    placeholder="0123456789"
                    value={tenantDraft.cccd}
                    onChange={(event) =>
                      updateTenantDraft("cccd", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-muted uppercase">
                    Giới tính
                  </label>
                  <Select
                    value={tenantDraft.gender}
                    onChange={(event) =>
                      updateTenantDraft("gender", event.target.value)
                    }
                    options={[
                      { label: "Chọn giới tính", value: "" },
                      { label: "Nam", value: "Nam" },
                      { label: "Nữ", value: "Nữ" },
                      { label: "Khác", value: "Khác" },
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-muted uppercase">
                    Ngày sinh
                  </label>
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
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-black text-muted uppercase">
                    Quốc tịch
                  </label>
                  <Input
                    type="text"
                    list="nationality-options"
                    placeholder="Chọn hoặc điền quốc tịch..."
                    value={tenantDraft.nationality}
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
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[11px] font-black text-muted uppercase">
                    Địa chỉ thường trú
                  </label>
                  <Input
                    type="text"
                    placeholder="Nhập địa chỉ..."
                    value={tenantDraft.address}
                    onChange={(event) =>
                      updateTenantDraft("address", event.target.value)
                    }
                  />
                </div>
              </div>
            </>
          )}

          {tenantModalStep === 2 && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-right-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-muted uppercase">
                  Loại phòng
                </label>
                <Select
                  value={contractDraft.soPhongNgu}
                  onChange={(e) => setContractDraft((p) => ({ ...p, soPhongNgu: e.target.value }))}
                  options={[
                    { label: "Phòng Studio", value: "Phòng Studio" },
                    { label: "1 phòng ngủ", value: "1 phòng ngủ" },
                    { label: "2 phòng ngủ", value: "2 phòng ngủ" },
                    { label: "3 phòng ngủ", value: "3 phòng ngủ" },
                    { label: "Khác", value: "Khác" },
                  ]}
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
                <label className="text-[11px] font-black text-muted uppercase">
                  Chủ căn hộ cho thuê
                </label>
                <Select
                  value={contractDraft.chuNha}
                  onChange={(e) => setContractDraft((p) => ({ ...p, chuNha: e.target.value as "TINH" | "THE" }))}
                  options={[
                    { label: "NGUYỄN ĐỨC TÍNH", value: "TINH" },
                    { label: "PHAN VĂN THỂ", value: "THE" },
                  ]}
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
                    Bằng chữ: {numberToWordsVietnamese(Number(contractDraft.tienThue.replace(/\D/g, "")))}
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
                type="number"
                value={contractRent}
                onChange={(e) => setContractRent(Number(e.target.value))}
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
                type="number"
                value={contractDeposit}
                onChange={(e) => setContractDeposit(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isRemoveTenantConfirmOpen}
        onClose={() => setIsRemoveTenantConfirmOpen(false)}
        title="Xác nhận xóa khách thuê"
        footer={
          <div className="flex gap-3 justify-end w-full">
            <Button
              variant="outline"
              onClick={() => setIsRemoveTenantConfirmOpen(false)}
              disabled={isRemovingTenant}
            >
              Hủy
            </Button>
            <Button
              onClick={async () => {
                if (onUpdateRoom) {
                  setIsRemovingTenant(true);
                  try {
                    await onUpdateRoom(roomId, { tenant: null, status: 'vacant' });
                    setRoomData(prev => prev ? { ...prev, tenant: null, status: 'vacant' } : prev);
                    setIsRemoveTenantConfirmOpen(false);
                    showToast("Đã xóa khách thuê thành công.", "success");
                  } catch (err) {
                    showToast("Lỗi khi xóa khách thuê.", "error");
                  } finally {
                    setIsRemovingTenant(false);
                  }
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
          Bạn có chắc chắn muốn xóa thông tin khách thuê này không? Thao tác này sẽ cập nhật trạng thái phòng thành &quot;Trống&quot;.
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
    </>,
    document.body,
  );
}
