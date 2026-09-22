"use client";

import React, { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type OperationsSidePanelShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  testId: string;
  children: React.ReactNode;
};

export default function OperationsSidePanelShell({
  open,
  onOpenChange,
  label,
  testId,
  children,
}: OperationsSidePanelShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onOpenChange]);

  return (
    <div
      ref={rootRef}
      data-testid={testId}
      className="pointer-events-none fixed right-0 top-[72px] bottom-4 z-[101] hidden xl:block"
    >
      <div
        aria-hidden={!open}
        className={`pointer-events-auto fixed bottom-4 right-0 top-[72px] flex min-w-0 flex-col overflow-y-auto rounded-l-[28px] border border-r-0 border-border/70 bg-card shadow-2xl transition-[width,opacity,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          open
            ? "w-[min(460px,calc(100vw-56px))] translate-x-0 opacity-100"
            : "pointer-events-none w-0 -translate-x-3 overflow-hidden border-0 opacity-0"
        }`}
      >
        {children}
      </div>
      <button
        type="button"
        data-testid={`${testId}-toggle`}
        aria-label={`${open ? "Thu gọn" : "Mở"} ${label}`}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={`pointer-events-auto fixed top-1/2 z-10 flex -translate-y-1/2 shrink-0 cursor-pointer list-none items-center gap-1.5 rounded-l-xl border-y border-l border-primary/40 bg-card/95 px-2 py-3 text-xs font-black text-primary shadow-xl backdrop-blur-md transition-[right,background-color,border-color,padding] duration-300 hover:border-primary hover:bg-primary/10 hover:pl-3 [writing-mode:vertical-rl] select-none ${
          open ? "right-[min(460px,calc(100vw-56px))]" : "right-0"
        }`}
      >
        {open ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        <span className={`transition-transform duration-300 ${open ? "[transform:rotate(180deg)]" : ""}`}>
          {label}
        </span>
      </button>
    </div>
  );
}
