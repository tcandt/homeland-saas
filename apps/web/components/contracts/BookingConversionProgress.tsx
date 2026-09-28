"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Clock3,
  ExternalLink,
  FileText,
  LoaderCircle,
  RotateCcw,
  Send,
} from "lucide-react";
import {
  BOOKING_CONVERTED_LABEL,
  BookingConversionStepState,
  getConversionSteps,
} from "@/lib/contracts/booking-conversion";
import { getContractStatusConfig } from "@/lib/contracts/contract-status";
import { useIssueInvoiceMutation } from "@/lib/queries/invoices.queries";
import { useSendInvoicePaymentToZaloMutation } from "@/lib/queries/payments.queries";
import { Button } from "../ui/Button";

type SendState = "idle" | "processing" | "success" | "failed";

const stateStyles: Record<
  BookingConversionStepState | "processing" | "failed",
  { circle: string; title: string; label: string }
> = {
  complete: {
    circle: "border-emerald-600 bg-emerald-600 text-white",
    title: "text-emerald-800 dark:text-emerald-300",
    label: "Hoàn tất",
  },
  current: {
    circle: "border-primary bg-primary text-white",
    title: "text-text",
    label: "Cần thực hiện",
  },
  waiting: {
    circle: "border-amber-500 bg-amber-500 text-white",
    title: "text-amber-800 dark:text-amber-300",
    label: "Đang chờ",
  },
  blocked: {
    circle: "border-border bg-surface text-muted",
    title: "text-muted",
    label: "Chưa đến bước",
  },
  processing: {
    circle: "border-sky-600 bg-sky-600 text-white",
    title: "text-sky-800 dark:text-sky-300",
    label: "Đang gửi",
  },
  failed: {
    circle: "border-danger bg-danger text-white",
    title: "text-danger",
    label: "Gửi thất bại",
  },
};

function getErrorMessage(error: any) {
  return String(
    error?.response?.data?.message ||
      error?.message ||
      "Không thể gửi QR qua Zalo. Vui lòng kiểm tra liên kết Zalo của khách rồi thử lại.",
  );
}

