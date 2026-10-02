import React, { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";
import { Button } from "./Button";
import { ModalHeaderTitle } from "./ModalHeaderTitle";

// Global overlay stack to handle nested / stacked modals and drawers with ESC (LIFO)
type OverlayStackEntry = {
  id: string;
  onClose: () => void;
  lockScroll: boolean;
};

let activeOverlayStack: OverlayStackEntry[] = [];
let isKeydownListenerAttached = false;

function handleGlobalKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape" || event.key === "Esc") {
    if (activeOverlayStack.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      // Only close the topmost overlay in the stack
      const topOverlay = activeOverlayStack[activeOverlayStack.length - 1];
      topOverlay.onClose();
    }
  }
}

export function registerOverlay(id: string, onClose: () => void, lockScroll = true) {
  activeOverlayStack = activeOverlayStack.filter((item) => item.id !== id);
  activeOverlayStack.push({ id, onClose, lockScroll });

  if (typeof document !== "undefined") {
    document.body.style.overflow = activeOverlayStack.some((item) => item.lockScroll)
      ? "hidden"
      : "";
    if (!isKeydownListenerAttached) {
      window.addEventListener("keydown", handleGlobalKeyDown, true);
      isKeydownListenerAttached = true;
    }
  }
}

export function unregisterOverlay(id: string) {
  activeOverlayStack = activeOverlayStack.filter((item) => item.id !== id);
  if (typeof document !== "undefined") {
    if (activeOverlayStack.length === 0) {
      document.body.style.overflow = "";
      if (isKeydownListenerAttached) {
        window.removeEventListener("keydown", handleGlobalKeyDown, true);
        isKeydownListenerAttached = false;
      }
    } else document.body.style.overflow = activeOverlayStack.some((item) => item.lockScroll) ? "hidden" : "";
  }
}

export function getOverlayStackDepth(id: string): number {
  const index = activeOverlayStack.findIndex((item) => item.id === id);
  return index >= 0 ? index : activeOverlayStack.length;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  zIndex?: number;
  headerActions?: React.ReactNode;
  headerContent?: React.ReactNode;
  placement?: "center" | "right" | "inline";
  testId?: string;
  closeButtonTestId?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  maxWidth = "max-w-md",
  zIndex = 10020,
  headerActions,
  headerContent,
  placement = "center",
  testId,
  closeButtonTestId
}) => {
  const uniqueId = useId();

  useEffect(() => {
    if (isOpen) {
      registerOverlay(uniqueId, onClose, placement === "center");
      return () => {
        unregisterOverlay(uniqueId);
      };
    } else {
      unregisterOverlay(uniqueId);
    }
  }, [isOpen, onClose, placement, uniqueId]);

  if (!isOpen) return null;

  if (placement === "inline") {
    return (
      <div
        data-testid={testId}
        className={`w-full ${maxWidth} bg-white dark:bg-card border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs flex flex-col overflow-hidden h-full max-h-full min-h-0`}
      >
        {/* Header */}
        <div className="flex min-h-10 shrink-0 items-center justify-between border-b border-slate-100 dark:border-white/[0.06] px-4 py-2 bg-white dark:bg-card">
          <div className="flex min-w-0 flex-1 items-center gap-2 pr-1">
            <h2 className="flex min-w-0 flex-1 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
              {typeof title === "string" ? (
                <ModalHeaderTitle icon={<FileText size={14} className="text-indigo-600" />} title={title} />
              ) : title}
            </h2>
            {headerActions}
          </div>
          <Button
            data-testid={closeButtonTestId}
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            title="Đóng"
            className="relative h-7 w-7 shrink-0 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X size={16} />
          </Button>
        </div>
        {headerContent ? (
          <div className="shrink-0 border-b border-slate-100 dark:border-white/[0.06]">
            {headerContent}
          </div>
        ) : null}

        {/* Body */}
        <div className="flex-1 overflow-y-auto hide-scrollbar p-3 space-y-3">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-slate-100 dark:border-white/[0.06] bg-white dark:bg-card p-3 rounded-b-2xl shrink-0">
            {footer}
          </div>
        )}
      </div>
    );
  }

  if (typeof document === "undefined") return null;

  const stackDepth = getOverlayStackDepth(uniqueId);
  const effectiveZIndex = zIndex + stackDepth * 20;

  return createPortal((
    <div className={`fixed inset-0 flex ${placement === "right" ? "items-stretch justify-end p-0 md:pointer-events-none md:items-start md:pt-[72px] md:pr-3" : "items-center justify-center p-4"}`} style={{ zIndex: effectiveZIndex }}>
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 motion-reduce:animate-none dark:bg-black/80 ${placement === "right" ? "md:pointer-events-none md:bg-transparent md:backdrop-blur-none md:dark:bg-transparent" : ""}`}
        onClick={onClose} 
      />
      <div data-testid={testId} className={`relative w-full ${maxWidth} bg-card border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-modal dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85)] flex flex-col animate-in zoom-in-95 duration-200 motion-reduce:animate-none max-h-[90vh] ${placement === "right" ? "h-[100dvh] max-h-none rounded-none md:pointer-events-auto md:h-[calc(100dvh-84px)] md:!max-h-none md:rounded-2xl" : ""}`}>
        {/* Header */}
        <div className="flex min-h-11 shrink-0 items-center justify-between border-b border-slate-200/70 px-3.5 py-2 dark:border-white/[0.06]">
          <div className="flex min-w-0 flex-1 items-center gap-2 pr-1">
            <h2 className="flex min-w-0 flex-1 truncate text-[13px] font-black text-text sm:text-sm">
              {typeof title === "string" ? (
                <ModalHeaderTitle icon={<FileText size={15} />} title={title} />
              ) : title}
            </h2>
            {headerActions}
          </div>
          <Button
            data-testid={closeButtonTestId}
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            title="Đóng"
            className="relative h-8 w-8 shrink-0 rounded-lg text-muted transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-slate-100 hover:text-text motion-reduce:transition-none dark:hover:bg-white/10"
          >
            <X size={18} />
          </Button>
        </div>
        {headerContent ? (
          <div className="shrink-0 border-b border-slate-200/70 dark:border-white/[0.06]">
            {headerContent}
          </div>
        ) : null}
        
        {/* Body */}
        <div className={`flex-1 overflow-y-auto hide-scrollbar ${placement === "right" ? "p-3 md:p-4" : "p-5"}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className={`border-t border-slate-200/70 bg-slate-50/60 p-5 dark:border-white/[0.06] dark:bg-slate-900/60 ${placement === "right" ? "p-3 md:p-4 md:rounded-b-2xl" : "rounded-b-2xl"}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  ), document.body);
};
