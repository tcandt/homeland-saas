"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  DoorOpen,
  FileCheck2,
  Loader2,
  ShieldCheck,
  UserRoundMinus,
} from "lucide-react";
import { contractsApi, type ContractSettlementPayload, type MoveOutOccupantResult } from "@/lib/api/contracts.api";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";

type OccupantOption = {
  id?: string;
  name?: string;
  fullName?: string;
  role?: string;
  isRep?: boolean;
  contractId?: string;
  contractStatus?: string;
};

type Props = {
  isOpen: boolean;
  roomId: string;
  roomName?: string;
  occupant: OccupantOption | null;
  fallbackContractId?: string;
  onClose: () => void;
  onCompleted: (result: MoveOutOccupantResult) => void | Promise<void>;
};

type MoneyFieldKey =
  | "baseRentAmount"
  | "electricityAmount"
  | "waterAmount"
  | "serviceAmount"
  | "damageFee"
  | "penaltyFee"
  | "otherChargeAmount"
  | "roomRefundAmount"
  | "otherCreditAmount"
  | "depositToRefund"
  | "depositToDeduct";

const ACTIVE_STATUSES = new Set(["ACTIVE", "EXPIRING"]);
const PRE_ACTIVE_STATUSES = new Set(["DRAFT", "PENDING_APPROVAL", "APPROVED"]);

const toLocalDateInput = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

const initialForm = () => ({
  actualMoveOutDate: toLocalDateInput(),
  roomTurnoverStatus: "AVAILABLE",
  rentDaysCharged: "0",
  baseRentAmount: "",
  electricityAmount: "",
  waterAmount: "",
  serviceAmount: "",
  damageFee: "",
  penaltyFee: "",
  otherChargeAmount: "",
  roomRefundAmount: "",
  otherCreditAmount: "",
  depositToRefund: "",
  depositToDeduct: "",
  refundReceiptStatus: "PENDING",
  reason: "Trả phòng theo yêu cầu của khách thuê",
});

const parseOptionalNumber = (value: string) => {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const formatMoneyInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("vi-VN") : "";
};

const formatMoney = (value: unknown) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const statusLabel: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  ACTIVE: "Đang hiệu lực",
  EXPIRING: "Sắp hết hạn",
  EXPIRED: "Đã hết hạn",
  TERMINATED: "Đã chấm dứt",
  CANCELLED: "Đã hủy",
};

