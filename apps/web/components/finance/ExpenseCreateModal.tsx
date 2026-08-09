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
  { value: "SUPPLIES", label: "Vat tu / dung cu" },
  { value: "REPAIR", label: "Sua chua" },
  { value: "MAINTENANCE", label: "Bao tri" },
  { value: "UTILITY", label: "Dien nuoc chung" },
  { value: "CLEANING", label: "Ve sinh" },
  { value: "REFUND", label: "Hoan tien khach" },
  { value: "STAFF", label: "Nhan su" },
  { value: "OTHER", label: "Khac" },
];

const statusOptions = [
  { value: "PENDING", label: "Cho duyet" },
  { value: "APPROVED", label: "Da duyet" },
  { value: "PAID", label: "Da chi" },
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
    return matched?.owner?.name || "Tu suy tu toa nha";
  }, [ownerSummary, buildingId]);

  const buildingOptions = useMemo(() => [
    { value: "", label: "Chon toa nha" },
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
      toast.error("Can chon toa nha");
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("So tien khong hop le");
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
        description: description.trim() || `${categoryOptions.find((item) => item.value === category)?.label || "Chi phi"} - ${selectedBuilding?.code || selectedBuilding?.name || ""}`,
      });

      toast.success("Da tao chi phi phat sinh");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: financeKeys.ownerProfitSummary() }),
        queryClient.invalidateQueries({ queryKey: financeKeys.expenses(undefined) }),
        queryClient.invalidateQueries({ queryKey: financeKeys.ledger(undefined) }),
      ]);
      reset();
      onClose();
    } catch (error: any) {
      toast.error(error?.message || "Khong tao duoc chi phi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Them chi phi phat sinh"
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
            Huy
          </Button>
          <Button type="submit" form="expense-create-form" isLoading={isSubmitting}>
            Luu chi phi
          </Button>
        </div>
      }
    >
      <form id="expense-create-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Toa nha">
          <Select value={buildingId} onChange={(event) => setBuildingId(event.target.value)} options={buildingOptions} />
        </Field>

        <Field label="Chu so huu">
          <Input value={ownerName} disabled />
        </Field>

        <Field label="Loai chi phi">
          <Select value={category} onChange={(event) => setCategory(event.target.value)} options={categoryOptions} />
        </Field>

        <Field label="Trang thai">
          <Select value={status} onChange={(event) => setStatus(event.target.value)} options={statusOptions} />
        </Field>

        <Field label="So tien">
          <Input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="VD: 350000" />
        </Field>

        <Field label="Nguoi chi / ung tien">
          <Input value={paidByName} onChange={(event) => setPaidByName(event.target.value)} placeholder="VD: Chu A, Chu B, admin..." />
        </Field>

        <Field label="Nha cung cap">
          <Input value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="VD: Cua hang vat tu" />
        </Field>

        <div className="hidden md:block" />

        <div className="md:col-span-2">
          <Field label="Mo ta">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="VD: Mua dung cu ve sinh XXX, YYY, ZZZ cho LK01-31" />
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
