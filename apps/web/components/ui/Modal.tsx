import React, { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";
import { Button } from "./Button";
import { ModalHeaderTitle } from "./ModalHeaderTitle";

// Global overlay stack to handle nested / stacked modals and drawers with ESC (LIFO)
type OverlayStackEntry = {
  id: string;
  onClose: () => void;
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

export function registerOverlay(id: string, onClose: () => void) {
  activeOverlayStack = activeOverlayStack.filter((item) => item.id !== id);
  activeOverlayStack.push({ id, onClose });

  if (typeof document !== "undefined") {
    document.body.style.overflow = "hidden";
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
    }
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
  testId,
  closeButtonTestId
}) => {
  const uniqueId = useId();

  useEffect(() => {
    if (isOpen) {
      registerOverlay(uniqueId, onClose);
      return () => {
        unregisterOverlay(uniqueId);
      };
    } else {
      unregisterOverlay(uniqueId);
    }
  }, [isOpen, onClose, uniqueId]);

  if (!isOpen || typeof document === "undefined") return null;

  const stackDepth = getOverlayStackDepth(uniqueId);
  const effectiveZIndex = zIndex + stackDepth * 20;

  return createPortal((
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: effectiveZIndex }}>
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 motion-reduce:animate-none dark:bg-black/80"
        onClick={onClose} 
      />
      <div data-testid={testId} className={`relative w-full ${maxWidth} bg-card border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-modal dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85)] flex flex-col animate-in zoom-in-95 duration-200 motion-reduce:animate-none max-h-[90vh]`}>
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
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 hide-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-5 border-t border-slate-200/70 dark:border-white/[0.06] bg-slate-50/60 dark:bg-slate-900/60 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  ), document.body);
};