export default function MoveOutOccupantModal({
  isOpen,
  roomId,
  roomName,
  occupant,
  fallbackContractId,
  onClose,
  onCompleted,
}: Props) {
  const [contract, setContract] = useState<any | null>(null);
  const [form, setForm] = useState(initialForm);
  const [preview, setPreview] = useState<any | null>(null);
  const [isLoadingContract, setIsLoadingContract] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRequestRef = useRef(0);

  const occupantName = occupant?.name || occupant?.fullName || "Khách thuê";
  const contractId = occupant?.contractId || fallbackContractId || contract?.id;
  const contractStatus = String(contract?.status || occupant?.contractStatus || "");
  const isPrimary = Boolean(contract && occupant?.id && contract.customerId === occupant.id);
  const isCoRepresentative = Boolean(
    contract
      && occupant?.id
      && Array.isArray(contract.coRepresentativeIds)
      && contract.coRepresentativeIds.includes(occupant.id),
  );
  const needsSettlement = isPrimary && ACTIVE_STATUSES.has(contractStatus);
  const willCancelContract = isPrimary && PRE_ACTIVE_STATUSES.has(contractStatus);

  const settlementPayload = useMemo<ContractSettlementPayload>(() => ({
    actualMoveOutDate: form.actualMoveOutDate,
    roomTurnoverStatus: form.roomTurnoverStatus as ContractSettlementPayload["roomTurnoverStatus"],
    rentDaysCharged: Number(form.rentDaysCharged || 0),
    baseRentAmount: parseOptionalNumber(form.baseRentAmount),
    electricityAmount: parseOptionalNumber(form.electricityAmount),
    waterAmount: parseOptionalNumber(form.waterAmount),
    serviceAmount: parseOptionalNumber(form.serviceAmount),
    damageFee: parseOptionalNumber(form.damageFee),
    penaltyFee: parseOptionalNumber(form.penaltyFee),
    otherChargeAmount: parseOptionalNumber(form.otherChargeAmount),
    roomRefundAmount: parseOptionalNumber(form.roomRefundAmount),
    otherCreditAmount: parseOptionalNumber(form.otherCreditAmount),
    depositToRefund: parseOptionalNumber(form.depositToRefund),
    depositToDeduct: parseOptionalNumber(form.depositToDeduct),
    refundReceiptStatus: form.refundReceiptStatus as ContractSettlementPayload["refundReceiptStatus"],
    refundReason: form.reason.trim() || undefined,
    note: form.reason.trim() || undefined,
  }), [form]);
  const settlementPayloadKey = JSON.stringify(settlementPayload);

  useEffect(() => {
    if (!isOpen || !occupant?.id) return;
    let active = true;
    setContract(null);
    setPreview(null);
    setError(null);
    setForm(initialForm());
    setIsLoadingContract(true);

    const loadContract = async () => {
      try {
        const explicitId = occupant.contractId || fallbackContractId;
        let resolved: any = explicitId ? await contractsApi.getDetail(explicitId) : null;
        if (!resolved) {
          const response: any = await contractsApi.list({ roomId, customerId: occupant.id, limit: 20 });
          const items = Array.isArray(response?.items) ? response.items : [];
          resolved = items.find((item: any) => ACTIVE_STATUSES.has(String(item.status)))
            || items.find((item: any) => PRE_ACTIVE_STATUSES.has(String(item.status)))
            || items[0]
            || null;
        }
        if (!active) return;
        setContract(resolved);
        if (resolved?.depositMoney) {
          setForm((current) => ({ ...current, depositToRefund: String(Number(resolved.depositMoney)) }));
        }
      } catch {
        if (active) {
          setError("Không tải được chi tiết hợp đồng. Bạn vẫn có thể gỡ người ở cùng khỏi phòng.");
        }
      } finally {
        if (active) setIsLoadingContract(false);
      }
    };

    void loadContract();
    return () => {
      active = false;
    };
  }, [isOpen, occupant?.id, occupant?.contractId, fallbackContractId, roomId]);

  useEffect(() => {
    const requestId = ++previewRequestRef.current;
    if (!isOpen || !needsSettlement || !contract?.id) {
      setIsLoadingPreview(false);
      setPreview(null);
      return;
    }

    setIsLoadingPreview(true);
    const timer = window.setTimeout(async () => {
      try {
        const nextPreview = await contractsApi.previewSettlement(
          contract.id,
          JSON.parse(settlementPayloadKey),
        );
        if (requestId === previewRequestRef.current) {
          setPreview(nextPreview);
          setError(null);
        }
      } catch (previewError: any) {
        if (requestId === previewRequestRef.current) {
          setPreview(null);
          setError(previewError?.message || "Không thể tính trước quyết toán.");
        }
      } finally {
        if (requestId === previewRequestRef.current) setIsLoadingPreview(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [isOpen, needsSettlement, contract?.id, settlementPayloadKey]);

  const updateMoney = (field: MoneyFieldKey, value: string) => {
    setForm((current) => ({ ...current, [field]: value.replace(/\D/g, "") }));
  };

  const handleSubmit = async () => {
    if (!occupant?.id || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await contractsApi.moveOutOccupant({
        ...(needsSettlement ? settlementPayload : {
          actualMoveOutDate: form.actualMoveOutDate,
          roomTurnoverStatus: form.roomTurnoverStatus as ContractSettlementPayload["roomTurnoverStatus"],
          note: form.reason.trim() || undefined,
        }),
        roomId,
        customerId: occupant.id,
        contractId: contractId || null,
        reason: form.reason.trim() || undefined,
      });
      try {
        await onCompleted(result);
      } catch {
        setError("Đã hoàn tất trả phòng nhưng chưa tải lại được dữ liệu. Hãy làm mới trang để xem kết quả.");
      }
    } catch (submitError: any) {
      const message = submitError?.message === "CONTRACT_CANCELLATION_REQUIRES_DEPOSIT_REFUND"
        ? "Hợp đồng đã nhận cọc. Hãy hoàn/khấu trừ tiền cọc trong nghiệp vụ quyết toán trước khi hủy."
        : submitError?.message || "Không thể hoàn tất trả phòng.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const actionDescription = needsSettlement
    ? "Hợp đồng sẽ chuyển sang Đã chấm dứt sau khi tạo quyết toán cuối."
    : willCancelContract
      ? "Hợp đồng chưa kích hoạt sẽ chuyển sang Đã hủy và vẫn nằm trong lịch sử."
      : isCoRepresentative
        ? "Khách sẽ được gỡ khỏi danh sách đồng đại diện; hợp đồng chính vẫn giữ nguyên."
        : "Chỉ kết thúc lượt cư trú và gỡ khách khỏi phòng.";

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] leading-4 text-muted sm:max-w-[55%]">
        Hồ sơ khách, hợp đồng, hóa đơn và lịch sử tài chính được bảo toàn.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="min-h-11">
          Quay lại
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || isLoadingContract || (needsSettlement && !preview)} className="min-h-11">
          {isSubmitting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <DoorOpen size={16} className="mr-2" />}
          {needsSettlement ? "Xác nhận quyết toán" : "Xác nhận trả phòng"}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!isSubmitting) onClose(); }}
      title="Trả phòng có bảo toàn"
      maxWidth={needsSettlement ? "max-w-4xl" : "max-w-xl"}
      footer={footer}
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.05] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <UserRoundMinus size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-black text-text">{occupantName}</p>
              {occupant?.role && (
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-bold text-muted">
                  {occupant.role}
                </span>
              )}
              {contractStatus && (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  HĐ: {statusLabel[contractStatus] || contractStatus}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-muted">
              {roomName ? `${roomName} · ` : ""}{actionDescription}
            </p>
          </div>
        </div>

        {isLoadingContract && (
          <div className="flex min-h-24 items-center justify-center gap-2 text-sm font-semibold text-muted">
            <Loader2 size={18} className="animate-spin text-primary" /> Đang kiểm tra hợp đồng và lịch sử cư trú…
          </div>
        )}

        {!isLoadingContract && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-wide text-muted">Ngày trả phòng</span>
                <Input
                  type="date"
                  value={form.actualMoveOutDate}
                  onChange={(event) => setForm((current) => ({ ...current, actualMoveOutDate: event.target.value }))}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-wide text-muted">Trạng thái phòng sau xử lý</span>
                <Select
                  value={form.roomTurnoverStatus}
                  onChange={(event) => setForm((current) => ({ ...current, roomTurnoverStatus: event.target.value }))}
                  options={[
                    { value: "AVAILABLE", label: "Sẵn sàng cho thuê" },
                    { value: "CLEANING", label: "Chờ vệ sinh" },
                    { value: "MAINTENANCE", label: "Chờ bảo trì" },
                  ]}
                />
              </label>
            </div>

            {needsSettlement && (
              <div className="space-y-4 rounded-2xl border border-border/70 bg-surface/30 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-black text-text">
                      <Calculator size={17} className="text-primary" /> Quyết toán cuối
                    </div>
                    <p className="mt-1 text-xs text-muted">Nhập các khoản phát sinh; tổng tiền được tính lại tự động.</p>
                  </div>
                  {isLoadingPreview && <Loader2 size={17} className="shrink-0 animate-spin text-primary" />}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="space-y-1.5">
                    <span className="text-[11px] font-bold text-muted">Số ngày tính tiền phòng</span>
                    <Input
                      type="number"
                      min={0}
                      max={31}
                      value={form.rentDaysCharged}
                      onChange={(event) => setForm((current) => ({ ...current, rentDaysCharged: event.target.value }))}
                    />
                  </label>
                  {([
                    ["baseRentAmount", "Tiền phòng phát sinh"],
                    ["electricityAmount", "Tiền điện chốt kỳ"],
                    ["waterAmount", "Tiền nước chốt kỳ"],
                    ["serviceAmount", "Phí dịch vụ"],
                    ["damageFee", "Bồi thường hư hỏng"],
                    ["penaltyFee", "Phí phạt / trả sớm"],
                    ["otherChargeAmount", "Khoản thu khác"],
                  ] as Array<[MoneyFieldKey, string]>).map(([field, label]) => (
                    <label className="space-y-1.5" key={field}>
                      <span className="text-[11px] font-bold text-muted">{label}</span>
                      <Input
                        inputMode="numeric"
                        value={formatMoneyInput(form[field])}
                        onChange={(event) => updateMoney(field, event.target.value)}
                        placeholder="0"
                      />
                    </label>
                  ))}
                </div>

                <div className="border-t border-border/60 pt-4">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-muted">Hoàn tiền và khấu trừ</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {([
                      ["roomRefundAmount", "Hoàn tiền phòng dư"],
                      ["otherCreditAmount", "Giảm trừ khác"],
                      ["depositToRefund", "Tiền cọc hoàn khách"],
                      ["depositToDeduct", "Cọc khấu trừ công nợ"],
                    ] as Array<[MoneyFieldKey, string]>).map(([field, label]) => (
                      <label className="space-y-1.5" key={field}>
                        <span className="text-[11px] font-bold text-muted">{label}</span>
                        <Input
                          inputMode="numeric"
                          value={formatMoneyInput(form[field])}
                          onChange={(event) => updateMoney(field, event.target.value)}
                          placeholder="0"
                        />
                      </label>
                    ))}
                    <label className="space-y-1.5">
                      <span className="text-[11px] font-bold text-muted">Trạng thái hoàn tiền</span>
                      <Select
                        value={form.refundReceiptStatus}
                        onChange={(event) => setForm((current) => ({ ...current, refundReceiptStatus: event.target.value }))}
                        options={[
                          { value: "PENDING", label: "Chờ xử lý hoàn tiền" },
                          { value: "COMPLETED", label: "Đã hoàn tiền" },
                        ]}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-[10px] font-bold uppercase text-muted">Tổng phát sinh</p>
                    <p className="mt-1 text-sm font-black text-text">{formatMoney(preview?.totals?.chargeTotal)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <p className="text-[10px] font-bold uppercase text-muted">Tổng giảm trừ</p>
                    <p className="mt-1 text-sm font-black text-emerald-600">{formatMoney(preview?.totals?.creditTotal)}</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
                    <p className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-300">Khách cần trả</p>
                    <p className="mt-1 text-sm font-black text-amber-700 dark:text-amber-300">{formatMoney(preview?.totals?.netReceivable)}</p>
                  </div>
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-3">
                    <p className="text-[10px] font-bold uppercase text-primary">Cần hoàn khách</p>
                    <p className="mt-1 text-sm font-black text-primary">{formatMoney(preview?.totals?.refundToCustomer)}</p>
                  </div>
                </div>
              </div>
            )}

            <label className="block space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wide text-muted">Lý do / ghi chú nghiệp vụ</span>
              <textarea
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                rows={3}
                maxLength={1000}
                className="w-full resize-none rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm text-text outline-none transition focus:ring-2 focus:ring-primary"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-xs leading-5 text-emerald-700 dark:text-emerald-300">
                <ShieldCheck size={17} className="mt-0.5 shrink-0" />
                <span>Không xóa khách hàng. Lượt cư trú được đóng bằng ngày trả phòng.</span>
              </div>
              <div className="flex gap-2 rounded-xl border border-primary/20 bg-primary/[0.05] p-3 text-xs leading-5 text-primary">
                <FileCheck2 size={17} className="mt-0.5 shrink-0" />
                <span>Hợp đồng và số liệu tài chính tiếp tục hiển thị trong lịch sử.</span>
              </div>
            </div>
          </>
        )}

        {error && (
          <div role="alert" className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.07] p-3 text-xs leading-5 text-rose-600 dark:text-rose-300">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
