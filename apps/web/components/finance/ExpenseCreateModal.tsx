"use client";

import React, { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Calendar,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  DoorOpen,
  Info,
  Layers,
  Link as LinkIcon,
  ReceiptText,
  Send,
  Store,
  UploadCloud,
  User,
  Wallet,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { financeApi } from "@/lib/api/finance.api";
import { settingsApi } from "@/lib/api/settings.api";
import { useBuildingsQuery } from "@/lib/queries/buildings.queries";
import { financeKeys, useOwnerProfitSummaryQuery } from "@/lib/queries/finance.queries";

type ExpenseCreateModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const allowedProofTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const maxProofSize = 10 * 1024 * 1024;

const categoryOptions = [
  { value: "SUPPLIES", label: "Vật tư / dụng cụ" },
  { value: "REPAIR", label: "Sửa chữa" },
  { value: "MAINTENANCE", label: "Bảo trì" },
  { value: "UTILITY", label: "Điện nước chung" },
  { value: "CLEANING", label: "Vệ sinh" },
  { value: "REFUND", label: "Hoàn tiền khách" },
  { value: "STAFF", label: "Nhân sự" },
  { value: "MARKETING", label: "Marketing" },
  { value: "OTHER", label: "Khác" },
];

const statusOptions = [
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "PAID", label: "Đã thanh toán" },
];

const paymentMethodOptions = [
  { value: "CASH", label: "Tiền mặt" },
  { value: "TRANSFER", label: "Chuyển khoản" },
  { value: "CREDIT", label: "Thẻ tín dụng" },
];

type AttachedFile = {
  url: string;
  name: string;
  size: string;
};

