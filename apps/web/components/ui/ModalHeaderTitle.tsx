"use client";

import React from "react";

export type ModalHeaderTitleTone = "primary" | "indigo" | "amber" | "rose" | "emerald";

type ModalHeaderTitleProps = {
  icon: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  tone?: ModalHeaderTitleTone;
};

const TONE_CLASSES: Record<
  ModalHeaderTitleTone,
  { icon: string; badge: string }
> = {
  primary: {
    icon: "bg-primary/10 text-primary",
    badge: "bg-primary/10 text-primary",
  },
  indigo: {
    icon: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
    badge: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  rose: {
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
  },
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

export function ModalHeaderTitle({
  icon,
  title,
  description,
  badge,
  tone = "primary",
}: ModalHeaderTitleProps) {
  return (
    <span className="flex min-w-0 max-w-full flex-1 items-center gap-2 text-left">
      <span
        aria-hidden="true"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[tone].icon}`}
      >
        {icon}
      </span>
      <span className="min-w-0 truncate text-[13px] font-black leading-5 text-text sm:text-sm">
        {title}
      </span>
      {badge ? (
        <span
          className={`hidden shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px] font-black sm:inline-flex ${TONE_CLASSES[tone].badge}`}
        >
          {badge}
        </span>
      ) : null}
      {description ? (
        <span className="hidden min-w-0 truncate text-xs font-bold text-muted lg:inline-flex lg:max-w-[220px]">
          <span aria-hidden="true" className="mr-1.5">•</span>
          {description}
        </span>
      ) : null}
    </span>
  );
}
