"use client";

import { FormEvent, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastContext";
import { apiClient } from "@/lib/api/client";
import { salesKeys } from "@/lib/queries/sales.queries";

type CreateSalesLeadModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const EMPTY_FORM = { name: "", phone: "", email: "", notes: "" };

export default function CreateSalesLeadModal({ isOpen, onClose }: CreateSalesLeadModalProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setForm(EMPTY_FORM);
  }, [isOpen]);

  const close = () => {
    if (!isSaving) onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    setIsSaving(true);
    try {
      await apiClient.post("/sales", {
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        notes: form.notes || null,
      }, {
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: salesKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: salesKeys.summary() }),
      ]);
      showToast("Đã tạo lead mới", "success");
      onClose();
    } catch (error: any) {
      showToast(error?.message || "Không thể tạo lead", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Thêm lead"
      maxWidth="max-w-lg"
      footer={(
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={isSaving}>Hủy</Button>
          <Button type="submit" form="create-sales-lead" isLoading={isSaving}>Tạo lead</Button>
        </div>
      )}
    >
      <form id="create-sales-lead" onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-semibold text-text">
          Họ và tên
          <input
            required
            minLength={2}
            maxLength={160}
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-text outline-none focus:border-primary"
            placeholder="Nguyễn Văn A"
          />
        </label>
        <label className="block text-sm font-semibold text-text">
          Số điện thoại
          <input
            required
            inputMode="tel"
            maxLength={24}
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-text outline-none focus:border-primary"
            placeholder="0901 234 567"
          />
        </label>
        <label className="block text-sm font-semibold text-text">
          Email <span className="font-normal text-muted">(không bắt buộc)</span>
          <input
            type="email"
            maxLength={254}
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            className="mt-1.5 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-text outline-none focus:border-primary"
            placeholder="khachhang@example.com"
          />
        </label>
        <label className="block text-sm font-semibold text-text">
          Ghi chú <span className="font-normal text-muted">(không bắt buộc)</span>
          <textarea
            rows={4}
            maxLength={2000}
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            className="mt-1.5 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
            placeholder="Nhu cầu thuê, thời điểm cần liên hệ..."
          />
        </label>
      </form>
    </Modal>
  );
}