export default function BookingConversionProgress({
  view,
  isSource,
  onOpenContract,
  onOpenInvoice,
  onOpenDeposit,
  onRefresh,
}: {
  view: any;
  isSource: boolean;
  onOpenContract?: (contract: { id: string }) => void;
  onOpenInvoice: (invoice: any) => void;
  onOpenDeposit: (id: string) => void;
  onRefresh?: () => Promise<unknown> | void;
}) {
  const issueInvoiceMutation = useIssueInvoiceMutation();
  const sendZaloMutation = useSendInvoicePaymentToZaloMutation();
  const [sendState, setSendState] = useState<SendState>("idle");
  const [sendError, setSendError] = useState("");
  const [invoiceIssuedLocally, setInvoiceIssuedLocally] = useState(false);

  const rental = view?.rentalContract;
  const source = view?.sourceBookingContract;
  const invoice = view?.entryInvoice;
  const steps = getConversionSteps(view);
  const persistedQrSent = Boolean(
    view?.entryPaymentRequest?.metadata?.zaloSentAt ||
      view?.entryPaymentRequest?.metadata?.zaloDispatchAt,
  );
  const paymentConfirmed = view?.rentalReadiness?.entryInvoicePaid === true;

  useEffect(() => {
    if (persistedQrSent || paymentConfirmed) {
      setSendState("success");
      setSendError("");
    }
  }, [paymentConfirmed, persistedQrSent]);

  useEffect(() => {
    setInvoiceIssuedLocally(String(invoice?.status || "").toUpperCase() !== "DRAFT");
  }, [invoice?.id, invoice?.status]);

  if (!rental) return null;

  const sendInvoiceQr = async () => {
    if (!invoice?.id || sendState === "processing") return;
    setSendState("processing");
    setSendError("");
    try {
      if (!invoiceIssuedLocally) {
        await issueInvoiceMutation.mutateAsync(invoice.id);
        setInvoiceIssuedLocally(true);
      }
      await sendZaloMutation.mutateAsync(invoice.id);
      setSendState("success");
      try {
        await onRefresh?.();
      } catch {
        // Delivery already succeeded; a failed refresh must not expose a false retry state.
      }
    } catch (error) {
      setSendState("failed");
      setSendError(getErrorMessage(error));
    }
  };

  return (
    <section
      data-testid="booking-conversion-progress"
      className="flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary/5 p-4"
      aria-labelledby="booking-conversion-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 id="booking-conversion-title" className="font-bold text-text">
            {isSource ? BOOKING_CONVERTED_LABEL : "Quy trình từ cọc giữ phòng"}
          </h4>
          <p className="text-sm text-muted">
            {rental.code} · {getContractStatusConfig(rental.status).label}
          </p>
          <p className="mt-1 text-xs text-muted">
            Hợp đồng giữ chỗ và hợp đồng thuê là hai hồ sơ riêng biệt, được liên kết để tra soát.
          </p>
        </div>
        {onOpenContract && (isSource || source) ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenContract({ id: isSource ? rental.id : source.id })}
          >
            <ExternalLink size={14} className="mr-1.5" />
            {isSource ? "Tiếp tục hợp đồng thuê" : `Xem cọc nguồn ${source.code || ""}`}
          </Button>
        ) : null}
      </div>

      <ol className="relative" aria-label="Tiến độ chuyển sang thuê dài hạn">
        {steps.map((step, index) => {
          let visualState: BookingConversionStepState | "processing" | "failed" = step.state;
          let detail = step.detail;
          if (step.key === "invoice-sent") {
            if (sendState === "processing") {
              visualState = "processing";
              detail = "Đang tạo QR và gửi tin nhắn thanh toán qua Zalo...";
            } else if (sendState === "failed") {
              visualState = "failed";
              detail = sendError;
            } else if (sendState === "success") {
              visualState = "complete";
              detail = `Đã gửi ${invoice?.code || "hóa đơn kỳ đầu"} và QR thanh toán qua Zalo.`;
            }
          } else if (
            step.key === "waiting-payment" &&
            sendState === "success" &&
            !paymentConfirmed
          ) {
            visualState = "waiting";
            detail = "Đang chờ giao dịch ngân hàng và đối soát SePay.";
          }
          const style = stateStyles[visualState];
          const isLast = index === steps.length - 1;

          return (
            <li key={step.key} className={`relative pl-11 ${isLast ? "" : "pb-5"}`}>
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-border"
                />
              ) : null}
              <span
                className={`absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-black ${style.circle}`}
                aria-hidden="true"
              >
                {visualState === "complete" ? (
                  <Check size={16} />
                ) : visualState === "processing" ? (
                  <LoaderCircle size={16} className="motion-safe:animate-spin" />
                ) : visualState === "failed" ? (
                  <AlertCircle size={16} />
                ) : visualState === "waiting" ? (
                  <Clock3 size={15} />
                ) : (
                  index + 1
                )}
              </span>

              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`text-sm font-bold ${style.title}`}>{step.title}</span>
                  <span className="text-[11px] font-semibold text-muted">{style.label}</span>
                </div>
                <p
                  className={`mt-0.5 text-xs ${visualState === "failed" ? "text-danger" : "text-muted"}`}
                  role={visualState === "failed" ? "alert" : undefined}
                  aria-live={step.key === "invoice-sent" ? "polite" : undefined}
                >
                  {detail}
                </p>

                {step.key === "invoice-sent" && invoice?.id && !paymentConfirmed ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!persistedQrSent && sendState !== "success" ? (
                      <Button
                        data-testid="booking-conversion-send-zalo"
                        size="sm"
                        variant={sendState === "failed" ? "danger" : "primary"}
                        onClick={() => void sendInvoiceQr()}
                        isLoading={sendState === "processing"}
                      >
                        {sendState === "failed" ? (
                          <RotateCcw size={14} className="mr-1.5" />
                        ) : (
                          <Send size={14} className="mr-1.5" />
                        )}
                        {sendState === "failed" ? "Gửi lại QR" : "Tạo và gửi QR qua Zalo"}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => onOpenInvoice(invoice)}>
                      <FileText size={14} className="mr-1.5" /> Mở hóa đơn
                    </Button>
                  </div>
                ) : null}

                {step.key === "rental-created" && view.securityDeposit?.id && !view.rentalReadiness?.depositPaid ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => onOpenDeposit(view.securityDeposit.id)}
                  >
                    Kiểm tra cọc hợp đồng
                  </Button>
                ) : null}

                {step.key === "rental-active" && isSource && onOpenContract && !step.done ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => onOpenContract({ id: rental.id })}
                  >
                    <ExternalLink size={14} className="mr-1.5" /> Tiếp tục hồ sơ thuê
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {invoice?.id && paymentConfirmed ? (
        <Button variant="outline" size="sm" onClick={() => onOpenInvoice(invoice)}>
          <FileText size={14} className="mr-1.5" /> Xem hóa đơn đã thanh toán
        </Button>
      ) : null}

      {["CANCELLED", "TERMINATED", "EXPIRED"].includes(rental.status) ? (
        <p role="status" className="text-sm text-muted">
          Hợp đồng thuê đã kết thúc hoặc bị hủy. Liên kết này vẫn được giữ để tra soát.
        </p>
      ) : null}
    </section>
  );
}
