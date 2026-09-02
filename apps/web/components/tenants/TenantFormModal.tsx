"use client";

import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreateCustomerSchema } from "@homeland/shared";
import { useCreateCustomerMutation, useUpdateCustomerMutation } from "@/lib/mutations/customers.mutations";
import { useCustomersQuery } from "@/lib/queries/customers.queries";
import { formatBirthDateForDisplay, normalizeVietnameseDate, parseCccdQrPayload } from "@/lib/utils/cccd-qr";
import { CCCD_LIVE_SCAN_CONFIG, optimizeCccdCameraTrack, stopCccdCameraTracks } from "@/lib/utils/cccd-camera";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { useToast } from "@/components/ui/ToastContext";
import { CccdUploadScannerModal } from "../common/CccdUploadScannerModal";
import { AlertTriangle, Camera, ChevronDown, QrCode, Upload, X } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

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
  status: "ACTIVE",
  notes: "",
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
    status: values.status || "ACTIVE",
    notes: values.notes?.trim() || null,
  };
};

export default function TenantFormModal({ isOpen, onClose, tenant }: TenantFormModalProps) {
  const createMutation = useCreateCustomerMutation();
  const updateMutation = useUpdateCustomerMutation();
  const { data: allCustomersData } = useCustomersQuery({ limit: 1000 });
  const { showToast } = useToast();
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);
  const [scannerFile, setScannerFile] = useState<File | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [isQrMenuOpen, setIsQrMenuOpen] = useState(false);
  const [isQrOverlayOpen, setIsQrOverlayOpen] = useState(false);
  const [qrMode, setQrMode] = useState<QrMode>(null);
  const [qrStatus, setQrStatus] = useState("");

  const isEdit = !!tenant;
  const isPending = createMutation.isPending || updateMutation.isPending;

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

  // Kiểm tra trùng SĐT trong danh sách khách hiện có
  const duplicatePhoneCustomer = React.useMemo(() => {
    const clean = currentPhone.replace(/[\s\-\.\(\)]/g, "").trim();
    if (!clean || clean.length < 8) return null;
    const list: any[] = (allCustomersData as any)?.data || [];
    return list.find((c: any) => {
      if (tenant && (c.id === tenant.id || c.id === tenant.source?.id)) return false;
      const p = (c.phone || "").replace(/[\s\-\.\(\)]/g, "").trim();
      return p === clean;
    });
  }, [currentPhone, allCustomersData, tenant]);

  // Kiểm tra trùng CCCD trong danh sách khách hiện có
  const duplicateCitizenIdCustomer = React.useMemo(() => {
    const clean = currentCitizenId.replace(/[\s\-\.]/g, "").trim();
    if (!clean || clean.length < 8) return null;
    const list: any[] = (allCustomersData as any)?.data || [];
    return list.find((c: any) => {
      if (tenant && (c.id === tenant.id || c.id === tenant.source?.id)) return false;
      const cid = (c.identityNo || c.citizenId || "").replace(/[\s\-\.]/g, "").trim();
      return cid === clean;
    });
  }, [currentCitizenId, allCustomersData, tenant]);

  useEffect(() => {
    if (!isOpen) {
      setIsQrMenuOpen(false);
      setIsQrOverlayOpen(false);
      setQrMode(null);
      setQrStatus("");
      setScannerFile(null);
      setIsScannerOpen(false);
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
        status: tenant.status || "ACTIVE",
        notes: tenant.notes || "",
      });
    } else {
      reset(EMPTY_VALUES);
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
            await Promise.resolve(scanner.stop()).catch(() => undefined);
            await Promise.resolve(scanner.clear()).catch(() => undefined);
            qrScannerRef.current = null;
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
      const scanner = qrScannerRef.current;
      qrScannerRef.current = null;
      if (scanner) {
        Promise.resolve(scanner.stop()).catch(() => undefined);
        Promise.resolve(scanner.clear()).catch(() => undefined);
      }
      stopCccdCameraTracks(QR_CAMERA_ID);
    };
  }, [isQrOverlayOpen, qrMode, setValue, showToast]);

  const closeQrOverlay = () => {
    const scanner = qrScannerRef.current;
    qrScannerRef.current = null;
    if (scanner) {
      Promise.resolve(scanner.stop()).catch(() => undefined);
      Promise.resolve(scanner.clear()).catch(() => undefined);
    }
    stopCccdCameraTracks(QR_CAMERA_ID);
    setIsQrOverlayOpen(false);
    setQrMode(null);
    setQrStatus("");
    setIsQrMenuOpen(false);
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

  const openQrCamera = () => {
    setIsQrMenuOpen(false);
    setIsQrOverlayOpen(true);
    setQrMode("camera");
    setQrStatus("Đang khởi tạo camera...");
  };

  const openQrUpload = () => {
    setIsQrMenuOpen(false);
    window.setTimeout(() => qrFileInputRef.current?.click(), 0);
  };

  const onSubmit = (data: FormData) => {
    if (duplicatePhoneCustomer) {
      const msg = `Số điện thoại "${data.phone}" đã được đăng ký bởi khách "${duplicatePhoneCustomer.fullName || duplicatePhoneCustomer.name}". Vui lòng kiểm tra lại!`;
      showToast(msg, "error");
      setError("phone", { type: "manual", message: `SĐT đã tồn tại (${duplicatePhoneCustomer.fullName || duplicatePhoneCustomer.name})` });
      return;
    }

    if (duplicateCitizenIdCustomer) {
      const msg = `Số CCCD/CMND "${data.citizenId}" đã được đăng ký bởi khách "${duplicateCitizenIdCustomer.fullName || duplicateCitizenIdCustomer.name}". Vui lòng kiểm tra lại!`;
      showToast(msg, "error");
      setError("citizenId", { type: "manual", message: `CCCD đã tồn tại (${duplicateCitizenIdCustomer.fullName || duplicateCitizenIdCustomer.name})` });
      return;
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
            if (errorMsg.includes("Số điện thoại") || errorMsg.includes("SĐT")) {
              setError("phone", { type: "manual", message: errorMsg });
            }
            if (errorMsg.includes("CCCD") || errorMsg.includes("CMND")) {
              setError("citizenId", { type: "manual", message: errorMsg });
            }
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
        if (errorMsg.includes("Số điện thoại") || errorMsg.includes("SĐT")) {
          setError("phone", { type: "manual", message: errorMsg });
        }
        if (errorMsg.includes("CCCD") || errorMsg.includes("CMND")) {
          setError("citizenId", { type: "manual", message: errorMsg });
        }
      },
    });
  };


  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Cập nhật khách thuê" : "Thêm khách thuê mới"}
      maxWidth="max-w-xl"
    >
      <div data-testid="tenant-form-drawer">
      <form onSubmit={handleSubmit(onSubmit)} className="mt-2 flex flex-col gap-4" data-testid="tenant-form">
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.06] bg-slate-50/60 dark:bg-slate-900/40 px-4 py-3">
          <div>
            <p className="text-[13px] font-extrabold uppercase tracking-[0.2em] text-muted">Thông tin khách hàng</p>
            <p className="mt-1 text-sm text-muted">Có thể quét QR CCCD để tự điền nhanh dữ liệu.</p>
          </div>

          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-card px-3"
              onClick={() => setIsQrMenuOpen((value) => !value)}
              data-testid="tenant-qr-button"
            >
              <QrCode size={18} className="mr-2" />
              QR
              <ChevronDown size={14} className="ml-2" />
            </Button>

            {isQrMenuOpen && (
              <div className="absolute right-0 top-12 z-20 w-44 overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-card shadow-xl">
                <button
                  type="button"
                  onClick={openQrCamera}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-text hover:bg-surface"
                >
                  <Camera size={16} />
                  Mở camera
                </button>
                <button
                  type="button"
                  onClick={openQrUpload}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-text hover:bg-surface"
                >
                  <Upload size={16} />
                  Tải ảnh lên
                </button>
              </div>
            )}
          </div>
        </div>

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
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-sm font-bold text-text">Họ và tên</label>
            <Input
              placeholder="Nhập họ và tên"
              {...register("fullName")}
              error={errors.fullName?.message}
              data-testid="input-fullName"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-text">Số điện thoại</label>
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

          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-text">Email</label>
            <Input
              placeholder="Nhập email"
              {...register("email")}
              error={errors.email?.message}
              data-testid="input-email"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-text">Giới tính</label>
            <Input
              placeholder="Nam / Nữ"
              {...register("gender")}
              error={errors.gender?.message}
              data-testid="input-gender"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-text">Ngày sinh</label>
            <Input
              placeholder="DD/MM/YYYY"
              {...register("birthDate")}
              error={errors.birthDate?.message}
              data-testid="input-birthDate"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-text">Quốc tịch</label>
            <Input
              placeholder="Việt Nam"
              {...register("nationality")}
              error={errors.nationality?.message}
              data-testid="input-nationality"
            />
          </div>

          <div className="sm:col-span-2 flex flex-col gap-1">
            <label className="text-sm font-bold text-text">Địa chỉ thường trú</label>
            <Input
              placeholder="Nhập địa chỉ..."
              {...register("address")}
              error={errors.address?.message}
              data-testid="input-address"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-text">Zalo chat ID</label>
            <Input
              placeholder="Dán chat_id từ webhook Bot"
              {...register("zaloChatId")}
              error={errors.zaloChatId?.message}
              data-testid="input-zaloChatId"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-bold text-text">Zalo user ID</label>
            <Input
              placeholder="Dán user_id từ webhook Bot"
              {...register("zaloUserId")}
              error={errors.zaloUserId?.message}
              data-testid="input-zaloUserId"
            />
          </div>

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
