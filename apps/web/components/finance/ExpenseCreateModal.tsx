"use client";

import React, { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Paperclip, ReceiptText, UploadCloud, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { financeApi } from "@/lib/api/finance.api";
import { settingsApi } from "@/lib/api/settings.api";
import { useBuildingsQuery } from "@/lib/queries/buildings.queries";
import { financeKeys, useOwnerProfitSummaryQuery } from "@/lib/queries/finance.queries";

type ExpenseCreateModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const allowedProofTypes = ["image/jpeg", "image/png", "image/webp"];
const maxProofSize = 2 * 1024 * 1024;

const categoryOptions = [
  { value: "SUPPLIES", label: "Vật tư / dụng cụ" },
  { value: "REPAIR", label: "Sửa chữa" },
  { value: "MAINTENANCE", label: "Bảo trì" },
  { value: "UTILITY", label: "Điện nước chung" },
  { value: "CLEANING", label: "Vệ sinh" },
  { value: "REFUND", label: "Hoàn tiền khách" },
  { value: "STAFF", label: "Nhân sự" },
  { value: "OTHER", label: "Khác" },
];

const statusOptions = [
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "PAID", label: "Đã chi" },
];

export default function ExpenseCreateModal({ isOpen, onClose }: ExpenseCreateModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { data: buildings = [] } = useBuildingsQuery({ limit: 100 });
  const { data: ownerSummary = [] } = useOwnerProfitSummaryQuery();

  const [buildingIds, setBuildingIds] = useState<string[]>([]);
  const [category, setCategory] = useState("SUPPLIES");
  const [status, setStatus] = useState("PENDING");
  const [amount, setAmount] = useState("");
  const [paidByName, setPaidByName] = useState("");
  const [vendor, setVendor] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [isUploading, setUploading] = useState(false);

  const selectedBuildings = useMemo(
    () => (buildings as any[]).filter((building) => buildingIds.includes(building.id)),
    [buildings, buildingIds],
  );

  const ownerName = useMemo(() => {
    if (buildingIds.length > 1) return `${buildingIds.length} tòa đã chọn`;
    const summaries = Array.isArray(ownerSummary) ? ownerSummary : [];
    const matched = summaries.find((row: any) =>
      (row.buildings || []).some((building: any) => building.id === buildingIds[0]),
    );
    return matched?.owner?.name || "Tự suy từ tòa nhà";
  }, [ownerSummary, buildingIds]);

  const toggleBuilding = (buildingId: string) => {
    setBuildingIds((current) =>
      current.includes(buildingId) ? current.filter((id) => id !== buildingId) : [...current, buildingId],
    );
  };

  const reset = () => {
    setBuildingIds([]);
    setCategory("SUPPLIES");
    setStatus("PENDING");
    setAmount("");
    setPaidByName("");
    setVendor("");
    setAttachmentUrls([]);
    setDescription("");
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
      toast.error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP cho chứng từ.");
      return;
    }

    const oversized = files.find((file) => file.size > maxProofSize);
    if (oversized) {
      toast.error("Mỗi file chứng từ tối đa 2MB.");
      return;
    }

    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map((file) => settingsApi.uploadAsset(file, {
          folder: "settings",
          purpose: "expense-proof",
          scope: "TENANT",
        })),
      );
      setAttachmentUrls((prev) => [...prev, ...uploaded.map((item) => item.url)]);
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
          });
        }),
      );

      toast.success(buildingIds.length > 1 ? `Đã tạo ${buildingIds.length} khoản chi theo từng tòa` : "Đã tạo chi phí phát sinh");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: financeKeys.ownerProfitSummary() }),
        queryClient.invalidateQueries({ queryKey: financeKeys.expensesRoot() }),
        queryClient.invalidateQueries({ queryKey: financeKeys.ledgerRoot() }),
      ]);
      reset();
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "Không tạo được chi phí");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Thêm chi phí phát sinh"
      maxWidth="max-w-3xl"
      zIndex={10040}
      testId="expense-create-modal"
      headerActions={
        <div className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl bg-[#8b5cf6]/10 text-[#8b5cf6]">
          <ReceiptText size={17} />
        </div>
      }
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting || isUploading}>
            Hủy
          </Button>
          <Button type="submit" form="expense-create-form" isLoading={isSubmitting}>
            Lưu chi phí
          </Button>
        </div>
      }
    >
      <form id="expense-create-form" onSubmit={handleSubmit} data-testid="expense-create-form" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Tòa nhà">
          <div className="max-h-[176px] overflow-auto rounded-2xl border border-border bg-surface/50 p-2" data-testid="expense-create-building">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(buildings as any[]).map((building) => {
                const active = buildingIds.includes(building.id);
                return (
                  <button
                    key={building.id}
                    type="button"
                    onClick={() => toggleBuilding(building.id)}
                    className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-[12px] font-black transition-colors ${
                      active
                        ? "border-[#8b5cf6]/40 bg-[#8b5cf6]/10 text-[#6d3df8]"
                        : "border-border bg-card text-text hover:border-[#8b5cf6]/30"
                    }`}
                  >
                    <span className="truncate">{building.code || building.name}</span>
                    <span className={`h-4 w-4 shrink-0 rounded border ${active ? "border-[#6d3df8] bg-[#6d3df8]" : "border-border bg-card"}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </Field>

        <Field label="Chủ sở hữu">
          <Input value={ownerName} disabled />
        </Field>

        <Field label="Loại chi phí">
          <Select value={category} onChange={(event) => setCategory(event.target.value)} options={categoryOptions} data-testid="expense-create-category" />
        </Field>

        <Field label="Trạng thái">
          <Select value={status} onChange={(event) => setStatus(event.target.value)} options={statusOptions} data-testid="expense-create-status" />
        </Field>

        <Field label="Số tiền">
          <Input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="VD: 350000" data-testid="expense-create-amount" />
        </Field>

        <Field label="Người chi / ứng tiền">
          <Input value={paidByName} onChange={(event) => setPaidByName(event.target.value)} placeholder="VD: Chủ A, Chủ B, admin..." />
        </Field>

        <Field label="Nhà cung cấp">
          <Input value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="VD: Cửa hàng vật tư" />
        </Field>

        <Field label="Chứng từ">
          <div className="flex flex-col gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => handleFiles(event.target.files)}
            />
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} isLoading={isUploading} className="justify-start" data-testid="expense-create-upload-trigger">
              <UploadCloud size={15} className="mr-2" /> Tải ảnh chứng từ
            </Button>
            <div className="text-[11px] font-semibold text-muted">Hỗ trợ JPG, PNG, WEBP. Mỗi file tối đa 2MB.</div>
          </div>
        </Field>

        {attachmentUrls.length > 0 && (
          <div className="md:col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {attachmentUrls.map((url, index) => (
              <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-2xl border border-border bg-surface">
                <a href={url} target="_blank" rel="noreferrer" className="block">
                  <img src={url} alt={`Chứng từ ${index + 1}`} className="h-28 w-full object-cover" />
                </a>
                <div className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] font-bold text-muted">
                  <span className="inline-flex items-center gap-1"><Paperclip size={12} /> Chứng từ {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => setAttachmentUrls((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                    className="rounded-full p-1 text-muted hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Xóa chứng từ ${index + 1}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="md:col-span-2">
          <Field label="Mô tả">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="VD: Mua dụng cụ vệ sinh XXX, YYY, ZZZ cho LK01-31" />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] font-black uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}
