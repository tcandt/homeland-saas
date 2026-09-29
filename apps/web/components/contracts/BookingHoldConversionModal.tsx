"use client";

import React from "react";
import dayjs from "dayjs";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Send,
} from "lucide-react";
import { getContractStatusConfig } from "@/lib/contracts/contract-status";
import {
  calculateBookingFirstRent,
  getBookingConversionPaymentSummary,
  getBookingRecoveryErrorMessage,
  parseBookingRentalDate,
} from "@/lib/contracts/booking-conversion";
import { RefundProofUploader } from "../common/RefundProofUploader";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import { BookingConversionPaymentSummary } from "./BookingConversionPaymentSummary";

export type BookingConversionForm = {
  startDate: string;
  endDate: string;
  securityRequired: string;
  rentAmount: string;
  excessAction: "CREDIT" | "REFUND";
  refundStatus: "PENDING" | "COMPLETED";
};

export type BookingConversionResult = {
  sourceContract: any;
  rentalContract: any;
  securityDepositId: string | null;
  securityRequired: number;
  transferredAmount: number;
  additionalCashRequired: number;
  excessAmount: number;
  excessAction: "CREDIT" | "REFUND" | null;
  refundStatus: "PENDING" | "COMPLETED";
  entryInvoice: {
    id: string;
    code: string;
    amount: number;
    rentAmount?: number;
    combined?: boolean;
    status: string;
  } | null;
  paymentRequest: any | null;
  sourceLinked: boolean;
};

const money = (value: number) =>
  `${Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} đ`;
const date = (value?: string) =>
  value && dayjs(value).isValid()
    ? dayjs(value).format("DD/MM/YYYY")
    : "Chưa có";
const readMoney = (value: string) => Number(value.replace(/[^0-9]/g, "") || 0);
const moneyInput = (value: string) =>
  value ? readMoney(value).toLocaleString("vi-VN") : "";
const getTerm = (startDate: string, endDate: string) =>
  [3, 6, 12, 24].find(
    (months) =>
      dayjs(startDate).isValid() &&
      dayjs(startDate).add(months, "month").format("YYYY-MM-DD") === endDate,
  );

function RentalDateInput({
  id,
  value,
  min,
  onChange,
}: {
  id: string;
  value: string;
  min?: string;
  onChange: (value: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const textInputRef = React.useRef<HTMLInputElement>(null);
  const [draft, setDraft] = React.useState(() => (value ? date(value) : ""));
  const emittedValue = React.useRef(value);
  React.useEffect(() => {
    if (value !== emittedValue.current) {
      emittedValue.current = value;
      setDraft(value ? date(value) : "");
    }
  }, [value]);
  const invalid = draft !== "" && !parseBookingRentalDate(draft);
  const openPicker = () => {
    const input = inputRef.current;
    if (!input || input.matches(":disabled")) return;
    try {
      if (typeof input.showPicker === "function") input.showPicker();
      else textInputRef.current?.focus();
    } catch {
      textInputRef.current?.focus();
    }
  };
  return (
    <div className="relative flex h-11 min-w-0 items-center rounded-lg border border-border bg-card focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
      <input
        ref={textInputRef}
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="DD/MM/YYYY"
        maxLength={10}
        value={draft}
        aria-invalid={invalid}
        onChange={(event) => {
          const digits = event.target.value.replace(/[^0-9]/g, "").slice(0, 8);
          const display = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
            .filter(Boolean)
            .join("/");
          setDraft(display);
          const nextValue = parseBookingRentalDate(display);
          emittedValue.current = nextValue;
          onChange(nextValue);
        }}
        required
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-text outline-none disabled:cursor-not-allowed disabled:opacity-50"
      />
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const nextValue = event.target.value;
          emittedValue.current = nextValue;
          setDraft(nextValue ? date(nextValue) : "");
          onChange(nextValue);
        }}
        className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
      />
      <button
        type="button"
        aria-label="Chọn ngày"
        title="Chọn ngày"
        onClick={openPicker}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Calendar size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative pl-9">
      <span
        className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
        aria-hidden="true"
      >
        {number}
      </span>
      <h3 className="mb-3 text-sm font-bold text-text">{title}</h3>
      {children}
    </section>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-[115px_minmax(0,1fr)] items-start gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-semibold text-text">
        {children}
      </dd>
    </div>
  );
}

