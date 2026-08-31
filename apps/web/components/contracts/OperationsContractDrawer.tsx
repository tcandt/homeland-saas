"use client";

import React, { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, FileText, CalendarClock, Download, Trash2, Link as LinkIcon, History, ShieldCheck, User, X, Upload, Save, Clock3, Loader2, Zap, Droplets, Wifi, RefreshCw, Receipt, Coins, Calendar, Users } from "lucide-react";

const DocumentScannerModal = dynamic(
  () => import("../common/DocumentScannerModal").then((mod) => mod.DocumentScannerModal),
  { ssr: false, loading: () => null }
);
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Textarea } from "../ui/Textarea";
import { getContractStatusConfig } from "../../lib/contracts/contract-status";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "../ui/ToastContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  useSubmitContractMutation,
  useApproveContractMutation,
  useActivateContractMutation,
  useTerminateContractMutation,
  useContractDetailQuery,
  useCompletePendingSettlementRefundMutation,
} from "../../lib/queries/contracts.queries";
import { useDeleteContractMutation } from "../../lib/mutations/contracts.mutations";
import { useUpdateRoomMutation } from "../../lib/mutations/rooms.mutations";
import { apiClient } from "../../lib/api/client";
import { ContractSettlementPayload, contractsApi } from "../../lib/api/contracts.api";
import { customersApi } from "../../lib/api/customers.api";
import { hunonicApi } from "../../lib/api/hunonic.api";

function formatDate(value?: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return date.toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(value?: number | null) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function toDateInputValue(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  }
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Chưa có"
    : date.toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour12: false,
    });
}

