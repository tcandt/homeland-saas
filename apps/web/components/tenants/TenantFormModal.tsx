"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreateCustomerSchema } from "@homeland/shared";
import { useCreateCustomerMutation, useUpdateCustomerMutation } from "@/lib/mutations/customers.mutations";
import { customersApi } from "@/lib/api/customers.api";
import { formatBirthDateForDisplay, normalizeVietnameseDate, parseCccdQrPayload } from "@/lib/utils/cccd-qr";
import { CCCD_LIVE_SCAN_CONFIG, optimizeCccdCameraTrack, safeStopAndClearScanner, stopCccdCameraTracks } from "@/lib/utils/cccd-camera";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { useToast } from "@/components/ui/ToastContext";
import { CccdUploadScannerModal } from "../common/CccdUploadScannerModal";
import { AlertTriangle, Camera, Check, ChevronDown, DoorOpen, QrCode, Upload, X } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useRoomsQuery } from "@/lib/queries/rooms.queries";

type FormData = z.infer<typeof CreateCustomerSchema>;
type QrMode = "camera" | "upload" | null;
type CropRect = { x: number; y: number; width: number; height: number };

interface TenantFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant?: any;
}

const EMPTY_VALUES: FormData = {
  fullName: "",
  phone: "",
  email: "",
  citizenId: "",
  gender: "",
  birthDate: "",
  nationality: "Việt Nam",
  address: "",
  zaloChatId: "",
  zaloUserId: "",
  emergencyPhone: "",
  status: "ACTIVE",
  notes: "",
  roomId: "",
};

export const formatShortBuilding = (buildingName?: string, buildingCode?: string) => {
  const raw = (buildingCode || buildingName || "").trim();
  if (!raw) return "";
  const cleaned = raw
    .replace(/^(Tòa\s*nhà|Toà\s*nhà|Tòa|Toà|Building|Block)\s+/i, "")
    .trim();
  return cleaned || raw;
};

export const formatRoomCode = (roomCodeOrName?: string) => {
  const raw = (roomCodeOrName || "").trim();
  if (!raw) return "";

  // Strip leading "Phòng " or "Phòng: "
  let cleaned = raw.replace(/^Phòng\s*:?\s*/i, "").trim();

  // If starts with "PN" (e.g. "PN 32-07", "PN32-07", "PN-32-07")
  if (/^PN\s*[-_.]?\s*(\d+.*)$/i.test(cleaned)) {
    const after = cleaned.replace(/^PN\s*[-_.]?\s*/i, "").trim();
    return after ? `PN ${after}` : cleaned;
  }

  // If starts with "P" followed by digits (e.g. "P25-01", "P-25-01", "P.25-01", "P 25-01") -> convert to "PN ..."
  if (/^P\s*[-_.]?\s*(\d+.*)$/i.test(cleaned)) {
    const after = cleaned.replace(/^P\s*[-_.]?\s*/i, "").trim();
    return after ? `PN ${after}` : cleaned;
  }

  return cleaned;
};

export const formatRoomDisplayLabel = (room: any) => {
  if (!room) return "";
  const bShort = formatShortBuilding(room.buildingName || room.building?.name, room.buildingCode || room.building?.code);
  const rCode = formatRoomCode(room.code || room.name || room.number);

  if (bShort && rCode) {
    return `${bShort} / ${rCode}`;
  }
  return rCode || bShort || "";
};

export const getRoomStatusSearchText = (status: string) => {
  switch (status) {
    case "vacant":
    case "AVAILABLE":
      return "trống phong trong vacant available";
    case "occupied":
    case "OCCUPIED":
      return "đang ở đang thuê phong da o occupied";
    case "deposited":
    case "RESERVED":
      return "đã cọc cọc dat coc reserved deposited";
    case "expiring_soon":
      return "sắp trống sắp hết hạn expiring";
    case "maintenance":
    case "MAINTENANCE":
      return "bảo trì maintenance";
    default:
      return "";
  }
};

const QR_CAMERA_ID = "tenant-qr-camera";

