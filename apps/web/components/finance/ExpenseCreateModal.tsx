"use client";

import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ReceiptText } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { financeApi } from "@/lib/api/finance.api";
import { useBuildingsQuery } from "@/lib/queries/buildings.queries";
import { financeKeys, useOwnerProfitSummaryQuery } from "@/lib/queries/finance.queries";

type ExpenseCreateModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

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
  const { data: buildings = [] } = useBuildingsQuery({ limit: 100 });
  const { data: ownerSummary = [] } = useOwnerProfitSummaryQuery();

  const [buildingId, setBuildingId] = useState("");
  const [category, setCategory] = useState("SUPPLIES");
  const [status, setStatus] = useState("PENDING");
  const [amount, setAmount] = useState("");
  const [paidByName, setPaidByName] = useState("");
  const [vendor, setVendor] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

  const selectedBuilding = useMemo(
    () => (buildings as any[]).find((building) => building.id === buildingId),
    [buildings, buildingId],
  );

  const ownerName = useMemo(() => {
    const summaries = Array.isArray(ownerSummary) ? ownerSummary : [];
    const matched = summaries.find((row: any) =>
      (row.buildings || []).some((building: any) => building.id === buildingId),
    );
    return matched?.owner?.name || "Tự suy từ tòa nhà";
  }, [ownerSummary, buildingId]);

  const buildingOptions = useMemo(() => [
    { value: "", label: "Chọn tòa nhà" },
    ...(buildings as any[]).map((building) => ({
      value: building.id,
      label: building.code || building.name,
    })),
  ], [buildings]);

  const reset = () => {
    setBuildingId("");
    setCategory("SUPPLIES");
    setStatus("PENDING");
    setAmount("");
    setPaidByName("");
    setVendor("");
    setAttachmentUrls("");
    setDescription("");
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericAmount = Number(String(amount).replace(/[^\d.]/g, ""));

    if (!buildingId) {
      toast.error("Cần chọn tòa nhà");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Số tiền không hợp lệ");
      return;
    }

    setSubmitting(true);
    try {
      await financeApi.createExpense({
        buildingId,
        category,
        status,
        amount: numericAmount,
        paidByName: paidByName.trim() || null,
        vendor: vendor.trim() || null,
        attachmentUrls: attachmentUrls
          .split(/\r?\n/)
          .map((url) => url.trim())
          .filter(Boolean),
        description: description.trim() || `${categoryOptions.find((item) => item.value === category)?.label || "Chi phí"} - ${selectedBuilding?.code || selectedBuilding?.name || ""}`,
      });

      toast.success("Đã tạo chi phí phát sinh");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: financeKeys.ownerProfitSummary() }),
        queryClient.invalidateQueries({ queryKey: financeKeys.expenses(undefined) }),
        queryClient.invalidateQueries({ queryKey: financeKeys.ledger(undefined) }),
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
      headerActions={
        <div className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl bg-[#8b5cf6]/10 text-[#8b5cf6]">
          <ReceiptText size={17} />
        </div>
      }
      footer={
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button type="submit" form="expense-create-form" isLoading={isSubmitting}>
            Lưu chi phí
          </Button>
        </div>
      }
    >
      <form id="expense-create-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Tòa nhà">
          <Select value={buildingId} onChange={(event) => setBuildingId(event.target.value)} options={buildingOptions} />
        </Field>

        <Field label="Chủ sở hữu">
          <Input value={ownerName} disabled />
        </Field>

        <Field label="Loại chi phí">
          <Select value={category} onChange={(event) => setCategory(event.target.value)} options={categoryOptions} />
        </Field>

        <Field label="Trạng thái">
          <Select value={status} onChange={(event) => setStatus(event.target.value)} options={statusOptions} />
        </Field>

        <Field label="Số tiền">
          <Input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="VD: 350000" />
        </Field>

        <Field label="Người chi / ứng tiền">
          <Input value={paidByName} onChange={(event) => setPaidByName(event.target.value)} placeholder="VD: Chủ A, Chủ B, admin..." />
        </Field>

        <Field label="Nhà cung cấp">
          <Input value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="VD: Cửa hàng vật tư" />
        </Field>

        <Field label="Chứng từ">
          <Textarea value={attachmentUrls} onChange={(event) => setAttachmentUrls(event.target.value)} placeholder="Mỗi dòng một link hóa đơn, ảnh chuyển khoản..." />
        </Field>

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