function getNextPaymentPeriod(startDateStr: string, endDateStr: string) {
  const now = new Date();
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  let targetDate = new Date(now.getFullYear(), now.getMonth(), 1);

  if (now < start) {
    targetDate = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  } else {
    if (now.getDate() > 3) {
      targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  }

  if (targetDate > end) {
    return null;
  }

  return {
    month: String(targetDate.getMonth() + 1).padStart(2, '0'),
    year: targetDate.getFullYear(),
  };
}

function getCustomerName(contract: any) {
  return contract?.customer?.fullName || contract?.customer?.name || "Chưa rõ khách thuê";
}

function getRoomLabel(contract: any) {
  const roomCode = contract?.room?.code || contract?.room?.number || "Chưa có phòng";
  const buildingName = contract?.room?.building?.name || "Chưa có tòa";
  return { roomCode, buildingName };
}

function StyledDateInput({
  value,
  onChange,
  testId,
}: {
  value: string;
  onChange: (val: string) => void;
  testId?: string;
}) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  const formattedDisplay = React.useMemo(() => {
    if (!value) return "Chọn ngày...";
    const [y, m, d] = value.split("-");
    if (y && m && d) {
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
    return value;
  }, [value]);

  const handleContainerClick = () => {
    try {
      if (dateInputRef.current && typeof dateInputRef.current.showPicker === "function") {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current?.focus();
      }
    } catch {
      dateInputRef.current?.focus();
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className="relative flex items-center h-10 w-full rounded-xl border border-border bg-surface/40 hover:bg-surface hover:border-primary/60 px-3 cursor-pointer transition-all shadow-2xs group focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
    >
      <Calendar size={15} className="text-primary shrink-0 mr-2.5 transition-transform group-hover:scale-110" />
      <span className="font-mono font-bold text-sm text-text flex-1 select-none">
        {formattedDisplay}
      </span>
      <input
        ref={dateInputRef}
        data-testid={testId}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 pointer-events-auto cursor-pointer w-full h-full"
      />
    </div>
  );
}

function getFileNameFromUrl(url: string) {
  try {
    const parts = url.split("/");
    return parts[parts.length - 1];
  } catch {
    return "Tài liệu đính kèm";
  }
}

function getFileUrl(url: string) {
  if (!url) return "#";
  if (url.startsWith("http")) return url;
  return `http://localhost:3000/${url}`;
}

function DocxViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);

    import("docx-preview")
      .then(({ renderAsync }) => {
        return fetch(url)
          .then((res) => {
            if (!res.ok) throw new Error("Network response was not ok");
            return res.blob();
          })
          .then((blob) => {
            if (mounted && containerRef.current) {
              return renderAsync(blob, containerRef.current, undefined, {
                className: "docx-viewer",
                inWrapper: true,
                ignoreWidth: false,
                ignoreHeight: false,
              }).then(() => {
                if (mounted) setLoading(false);
              });
            }
          });
      })
      .catch((err) => {
        console.error(err);
        if (mounted) {
          setLoading(false);
          setError(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [url]);

  return (
    <div className="w-full h-[75vh] relative overflow-hidden bg-white/5 rounded-lg border border-border">
      {loading && <div className="absolute inset-0 flex flex-col gap-2 items-center justify-center bg-background/80 backdrop-blur-sm z-10"><Loader2 className="animate-spin text-[#6366f1]" size={32} /><span className="text-sm font-medium">Đang tải và hiển thị file Word...</span></div>}
      {error && <div className="absolute inset-0 flex flex-col gap-4 items-center justify-center bg-background/80 backdrop-blur-sm z-10"><p className="text-rose-500 font-medium">Lỗi khi đọc file Word trực tiếp.</p><Button onClick={() => window.open(url, '_blank')}>Tải xuống tài liệu</Button></div>}
      <div ref={containerRef} className="w-full h-full bg-white text-black overflow-auto" />
    </div>
  );
}

export default function OperationsContractDrawer({ contract, onClose }: { contract: any | null, onClose: () => void }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();

  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [isRefundCompletionModalOpen, setIsRefundCompletionModalOpen] = useState(false);
  const [showTerminateConfirm, setShowTerminateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [documentDeleteConfirm, setDocumentDeleteConfirm] = useState<{ type: 'contract' | 'cccd', index: number } | null>(null);
  const [refundCompletionNote, setRefundCompletionNote] = useState("");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'image' | 'pdf' | 'doc' | null>(null);

  const [isUploadingContract, setIsUploadingContract] = useState(false);
  const [isUploadingCCCD, setIsUploadingCCCD] = useState(false);
  const [isCompilingPdf, setIsCompilingPdf] = useState(false);

  const [scannerFile, setScannerFile] = useState<File | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerOnSaveCallback, setScannerOnSaveCallback] = useState<((scanned: File) => void) | null>(null);

  const contractFileInputRef = useRef<HTMLInputElement>(null);
  const cccdFileInputRef = useRef<HTMLInputElement>(null);

  const detailQuery = useContractDetailQuery(contract?.id || "");
  const detailContract = detailQuery.data?.data || contract;
  const statusConfig = detailContract ? getContractStatusConfig(detailContract.status) : null;
  const [settlementForm, setSettlementForm] = useState({
    actualMoveOutDate: toDateInputValue(),
    roomTurnoverStatus: "AVAILABLE",
    rentDaysCharged: "0",
    baseRentAmount: "",
    electricityAmount: "",
    electricityClosingKwh: "",
    waterAmount: "",
    waterPreviousReading: "",
    waterCurrentReading: "",
    waterUsage: "",
    waterUnitPrice: "",
    serviceAmount: "",
    damageFee: "",
    penaltyFee: "",
    otherChargeAmount: "",
    roomRefundAmount: "",
    waterSupportAmount: "",
    otherCreditAmount: "",
    depositToRefund: "",
    depositToDeduct: "",
    refundReceiptStatus: "COMPLETED",
    refundReason: "",
    refundAttachmentUrls: "",
    note: "",
  });
  const [settlementPreview, setSettlementPreview] = useState<any | null>(null);
  const [isSettlementPreviewPending, setIsSettlementPreviewPending] = useState(false);
  const settlementPreviewRequestRef = useRef(0);

  const submitMutation = useSubmitContractMutation();
  const approveMutation = useApproveContractMutation();
  const activateMutation = useActivateContractMutation();
  const terminateMutation = useTerminateContractMutation();
  const completePendingRefundMutation = useCompletePendingSettlementRefundMutation();
  const deleteMutation = useDeleteContractMutation();
  const updateRoomMutation = useUpdateRoomMutation();
  const settlementRefund = detailContract?.settlementRefund;
  const hasPendingSettlementRefund =
    !!settlementRefund?.pending && (detailContract?.status === "TERMINATED" || detailContract?.status === "EXPIRED");

  const buildSettlementPayload = React.useCallback((): ContractSettlementPayload => {
    const parseOptionalNumber = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    return {
      actualMoveOutDate: settlementForm.actualMoveOutDate,
      roomTurnoverStatus: settlementForm.roomTurnoverStatus as "AVAILABLE" | "CLEANING" | "MAINTENANCE",
      rentDaysCharged: settlementForm.rentDaysCharged.trim() ? Number(settlementForm.rentDaysCharged) : 0,
      baseRentAmount: parseOptionalNumber(settlementForm.baseRentAmount),
      electricityAmount: parseOptionalNumber(settlementForm.electricityAmount),
      electricityClosingKwh: parseOptionalNumber(settlementForm.electricityClosingKwh),
      waterAmount: parseOptionalNumber(settlementForm.waterAmount),
      waterPreviousReading: parseOptionalNumber(settlementForm.waterPreviousReading),
      waterCurrentReading: parseOptionalNumber(settlementForm.waterCurrentReading),
      waterUsage: parseOptionalNumber(settlementForm.waterUsage),
      waterUnitPrice: parseOptionalNumber(settlementForm.waterUnitPrice),
      serviceAmount: parseOptionalNumber(settlementForm.serviceAmount),
      damageFee: parseOptionalNumber(settlementForm.damageFee),
      penaltyFee: parseOptionalNumber(settlementForm.penaltyFee),
      otherChargeAmount: parseOptionalNumber(settlementForm.otherChargeAmount),
      roomRefundAmount: parseOptionalNumber(settlementForm.roomRefundAmount),
      waterSupportAmount: parseOptionalNumber(settlementForm.waterSupportAmount),
      otherCreditAmount: parseOptionalNumber(settlementForm.otherCreditAmount),
      depositToRefund: parseOptionalNumber(settlementForm.depositToRefund),
      depositToDeduct: parseOptionalNumber(settlementForm.depositToDeduct),
      refundReceiptStatus: settlementForm.refundReceiptStatus as "PENDING" | "COMPLETED",
      refundReason: settlementForm.refundReason.trim() || undefined,
      refundAttachmentUrls: settlementForm.refundAttachmentUrls
        .split(/\r?\n|,/)
        .map((value) => value.trim())
        .filter(Boolean),
      note: settlementForm.note.trim() || undefined,
    };
  }, [settlementForm]);
  const settlementPreviewPayloadKey = JSON.stringify(buildSettlementPayload());

  const handleSuccess = (message: string) => {
    showToast(message, "success");
    queryClient.invalidateQueries({ queryKey: ["contracts"] });
    if (detailContract?.id) {
      queryClient.invalidateQueries({ queryKey: ["contracts", "detail", detailContract.id] });
      queryClient.invalidateQueries({ queryKey: ["contractDetail", detailContract.id] });
    }
    onClose();
  };

  const handleError = (error: any) => {
    showToast(error?.response?.data?.message || "Có lỗi xảy ra", "error");
  };

  useEffect(() => {
    if (!detailContract?.id) return;
    setSettlementForm({
      actualMoveOutDate: toDateInputValue(),
      roomTurnoverStatus: "AVAILABLE",
      rentDaysCharged: "0",
      baseRentAmount: "",
      electricityAmount: "",
      electricityClosingKwh: "",
      waterAmount: "",
      waterPreviousReading: "",
      waterCurrentReading: "",
      waterUsage: "",
      waterUnitPrice: "",
      serviceAmount: "",
      damageFee: "",
      penaltyFee: "",
      otherChargeAmount: "",
      roomRefundAmount: "",
      waterSupportAmount: "",
      otherCreditAmount: "",
      depositToRefund: detailContract.depositMoney ? String(detailContract.depositMoney) : "",
      depositToDeduct: "",
      refundReceiptStatus: "COMPLETED",
      refundReason: "",
      refundAttachmentUrls: "",
      note: "",
    });
    setSettlementPreview(null);
    setIsSettlementModalOpen(false);
  }, [detailContract?.id, detailContract?.depositMoney]);

  useEffect(() => {
    const requestId = ++settlementPreviewRequestRef.current;
    if (!isSettlementModalOpen || !detailContract?.id) {
      setIsSettlementPreviewPending(false);
      return;
    }

    setIsSettlementPreviewPending(true);

    const timer = window.setTimeout(async () => {
      try {
        const payload = JSON.parse(settlementPreviewPayloadKey) as ContractSettlementPayload;
        const preview = await contractsApi.previewSettlement(detailContract.id, payload);
        if (requestId === settlementPreviewRequestRef.current) {
          setSettlementPreview(preview);
        }
      } catch {
        if (requestId === settlementPreviewRequestRef.current) {
          setSettlementPreview(null);
        }
      } finally {
        if (requestId === settlementPreviewRequestRef.current) {
          setIsSettlementPreviewPending(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [isSettlementModalOpen, detailContract?.id, settlementPreviewPayloadKey]);

  const updateSettlementField = (field: keyof typeof settlementForm, value: string) => {
    setSettlementForm((prev) => ({ ...prev, [field]: value }));
  };

  const [isSyncingHunonic, setIsSyncingHunonic] = useState(false);
  const [customSharedOccupants, setCustomSharedOccupants] = useState<number | null>(null);

  const formatVndInput = (value: string | number | undefined | null) => {
    if (value === undefined || value === null || value === "") return "";
    const cleanStr = String(value).replace(/[^0-9]/g, "");
    if (!cleanStr) return "";
    return Number(cleanStr).toLocaleString("vi-VN");
  };

  const handleMoneyInputChange = (field: keyof typeof settlementForm, rawText: string) => {
    const digits = rawText.replace(/[^0-9]/g, "");
    updateSettlementField(field, digits);
  };

  const handleSyncElectricity = async () => {
    if (isSyncingHunonic) return;
    setIsSyncingHunonic(true);
    try {
      showToast("Đang đồng bộ chỉ số điện từ công tơ Hunonic...", "info");
      await hunonicApi.sync();
      if (detailContract?.id) {
        const payload = buildSettlementPayload();
        const preview: any = await contractsApi.previewSettlement(detailContract.id, payload);
        setSettlementPreview(preview);
        if (preview?.utilitySnapshot?.electricity) {
          const elec = preview.utilitySnapshot.electricity;
          const amount = elec.calculatedAmountVnd || elec.monthAmountVnd;
          if (amount !== undefined && amount !== null) {
            updateSettlementField("electricityAmount", String(Number(amount)));
          }
          if (elec.monthKwh !== undefined && elec.monthKwh !== null) {
            updateSettlementField("electricityClosingKwh", String(Number(elec.monthKwh)));
          }
        }
      }
      showToast("Đã đồng bộ công tơ điện và cập nhật số liệu thành công!", "success");
    } catch (error: any) {
      showToast(error?.response?.data?.message || "Không thể đồng bộ công tơ điện Hunonic", "error");
    } finally {
      setIsSyncingHunonic(false);
    }
  };

  const handleApplyUtilitySnapshot = () => {
    if (!settlementPreview?.utilitySnapshot?.electricity) {
      showToast("Chưa có dữ liệu công tơ điện để áp dụng", "info");
      return;
    }
    const electricity = settlementPreview.utilitySnapshot.electricity;
    const isShared = Boolean(electricity.isSharedRoom);
    const effectiveOccupants = customSharedOccupants ?? (electricity.activeOccupants || 1);

    const amountToApply = isShared
      ? Math.round(
        Number(electricity.totalCalculatedAmountVnd || electricity.totalRoomAmountVnd || electricity.calculatedAmountVnd || 0) /
        Math.max(1, effectiveOccupants)
      )
      : Number(electricity.calculatedAmountVnd || electricity.monthAmountVnd || 0);

    const kwhToApply = isShared
      ? Math.round(
        (Number(electricity.totalRoomMonthKwh || electricity.monthKwh || 0) / Math.max(1, effectiveOccupants)) * 100
      ) / 100
      : Number(electricity.monthKwh || 0);

    setSettlementForm((prev) => ({
      ...prev,
      electricityAmount: String(amountToApply),
      electricityClosingKwh: String(kwhToApply),
    }));

    showToast(
      isShared
        ? `Đã áp dụng tiền điện chia đều cho ${effectiveOccupants} người: ${formatCurrency(amountToApply)}`
        : "Đã áp dụng số liệu công tơ điện vào biểu mẫu quyết toán",
      "success"
    );
  };

  const handleOpenSettlementModal = () => {
    setIsSettlementModalOpen(true);
  };

  const handleConfirmTermination = () => {
    if (!detailContract?.id) return;
    terminateMutation.mutate(
      {
        id: detailContract.id,
        payload: buildSettlementPayload(),
      },
      {
        onSuccess: () => {
          setIsSettlementModalOpen(false);
          handleSuccess("Đã chấm dứt hợp đồng và tạo quyết toán");
        },
        onError: handleError,
      }
    );
  };

  const handleMarkRoomAvailable = () => {
    if (!detailContract?.room?.id) return;
    updateRoomMutation.mutate(
      {
        id: detailContract.room.id,
        data: { status: "AVAILABLE" },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["contractDetail", detailContract.id] });
          showToast("Đã chuyển phòng về trạng thái sẵn sàng khai thác", "success");
        },
        onError: handleError,
      }
    );
  };

  const handleCompletePendingRefund = () => {
    if (!detailContract?.id) return;
    completePendingRefundMutation.mutate(
      {
        id: detailContract.id,
        note: refundCompletionNote.trim() || undefined,
      },
      {
        onSuccess: () => {
          setIsRefundCompletionModalOpen(false);
          setRefundCompletionNote("");
          showToast("Da hoan tat phieu hoan tien quyet toan", "success");
          queryClient.invalidateQueries({ queryKey: ["contracts"] });
          queryClient.invalidateQueries({ queryKey: ["contracts", "detail", detailContract.id] });
          queryClient.invalidateQueries({ queryKey: ["contractDetail", detailContract.id] });
        },
        onError: handleError,
      }
    );
  };

  const handlePrintCompiledPdf = async () => {
    if (!detailContract?.id) return;
    setIsCompilingPdf(true);
    showToast("Bắt đầu đóng gói hồ sơ cư trú...", "success");
    try {
      const authStore = localStorage.getItem('auth-storage');
      let token = '';
      if (authStore) {
        const parsed = JSON.parse(authStore);
        token = parsed?.state?.accessToken || '';
      }

      const res = await fetch("/api/export-compiled-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          contractId: detailContract.id,
          ct01Draft: {
            hoTenChuHo: "NGUYỄN ĐỨC TÍNH",
            quanHeVoiChuHo: "Khách thuê",
            thanhVien: [],
          }
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Lỗi đóng gói tài liệu");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `HoSoLuuTru_Phong_${detailContract.room?.code || 'Detail'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showToast("Đã tải xuống hồ sơ cư trú PDF thành công!", "success");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Không thể đóng gói hồ sơ cư trú", "error");
    } finally {
      setIsCompilingPdf(false);
    }
  };

  const checkAndUpdateContractStatus = async (hasContract: boolean, cccdCount: number) => {
    if (!detailContract) return;
    if (hasContract && cccdCount >= 2 && (detailContract.status === 'DRAFT' || detailContract.status === 'PENDING_APPROVAL')) {
      try {
        await contractsApi.update(detailContract.id, { status: 'ACTIVE' });
        showToast("Đã đủ hồ sơ, tự động chuyển trạng thái hợp đồng sang Đã ký", "success");
      } catch (err) {
        console.error(err);
      }
    }
  };

  const executeUploadContractFile = async (file: File) => {
    try {
      setIsUploadingContract(true);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "contracts");
      const res = await apiClient.postForm<{ url: string }>("/documents/upload", formData);

      const newAttachments = [...(detailContract?.attachments || []), res.url];
      await contractsApi.update(detailContract.id, { attachments: newAttachments });

      showToast("Đã tải lên hồ sơ hợp đồng", "success");
      await checkAndUpdateContractStatus(true, detailContract.customer?.idImages?.length || 0);
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    } catch (err) {
      console.error(err);
      showToast("Tải lên thất bại", "error");
    } finally {
      setIsUploadingContract(false);
    }
  };

  const handleUploadContractFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !detailContract) return;

    if (file.type.startsWith("image/")) {
      setScannerFile(file);
      setScannerOnSaveCallback(() => async (scanned: File) => {
        await executeUploadContractFile(scanned);
      });
      setIsScannerOpen(true);
    } else {
      await executeUploadContractFile(file);
    }
  };

  const executeUploadCCCD = async (filesList: File[]) => {
    try {
      setIsUploadingCCCD(true);
      const uploadPromises = filesList.map(async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "customers");
        const res = await apiClient.postForm<{ url: string }>("/documents/upload", formData);
        return res.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const newIdImages = [...(detailContract.customer.idImages || []), ...uploadedUrls];

      await customersApi.update(detailContract.customer.id, { idImages: newIdImages });

      showToast("Đã tải lên ảnh CCCD", "success");
      await checkAndUpdateContractStatus((detailContract.attachments?.length || 0) > 0, newIdImages.length);
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (detailContract?.id) {
        queryClient.invalidateQueries({ queryKey: ["contractDetail", detailContract.id] });
      }
    } catch (err) {
      console.error(err);
      showToast("Tải lên thất bại", "error");
    } finally {
      setIsUploadingCCCD(false);
    }
  };

  const handleUploadCCCD = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !detailContract?.customer?.id) return;

    const firstFile = files[0];
    if (files.length === 1 && firstFile.type.startsWith("image/")) {
      setScannerFile(firstFile);
      setScannerOnSaveCallback(() => async (scanned: File) => {
        await executeUploadCCCD([scanned]);
      });
      setIsScannerOpen(true);
    } else {
      await executeUploadCCCD(Array.from(files));
    }
  };

  const handleRemoveContractFile = async (index: number) => {
    if (!detailContract?.attachments) return;
    try {
      const newAttachments = [...detailContract.attachments];
      newAttachments.splice(index, 1);
      await contractsApi.update(detailContract.id, { attachments: newAttachments });
      showToast("Đã xóa file hợp đồng", "success");
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    } catch (err) {
      console.error(err);
      showToast("Xóa file thất bại", "error");
    }
  };

  const handleRemoveCCCD = async (index: number) => {
    if (!detailContract?.customer?.id || !detailContract.customer.idImages) return;
    try {
      const newIdImages = [...detailContract.customer.idImages];
      newIdImages.splice(index, 1);
      await customersApi.update(detailContract.customer.id, { idImages: newIdImages });
      showToast("Đã xóa ảnh CCCD", "success");
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (err) {
      console.error(err);
      showToast("Xóa ảnh thất bại", "error");
    }
  };

  const handlePreview = (url: string) => {
    const fullUrl = getFileUrl(url);
    const extension = url.split('.').pop()?.toLowerCase();
    setPreviewUrl(fullUrl);
    setPreviewType(extension === 'pdf' ? 'pdf' : (extension === 'doc' || extension === 'docx' ? 'doc' : 'image'));
  };

  if (!detailContract) return null;

  const customerName = getCustomerName(detailContract);

  const representatives = [
    detailContract.customer,
    ...(detailContract.coRepresentatives || [])
  ].filter(Boolean).filter((rep: any, index: number, items: any[]) => {
    if (!rep?.id) return true;
    return items.findIndex((item: any) => item?.id === rep.id) === index;
  });

  const { roomCode, buildingName } = getRoomLabel(detailContract);
  const memberCount = Number(detailContract.memberCount || 0);
  const remainingDays = Math.max(
    0,
    Math.ceil((new Date(detailContract.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  );

  const contractPdfUrl = detailContract.contractPdfUrl || detailContract.pdfUrl || null;
  const hasUploadedContract = !!contractPdfUrl || (detailContract.attachments && detailContract.attachments.length > 0);
  const hasUploadedCCCD = detailContract.customer?.idImages && detailContract.customer.idImages.length > 0;
  const signStatus = (hasUploadedContract && hasUploadedCCCD) ? "Đã ký" : "Chưa ký";

  return (
    <>
      <Modal
        isOpen={!!detailContract}
        onClose={onClose}
        maxWidth="max-w-[1100px]"
        title={
          <div className="flex items-center gap-3">
            <span className="font-black text-[20px] text-text">Chi tiết hợp đồng</span>
            <Badge variant="primary">{detailContract.code || detailContract.id.slice(0, 8)}</Badge>
          </div>
        }
        footer={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {detailContract.status === "DRAFT" && hasPermission("contract.submit") && (
                <Button
                  data-testid="btn-submit-contract"
                  onClick={() =>
                    submitMutation.mutate(detailContract.id, {
                      onSuccess: () => handleSuccess("Đã trình duyệt hợp đồng"),
                      onError: handleError,
                    })
                  }
                  isLoading={submitMutation.isPending}
                >
                  Trình duyệt
                </Button>
              )}
              {detailContract.status === "PENDING_APPROVAL" && hasPermission("contract.approve") && (
                <Button
                  data-testid="btn-approve-contract"
                  onClick={() =>
                    approveMutation.mutate(detailContract.id, {
                      onSuccess: () => handleSuccess("Đã duyệt hợp đồng"),
                      onError: handleError,
                    })
                  }
                  isLoading={approveMutation.isPending}
                >
                  Duyệt hợp đồng
                </Button>
              )}
              {detailContract.status === "APPROVED" && hasPermission("contract.activate") && (
                <Button
                  data-testid="btn-activate-contract"
                  onClick={() =>
                    activateMutation.mutate(detailContract.id, {
                      onSuccess: () => handleSuccess("Đã kích hoạt hợp đồng"),
                      onError: handleError,
                    })
                  }
                  isLoading={activateMutation.isPending}
                >
                  Kích hoạt
                </Button>
              )}
              {(detailContract.status === "ACTIVE" || detailContract.status === "EXPIRING") &&
                hasPermission("contract.terminate") && (
                  <Button
                    data-testid="btn-open-settlement"
                    variant="outline"
                    onClick={handleOpenSettlementModal}
                  >
                    Quyết toán trả phòng
                  </Button>
                )}
              {(detailContract.status === "TERMINATED" || detailContract.status === "EXPIRED") &&
                (detailContract.room?.status === "CLEANING" || detailContract.room?.status === "MAINTENANCE") &&
                hasPermission("room.update") && (
                  <Button
                    data-testid="btn-room-ready"
                    variant="outline"
                    onClick={handleMarkRoomAvailable}
                    isLoading={updateRoomMutation.isPending}
                  >
                    Hoàn tất vệ sinh / bảo trì phòng
                  </Button>
                )}
              {false && (detailContract.status === "ACTIVE" || detailContract.status === "EXPIRING") &&
                hasPermission("contract.terminate") &&
                (showTerminateConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-rose-500 font-bold">Bạn chắc chắn muốn chấm dứt?</span>
                    <Button
                      data-testid="btn-confirm-terminate"
                      variant="danger"
                      onClick={() =>
                        terminateMutation.mutate(detailContract.id, {
                          onSuccess: () => {
                            setShowTerminateConfirm(false);
                            handleSuccess("Đã chấm dứt hợp đồng");
                          },
                          onError: handleError,
                        })
                      }
                      isLoading={terminateMutation.isPending}
                    >
                      Xác nhận
                    </Button>
                    <Button variant="ghost" onClick={() => setShowTerminateConfirm(false)}>
                      Hủy
                    </Button>
                  </div>
                ) : (
                  <Button
                    data-testid="btn-terminate-contract"
                    variant="ghost"
                    className="text-rose-500 hover:bg-rose-500/10"
                    onClick={handleOpenSettlementModal}
                  >
                    <Trash2 size={16} className="mr-2" /> Chấm dứt
                  </Button>
                ))}

              {hasPermission("contract.delete") &&
                (showDeleteConfirm ? (
                  <div className="flex items-center gap-2 border-l border-border/50 pl-2 ml-2">
                    <span className="text-sm text-rose-500 font-bold">Xóa hẳn hợp đồng?</span>
                    <Button
                      data-testid="btn-confirm-delete"
                      variant="danger"
                      onClick={() =>
                        deleteMutation.mutate(detailContract.id, {
                          onSuccess: () => {
                            setShowDeleteConfirm(false);
                            onClose();
                            queryClient.removeQueries({ queryKey: ["contracts", "detail", detailContract.id] });
                            showToast("Đã xóa hợp đồng", "success");
                            queryClient.invalidateQueries({ queryKey: ["contracts"] });
                          },
                          onError: handleError,
                        })
                      }
                      isLoading={deleteMutation.isPending}
                    >
                      Xác nhận
                    </Button>
                    <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                      Hủy
                    </Button>
                  </div>
                ) : (
                  <Button
                    data-testid="btn-delete-contract"
                    variant="ghost"
                    className="text-rose-500 hover:bg-rose-500/10 ml-2 border-l border-border/50 rounded-none pl-4"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 size={16} className="mr-2" /> Xóa
                  </Button>
                ))}
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handlePrintCompiledPdf}
                isLoading={isCompilingPdf}
                disabled={isCompilingPdf}
              >
                <Download size={16} className="mr-2" /> In tài liệu (Khai báo lưu trú)
              </Button>
              {!statusConfig?.isTerminal && remainingDays <= 30 && (
                <Button className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg animate-pulse border-none">
                  <CalendarClock size={16} className="mr-2" /> Gia hạn
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Card className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-[16px]">
              <div className="flex flex-col gap-[8px]">
                <h3 className="font-black text-[22px] text-text leading-tight">{customerName}</h3>
                <div className="flex flex-wrap items-center gap-[8px]">
                  <Badge variant="neutral">
                    {roomCode} · {buildingName}
                  </Badge>
                  <Badge data-testid="contract-status-badge" variant={statusConfig?.color || "neutral"}>
                    {statusConfig?.label || detailContract.status}
                  </Badge>
                  <Badge variant={signStatus === "Đã ký" ? "success" : "warning"}>{signStatus}</Badge>
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-[4px]">
                <span className="text-[12px] font-bold text-muted uppercase tracking-wider">Cập nhật gần nhất</span>
                <div className="flex items-center gap-[6px] text-[14px] font-black text-text">
                  <Clock3 size={16} className="text-[#6366f1]" />
                  {formatDateTime(detailContract.updatedAt || detailContract.createdAt)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 pt-3 border-t border-slate-200/60 dark:border-white/[0.06]">
              <div className="flex flex-col gap-[4px]">
                <span className="text-[11px] font-bold text-muted uppercase">Ngày bắt đầu</span>
                <span className="text-[14px] font-bold text-text">{formatDate(detailContract.startDate)}</span>
              </div>
              <div className="flex flex-col gap-[4px]">
                <span className="text-[11px] font-bold text-muted uppercase">Ngày kết thúc</span>
                <span className="text-[14px] font-bold text-text">{formatDate(detailContract.endDate)}</span>
              </div>
              <div className="flex flex-col gap-[4px]">
                <span className="text-[11px] font-bold text-muted uppercase">Thời gian còn lại</span>
                <span className="text-[14px] font-black flex items-center gap-1 text-[#f97316]">{remainingDays} ngày</span>
              </div>
              <div className="flex flex-col gap-[4px]">
                <span className="text-[11px] font-bold text-muted uppercase">Khách thuê</span>
                <span className="text-[14px] font-bold text-text flex items-center gap-1">
                  <User size={14} className="text-muted" />
                  {memberCount} người
                </span>
              </div>
            </div>
          </Card>

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 flex flex-col gap-4 min-w-0">
              <Card className="p-4 flex flex-col gap-3">
                <h4 className="font-black text-[14px] text-text flex items-center gap-2 border-b border-slate-200/60 dark:border-white/[0.06] pb-2">
                  <FileText size={16} className="text-[#6366f1]" /> Thông tin tài chính
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="flex flex-col justify-center p-3 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/60 rounded-[10px]">
                    <span className="text-[12px] font-bold text-muted">Giá thuê / tháng</span>
                    <span className="text-[14px] font-black text-text">
                      {Number(detailContract.monthlyRent || 0).toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                  <div className="flex flex-col justify-center p-3 bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800/60 rounded-[10px]">
                    <span className="text-[12px] font-bold text-muted">Tiền cọc</span>
                    <span className="text-[14px] font-black text-text">
                      {Number(detailContract.depositMoney || 0).toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                  <div className="flex flex-col justify-center p-3 bg-rose-500/10 dark:bg-rose-500/15 border border-rose-500/20 dark:border-rose-500/30 rounded-[10px]">
                    <span className="text-[12px] font-bold text-rose-500">Công nợ hiện tại</span>
                    <span className="text-[14px] font-black text-rose-500">
                      {Number(detailContract.debt || 0).toLocaleString("vi-VN")}đ
                    </span>
                  </div>
                </div>

                {/* Dịch vụ tiện ích */}
                <div className="rounded-xl border border-border/60 bg-surface/50 p-2.5 space-y-1.5 text-xs">
                  <span className="font-bold text-muted block text-[10px] uppercase tracking-wider">Dịch vụ & Tiện ích đi kèm</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-2.5 py-1.5">
                      <Zap size={13} className="text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-muted block leading-none">Điện</span>
                        <span className="text-[11px] font-black text-text truncate block">Giá nhà nước</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-2.5 py-1.5">
                      <Droplets size={13} className="text-sky-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-muted block leading-none">Nước</span>
                        <span className="text-[11px] font-black text-text truncate block">100.000 đ / người</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-2.5 py-1.5">
                      <Wifi size={13} className="text-indigo-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-muted block leading-none">Wifi</span>
                        <span className="text-[11px] font-black text-text truncate block">Miễn phí</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-2.5 py-1.5">
                      <FileText size={13} className="text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold text-muted block leading-none">Dịch vụ</span>
                        <span className="text-[11px] font-black text-text truncate block">Vệ sinh / Rác</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {hasPendingSettlementRefund ? (
                <Card data-testid="contract-pending-settlement-refund" className="p-4 flex flex-col gap-4 border border-amber-500/30 bg-amber-500/5">
                  <div className="flex flex-col gap-1">
                    <h4 className="font-black text-[14px] text-text">Hoan tien quyet toan dang cho xu ly</h4>
                    <p className="text-sm text-muted">
                      Receipt hoan tien da tao nhung chua xac nhan hoan tat. Sau khi chuyen khoan cho khach, xac nhan tai day de dong receipt va task theo doi.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-[10px] border border-border/70 bg-card/70 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Phieu chi</div>
                      <div className="mt-1 text-sm font-black text-text">{settlementRefund?.receiptCode || "Chua tao"}</div>
                    </div>
                    <div className="rounded-[10px] border border-border/70 bg-card/70 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">So tien</div>
                      <div className="mt-1 text-sm font-black text-amber-600">{formatCurrency(settlementRefund?.receiptAmount || 0)}</div>
                    </div>
                    <div className="rounded-[10px] border border-border/70 bg-card/70 p-3">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Trang thai</div>
                      <div className="mt-1 text-sm font-black text-text">{settlementRefund?.taskStatus || settlementRefund?.receiptStatus || "PENDING"}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      data-testid="contract-complete-settlement-refund-open"
                      onClick={() => setIsRefundCompletionModalOpen(true)}
                      isLoading={completePendingRefundMutation.isPending}
                    >
                      Xac nhan da hoan tien
                    </Button>
                    <span className="text-xs text-muted">
                      {settlementRefund?.taskTitle || "Dang cho xu ly thu cong"}
                    </span>
                  </div>
                </Card>
              ) : null}

              <Card className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.06] pb-2">
                  <h4 className="font-black text-[14px] text-text flex items-center gap-2">
                    <ShieldCheck size={16} className="text-[#8b5cf6]" /> Hồ sơ & Chữ ký
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* File hợp đồng */}
                  <div className="flex flex-col gap-[12px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-bold text-text flex items-center gap-2">
                        <FileText size={14} className="text-[#6366f1]" /> File hợp đồng đính kèm
                      </span>
                      <Button variant="outline" size="sm" onClick={() => contractFileInputRef.current?.click()} isLoading={isUploadingContract}>
                        <Upload size={14} className="mr-2" /> Tải lên
                      </Button>
                      <input type="file" ref={contractFileInputRef} onChange={handleUploadContractFile} className="hidden" accept=".pdf,.doc,.docx" />
                    </div>

                    {detailContract.attachments && detailContract.attachments.length > 0 ? (
                      detailContract.attachments.map((url: string, index: number) => (
                        <div key={index} className="flex items-center justify-between p-[12px] border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 rounded-[10px] hover:border-[#6366f1]/50 transition-colors group">
                          <div className="flex items-center gap-[12px] min-w-0">
                            <div className="w-[36px] h-[36px] rounded-[8px] bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                              <FileText size={16} />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span
                                className="text-[13px] font-bold text-text group-hover:text-[#6366f1] transition-colors truncate cursor-pointer hover:underline"
                                onClick={() => handlePreview(url)}
                              >
                                {getFileNameFromUrl(url) || `Hồ sơ đính kèm ${index + 1}`}
                              </span>
                            </div>
                          </div>
                          <button onClick={() => setDocumentDeleteConfirm({ type: 'contract', index })} className="w-[28px] h-[28px] flex items-center justify-center rounded-full hover:bg-rose-500/10 text-muted hover:text-rose-500 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    ) : contractPdfUrl ? (
                      <div className="flex items-center justify-between p-[12px] border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 rounded-[10px] hover:border-[#6366f1]/50 transition-colors group">
                        <div className="flex items-center gap-[12px] min-w-0">
                          <div className="w-[36px] h-[36px] rounded-[8px] bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                            <FileText size={16} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span
                              className="text-[13px] font-bold text-text group-hover:text-[#6366f1] transition-colors truncate cursor-pointer hover:underline"
                              onClick={() => handlePreview(contractPdfUrl)}
                            >
                              Hợp đồng thuê nhà.pdf
                            </span>
                            <span className="text-[11px] font-medium text-muted truncate">
                              Cập nhật {formatDateTime(detailContract.updatedAt || detailContract.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col items-center justify-center text-center gap-2">
                        <FileText size={24} className="text-muted" />
                        <span className="text-sm font-semibold text-text">Chưa có hợp đồng</span>
                        <span className="text-xs text-muted">Vui lòng tải lên file hợp đồng đã ký</span>
                      </div>
                    )}
                  </div>

                  {/* CCCD */}
                  <div className="flex flex-col gap-[12px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-bold text-text flex items-center gap-2">
                        <User size={14} className="text-[#8b5cf6]" /> Căn cước công dân (CCCD)
                      </span>
                      <Button variant="outline" size="sm" onClick={() => cccdFileInputRef.current?.click()} isLoading={isUploadingCCCD}>
                        <Upload size={14} className="mr-2" /> Tải lên
                      </Button>
                      <input type="file" ref={cccdFileInputRef} onChange={handleUploadCCCD} className="hidden" accept="image/*" multiple />
                    </div>

                    {detailContract.customer?.idImages && detailContract.customer.idImages.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {detailContract.customer.idImages.map((url: string, index: number) => (
                          <div key={index} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 w-[100px] h-[66px] shrink-0 bg-slate-100 dark:bg-slate-800/40">
                            <img src={getFileUrl(url)} alt={`CCCD ${index + 1}`} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button onClick={() => handlePreview(url)} className="w-[32px] h-[32px] rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white backdrop-blur-sm transition-colors">
                                <LinkIcon size={14} />
                              </button>
                              <button onClick={() => setDocumentDeleteConfirm({ type: 'cccd', index })} className="w-[32px] h-[32px] rounded-full bg-rose-500/20 hover:bg-rose-500/40 flex items-center justify-center text-white backdrop-blur-sm transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col items-center justify-center text-center gap-1 h-[80px]">
                        <User size={24} className="text-muted" />
                        <span className="text-sm font-semibold text-text">Chưa có ảnh CCCD</span>
                        <span className="text-xs text-muted">Vui lòng tải lên ít nhất 2 ảnh CCCD</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            <div className="w-full lg:w-[280px] flex flex-col gap-4 shrink-0">
              <Card className="p-4 flex flex-col gap-4 flex-1">
                <h4 className="font-black text-[14px] text-text flex items-center gap-2 border-b border-slate-200/60 dark:border-white/[0.06] pb-2"><History size={16} className="text-[#f97316]" /> Lifecycle Timeline</h4>

                <div className="flex flex-col gap-[12px] border-b border-slate-200/60 dark:border-white/[0.06] pb-3">
                  {representatives.map((rep: any, idx: number) => (
                    <div key={`${rep.id || "representative"}-${idx}`} className="flex items-center gap-2">
                      <div className="w-[36px] h-[36px] rounded-[10px] bg-[#6366f1]/10 text-[#6366f1] flex items-center justify-center font-bold text-sm">
                        {(rep.fullName || rep.name)?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-black text-[14px] text-text truncate">{rep.fullName || rep.name}</span>
                        <span className="text-[12px] text-muted font-bold truncate">Đại diện {idx > 0 ? idx + 1 : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-[0px] relative mt-[8px]">
                  <div className="absolute left-[15px] top-[10px] bottom-[20px] w-[2px] bg-border" />

                  <div className="flex gap-[16px] relative z-10 pb-[24px]">
                    <div className="w-[32px] h-[32px] rounded-full bg-[#8b5cf6] flex items-center justify-center shrink-0 border-[4px] border-card"><CheckCircle2 size={14} className="text-white" /></div>
                    <div className="flex flex-col gap-[4px] pt-[6px]">
                      <span className="text-[13px] font-bold text-text leading-none">Tạo hợp đồng</span>
                      <span className="text-[11px] text-muted">{formatDateTime(detailContract.createdAt)}</span>
                    </div>
                  </div>
                  {signStatus === "Đã ký" && (
                    <div className="flex gap-[16px] relative z-10 pb-[24px]">
                      <div className="w-[32px] h-[32px] rounded-full bg-[#8b5cf6] flex items-center justify-center shrink-0 border-[4px] border-card"><CheckCircle2 size={14} className="text-white" /></div>
                      <div className="flex flex-col gap-[4px] pt-[6px]">
                        <span className="text-[13px] font-bold text-text leading-none">Đã ký & Upload hồ sơ</span>
                      </div>
                    </div>
                  )}
                  {detailContract.status === 'ACTIVE' && (
                    <>
                      <div className="flex gap-[16px] relative z-10 pb-[24px]">
                        <div className="w-[32px] h-[32px] rounded-full bg-[#3b82f6] flex items-center justify-center shrink-0 border-[4px] border-card"><div className="w-[8px] h-[8px] bg-white rounded-full" /></div>
                        <div className="flex flex-col gap-[4px] pt-[6px]">
                          <span className="text-[13px] font-bold text-[#3b82f6] leading-none">Đang thuê</span>
                          <span className="text-[11px] text-muted">Hiệu lực đến {formatDate(detailContract.endDate)}</span>
                        </div>
                      </div>
                      {(() => {
                        const nextPay = getNextPaymentPeriod(detailContract.startDate, detailContract.endDate);
                        if (!nextPay) return null;
                        return (
                          <div className="flex gap-[16px] relative z-10">
                            <div className="w-[32px] h-[32px] rounded-full bg-[#f97316] flex items-center justify-center shrink-0 border-[4px] border-card">
                              <CalendarClock size={12} className="text-white" />
                            </div>
                            <div className="flex flex-col gap-[4px] pt-[6px]">
                              <span className="text-[13px] font-bold text-text leading-none">Thanh toán tiếp theo</span>
                              <span className="text-[11px] text-[#f97316] font-semibold">Hạn đóng: 01/{nextPay.month} - 03/{nextPay.month}/{nextPay.year}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
        <Modal isOpen={!!previewUrl} onClose={() => { setPreviewUrl(null); setPreviewType(null); }} title="Xem trước tài liệu" maxWidth="max-w-[800px]">
          <div className="flex flex-col items-center justify-center p-4">
            {previewType === 'image' && <img src={previewUrl!} className="max-w-full max-h-[75vh] object-contain" alt="Preview" />}
            {previewType === 'pdf' && <iframe src={previewUrl!} className="w-full h-[75vh] border-0" title="PDF Preview" />}
            {previewType === 'doc' && (
              <div className="w-full h-full">
                <DocxViewer url={previewUrl!} />
              </div>
            )}
          </div>
        </Modal>

        <Modal isOpen={!!documentDeleteConfirm} onClose={() => setDocumentDeleteConfirm(null)} title="Xác nhận xóa tài liệu" maxWidth="max-w-[400px]">
          <div className="p-4 flex flex-col gap-4">
            <p className="text-text">Bạn có chắc chắn muốn xóa {documentDeleteConfirm?.type === 'contract' ? 'file hợp đồng' : 'ảnh CCCD'} này không? Hành động này không thể hoàn tác.</p>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="ghost" onClick={() => setDocumentDeleteConfirm(null)}>Hủy bỏ</Button>
              <Button className="bg-rose-500 hover:bg-rose-600 text-white" onClick={() => {
                if (documentDeleteConfirm?.type === 'contract') handleRemoveContractFile(documentDeleteConfirm.index);
                else if (documentDeleteConfirm?.type === 'cccd') handleRemoveCCCD(documentDeleteConfirm.index);
                setDocumentDeleteConfirm(null);
              }}>Xác nhận xóa</Button>
            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isSettlementModalOpen}
          onClose={() => setIsSettlementModalOpen(false)}
          title="Quyết toán trả phòng & Thanh lý hợp đồng"
          maxWidth="max-w-[1240px]"
          testId="contract-settlement-modal"
          footer={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between w-full">
              <div className="text-xs text-muted font-medium">
                Vui lòng kiểm tra kỹ đối chiếu điện & các khoản thu/hoàn tiền ở cột bên phải trước khi xác nhận.
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsSettlementModalOpen(false)}>
                  Đóng
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApplyUtilitySnapshot}
                  disabled={!settlementPreview?.utilitySnapshot?.electricity}
                  className="font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Zap size={14} className="text-amber-500" />
                  Áp dụng số điện
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  data-testid="btn-confirm-terminate-settlement"
                  onClick={handleConfirmTermination}
                  isLoading={terminateMutation.isPending}
                  disabled={!settlementPreview || isSettlementPreviewPending}
                  className="font-bold shadow-sm cursor-pointer"
                >
                  Xác nhận chấm dứt
                </Button>
              </div>
            </div>
          }
        >
          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] items-start">
            {/* CỘT TRÁI: FORM NHẬP LIỆU */}
            <div className="space-y-4">

              {/* NHÓM 1: BÀN GIAO & THỜI GIAN */}
              <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50 text-[12px] font-black uppercase tracking-wider text-text">
                  <Calendar size={15} className="text-primary" />
                  <span>1. Thời gian & Trạng thái bàn giao</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Ngày trả phòng thực tế
                    </label>
                    <StyledDateInput
                      testId="contract-settlement-actual-move-out-date"
                      value={settlementForm.actualMoveOutDate}
                      onChange={(val) => updateSettlementField("actualMoveOutDate", val)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Trạng thái bàn giao phòng
                    </label>
                    <Select
                      data-testid="contract-settlement-room-turnover-status"
                      value={settlementForm.roomTurnoverStatus}
                      onChange={(event) => updateSettlementField("roomTurnoverStatus", event.target.value)}
                      options={
                        detailContract?.room?.rentalType === "shared" || detailContract?.room?.rentalType === "SHARED"
                          ? [
                            { label: "Phòng trống / Sẵn sàng đón khách (AVAILABLE)", value: "AVAILABLE" },
                            { label: "Bàn giao bảo trì giường (MAINTENANCE)", value: "MAINTENANCE" },
                            { label: "Bàn giao chờ vệ sinh (CLEANING)", value: "CLEANING" },
                          ]
                          : [
                            { label: "Phòng trống / Sẵn sàng mở bán (AVAILABLE)", value: "AVAILABLE" },
                            { label: "Bàn giao chờ bảo trì (MAINTENANCE)", value: "MAINTENANCE" },
                            { label: "Bàn giao chờ vệ sinh (CLEANING)", value: "CLEANING" },
                          ]
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Số ngày tính tiền phòng
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="31"
                      placeholder="0"
                      value={settlementForm.rentDaysCharged}
                      onChange={(event) => updateSettlementField("rentDaysCharged", event.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* NHÓM 2: KHOẢN THU QUYẾT TOÁN */}
              <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50 text-[12px] font-black uppercase tracking-wider text-text">
                  <Receipt size={15} className="text-primary" />
                  <span>2. Chi phí & Khoản thu quyết toán</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Tiền điện chốt (VNĐ)
                    </label>
                    <Input
                      placeholder="0"
                      value={formatVndInput(settlementForm.electricityAmount)}
                      onChange={(event) => handleMoneyInputChange("electricityAmount", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Chỉ số điện chốt (kWh)
                    </label>
                    <Input
                      placeholder="0"
                      value={settlementForm.electricityClosingKwh}
                      onChange={(event) => updateSettlementField("electricityClosingKwh", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Phí dịch vụ phát sinh (VNĐ)
                    </label>
                    <Input
                      placeholder="0"
                      value={formatVndInput(settlementForm.serviceAmount)}
                      onChange={(event) => handleMoneyInputChange("serviceAmount", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Phí bồi thường hư hỏng (VNĐ)
                    </label>
                    <Input
                      placeholder="0"
                      value={formatVndInput(settlementForm.damageFee)}
                      onChange={(event) => handleMoneyInputChange("damageFee", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Phí phạt vi phạm / trả sớm (VNĐ)
                    </label>
                    <Input
                      placeholder="0"
                      value={formatVndInput(settlementForm.penaltyFee)}
                      onChange={(event) => handleMoneyInputChange("penaltyFee", event.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Khoản thu phát sinh khác (VNĐ)
                    </label>
                    <Input
                      placeholder="0"
                      value={formatVndInput(settlementForm.otherChargeAmount)}
                      onChange={(event) => handleMoneyInputChange("otherChargeAmount", event.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* NHÓM 3: HOÀN TIỀN & CỌC */}
              <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50 text-[12px] font-black uppercase tracking-wider text-text">
                  <ShieldCheck size={15} className="text-emerald-500" />
                  <span>3. Hoàn tiền & Khấu trừ cọc</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Khấu trừ cọc vào công nợ (VNĐ)
                    </label>
                    <Input
                      data-testid="contract-settlement-deposit-deduct"
                      placeholder="0"
                      value={formatVndInput(settlementForm.depositToDeduct)}
                      onChange={(event) => handleMoneyInputChange("depositToDeduct", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Hoàn tiền phòng dư (VNĐ)
                    </label>
                    <Input
                      placeholder="0"
                      value={formatVndInput(settlementForm.roomRefundAmount)}
                      onChange={(event) => handleMoneyInputChange("roomRefundAmount", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Giảm trừ khác (VNĐ)
                    </label>
                    <Input
                      placeholder="0"
                      value={formatVndInput(settlementForm.otherCreditAmount)}
                      onChange={(event) => handleMoneyInputChange("otherCreditAmount", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Tiền cọc hoàn trả khách (VNĐ)
                    </label>
                    <Input
                      data-testid="contract-settlement-deposit-refund"
                      placeholder="0"
                      value={formatVndInput(settlementForm.depositToRefund)}
                      onChange={(event) => handleMoneyInputChange("depositToRefund", event.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Phương thức xử lý phiếu hoàn cọc
                    </label>
                    <Select
                      data-testid="contract-settlement-refund-status"
                      value={settlementForm.refundReceiptStatus}
                      onChange={(event) => updateSettlementField("refundReceiptStatus", event.target.value)}
                      options={[
                        { label: "Hoàn tiền ngay (COMPLETED)", value: "COMPLETED" },
                        { label: "Tạo phiếu chờ duyệt hoàn tiền (PENDING)", value: "PENDING" },
                      ]}
                    />
                  </div>
                </div>
              </div>

              {/* NHÓM 4: GHI CHÚ & CHỨNG TỪ */}
              <div className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-border/50 text-[12px] font-black uppercase tracking-wider text-text">
                  <FileText size={15} className="text-primary" />
                  <span>4. Ghi chú & Hồ sơ chứng từ</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Lý do hoàn tiền / Diễn giải
                    </label>
                    <Textarea
                      data-testid="contract-settlement-refund-reason"
                      placeholder="Nhập lý do hoàn tiền cho khách (nếu có)..."
                      value={settlementForm.refundReason}
                      onChange={(event) => updateSettlementField("refundReason", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      URL chứng từ hoàn tiền / Biên bản bàn giao (cách nhau bởi dấu phẩy hoặc xuống dòng)
                    </label>
                    <Textarea
                      placeholder="https://... hoặc đường dẫn hình ảnh chứng từ"
                      value={settlementForm.refundAttachmentUrls}
                      onChange={(event) => updateSettlementField("refundAttachmentUrls", event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
                      Ghi chú quyết toán nội bộ
                    </label>
                    <Textarea
                      placeholder="Ghi chú thêm cho kế toán / quản lý..."
                      value={settlementForm.note}
                      onChange={(event) => updateSettlementField("note", event.target.value)}
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* CỘT PHẢI: BẢNG ĐỐI CHIẾU & TỔNG QUAN */}
            <div className="space-y-4">

              {/* 1. KHỐI TỔNG KẾT QUYẾT TOÁN / SỐ TIỀN CÒN LẠI HOÀN HOẶC NỘP THÊM */}
              {(() => {
                const refundToCustomer = settlementPreview?.totals?.refundToCustomer || 0;
                const netReceivable = settlementPreview?.totals?.netReceivable || 0;
                const chargeTotal = settlementPreview?.totals?.chargeTotal || 0;
                const creditTotal = settlementPreview?.totals?.creditTotal || 0;

                if (refundToCustomer > 0) {
                  return (
                    <div className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-card p-4 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                          KẾT QUẢ QUYẾT TOÁN
                        </span>
                        <Badge variant="success" className="px-2.5 py-0.5 font-black text-[11px]">
                          HOÀN TRẢ KHÁCH
                        </Badge>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                          Số tiền còn lại phải hoàn trả khách
                        </span>
                        <div className="mt-1 text-3xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(refundToCustomer)}
                        </div>
                        <div className="mt-2 text-[11px] text-muted font-medium pt-2 border-t border-emerald-500/20 flex flex-wrap items-center justify-between gap-1">
                          <span>Tổng cọc & giảm trừ: <b className="font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(creditTotal)}</b></span>
                          <span>Trừ tổng thu: <b className="font-mono text-text">{formatCurrency(chargeTotal)}</b></span>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (netReceivable > 0) {
                  return (
                    <div className="rounded-2xl border-2 border-rose-500/50 bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-card p-4 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                          <Receipt size={16} className="text-rose-600 dark:text-rose-400" />
                          KẾT QUẢ QUYẾT TOÁN
                        </span>
                        <Badge variant="error" className="px-2.5 py-0.5 font-black text-[11px]">
                          KHÁCH CẦN NỘP THÊM
                        </Badge>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                          Số tiền khách cần nộp thêm
                        </span>
                        <div className="mt-1 text-3xl font-mono font-black text-rose-600 dark:text-rose-400">
                          {formatCurrency(netReceivable)}
                        </div>
                        <div className="mt-2 text-[11px] text-muted font-medium pt-2 border-t border-rose-500/20 flex flex-wrap items-center justify-between gap-1">
                          <span>Tổng khoản thu: <b className="font-mono text-rose-600 dark:text-rose-400">{formatCurrency(chargeTotal)}</b></span>
                          <span>Trừ tổng cọc & giảm trừ: <b className="font-mono text-text">{formatCurrency(creditTotal)}</b></span>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="rounded-2xl border border-border/80 bg-surface/60 p-4 space-y-1">
                    <span className="text-xs font-black uppercase tracking-wider text-muted block">KẾT QUẢ QUYẾT TOÁN</span>
                    <div className="text-2xl font-mono font-black text-text">0đ</div>
                    <span className="text-xs text-muted">Không phát sinh công nợ hoặc tiền hoàn.</span>
                  </div>
                );
              })()}

              {/* 2. KPI CARDS: TỔNG KHOẢN THU & TỔNG GIẢM TRỪ */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs">
                  <div className="text-[11px] font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <Coins size={14} className="text-primary" />
                    Tổng khoản thu
                  </div>
                  <div className="mt-1.5 text-xl font-mono font-black text-text">
                    {formatCurrency(settlementPreview?.totals?.chargeTotal)}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 shadow-2xs">
                  <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    Tổng giảm trừ
                  </div>
                  <div className="mt-1.5 text-xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(settlementPreview?.totals?.creditTotal)}
                  </div>
                </div>
              </div>

              {/* 3. CHI TIẾT CÁC KHOẢN THU */}
              <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
                <div className="border-b border-border/70 px-4 py-2.5 bg-surface/50 flex items-center justify-between">
                  <span className="text-xs font-black text-text uppercase tracking-wide">Chi tiết các khoản thu</span>
                  <span className="text-[11px] font-bold text-muted">{(settlementPreview?.charges || []).length} mục</span>
                </div>
                <div className="divide-y divide-border/50">
                  {(settlementPreview?.charges || []).length > 0 ? (
                    settlementPreview.charges.map((item: any) => (
                      <div key={item.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                        <span className="text-muted font-medium">{item.description}</span>
                        <span className="font-mono font-black text-text">{formatCurrency(item.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-xs text-muted text-center">Chưa có khoản thu phát sinh.</div>
                  )}
                </div>
              </div>

              {/* 4. CHI TIẾT HOÀN & GIẢM TRỪ */}
              <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs" data-testid="contract-settlement-credits">
                <div className="border-b border-border/70 px-4 py-2.5 bg-surface/50 flex items-center justify-between">
                  <span className="text-xs font-black text-text uppercase tracking-wide">Chi tiết hoàn & giảm trừ</span>
                  <span className="text-[11px] font-bold text-muted">{(settlementPreview?.credits || []).length} mục</span>
                </div>
                <div className="divide-y divide-border/50">
                  {(settlementPreview?.credits || []).length > 0 ? (
                    settlementPreview.credits.map((item: any) => (
                      <div key={item.key} data-testid={`contract-settlement-credit-${item.key}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                        <span className="text-muted font-medium">{item.description}</span>
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(item.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-xs text-muted text-center">Chưa có khoản hoàn hoặc giảm trừ.</div>
                  )}
                </div>
              </div>

              {/* 5. ĐỐI CHIẾU ĐIỆN THÔNG MINH HUNONIC */}
              <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-card via-amber-500/[0.03] to-card overflow-hidden shadow-2xs">
                <div className="border-b border-border/70 px-4 py-3 bg-amber-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap size={16} className="text-amber-500" />
                    <span className="text-xs font-black text-text uppercase tracking-wide">Đối chiếu điện Hunonic</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncElectricity}
                    disabled={isSyncingHunonic}
                    className="h-7 px-2.5 text-[11px] font-bold bg-card border-amber-500/40 text-amber-600 hover:bg-amber-500/10 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <RefreshCw size={12} className={isSyncingHunonic ? "animate-spin" : ""} />
                    {isSyncingHunonic ? "Đang đồng bộ..." : "Đồng bộ công tơ"}
                  </Button>
                </div>

                {settlementPreview?.utilitySnapshot?.electricity ? (
                  <div className="p-4 space-y-3">
                    {/* Banner phòng ghép */}
                    {settlementPreview.utilitySnapshot.electricity.isSharedRoom && (() => {
                      const elec = settlementPreview.utilitySnapshot.electricity;
                      const effectiveOccupants = customSharedOccupants ?? (elec.activeOccupants || 1);
                      const totalAmount = Number(elec.totalCalculatedAmountVnd || elec.totalRoomAmountVnd || elec.calculatedAmountVnd || 0);
                      const totalKwh = Number(elec.totalRoomMonthKwh || elec.monthKwh || 0);
                      const myAmount = Math.round(totalAmount / Math.max(1, effectiveOccupants));
                      const myKwh = Math.round((totalKwh / Math.max(1, effectiveOccupants)) * 100) / 100;

                      return (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-black text-amber-700 dark:text-amber-300">
                              <Users size={14} className="text-amber-600" />
                              <span>Phòng ghép (Dorm) · Chia tiền điện</span>
                            </div>
                            <div className="flex items-center gap-1 bg-card rounded-lg border border-border px-2 py-0.5 shadow-2xs">
                              <span className="text-[10px] font-bold text-muted uppercase">Chia cho:</span>
                              <button
                                type="button"
                                disabled={effectiveOccupants <= 1}
                                onClick={() => setCustomSharedOccupants(Math.max(1, effectiveOccupants - 1))}
                                className="w-5 h-5 flex items-center justify-center rounded bg-surface hover:bg-surface-hover text-text font-bold text-xs disabled:opacity-30 cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-mono font-black text-xs px-1 text-text">{effectiveOccupants}</span>
                              <button
                                type="button"
                                onClick={() => setCustomSharedOccupants(effectiveOccupants + 1)}
                                className="w-5 h-5 flex items-center justify-center rounded bg-surface hover:bg-surface-hover text-text font-bold text-xs cursor-pointer"
                              >
                                +
                              </button>
                              <span className="text-[10px] text-muted font-medium">người</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-amber-500/20">
                            <div>
                              <span className="text-[10px] text-muted block">Tổng cả phòng:</span>
                              <span className="font-mono font-bold text-text text-xs">
                                {formatCurrency(totalAmount)}
                              </span>
                              <span className="text-[10px] text-muted block">
                                ({totalKwh.toLocaleString("vi-VN")} kWh)
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold block">
                                Phần khách (1/{effectiveOccupants}):
                              </span>
                              <span className="font-mono font-black text-amber-600 text-sm">
                                {formatCurrency(myAmount)}
                              </span>
                              <span className="text-[10px] text-muted block font-mono">
                                ({myKwh} kWh)
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2.5 rounded-lg bg-surface/60 border border-border/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">Công tơ</span>
                        <span className="text-xs font-black text-text mt-0.5 block truncate">{settlementPreview.utilitySnapshot.electricity.displayName}</span>
                        <span className="text-[10px] text-muted truncate block">{settlementPreview.utilitySnapshot.electricity.deviceName || "Hunonic Meter"}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-surface/60 border border-border/60">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">Mốc đọc gần nhất</span>
                        <span className="text-xs font-black text-text mt-0.5 block">{formatDateTime(settlementPreview.utilitySnapshot.electricity.readingAt)}</span>
                        <span className="text-[10px] text-muted block">{settlementPreview.utilitySnapshot.electricity.source}</span>
                      </div>
                    </div>

                    {!settlementPreview.utilitySnapshot.electricity.isSharedRoom && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-2.5 rounded-lg bg-surface/60 border border-border/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">kWh tháng hiện tại</span>
                          <span className="text-base font-mono font-black text-text mt-0.5 block">
                            {Number(settlementPreview.utilitySnapshot.electricity.monthKwh || 0).toLocaleString("vi-VN")} kWh
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-surface/60 border border-border/60">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">Tiền điện tạm tính</span>
                          <span className="text-base font-mono font-black text-amber-600 mt-0.5 block">
                            {formatCurrency(settlementPreview.utilitySnapshot.electricity.calculatedAmountVnd || settlementPreview.utilitySnapshot.electricity.monthAmountVnd)}
                          </span>
                          <span className="text-[9px] text-muted block truncate">
                            {settlementPreview.utilitySnapshot.electricity.rateMode
                              ? `${settlementPreview.utilitySnapshot.electricity.rateMode} · ${settlementPreview.utilitySnapshot.electricity.calculationSource || ""}`
                              : "Theo số tiền Hunonic"}
                          </span>
                        </div>
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleApplyUtilitySnapshot}
                      className="w-full text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 py-1.5 h-auto flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Zap size={13} />
                      {settlementPreview.utilitySnapshot.electricity.isSharedRoom
                        ? "Áp dụng phần tiền điện của khách vào biểu mẫu"
                        : "Áp dụng số điện này vào biểu mẫu"}
                    </Button>
                  </div>
                ) : (
                  <div className="p-5 text-center text-xs text-muted">
                    Chưa có snapshot điện Hunonic cho phòng này trước ngày trả phòng. Bạn có thể bấm nút <b>Đồng bộ công tơ</b> ở trên để cập nhật mới nhất.
                  </div>
                )}
              </div>

              {/* 6. TRẠNG THÁI BÀN GIAO */}
              <div className="rounded-xl border border-border/80 bg-card p-3 shadow-2xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                    Trạng thái phòng sau bàn giao
                  </span>
                  <span className="text-xs font-black text-text mt-0.5 block">
                    {settlementPreview?.roomTurnoverStatus === "MAINTENANCE"
                      ? "Bảo trì trước khi mở bán"
                      : settlementPreview?.roomTurnoverStatus === "CLEANING"
                        ? "Vệ sinh trước khi mở bán"
                        : "Phòng trống (Sẵn sàng mở bán)"}
                  </span>
                </div>
                <Badge
                  variant={
                    settlementPreview?.roomTurnoverStatus === "MAINTENANCE"
                      ? "warning"
                      : settlementPreview?.roomTurnoverStatus === "CLEANING"
                        ? "primary"
                        : "success"
                  }
                >
                  {settlementPreview?.roomTurnoverStatus || "AVAILABLE"}
                </Badge>
              </div>

            </div>
          </div>
        </Modal>

        <Modal
          isOpen={isRefundCompletionModalOpen}
          onClose={() => {
            if (completePendingRefundMutation.isPending) return;
            setIsRefundCompletionModalOpen(false);
          }}
          title="Xac nhan hoan tien quyet toan"
          maxWidth="max-w-lg"
          testId="contract-settlement-refund-complete-modal"
          footer={
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setIsRefundCompletionModalOpen(false)}
                disabled={completePendingRefundMutation.isPending}
              >
                Dong
              </Button>
              <Button data-testid="contract-settlement-refund-complete-submit" onClick={handleCompletePendingRefund} isLoading={completePendingRefundMutation.isPending}>
                Xac nhan hoan tat
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border/70 bg-surface p-4">
              <div className="text-sm font-semibold text-text">
                Xac nhan nay se chuyen receipt hoan tien sang COMPLETED va dong task theo doi.
              </div>
              <div className="mt-2 text-sm text-muted">
                So tien: <span className="font-black text-text">{formatCurrency(settlementRefund?.receiptAmount || 0)}</span>
              </div>
              <div className="mt-1 text-sm text-muted">
                Ma phieu: <span className="font-black text-text">{settlementRefund?.receiptCode || "Chua co"}</span>
              </div>
            </div>
            <Textarea
              data-testid="contract-settlement-refund-complete-note"
              placeholder="Ghi chu xac nhan chuyen khoan, ma giao dich, nguoi thuc hien..."
              value={refundCompletionNote}
              onChange={(event) => setRefundCompletionNote(event.target.value)}
            />
          </div>
        </Modal>

        <DocumentScannerModal
          isOpen={isScannerOpen}
          onClose={() => {
            setIsScannerOpen(false);
            setScannerFile(null);
            setScannerOnSaveCallback(null);
          }}
          file={scannerFile}
          onSave={(scanned) => {
            if (scannerOnSaveCallback) {
              scannerOnSaveCallback(scanned);
            }
          }}
        />
      </Modal>
    </>
  );
}
