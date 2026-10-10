"use client";

import React from "react";
import { CheckCircle2, ExternalLink, FileText, Receipt, ShieldCheck } from "lucide-react";
import { Modal } from "../ui/Modal";
import { getContractConversionEvidence, getConversionSteps } from "../../lib/contracts/booking-conversion";
import { getContractStatusConfig } from "../../lib/contracts/contract-status";

type Props = {
  view?: any;
  contract?: any;
  isOpen: boolean;
  onClose: () => void;
  onOpenContract?: (contract: { id: string }) => void;
  onOpenInvoice?: (invoice: any) => void;
  onOpenDeposit?: (id: string) => void;
};

const unknown = (value: unknown) => value == null || value === "" ? "Chưa rõ" : String(value);
const stateLabels = { complete: "Hoàn tất", current: "Cần thực hiện", waiting: "Đang chờ", blocked: "Chưa đến bước" };

export default function ContractConversionHistoryModal({
  view, contract, isOpen, onClose, onOpenContract, onOpenInvoice, onOpenDeposit,
}: Props) {
  const evidence = getContractConversionEvidence(view, contract);
  const steps = evidence?.live ? getConversionSteps(view || contract?.bookingConversion) : [];
  const invoice = view?.entryInvoice;
  const deposit = view?.securityDeposit;

  return (
    <Modal isOpen={isOpen} onClose={onClose} testId="contract-conversion-history-modal" title="Lịch sử chuyển đổi hợp đồng">
      <div data-testid="contract-conversion-history" className="flex flex-col gap-4 p-1">
        {!evidence ? (
          <p role="status" className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            Chưa có liên kết chuyển đổi hợp lệ giữa hai hợp đồng.
          </p>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck size={18} className="mt-0.5 text-primary" />
                <div>
                  <h3 className="font-bold text-text">Liên kết hồ sơ có thể tra soát</h3>
                  <p className="text-xs text-muted">Trạng thái hiện tại từ hồ sơ thực tế; không phải nhật ký thời gian thực hiện các bước.</p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Hợp đồng nguồn</dt>
                  <dd className="break-all font-mono font-semibold">{unknown(evidence.source.code || evidence.source.id)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Hợp đồng thuê</dt>
                  <dd className="break-all font-mono font-semibold">{unknown(evidence.target.code || evidence.target.id)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Trạng thái nguồn</dt>
                  <dd>{evidence.source.status ? getContractStatusConfig(evidence.source.status).label : "Chưa rõ"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Trạng thái đích</dt>
                  <dd>{evidence.target.status ? getContractStatusConfig(evidence.target.status).label : "Chưa rõ"}</dd>
                </div>
              </dl>
            </div>
            {evidence.live ? (
              <ol className="flex flex-col gap-2" aria-label="Tiến độ chuyển đổi">
                {steps.map((step) => (
                  <li key={step.key} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      {step.done ? <CheckCircle2 size={16} className="text-emerald-600" /> : <span className="h-4 w-4 rounded-full border border-muted" />}
                      {step.title}
                      <span className="ml-auto text-xs text-muted">{stateLabels[step.state]}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{step.detail}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-border p-3 text-sm text-muted">
                Có liên kết nguồn/đích nhưng chưa có dữ liệu trực tiếp để xác nhận tiến độ.
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button type="button" disabled={!onOpenContract} onClick={() => onOpenContract?.({ id: evidence.sourceId })}
                className="rounded-xl border border-border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50">
                <FileText size={16} /><span className="mt-1 block text-xs font-semibold">Mở hợp đồng nguồn</span>
              </button>
              <button type="button" disabled={!onOpenContract} onClick={() => onOpenContract?.({ id: evidence.targetId })}
                className="rounded-xl border border-border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50">
                <ExternalLink size={16} /><span className="mt-1 block text-xs font-semibold">Mở hợp đồng thuê</span>
              </button>
              <button type="button" disabled={!invoice?.id || !onOpenInvoice} onClick={() => invoice?.id && onOpenInvoice?.(invoice)}
                className="rounded-xl border border-border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50">
                <Receipt size={16} /><span className="mt-1 block text-xs font-semibold">Hóa đơn: {unknown(invoice?.code)}</span>
              </button>
            </div>
            {deposit?.id && onOpenDeposit ? (
              <button type="button" onClick={() => onOpenDeposit(deposit.id)} className="text-left text-xs font-semibold text-primary">
                Mở khoản cọc bảo đảm
              </button>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