const buildFormPayload = (values: FormData) => {
  const birthDate = normalizeVietnameseDate(values.birthDate || "");
  return {
    fullName: values.fullName.trim(),
    phone: values.phone.trim(),
    email: values.email?.trim() || null,
    citizenId: values.citizenId?.trim() || null,
    gender: values.gender?.trim() || null,
    birthDate: birthDate || null,
    nationality: values.nationality?.trim() || null,
    address: values.address?.trim() || null,
    zaloChatId: values.zaloChatId?.trim() || null,
    zaloUserId: values.zaloUserId?.trim() || null,
    emergencyPhone: values.emergencyPhone?.trim() || null,
    status: values.status || "ACTIVE",
    notes: values.notes?.trim() || null,
    roomId: values.roomId ? values.roomId : null,
  };
};

export default function TenantFormModal({ isOpen, onClose, tenant }: TenantFormModalProps) {
  const createMutation = useCreateCustomerMutation();
  const updateMutation = useUpdateCustomerMutation();
  const { showToast } = useToast();
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);
  const [scannerFile, setScannerFile] = useState<File | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const { data: rooms = [], isLoading: isLoadingRooms } = useRoomsQuery({ limit: 500 });
  const [roomSearch, setRoomSearch] = useState("");
  const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false);
  const roomDropdownRef = useRef<HTMLDivElement>(null);
  const roomInputRef = useRef<HTMLInputElement>(null);

  const [isQrMenuOpen, setIsQrMenuOpen] = useState(false);
  const [isQrOverlayOpen, setIsQrOverlayOpen] = useState(false);
  const [qrMode, setQrMode] = useState<QrMode>(null);
  const [qrStatus, setQrStatus] = useState("");
  const [duplicatePhoneCustomer, setDuplicatePhoneCustomer] = useState<any | null>(null);
  const [duplicateCitizenIdCustomer, setDuplicateCitizenIdCustomer] = useState<any | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  const isEdit = !!tenant;
  const isPending = createMutation.isPending || updateMutation.isPending || isCheckingDuplicate;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(CreateCustomerSchema as any),
    defaultValues: EMPTY_VALUES,
  });

  const currentPhone = watch("phone") || "";
  const currentCitizenId = watch("citizenId") || "";
  const selectedRoomId = watch("roomId") || "";
  const [rentalType, setRentalType] = useState<"WHOLE" | "SHARED">("WHOLE");

  const selectedRoom = useMemo(() => {
    return rooms.find((r: any) => r.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (selectedRoom) {
      const rawRentalType = String(selectedRoom.rentalType || selectedRoom.raw?.rentalType || "").toUpperCase();
      if (rawRentalType === "SHARED") {
        setRentalType("SHARED");
      } else {
        setRentalType("WHOLE");
      }
    }
  }, [selectedRoom]);

  const filteredRooms = useMemo(() => {
    if (!roomSearch.trim()) return rooms;
    const clean = (str: string) =>
      str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
    const query = clean(roomSearch).replace(/\s+/g, " ");
    return rooms.filter((r: any) => {
      const rawCode = clean(r.code || "");
      const rawName = clean(r.name || "");
      const bName = clean(r.buildingName || "");
      const displayLabel = clean(formatRoomDisplayLabel(r));
      const formattedCode = clean(formatRoomCode(r.code || r.name));
      const statusText = clean(getRoomStatusSearchText(r.status));
      return (
        rawCode.includes(query) ||
        rawName.includes(query) ||
        bName.includes(query) ||
        displayLabel.includes(query) ||
        formattedCode.includes(query) ||
        statusText.includes(query)
      );
    });
  }, [rooms, roomSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (roomDropdownRef.current && !roomDropdownRef.current.contains(event.target as Node)) {
        setIsRoomDropdownOpen(false);
        setRoomSearch("");
      }
    };
    if (isRoomDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isRoomDropdownOpen]);

  useEffect(() => {
    const cleanPhone = currentPhone.replace(/[\s\-\.\(\)]/g, "").trim();
    const cleanCid = currentCitizenId.replace(/[\s\-\.]/g, "").trim();

    if ((!cleanPhone || cleanPhone.length < 8) && (!cleanCid || cleanCid.length < 8)) {
      setDuplicatePhoneCustomer(null);
      setDuplicateCitizenIdCustomer(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const dupRes: any = await customersApi.checkDuplicate({
          phone: cleanPhone.length >= 8 ? cleanPhone : undefined,
          identityNo: cleanCid.length >= 8 ? cleanCid : undefined,
          excludeId: tenant?.id || undefined,
        });
        const dupData = dupRes?.data || dupRes;
        if (dupData?.isDuplicate) {
          if (dupData.duplicateField === "phone" || dupData.duplicateField === "both") {
            setDuplicatePhoneCustomer(dupData.duplicateCustomer);
          } else {
            setDuplicatePhoneCustomer(null);
          }
          if (dupData.duplicateField === "identityNo" || dupData.duplicateField === "both") {
            setDuplicateCitizenIdCustomer(dupData.duplicateCustomer);
          } else {
            setDuplicateCitizenIdCustomer(null);
          }
        } else {
          setDuplicatePhoneCustomer(null);
          setDuplicateCitizenIdCustomer(null);
        }
      } catch (err) {
        // ignore
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [currentPhone, currentCitizenId, tenant?.id]);

  useEffect(() => {
    if (!isOpen) {
      setIsQrMenuOpen(false);
      setIsQrOverlayOpen(false);
      setQrMode(null);
      setQrStatus("");
      setScannerFile(null);
      setIsScannerOpen(false);
      setDuplicatePhoneCustomer(null);
      setDuplicateCitizenIdCustomer(null);
      setRoomSearch("");
      setIsRoomDropdownOpen(false);
      setRentalType("WHOLE");
      return;
    }

    if (tenant) {
      reset({
        fullName: tenant.name || tenant.fullName || "",
        phone: tenant.phone || "",
        email: tenant.email || "",
        citizenId: tenant.identityNo || tenant.citizenId || "",
        gender: tenant.gender || "",
        birthDate: tenant.birthDate ? formatBirthDateForDisplay(String(tenant.birthDate)) : "",
        nationality: tenant.nationality || "Việt Nam",
        address: tenant.address || "",
        zaloChatId: tenant.zaloChatId || "",
        zaloUserId: tenant.zaloUserId || "",
        emergencyPhone: tenant.emergencyPhone || "",
        status: tenant.status || "ACTIVE",
        notes: tenant.notes || "",
        roomId:
          tenant.roomId ||
          tenant.source?.roomId ||
          tenant.room?.id ||
          tenant.contracts?.[0]?.roomId ||
          tenant.contracts?.[0]?.room?.id ||
          "",
      });
      if (tenant.rentalType) {
        setRentalType(String(tenant.rentalType).toUpperCase() === "SHARED" ? "SHARED" : "WHOLE");
      }
    } else {
      reset(EMPTY_VALUES);
      setRentalType("WHOLE");
    }
  }, [isOpen, reset, tenant]);

  useEffect(() => {
    if (!isQrOverlayOpen || qrMode !== "camera") {
      return;
    }

    const startScanner = async () => {
      try {
        const cameraSupported = typeof window !== "undefined" && !!navigator?.mediaDevices?.getUserMedia;
        if (!cameraSupported) {
          setQrStatus("Trình duyệt hiện không hỗ trợ camera. Bạn có thể tải ảnh CCCD lên để quét.");
          return;
        }

        const scanner = new Html5Qrcode(QR_CAMERA_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
          useBarCodeDetectorIfSupported: true,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });
        qrScannerRef.current = scanner;
        setQrStatus("Đưa riêng mã QR trên CCCD vào khung và giữ máy ổn định.");

        await scanner.start(
          { facingMode: "environment" },
          CCCD_LIVE_SCAN_CONFIG,
          async (decodedText) => {
            const parsed = parseCccdQrPayload(decodedText?.trim() || "");
            if (!parsed) {
              showToast("QR không đúng định dạng CCCD.", "error");
              return;
            }

            setValue("fullName", parsed.fullName || "", { shouldDirty: true, shouldValidate: true });
            setValue("citizenId", parsed.citizenId || "", { shouldDirty: true, shouldValidate: true });
            setValue("gender", parsed.gender || "", { shouldDirty: true, shouldValidate: true });
            setValue("birthDate", parsed.birthDate ? formatBirthDateForDisplay(parsed.birthDate) : "", { shouldDirty: true, shouldValidate: true });
            setValue("nationality", parsed.nationality || "Việt Nam", { shouldDirty: true, shouldValidate: true });
            setValue("address", parsed.address || "", { shouldDirty: true, shouldValidate: true });

            showToast("Đã nhận diện QR CCCD.", "success");
            const activeScanner = qrScannerRef.current;
            qrScannerRef.current = null;
            void safeStopAndClearScanner(activeScanner, QR_CAMERA_ID);
            setIsQrOverlayOpen(false);
            setQrMode(null);
            setIsQrMenuOpen(false);
          },
          () => setQrStatus((current) => current || "Đang tìm QR CCCD...")
        );
        await optimizeCccdCameraTrack(QR_CAMERA_ID);
      } catch (error) {
        console.error(error);
        setQrStatus("Không thể mở camera quét QR.");
        showToast("Không thể mở camera quét QR.", "error");
      }
    };

    void startScanner();

    return () => {
      const activeScanner = qrScannerRef.current;
      qrScannerRef.current = null;
      void safeStopAndClearScanner(activeScanner, QR_CAMERA_ID);
    };
  }, [isQrOverlayOpen, qrMode, setValue, showToast]);

  const closeQrOverlay = () => {
    const activeScanner = qrScannerRef.current;
    qrScannerRef.current = null;
    void safeStopAndClearScanner(activeScanner, QR_CAMERA_ID);
    setIsQrOverlayOpen(false);
    setQrMode(null);
    setQrStatus("");
    setIsQrMenuOpen(false);
  };

  const openQrCamera = () => {
    setIsQrMenuOpen(false);
    setIsQrOverlayOpen(true);
    setQrMode("camera");
    setQrStatus("Đang khởi tạo camera...");
  };

  const openQrUpload = () => {
    setIsQrMenuOpen(false);
    qrFileInputRef.current?.click();
  };

  const handleUploadSuccess = (decodedText: string) => {
    const parsed = parseCccdQrPayload(decodedText);
    if (!parsed) {
      showToast("Mã QR không đúng định dạng CCCD.", "error");
      return;
    }

    setValue("fullName", parsed.fullName || "", { shouldDirty: true, shouldValidate: true });
    setValue("citizenId", parsed.citizenId || "", { shouldDirty: true, shouldValidate: true });
    setValue("gender", parsed.gender || "", { shouldDirty: true, shouldValidate: true });
    setValue("birthDate", parsed.birthDate ? formatBirthDateForDisplay(parsed.birthDate) : "", { shouldDirty: true, shouldValidate: true });
    setValue("nationality", parsed.nationality || "Việt Nam", { shouldDirty: true, shouldValidate: true });
    setValue("address", parsed.address || "", { shouldDirty: true, shouldValidate: true });

    showToast("Đã tự động điền thông tin khách thuê.", "success");
    setIsScannerOpen(false);
    setScannerFile(null);
  };

  const getRoomStatusBadge = (status: string) => {
    switch (status) {
      case "vacant":
      case "AVAILABLE":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 shrink-0">
            Trống
          </span>
        );
      case "occupied":
      case "OCCUPIED":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 shrink-0">
            Đang ở
          </span>
        );
      case "deposited":
      case "RESERVED":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 shrink-0">
            Đã cọc
          </span>
        );
      case "expiring_soon":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/60 shrink-0">
            Sắp trống
          </span>
        );
      case "maintenance":
      case "MAINTENANCE":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0">
            Bảo trì
          </span>
        );
      default:
        return null;
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsCheckingDuplicate(true);
      const dupRes: any = await customersApi.checkDuplicate({
        phone: data.phone?.trim() || undefined,
        identityNo: data.citizenId?.trim() || undefined,
        excludeId: tenant?.id || undefined,
      });

      const dupData = dupRes?.data || dupRes;
      if (dupData?.isDuplicate) {
        const msg = dupData.message || "SĐT hoặc CCCD đã tồn tại trong hệ thống.";
        showToast(msg, "error");
        if (dupData.duplicateField === "phone" || dupData.duplicateField === "both") {
          setError("phone", { type: "manual", message: msg });
        }
        if (dupData.duplicateField === "identityNo" || dupData.duplicateField === "both") {
          setError("citizenId", { type: "manual", message: msg });
        }
        return;
      }
    } catch (err) {
      console.warn("Could not check duplicate customer:", err);
    } finally {
      setIsCheckingDuplicate(false);
    }

    const payload = buildFormPayload(data);

    if (isEdit) {
      updateMutation.mutate(
        { id: tenant.id, data: payload },
        {
          onSuccess: () => {
            showToast("Đã cập nhật khách thuê.", "success");
            onClose();
          },
          onError: (error: any) => {
            const errorMsg = error?.message || "Có lỗi xảy ra khi cập nhật khách thuê";
            showToast(errorMsg, "error");
          },
        }
      );
      return;
    }

    createMutation.mutate(payload, {
      onSuccess: () => {
        showToast("Đã thêm khách thuê mới.", "success");
        onClose();
      },
      onError: (error: any) => {
        const errorMsg = error?.message || "Có lỗi xảy ra khi thêm khách thuê";
        showToast(errorMsg, "error");
      },
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Cập nhật khách thuê" : "Thêm khách thuê mới"}
      maxWidth="max-w-xl"
      headerActions={
        <div className="ml-auto relative flex items-center pr-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-lg border border-indigo-200/80 dark:border-indigo-800/80 bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 px-2.5 text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
            onClick={() => setIsQrMenuOpen((value) => !value)}
            data-testid="tenant-qr-button"
            title="Quét mã QR CCCD để tự động điền"
          >
            <QrCode size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-bold text-[12px]">Quét QR</span>
            <ChevronDown size={12} className={`text-indigo-500/70 dark:text-indigo-400/70 transition-transform duration-200 ${isQrMenuOpen ? "rotate-180" : ""}`} />
          </Button>

          {isQrMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsQrMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 z-50 w-44 overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-card shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    setIsQrMenuOpen(false);
                    openQrCamera();
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-text hover:bg-surface transition-colors"
                >
                  <Camera size={15} className="text-indigo-600 dark:text-indigo-400" />
                  Mở camera
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsQrMenuOpen(false);
                    openQrUpload();
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold text-text hover:bg-surface transition-colors"
                >
                  <Upload size={15} className="text-indigo-600 dark:text-indigo-400" />
                  Tải ảnh lên
                </button>
              </div>
            </>
          )}
        </div>
      }
    >
      <div data-testid="tenant-form-drawer">
        <form onSubmit={handleSubmit(onSubmit)} className="mt-1 flex flex-col gap-4" data-testid="tenant-form">
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
              event.currentTarget.value = "";
            }}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* 1. Chọn phòng */}
            <div className="flex flex-col gap-1 relative" ref={roomDropdownRef}>
              <label className="text-sm font-bold text-text">Chọn phòng</label>

              <div className="relative">
                <div className="relative flex items-center">
                  <DoorOpen size={16} className="absolute left-3 text-muted pointer-events-none" />
                  <input
                    ref={roomInputRef}
                    type="text"
                    value={
                      isRoomDropdownOpen
                        ? roomSearch
                        : selectedRoom
                        ? formatRoomDisplayLabel(selectedRoom)
                        : roomSearch
                    }
                    onChange={(e) => {
                      setRoomSearch(e.target.value);
                      if (!isRoomDropdownOpen) setIsRoomDropdownOpen(true);
                    }}
                    onFocus={() => {
                      setIsRoomDropdownOpen(true);
                    }}
                    placeholder={selectedRoom ? formatRoomDisplayLabel(selectedRoom) : "Nhập tìm hoặc chọn phòng..."}
                    className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-14 text-sm font-medium text-text placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    data-testid="tenant-room-combobox-input"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    {(roomSearch || selectedRoomId) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setValue("roomId", "", { shouldDirty: true });
                          setRoomSearch("");
                          if (roomInputRef.current) {
                            roomInputRef.current.focus();
                          }
                        }}
                        className="p-1 text-muted hover:text-rose-500 rounded-md hover:bg-surface transition-colors"
                        title="Bỏ chọn phòng"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsRoomDropdownOpen((prev) => {
                          const next = !prev;
                          if (next && roomInputRef.current) {
                            roomInputRef.current.focus();
                          }
                          return next;
                        });
                      }}
                      className="p-1 text-muted hover:text-text rounded-md hover:bg-surface transition-colors"
                      title="Mở danh sách phòng"
                    >
                      <ChevronDown
                        size={15}
                        className={`transition-transform duration-200 ${isRoomDropdownOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Droplist Dropdown */}
                {isRoomDropdownOpen && (
                  <div className="absolute left-0 right-0 top-11 z-30 max-h-64 overflow-y-auto rounded-xl border border-slate-200/90 dark:border-slate-800 bg-card shadow-2xl py-1 text-sm animate-in fade-in zoom-in-95 duration-150">
                    <div className="sticky top-0 z-10 bg-card border-b border-border/60 px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-muted uppercase tracking-wider">
                      <span>{isLoadingRooms ? "Đang tải phòng..." : `Tìm thấy ${filteredRooms.length} phòng`}</span>
                      {selectedRoomId && (
                        <button
                          type="button"
                          onClick={() => {
                            setValue("roomId", "", { shouldDirty: true });
                            setRoomSearch("");
                            setIsRoomDropdownOpen(false);
                          }}
                          className="text-rose-500 hover:underline capitalize font-semibold"
                        >
                          Bỏ chọn
                        </button>
                      )}
                    </div>

                    {isLoadingRooms ? (
                      <div className="px-4 py-4 text-center text-xs text-muted">
                        Đang tải danh sách phòng...
                      </div>
                    ) : filteredRooms.length === 0 ? (
                      <div className="px-4 py-4 text-center text-xs text-muted">
                        Không tìm thấy phòng nào phù hợp
                      </div>
                    ) : (
                      filteredRooms.map((r: any) => {
                        const isSelected = r.id === selectedRoomId;
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setValue("roomId", r.id, { shouldDirty: true, shouldValidate: true });
                              setRoomSearch("");
                              setIsRoomDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-surface ${
                              isSelected ? "bg-primary/10 text-primary font-bold" : "text-text"
                            }`}
                          >
                            <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-bold text-[13px]">{formatRoomDisplayLabel(r)}</span>
                              </div>
                              {r.price > 0 && (
                                <span className="text-[10px] text-muted font-normal">
                                  {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(r.price)}/tháng
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {getRoomStatusBadge(r.status)}
                              {isSelected && <Check size={14} className="text-primary shrink-0" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              <input type="hidden" {...register("roomId")} />
            </div>

            {/* 2. Kiểu thuê phòng */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-text">Kiểu thuê phòng</label>
              <div className="relative">
                <select
                  value={rentalType}
                  onChange={(e) => setRentalType(e.target.value as "WHOLE" | "SHARED")}
                  disabled={!!selectedRoom}
                  className={`h-10 w-full rounded-xl border border-border bg-card px-3 pr-8 text-sm font-medium text-text appearance-none focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                    selectedRoom
                      ? "bg-slate-50 dark:bg-slate-800/60 text-text/90 cursor-not-allowed border-slate-200 dark:border-slate-700"
                      : ""
                  }`}
                  data-testid="select-rental-type"
                >
                  <option value="WHOLE">Thuê nguyên căn</option>
                  <option value="SHARED">Ở ghép</option>
                </select>
                <ChevronDown
                  size={15}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                />
              </div>
              {selectedRoom && (
                <span className="text-[11px] text-muted leading-tight">
                  Đồng bộ theo cấu hình phòng. Đổi kiểu thuê tại Cài đặt phòng.
                </span>
              )}
            </div>

            {/* 3. Họ và tên */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-text">
                Họ và tên <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="Nhập họ và tên"
                {...register("fullName")}
                error={errors.fullName?.message}
                data-testid="input-fullName"
              />
            </div>

            {/* 4. Số điện thoại */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-text">
                Số điện thoại <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="Nhập số điện thoại"
                {...register("phone")}
                error={errors.phone?.message}
                data-testid="input-phone"
              />
              {duplicatePhoneCustomer && (
                <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-900/50">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>
                    SĐT này đã thuộc về khách <b>{duplicatePhoneCustomer.fullName || duplicatePhoneCustomer.name}</b>
                  </span>
                </div>
              )}
            </div>

            {/* 5. SĐT người thân */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-text">SĐT người thân</label>
              <Input
                placeholder="Nhập SĐT người thân / liên hệ khẩn cấp"
                {...register("emergencyPhone")}
                error={errors.emergencyPhone?.message}
                data-testid="input-emergencyPhone"
              />
            </div>

            {/* 6. Email */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-text">Email</label>
              <Input
                placeholder="Nhập email"
                {...register("email")}
                error={errors.email?.message}
                data-testid="input-email"
              />
            </div>

            {/* 7. CCCD / CMND */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-text">CCCD / CMND</label>
              <Input
                placeholder="Nhập số CCCD"
                {...register("citizenId")}
                error={errors.citizenId?.message}
                data-testid="input-citizenId"
              />
              {duplicateCitizenIdCustomer && (
                <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg border border-rose-200 dark:border-rose-900/50">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>
                    Số CCCD này đã thuộc về khách <b>{duplicateCitizenIdCustomer.fullName || duplicateCitizenIdCustomer.name}</b>
                  </span>
                </div>
              )}
            </div>

            {/* 8. Giới tính */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-text">Giới tính</label>
              <div className="relative">
                <select
                  {...register("gender")}
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 pr-8 text-sm font-medium text-text appearance-none focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                  data-testid="select-gender"
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
              {errors.gender?.message && (
                <span className="text-xs text-rose-500">{errors.gender.message}</span>
              )}
            </div>

            {/* 9. Ngày sinh */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-text">Ngày sinh</label>
              <Input
                placeholder="DD/MM/YYYY"
                {...register("birthDate")}
                error={errors.birthDate?.message}
                data-testid="input-birthDate"
              />
            </div>

            {/* 10. Quốc tịch */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-text">Quốc tịch</label>
              <Input
                placeholder="Việt Nam"
                {...register("nationality")}
                error={errors.nationality?.message}
                data-testid="input-nationality"
              />
            </div>

            {/* 11. Địa chỉ thường trú */}
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-sm font-bold text-text">Địa chỉ thường trú</label>
              <Input
                placeholder="Nhập địa chỉ..."
                {...register("address")}
                error={errors.address?.message}
                data-testid="input-address"
              />
            </div>

            {/* 12. Zalo chat ID */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-text">Zalo chat ID</label>
              <Input
                placeholder="Dán chat_id từ webhook Bot"
                {...register("zaloChatId")}
                error={errors.zaloChatId?.message}
                data-testid="input-zaloChatId"
              />
            </div>

            {/* 13. Zalo user ID */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-text">Zalo user ID</label>
              <Input
                placeholder="Dán user_id từ webhook Bot"
                {...register("zaloUserId")}
                error={errors.zaloUserId?.message}
                data-testid="input-zaloUserId"
              />
            </div>

            {/* 14. Ghi chú */}
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-sm font-bold text-text">Ghi chú</label>
              <textarea
                className="flex min-h-[88px] w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Nhập ghi chú"
                {...register("notes")}
                data-testid="input-notes"
              />
            </div>
          </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending} data-testid="tenant-form-cancel">
            Hủy
          </Button>
          <Button type="submit" variant="primary" disabled={isPending} data-testid="tenant-form-submit">
            {isPending ? "Đang lưu..." : "Lưu khách thuê"}
          </Button>
        </div>
      </form>

      {isQrOverlayOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-[420px] overflow-hidden rounded-[28px] border border-border bg-card text-text shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-[18px] font-black">Quét QR CCCD</h3>
                <p className="mt-1 text-[13px] text-emerald-300">
                  Chỉ hiện khung xanh khi đã nhận diện đúng QR CCCD
                </p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full border border-white/10 text-white hover:bg-white/10" onClick={closeQrOverlay}>
                <X size={18} />
              </Button>
            </div>

            <div className="px-5 pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-white hover:bg-white/10"
                  onClick={() => {
                    if (qrMode === "camera") {
                      closeQrOverlay();
                    }
                    setIsQrOverlayOpen(true);
                    setQrMode("camera");
                    setQrStatus("Đang mở lại camera...");
                  }}
                >
                  <Camera size={16} className="mr-2" />
                  Quét lại
                </Button>
                <div className="text-right text-[12px] text-white/60">
                  {qrStatus || "Đưa CCCD vào khung để hệ thống tự nhận diện."}
                </div>
              </div>

              {qrMode === "camera" && (
                <div className="relative h-[420px] overflow-hidden rounded-[24px] border border-indigo-400/30 bg-black">
                  <div id={QR_CAMERA_ID} className="absolute inset-0" />
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute left-1/2 top-1/2 aspect-square w-[46%] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-2 border-indigo-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.22)]" />
                    <div className="absolute left-1/2 top-1/2 h-[2px] w-[42%] -translate-x-1/2 bg-indigo-400/80 shadow-[0_0_18px_rgba(16,185,129,0.85)] animate-pulse" />
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-black/70 px-4 py-3 text-center text-[13px] font-semibold text-white">
                    Đưa riêng mã QR vào khung • Giữ yên • Căn gần để tăng độ sắc nét
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 pb-5 pt-4">
              <div className="rounded-2xl bg-white/5 px-4 py-3 text-[13px] leading-6 text-white/80">
                Hệ thống sẽ tự nhận dạng mã QR trên camera và tự động điền thông tin sau khi quét xong.
              </div>
            </div>
          </div>
        </div>
      )}

      <CccdUploadScannerModal
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          setScannerFile(null);
        }}
        file={scannerFile}
        onSuccess={handleUploadSuccess}
      />
      </div>
    </Modal>
  );
}
