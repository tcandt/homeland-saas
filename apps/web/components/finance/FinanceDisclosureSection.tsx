"use client";

import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

type FinanceDisclosureSectionProps = {
  title: string;
  description: string;
  eyebrow?: string;
  defaultOpen?: boolean;
  testId: string;
  children: React.ReactNode;
};

export default function FinanceDisclosureSection({
  title,
  description,
  eyebrow = "Chi tiết tài chính",
  defaultOpen = false,
  testId,
  children,
}: FinanceDisclosureSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section data-testid={testId} className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs">
      <button
        type="button"
        data-testid={`${testId}-toggle`}
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-[76px] w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-surface/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:px-5"
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-black uppercase tracking-[0.14em] text-primary">{eyebrow}</span>
          <span className="mt-1 block text-base font-black text-text md:text-lg">{title}</span>
          <span className="mt-1 block text-sm leading-5 text-muted">{description}</span>
        </span>
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted shadow-2xs">
          <ChevronDown size={18} className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden />
        </span>
      </button>

      <div id={contentId} hidden={!open} className="border-t border-border/70 bg-background/30 p-3 md:p-4">
        {open ? children : null}
      </div>
    </section>
  );
}