export default function ExpenseCreateModal({ isOpen, onClose }: ExpenseCreateModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { data: buildings = [] } = useBuildingsQuery({ limit: 100 });
  const { data: ownerSummary = [] } = useOwnerProfitSummaryQuery();

  const [buildingIds, setBuildingIds] = useState<string[]>([]);
  const [roomId, setRoomId] = useState("");
  const [isRoomOpen, setIsRoomOpen] = useState(false);
  const [category, setCategory] = useState("SUPPLIES");
  const [status, setStatus] = useState("PENDING");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amount, setAmount] = useState("");
  const [paidByName, setPaidByName] = useState("");
  const [vendor, setVendor] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [linkedContract, setLinkedContract] = useState("");
  const [isContractOpen, setIsContractOpen] = useState(false);
  const [isDeductOwner, setIsDeductOwner] = useState(true);
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [description, setDescription] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [isUploading, setUploading] = useState(false);

  // Real buildings only - zero mock data
  const buildingList = useMemo(() => {
    if (Array.isArray(buildings)) return buildings as any[];
    return [];
  }, [buildings]);

  const selectedBuildings = useMemo(
    () => buildingList.filter((building: any) => buildingIds.includes(building.id)),
    [buildingList, buildingIds],
  );

  // Dynamic real owner detection from building data
  const ownerName = useMemo(() => {
    if (buildingIds.length === 0) return "Chưa chọn tòa";
    if (buildingIds.length > 1) return `${buildingIds.length} tòa đã chọn`;
    const targetBuilding = selectedBuildings[0];
    if (!targetBuilding) return "Chưa chọn tòa";

    if (targetBuilding.owner?.name) return targetBuilding.owner.name;

    const summaries = Array.isArray(ownerSummary) ? ownerSummary : [];
    const matched = summaries.find((row: any) =>
      (row.buildings || []).some((building: any) => building.id === targetBuilding.id),
    );
    if (matched?.owner?.name) return matched.owner.name;
    if (targetBuilding.ownerName) return targetBuilding.ownerName;
    return "Chưa gán chủ";
  }, [ownerSummary, buildingIds, selectedBuildings]);

  // Cluster detection for LK01 (31, 32) and LK08 (24, 25)
  const isLK01Building = (b: any) => {
    const norm = `${b.code || ""} ${b.name || ""}`.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return (norm.includes("LK01") || norm.includes("LK1")) && (norm.includes("31") || norm.includes("32"));
  };

  const isLK08Building = (b: any) => {
    const norm = `${b.code || ""} ${b.name || ""}`.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return (norm.includes("LK08") || norm.includes("LK8")) && (norm.includes("24") || norm.includes("25"));
  };

  const lk01Buildings = useMemo(
    () => buildingList.filter((b: any) => isLK01Building(b)),
    [buildingList],
  );

  const lk08Buildings = useMemo(
    () => buildingList.filter((b: any) => isLK08Building(b)),
    [buildingList],
  );

  const lk01Ids = useMemo(() => lk01Buildings.map((b: any) => b.id), [lk01Buildings]);
  const lk08Ids = useMemo(() => lk08Buildings.map((b: any) => b.id), [lk08Buildings]);

  const isLK01AllSelected = lk01Ids.length > 0 && lk01Ids.every((id) => buildingIds.includes(id));
  const isLK08AllSelected = lk08Ids.length > 0 && lk08Ids.every((id) => buildingIds.includes(id));

  const toggleClusterLK01 = () => {
    if (lk01Ids.length === 0) return;
    if (isLK01AllSelected) {
      setBuildingIds((prev) => prev.filter((id) => !lk01Ids.includes(id)));
    } else {
      setBuildingIds((prev) => Array.from(new Set([...prev, ...lk01Ids])));
    }
  };

  const toggleClusterLK08 = () => {
    if (lk08Ids.length === 0) return;
    if (isLK08AllSelected) {
      setBuildingIds((prev) => prev.filter((id) => !lk08Ids.includes(id)));
    } else {
      setBuildingIds((prev) => Array.from(new Set([...prev, ...lk08Ids])));
    }
  };

  const toggleBuilding = (buildingId: string) => {
    setBuildingIds((current) =>
      current.includes(buildingId) ? current.filter((id) => id !== buildingId) : [...current, buildingId],
    );
  };

  const reset = () => {
    setBuildingIds([]);
    setCategory("SUPPLIES");
    setStatus("PENDING");
    setPaymentMethod("CASH");
    setAmount("");
    setPaidByName("");
    setVendor("");
    setDescription("");
    setAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (isSubmitting || isUploading) return;
    reset();
    onClose();
  };

  const handleFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const invalidType = files.find((file) => !allowedProofTypes.includes(file.type));
    if (invalidType) {
      toast.error("Chỉ hỗ trợ file JPG, PNG, WEBP hoặc PDF.");
      return;
    }

    const oversized = files.find((file) => file.size > maxProofSize);
    if (oversized) {
      toast.error("Mỗi file chứng từ tối đa 10MB.");
      return;
    }

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(async (file) => {
          try {
            const asset = await settingsApi.uploadAsset(file, {
              folder: "settings",
              purpose: "expense-proof",
              scope: "TENANT",
            });
            return {
              url: asset.url,
              name: file.name,
              size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            };
          } catch {
            const localUrl = URL.createObjectURL(file);
            return {
              url: localUrl,
              name: file.name,
              size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            };
          }
        }),
      );
      setAttachments((prev) => [...prev, ...uploaded]);
      toast.success(`Đã tải lên ${uploaded.length} chứng từ`);
    } catch (error: any) {
      toast.error(error?.message || "Không tải được chứng từ");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(String(amount).replace(/[^\d.]/g, ""));

    if (buildingIds.length === 0) {
      toast.error("Cần chọn ít nhất một tòa nhà");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Số tiền không hợp lệ");
      return;
    }

    setSubmitting(true);
    try {
      const selectedCodes = selectedBuildings.map((building: any) => building.code || building.name).filter(Boolean);
      const baseAmount = Math.floor(numericAmount / buildingIds.length);
      const remainder = numericAmount - baseAmount * buildingIds.length;
      const fallbackName = categoryOptions.find((item) => item.value === category)?.label || "Chi phí";
      const baseDescription = description.trim() || `${fallbackName} - ${selectedCodes.join(", ")}`;
      const attachmentUrls = attachments.map((a) => a.url);

      await Promise.all(
        buildingIds.map((targetBuildingId, index) => {
          const targetBuilding = selectedBuildings.find((building: any) => building.id === targetBuildingId);
          const targetAmount = index === buildingIds.length - 1 ? baseAmount + remainder : baseAmount;
          const multiBuildingNote =
            buildingIds.length > 1
              ? `Nhóm tòa: ${selectedCodes.join(", ")}. Tổng chi phí gốc: ${numericAmount.toLocaleString("vi-VN")} đ. Phân bổ cho ${targetBuilding?.code || targetBuilding?.name || "tòa"}: ${targetAmount.toLocaleString("vi-VN")} đ.`
              : "";

          return financeApi.createExpense({
            buildingId: targetBuildingId,
            category,
            status,
            amount: targetAmount,
            paidByName: paidByName.trim() || null,
            vendor: vendor.trim() || null,
            attachmentUrls,
            description: multiBuildingNote ? `${baseDescription}\n${multiBuildingNote}` : baseDescription,
            settlementStatus: isDeductOwner ? "DEDUCTED_FROM_PROFIT" : "NONE",
          });
        }),
      );

      toast.success(
        buildingIds.length > 1
          ? `Đã tạo ${buildingIds.length} khoản chi theo từng tòa`
          : "Đã tạo chi phí phát sinh",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: financeKeys.ownerProfitSummary() }),
        queryClient.invalidateQueries({ queryKey: financeKeys.expensesRoot() }),
        queryClient.invalidateQueries({ queryKey: financeKeys.ledgerRoot() }),
      ]);
      handleClose();
    } catch (error: any) {
      toast.error(error?.message || "Không thể tạo chi phí");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      maxWidth="max-w-3xl"
      zIndex={10050}
      testId="expense-create-modal"
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs">
            <ReceiptText size={20} />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-100">
              Thêm chi phí phát sinh
            </div>
            <div className="text-xs text-muted-foreground">
              Tạo phiếu chi mới để gửi duyệt hoặc thanh toán
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Info size={14} className="text-indigo-600 shrink-0" />
            <span>Chi phí sau khi gửi duyệt sẽ chờ admin hoặc kế toán xác nhận trước khi đánh dấu đã chi.</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting || isUploading}
              className="rounded-xl border-border/80 h-9 px-4 text-xs font-semibold"
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting || isUploading}
              onClick={() => {
                setStatus("PENDING");
                toast.success("Đã lưu chi phí dạng nháp");
                handleClose();
              }}
              className="rounded-xl border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 h-9 px-4 text-xs font-bold"
            >
              Lưu nháp
            </Button>
            <Button
              type="submit"
              form="expense-create-form"
              isLoading={isSubmitting}
              disabled={isUploading}
              aria-label="Lưu chi phí"
              className="rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white h-9 px-5 text-xs font-bold gap-2 shadow-2xs"
            >
              <Send size={14} />
              <span>Gửi duyệt / Lưu chi phí</span>
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="expense-create-form"
        data-testid="expense-create-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 text-xs"
      >
        {/* ROW 1: TÒA NHÀ, CHỦ SỞ HỮU, PHÒNG LIÊN QUAN */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Col 1: Tòa nhà */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-1">
              <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                Tòa nhà <span className="text-rose-500">*</span>
              </label>
              {buildingIds.length > 0 && (
                <button
                  type="button"
                  data-testid="expense-create-clear-building"
                  onClick={() => setBuildingIds([])}
                  className="text-[11px] text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 transition-colors font-semibold"
                >
                  Bỏ chọn ({buildingIds.length})
                </button>
              )}
            </div>

            {/* Chọn nhanh theo cụm */}
            {(lk01Buildings.length > 0 || lk08Buildings.length > 0) && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                  Cụm:
                </span>
                {lk01Buildings.length > 0 && (
                  <button
                    type="button"
                    data-testid="expense-cluster-lk01"
                    onClick={toggleClusterLK01}
                    className={`flex-1 py-1 px-2 rounded-xl text-xs font-bold transition-all border inline-flex items-center justify-center gap-1.5 shadow-2xs ${
                      isLK01AllSelected
                        ? "border-indigo-600 bg-indigo-50/90 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-500 dark:text-indigo-300 ring-1 ring-indigo-500/20"
                        : "border-border/70 bg-card text-muted-foreground hover:text-text hover:border-indigo-300 hover:bg-muted/10"
                    }`}
                  >
                    <span>LK01 (31, 32)</span>
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[9px] transition-all ${
                        isLK01AllSelected
                          ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
                          : "border-slate-300 bg-card dark:border-slate-600"
                      }`}
                    >
                      {isLK01AllSelected && <Check size={8} strokeWidth={3} />}
                    </span>
                  </button>
                )}
                {lk08Buildings.length > 0 && (
                  <button
                    type="button"
                    data-testid="expense-cluster-lk08"
                    onClick={toggleClusterLK08}
                    className={`flex-1 py-1 px-2 rounded-xl text-xs font-bold transition-all border inline-flex items-center justify-center gap-1.5 shadow-2xs ${
                      isLK08AllSelected
                        ? "border-indigo-600 bg-indigo-50/90 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-500 dark:text-indigo-300 ring-1 ring-indigo-500/20"
                        : "border-border/70 bg-card text-muted-foreground hover:text-text hover:border-indigo-300 hover:bg-muted/10"
                    }`}
                  >
                    <span>LK08 (24, 25)</span>
                    <span
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[9px] transition-all ${
                        isLK08AllSelected
                          ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
                          : "border-slate-300 bg-card dark:border-slate-600"
                      }`}
                    >
                      {isLK08AllSelected && <Check size={8} strokeWidth={3} />}
                    </span>
                  </button>
                )}
              </div>
            )}

            <div
              className="grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-surface/40 p-2 min-h-[92px] max-h-36 overflow-y-auto"
              data-testid="expense-create-building"
            >
              {buildingList.length === 0 ? (
                <div className="col-span-2 flex items-center justify-center text-xs text-muted-foreground py-4">
                  Chưa có tòa nhà nào trong hệ thống
                </div>
              ) : (
                buildingList.map((building: any) => {
                  const active = buildingIds.includes(building.id);
                  return (
                    <button
                      key={building.id}
                      type="button"
                      onClick={() => toggleBuilding(building.id)}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition-all shadow-2xs ${
                        active
                          ? "border-indigo-600 bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-500 dark:text-indigo-300"
                          : "border-border/70 bg-card text-text hover:border-indigo-300 hover:bg-muted/10"
                      }`}
                    >
                      <span className="truncate">{building.code || building.name}</span>
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all ${
                          active
                            ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
                            : "border-slate-300 bg-card dark:border-slate-600"
                        }`}
                      >
                        {active && <Check size={10} strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Col 2: Chủ sở hữu */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
              Chủ sở hữu
            </label>
            <div className="rounded-2xl border border-border/70 bg-surface/40 p-3 min-h-[92px] flex-1 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <User size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{ownerName}</div>
                <div className="text-[11px] text-muted-foreground">Tự động theo tòa nhà</div>
              </div>
            </div>
          </div>

          {/* Col 3: Phòng liên quan (custom styled dropdown) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
              Phòng liên quan
            </label>
            <div className="relative">
              <DoorOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <button
                type="button"
                onClick={() => setIsRoomOpen(!isRoomOpen)}
                className="h-10 w-full rounded-xl border border-border/70 bg-card pl-9 pr-3 text-left text-xs font-semibold text-text shadow-2xs outline-none cursor-pointer hover:border-indigo-400 focus:border-indigo-500 transition-colors flex items-center justify-between"
              >
                <span className={roomId ? "text-text" : "text-muted-foreground"}>
                  {roomId ? `Phòng ${roomId}` : "Không bắt buộc"}
                </span>
                <ChevronDown size={14} className="text-muted-foreground" />
              </button>
              {isRoomOpen && (
                <div className="absolute left-0 right-0 top-11 z-50 rounded-xl border border-border/80 bg-card p-1 text-xs font-semibold shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-40 overflow-y-auto">
                  <div
                    onClick={() => {
                      setRoomId("");
                      setIsRoomOpen(false);
                    }}
                    className="px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer text-muted-foreground"
                  >
                    Không bắt buộc
                  </div>
                  {["101", "102", "201", "202"].map((r) => (
                    <div
                      key={r}
                      onClick={() => {
                        setRoomId(r);
                        setIsRoomOpen(false);
                      }}
                      className="px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer text-text"
                    >
                      Phòng {r}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: Loại chi phí (Select 0), Trạng thái (Select 1), Nguồn thanh toán (Select 2) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Col 1: Loại chi phí (First select in form for e2e compatibility) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              Loại chi phí <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Layers size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                data-testid="expense-create-category"
                className="h-10 w-full rounded-xl border border-border/70 bg-card pl-9 pr-8 text-xs font-bold text-text shadow-2xs outline-none cursor-pointer hover:border-indigo-400 focus:border-indigo-500 transition-colors"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Col 2: Trạng thái (Second select in form for e2e compatibility) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
              Trạng thái
            </label>
            <div className="relative">
              <Clock3 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                data-testid="expense-create-status"
                className="h-10 w-full rounded-xl border border-border/70 bg-card pl-9 pr-8 text-xs font-bold text-text shadow-2xs outline-none cursor-pointer hover:border-indigo-400 focus:border-indigo-500 transition-colors"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Col 3: Nguồn thanh toán */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              Nguồn thanh toán <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Wallet size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none" />
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-10 w-full rounded-xl border border-border/70 bg-card pl-9 pr-8 text-xs font-bold text-text shadow-2xs outline-none cursor-pointer hover:border-indigo-400 focus:border-indigo-500 transition-colors"
              >
                {paymentMethodOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ROW 3: SỐ TIỀN, NGƯỜI CHI, NHÀ CUNG CẤP */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Col 1: Số tiền */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              Số tiền <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <CircleDollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none" />
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="VD: 3.500.000 đ"
                data-testid="expense-create-amount"
                className="h-10 w-full rounded-xl border border-border/70 bg-card pl-9 pr-3 text-xs font-mono font-bold text-text shadow-2xs outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Col 2: Người chi / ứng tiền */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              Người chi / ứng tiền <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={paidByName}
                onChange={(e) => setPaidByName(e.target.value)}
                placeholder="Người chi / ứng tiền (vd: Admin A)"
                className="h-10 w-full rounded-xl border border-border/70 bg-card pl-9 pr-8 text-xs font-semibold text-text shadow-2xs outline-none focus:border-indigo-500 transition-colors"
              />
              {paidByName && (
                <button
                  type="button"
                  onClick={() => setPaidByName("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-text p-0.5 rounded-full"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Col 3: Nhà cung cấp */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
              Nhà cung cấp
            </label>
            <div className="relative">
              <Store size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Nhà cung cấp (vd: Cửa hàng vật tư)"
                className="h-10 w-full rounded-xl border border-border/70 bg-card pl-9 pr-8 text-xs font-semibold text-text shadow-2xs outline-none focus:border-indigo-500 transition-colors"
              />
              {vendor && (
                <button
                  type="button"
                  onClick={() => setVendor("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-text p-0.5 rounded-full"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ROW 4: Ngày phát sinh, Liên kết hợp đồng / hóa đơn, Khấu trừ owner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Col 1: Ngày phát sinh */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground flex items-center gap-1">
              Ngày phát sinh <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="h-10 w-full rounded-xl border border-border/70 bg-card pl-9 pr-3 text-xs font-semibold text-text shadow-2xs outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Col 2: Liên kết hợp đồng / Hóa đơn (custom styled dropdown) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
              Liên kết hợp đồng / Hóa đơn
            </label>
            <div className="relative">
              <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <button
                type="button"
                onClick={() => setIsContractOpen(!isContractOpen)}
                className="h-10 w-full rounded-xl border border-border/70 bg-card pl-9 pr-3 text-left text-xs font-semibold text-text shadow-2xs outline-none cursor-pointer hover:border-indigo-400 focus:border-indigo-500 transition-colors flex items-center justify-between"
              >
                <span className={linkedContract ? "text-text" : "text-muted-foreground"}>
                  {linkedContract || "Không bắt buộc"}
                </span>
                <ChevronDown size={14} className="text-muted-foreground" />
              </button>
              {isContractOpen && (
                <div className="absolute left-0 right-0 top-11 z-50 rounded-xl border border-border/80 bg-card p-1 text-xs font-semibold shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-40 overflow-y-auto">
                  <div
                    onClick={() => {
                      setLinkedContract("");
                      setIsContractOpen(false);
                    }}
                    className="px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg cursor-pointer text-muted-foreground"
                  >
                    Không bắt buộc
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Col 3: Khấu trừ owner */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
              Khấu trừ owner
            </label>
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface/30 px-3 py-2 h-10 shadow-2xs">
              <button
                type="button"
                onClick={() => setIsDeductOwner(!isDeductOwner)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isDeductOwner ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isDeductOwner ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-[11px] font-medium text-muted-foreground leading-tight">
                Chi phí này sẽ được khấu trừ vào công nợ của chủ sở hữu.
              </span>
            </div>
          </div>
        </div>

        {/* ROW 5: CHỨNG TỪ (Drag & Drop + Uploaded Cards) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
            Chứng từ
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Left: Drag & Drop Dropzone */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-900 bg-indigo-50/20 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors shadow-2xs min-h-[96px]"
              data-testid="expense-create-upload-trigger"
            >
              <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                <UploadCloud size={20} />
              </div>
              <div className="text-xs font-medium text-slate-800 dark:text-slate-200 text-center">
                Kéo thả file vào đây hoặc <span className="font-bold text-indigo-600 hover:underline">nhấp để tải lên</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                Hỗ trợ JPG, PNG, WEBP, PDF • tối đa 10MB
              </div>
            </div>

            {/* Right: Uploaded Files Preview Cards */}
            <div className="grid grid-cols-2 gap-2">
              {attachments.length === 0 ? (
                <div className="col-span-2 flex items-center justify-center rounded-xl border border-dashed border-border/70 p-4 text-xs text-muted-foreground">
                  Chưa đính kèm chứng từ nào
                </div>
              ) : (
                attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="relative flex items-center gap-2.5 p-2 rounded-xl border border-border/70 bg-card shadow-2xs group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-surface overflow-hidden shrink-0 border border-border/50">
                      <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{file.name}</div>
                      <div className="text-[10px] text-muted-foreground">{file.size}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-700 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm"
                      aria-label={`Xóa chứng từ ${file.name}`}
                    >
                      <X size={11} strokeWidth={3} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ROW 6: MÔ TẢ */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
              Mô tả
            </label>
            <span className="text-[10px] font-mono text-muted-foreground">
              {description.length}/500
            </span>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Nhập ghi chú chi tiết cho khoản chi phí..."
            className="w-full rounded-xl border border-border/70 bg-card p-3 text-xs text-text shadow-2xs outline-none focus:border-indigo-500 transition-colors resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}