function ContractCode({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className="min-w-0 break-all font-mono text-xs">{code}</span>
      <button
        type="button"
        title={copied ? "Đã sao chép" : "Sao chép mã hợp đồng"}
        aria-label={copied ? "Đã sao chép mã hợp đồng" : "Sao chép mã hợp đồng"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}

function SourceDetails({ source }: { source: any }) {
  const customerName =
    source.customer?.fullName ||
    source.customer?.name ||
    source.customerSnapshot?.fullName ||
    source.customerSnapshot?.name;
  const customerPhone = source.customer?.phone || source.customerSnapshot?.phone;
  const buildingName =
    source.room?.building?.name || source.roomSnapshot?.building?.name;
  const roomCode = source.room?.code || source.roomSnapshot?.code;
  return (
    <dl className="min-w-0 border-y border-border/70 py-2">
      <Detail label="Mã HĐ cọc">
        <ContractCode code={source.code || source.id} />
      </Detail>
      <Detail label="Khách hàng">
        {customerName || "Chưa có"}
        <span className="mt-0.5 block text-xs font-normal text-muted">
          {customerPhone || "Chưa có số điện thoại"}
        </span>
      </Detail>
      <Detail label="Tòa / Phòng">
        {buildingName || "Chưa có tòa"} · {roomCode || "Chưa có phòng"}
      </Detail>
      <Detail label="Ngày lập">{date(source.createdAt)}</Detail>
      <Detail label="Dự kiến vào ở">{date(source.startDate)}</Detail>
    </dl>
  );
}

function Condition({
  passed,
  title,
  detail,
}: {
  passed: boolean;
  title: string;
  detail: string;
}) {
  const Icon = passed ? CheckCircle2 : AlertCircle;
  return (
    <li className="flex min-w-0 items-start gap-2">
      <Icon
        size={18}
        className={`mt-0.5 shrink-0 ${passed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
      />
      <div className="min-w-0">
        <p className="text-xs font-bold text-text">{title}</p>
        <p className="mt-1 break-words text-xs text-muted">{detail}</p>
      </div>
    </li>
  );
}

export function BookingHoldConversionModal({
  isOpen,
  source,
  balance,
  canConvert,
  form,
  onChange,
  onClose,
  onConfirm,
  saving,
  proofUrls,
  onProofChange,
  proofUploading,
  onProofUploadingChange,
}: {
  isOpen: boolean;
  source: any;
  balance: number;
  canConvert: boolean;
  form: BookingConversionForm;
  onChange: React.Dispatch<React.SetStateAction<BookingConversionForm>>;
  onClose: () => void;
  onConfirm: () => void;
  saving: boolean;
  proofUrls: string[];
  onProofChange: (urls: string[]) => void;
  proofUploading: boolean;
  onProofUploadingChange: (uploading: boolean) => void;
}) {
  const [term, setTerm] = React.useState(() =>
    getTerm(form.startDate, form.endDate),
  );
  React.useEffect(() => {
    if (isOpen) setTerm(getTerm(form.startDate, form.endDate));
  }, [isOpen]);
  if (!source) return null;
  const customerName =
    source.customer?.fullName ||
    source.customer?.name ||
    source.customerSnapshot?.fullName ||
    source.customerSnapshot?.name;
  const security = readMoney(form.securityRequired);
  const firstRentAmount = calculateBookingFirstRent(
    readMoney(form.rentAmount),
    form.startDate,
  );
  const paymentSummary = getBookingConversionPaymentSummary({
    bookingBalance: balance,
    securityRequired: security,
    firstRentAmount,
  });
  const paymentConfirmed = source.bookingPaymentRequest?.status === "CONFIRMED";
  const depositPaid = ["PAID", "CONVERTED_TO_CONTRACT"].includes(String(source.bookingDeposit?.status || "").toUpperCase());
  const rentValid =
    form.rentAmount.trim() !== "" &&
    Number.isSafeInteger(readMoney(form.rentAmount));
  const excess = Math.max(balance - security, 0);
  const validDates = Boolean(
    form.startDate &&
      form.endDate &&
      dayjs(form.startDate).isValid() &&
      dayjs(form.endDate).isValid() &&
      form.endDate > form.startDate,
  );
  const hasCustomer = Boolean(source.customerId && customerName);
  const hasRoom = Boolean(source.roomId);
  const proofRequired =
    excess > 0 &&
    form.excessAction === "REFUND" &&
    form.refundStatus === "COMPLETED";
  const eligible =
    canConvert &&
    hasCustomer &&
    hasRoom &&
    validDates &&
    rentValid &&
    Number.isSafeInteger(security) &&
    security > 0 &&
    (!proofRequired || proofUrls.length > 0);
  const change = (key: keyof BookingConversionForm, value: string) =>
    onChange((prev) => ({ ...prev, [key]: value }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!saving && !proofUploading) onClose();
      }}
      title={
        <span className="flex min-w-0 flex-1 flex-col gap-1 whitespace-normal">
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
              <FileText size={15} />
            </span>
            <span className="min-w-0 break-words leading-5">
              Chuyển HĐ cọc sang thuê dài hạn
            </span>
          </span>
          <span
            data-testid="booking-conversion-header-deposit"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`flex min-h-5 min-w-0 items-start gap-1.5 pl-9 text-xs font-semibold leading-5 ${depositPaid ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}`}
          >
            {depositPaid ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />}
            <span className="min-w-0 break-words tabular-nums">
              {depositPaid
                ? `Đã ghi nhận cọc: ${Number(balance || 0).toLocaleString("vi-VN")} đồng`
                : paymentConfirmed
                  ? "Đang tự động đồng bộ cọc"
                  : "Chưa đủ điều kiện chuyển"}
            </span>
          </span>
        </span>
      }
      maxWidth="max-w-[620px]"
      testId="booking-hold-convert-modal"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <Button
            variant="outline"
            className="min-h-10 shrink-0 rounded-lg"
            disabled={saving || proofUploading}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button
            data-testid="booking-hold-convert-submit"
            className="min-h-10 min-w-0 shrink-0 rounded-lg sm:flex-1"
            onClick={onConfirm}
            isLoading={saving}
            disabled={!eligible || proofUploading}
          >
            <ArrowRight size={16} className="mr-2 shrink-0" />
            Xác nhận chuyển đổi
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Step number={1} title="Thông tin nguồn (Hợp đồng cọc)">
          <SourceDetails source={source} />
          {(!canConvert || source.reconciliationError) && (
            <div role="alert" className="mt-3 space-y-2 border-l-2 border-amber-500 pl-3 text-xs text-amber-800 dark:text-amber-300">
              <p>{source.reconciliationError
                ? getBookingRecoveryErrorMessage(source.reconciliationError)
                : paymentConfirmed && !depositPaid
                  ? "Thanh toán đã xác nhận. Hệ thống đang tự động đồng bộ vào sổ cọc; không thu lại tiền."
                  : depositPaid
                    ? "Hồ sơ hoặc quyền tạo hợp đồng chưa đủ điều kiện chuyển đổi."
                    : "Cần xác nhận khoản cọc giữ phòng trước khi chuyển đổi."}</p>
            </div>
          )}
        </Step>
        <Step number={2} title="Thiết lập hợp đồng thuê dài hạn">
          <fieldset
            disabled={saving || proofUploading}
            className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2"
          >
            <div>
              <label
                className="mb-1 block text-xs font-semibold text-muted"
                htmlFor="booking-rental-start"
              >
                Ngày bắt đầu thuê *
              </label>
              <RentalDateInput
                id="booking-rental-start"
                value={form.startDate}
                onChange={(startDate) => {
                  onChange((prev) => ({
                    ...prev,
                    startDate,
                    endDate:
                      term && dayjs(startDate).isValid()
                        ? dayjs(startDate)
                            .add(term, "month")
                            .format("YYYY-MM-DD")
                        : prev.endDate,
                  }));
                }}
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-semibold text-muted"
                htmlFor="booking-rental-term"
              >
                Thời hạn thuê *
              </label>
              <Select
                id="booking-rental-term"
                value={term ? String(term) : "custom"}
                onChange={(event) => {
                  const months =
                    event.target.value === "custom"
                      ? undefined
                      : Number(event.target.value);
                  setTerm(months);
                  if (months && form.startDate && dayjs(form.startDate).isValid())
                    change(
                      "endDate",
                      dayjs(form.startDate)
                        .add(months, "month")
                        .format("YYYY-MM-DD"),
                    );
                }}
                options={[
                  ...[3, 6, 12, 24].map((months) => ({
                    label: `${months} tháng`,
                    value: String(months),
                  })),
                  { label: "Tùy chỉnh ngày kết thúc", value: "custom" },
                ]}
                className="rounded-lg"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                className="mb-1 block text-xs font-semibold text-muted"
                htmlFor="booking-rental-end"
              >
                Ngày kết thúc thuê *
              </label>
              <RentalDateInput
                id="booking-rental-end"
                min={form.startDate}
                value={form.endDate}
                onChange={(value) => {
                  setTerm(undefined);
                  change("endDate", value);
                }}
              />
              {!validDates && (
                <p role="alert" className="mt-1 text-xs text-danger">
                  {form.startDate && form.endDate
                    ? "Ngày kết thúc phải sau ngày bắt đầu thuê."
                    : "Nhập ngày bắt đầu và kết thúc hợp lệ (DD/MM/YYYY)."}
                </p>
              )}
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-semibold text-muted"
                htmlFor="booking-rental-price"
              >
                Giá thuê / tháng (đ) *
              </label>
              <Input
                id="booking-rental-price"
                inputMode="numeric"
                value={moneyInput(form.rentAmount)}
                onChange={(event) =>
                  change(
                    "rentAmount",
                    event.target.value.replace(/[^0-9]/g, ""),
                  )
                }
                required
                className="rounded-lg"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-semibold text-muted"
                htmlFor="booking-rental-security"
              >
                Cọc bảo đảm cần giữ (đ) *
              </label>
              <Input
                id="booking-rental-security"
                inputMode="numeric"
                value={moneyInput(form.securityRequired)}
                onChange={(event) =>
                  change(
                    "securityRequired",
                    event.target.value.replace(/[^0-9]/g, ""),
                  )
                }
                required
                className="rounded-lg"
              />
            </div>
            {excess > 0 && (
              <>
                <div className="sm:col-span-2">
                  <label
                    className="mb-1 block text-xs font-semibold text-muted"
                    htmlFor="booking-rental-excess"
                  >
                    Xử lý phần dư {money(excess)}
                  </label>
                  <Select
                    id="booking-rental-excess"
                    value={form.excessAction}
                    onChange={(event) =>
                      change("excessAction", event.target.value)
                    }
                    options={[
                      {
                        label: "Ghi nhận khoản có lợi cho khách",
                        value: "CREDIT",
                      },
                      { label: "Hoàn tiền cho khách", value: "REFUND" },
                    ]}
                    className="rounded-lg"
                  />
                </div>
                {form.excessAction === "REFUND" && (
                  <>
                    <div className="sm:col-span-2">
                      <label
                        className="mb-1 block text-xs font-semibold text-muted"
                        htmlFor="booking-rental-refund"
                      >
                        Trạng thái hoàn tiền
                      </label>
                      <Select
                        id="booking-rental-refund"
                        value={form.refundStatus}
                        onChange={(event) =>
                          change("refundStatus", event.target.value)
                        }
                        options={[
                          { label: "Chờ hoàn tiền", value: "PENDING" },
                          { label: "Đã hoàn tiền", value: "COMPLETED" },
                        ]}
                        className="rounded-lg"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <RefundProofUploader
                        value={proofUrls}
                        onChange={onProofChange}
                        onUploadingChange={onProofUploadingChange}
                        disabled={saving}
                        required={proofRequired}
                        folder="booking-deposit-conversion-refunds"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </fieldset>
        </Step>
        <Step number={3} title="Thanh toán">
          {(!hasCustomer || !hasRoom || !validDates || !rentValid || security <= 0) && (
            <ul role="alert" className="mb-3 space-y-1 text-xs text-danger">
              {!hasCustomer && <li>Chưa có đại diện hợp đồng.</li>}
              {!hasRoom && <li>Chưa có phòng thuê.</li>}
              {!validDates && <li>Kiểm tra ngày bắt đầu và kết thúc thuê.</li>}
              {!rentValid && <li>Nhập giá thuê hợp lệ.</li>}
              {security <= 0 && <li>Nhập số tiền cọc hợp đồng.</li>}
            </ul>
          )}
          <BookingConversionPaymentSummary
            rentAmount={firstRentAmount}
            securityAmount={security}
            paidDepositAmount={paymentSummary.transferredAmount}
            totalDue={paymentSummary.totalAdditionalRequired}
            startDate={form.startDate}
            totalTestId="booking-conversion-total-due"
          />
        </Step>
      </div>
    </Modal>
  );
}

export function BookingHoldConversionResultModal({
  result,
  onClose,
  onOpenContract,
  onOpenInvoice,
  onOpenDeposit,
  onSubmit,
  submitting,
  canSubmit,
}: {
  result: BookingConversionResult | null;
  onClose: () => void;
  onOpenContract?: (contract: { id: string }) => void;
  onOpenInvoice: (invoice: any) => void;
  onOpenDeposit: (id: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  canSubmit: boolean;
}) {
  const rental = result?.rentalContract;
  const status = getContractStatusConfig(rental?.status);
  return (
    <Modal
      isOpen={Boolean(result)}
      onClose={() => {
        if (!submitting) onClose();
      }}
      title="Chuyển đổi thành công"
      maxWidth="max-w-[620px]"
      testId="booking-hold-conversion-result-modal"
      footer={
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            {onOpenContract && rental?.id && (
              <Button
                className="min-h-10 min-w-0 shrink-0 rounded-lg sm:flex-1"
                disabled={submitting}
                data-testid="booking-hold-open-rental-contract"
                onClick={() => {
                  onClose();
                  onOpenContract({ id: rental.id });
                }}
              >
                <FileText size={16} className="mr-2 shrink-0" />
                Mở HĐ thuê mới
              </Button>
            )}
            {canSubmit && rental?.status === "DRAFT" && (
              <Button
                variant="outline"
                className="min-h-10 min-w-0 shrink-0 rounded-lg sm:flex-1"
                data-testid="booking-hold-submit-rental-contract"
                isLoading={submitting}
                onClick={onSubmit}
              >
                <Send size={16} className="mr-2 shrink-0" />
                Trình duyệt HĐ thuê
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            className="rounded-lg"
            onClick={onClose}
            disabled={submitting}
          >
            Đóng
          </Button>
        </div>
      }
    >
      {result && (
        <div className="flex flex-col gap-6">
          <div
            role="status"
            className="flex items-start gap-3 border-b border-emerald-500/25 pb-4"
          >
            <CheckCircle2
              size={28}
              className="shrink-0 text-emerald-600 dark:text-emerald-400"
            />
            <div>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                Đã tạo hợp đồng thuê dài hạn
              </p>
              <p className="mt-1 text-xs text-muted">
                {rental.status === "DRAFT"
                  ? "Bản nháp, chưa có hiệu lực thuê ở."
                  : status.label}
              </p>
            </div>
          </div>
          <Step number={1} title="Hợp đồng nguồn (HĐ cọc)">
            <SourceDetails source={result.sourceContract} />
          </Step>
          <Step number={2} title="Hợp đồng thuê đã tạo">
            <dl className="border-y border-border/70 py-2">
              <Detail label="Mã HĐ thuê">
                <ContractCode code={rental.code || rental.id} />
              </Detail>
              <Detail label="Loại hợp đồng">Hợp đồng thuê dài hạn</Detail>
              <Detail label="Ngày bắt đầu">{date(rental.startDate)}</Detail>
              <Detail label="Ngày kết thúc">{date(rental.endDate)}</Detail>
              <Detail label="Thời hạn">
                {getTerm(
                  dayjs(rental.startDate).format("YYYY-MM-DD"),
                  dayjs(rental.endDate).format("YYYY-MM-DD"),
                )
                  ? `${getTerm(dayjs(rental.startDate).format("YYYY-MM-DD"), dayjs(rental.endDate).format("YYYY-MM-DD"))} tháng`
                  : "Theo ngày bắt đầu / kết thúc"}
              </Detail>
              <Detail label="Trạng thái">
                <Badge variant={status.color}>{status.label}</Badge>
              </Detail>
            </dl>
          </Step>
          <Step number={3} title="Kết quả cập nhật">
            <ul className="space-y-3">
              <Condition
                passed={Boolean(rental.id)}
                title="Đã tạo HĐ thuê dài hạn"
                detail={rental.code || rental.id}
              />
              <Condition
                passed={result.sourceLinked}
                title={
                  result.sourceLinked
                    ? "Đã liên kết HĐ cọc và HĐ thuê"
                    : "Cần tải lại liên kết HĐ cọc"
                }
                detail={
                  result.sourceLinked
                    ? "HĐ cọc: Đã tạo hợp đồng thuê dài hạn"
                    : "Mở hồ sơ cọc để kiểm tra liên kết"
                }
              />
              <Condition
                passed={Boolean(result.securityDepositId)}
                title="Cọc đã chuyển sang cọc bảo đảm"
                detail={`${money(result.transferredAmount)} / ${money(result.securityRequired)}`}
              />
            </ul>
          </Step>
          <Step number={4} title="Thanh toán và thao tác tiếp theo">
            {result.entryInvoice && (
              <BookingConversionPaymentSummary
                rentAmount={result.entryInvoice.rentAmount ?? result.entryInvoice.amount}
                securityAmount={result.securityRequired}
                paidDepositAmount={result.transferredAmount}
                totalDue={result.entryInvoice.combined ? result.entryInvoice.amount : result.additionalCashRequired + result.entryInvoice.amount}
                startDate={rental.startDate}
                totalTestId="booking-conversion-result-total-due"
              />
            )}
            {(!result.entryInvoice || result.excessAmount > 0) && (
            <dl className="border-y border-border/70 py-2">
              {!result.entryInvoice && (
                <Detail label="Tiền thuê kỳ đầu">Chưa có hóa đơn</Detail>
              )}
              {result.excessAmount > 0 && (
                <Detail label="Phần dư">
                  {money(result.excessAmount)}
                  <span className="mt-1 block text-xs font-normal text-muted">
                    {result.excessAction === "REFUND"
                      ? result.refundStatus === "COMPLETED"
                        ? "Đã hoàn tiền"
                        : "Phiếu hoàn đang chờ chi"
                      : "Đã ghi nhận khoản có lợi cho khách"}
                  </span>
                </Detail>
              )}
            </dl>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {result.entryInvoice?.id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => {
                    onClose();
                    onOpenInvoice(result.entryInvoice);
                  }}
                >
                  Hóa đơn {result.entryInvoice.code}
                </Button>
              )}
              {result.securityDepositId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => {
                    onClose();
                    onOpenDeposit(result.securityDepositId!);
                  }}
                >
                  Hồ sơ cọc bảo đảm
                </Button>
              )}
            </div>
            {(result.entryInvoice?.combined ? result.entryInvoice.amount : result.additionalCashRequired) > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  {result.entryInvoice?.combined
                    ? `Thanh toán một lần: ${money(result.entryInvoice.amount)}`
                    : `Còn thiếu ${money(result.additionalCashRequired)} cọc bảo đảm`}
                </p>
                {result.paymentRequest?.qrUrl ? (
                  <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row">
                    <img
                      src={result.paymentRequest.qrUrl}
                      alt={result.entryInvoice?.combined ? "QR thanh toán hóa đơn nhận phòng" : "QR thanh toán cọc bảo đảm còn thiếu"}
                      className="h-36 w-36 shrink-0 rounded-lg border border-border bg-white object-contain p-1"
                    />
                    <div className="min-w-0 space-y-1 break-words text-xs text-muted">
                      <p>
                        Mã thanh toán:{" "}
                        <strong className="text-text">
                          {result.paymentRequest.paymentCode}
                        </strong>
                      </p>
                      <p>
                        Số tiền thanh toán:{" "}
                        <strong className="text-text">
                          {money(Number(result.paymentRequest.amount))}
                        </strong>
                      </p>
                      <p>
                        {result.paymentRequest.bankName} ·{" "}
                        {result.paymentRequest.bankAccountNumber}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p
                    role="alert"
                    className="mt-2 text-xs text-amber-700 dark:text-amber-300"
                  >
                    {result.entryInvoice?.combined
                      ? "QR chưa được tạo. Mở hóa đơn nhận phòng để tạo lại yêu cầu thanh toán."
                      : "QR chưa được tạo. Mở cọc bảo đảm để tạo lại yêu cầu thanh toán."}
                  </p>
                )}
              </div>
            )}
          </Step>
        </div>
      )}
    </Modal>
  );
}
