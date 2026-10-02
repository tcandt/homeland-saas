"use client";

import { ArrowLeft, Check } from "lucide-react";

type TenantJourneyHeaderProps = {
  currentStep: 1 | 2 | 3 | 4 | 5;
  intent?: "BOOKING" | "IMMEDIATE" | null;
  onBack?: () => void;
  backLabel?: string;
};

const STEPS = ["Hình thức", "Chọn khách", "Hồ sơ", "Thiết lập thuê", "Hoàn tất"] as const;

export function TenantJourneyHeader({
  currentStep,
  intent,
  onBack,
  backLabel = "Quay lại",
}: TenantJourneyHeaderProps) {
  const intentLabel = intent === "BOOKING" ? "Cọc giữ phòng" : intent === "IMMEDIATE" ? "Thuê ở ngay" : "Chọn cách bắt đầu";

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-white to-amber-50/70 px-5 py-4 dark:from-indigo-950/30 dark:via-slate-950/20 dark:to-amber-950/10 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-300">
            Hành trình thêm khách thuê
          </p>
          <p className="mt-0.5 text-sm font-semibold text-text">
            {intentLabel} <span className="font-normal text-muted">· Bước {currentStep}/5</span>
          </p>
        </div>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-indigo-200/80 bg-white/80 px-3 text-xs font-bold text-indigo-700 transition-colors hover:border-indigo-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-400/20 dark:bg-white/5 dark:text-indigo-200 dark:hover:bg-white/10"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {backLabel}
          </button>
        ) : null}
      </div>
      <ol className="grid grid-cols-5 gap-1" aria-label="Tiến trình thêm khách thuê">
        {STEPS.map((label, index) => {
          const step = (index + 1) as TenantJourneyHeaderProps["currentStep"];
          const complete = step < currentStep;
          const active = step === currentStep;
          return (
            <li key={label} aria-current={active ? "step" : undefined} className="min-w-0">
              <div className="flex items-center gap-1">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ring-2 ring-inset ${
                    complete
                      ? "bg-indigo-600 text-white ring-indigo-600"
                      : active
                        ? "bg-white text-indigo-700 ring-indigo-600 dark:bg-slate-900 dark:text-indigo-200"
                        : "bg-white/70 text-slate-400 ring-slate-200 dark:bg-white/5 dark:text-slate-500 dark:ring-white/10"
                  }`}
                >
                  {complete ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : step}
                </span>
                {index < STEPS.length - 1 ? (
                  <span className={`h-0.5 min-w-0 flex-1 rounded-full ${complete ? "bg-indigo-500" : "bg-slate-200 dark:bg-white/10"}`} aria-hidden="true" />
                ) : null}
              </div>
              <span className={`mt-1.5 block pr-1 text-xs font-semibold leading-4 ${active ? "text-indigo-700 dark:text-indigo-200" : complete ? "text-text" : "text-muted"}`}>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
