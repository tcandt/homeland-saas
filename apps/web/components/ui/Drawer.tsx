import React, { useEffect, useId } from "react";
import { FileText, X } from "lucide-react";
import { Button } from "./Button";
import { ModalHeaderTitle } from "./ModalHeaderTitle";
import { registerOverlay, unregisterOverlay, getOverlayStackDepth } from "./Modal";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  testId?: string;
  closeTestId?: string;
  headerActions?: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children, footer, size = "md", className = "", testId, closeTestId, headerActions }) => {
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

  if (!isOpen) return null;

  const stackDepth = getOverlayStackDepth(uniqueId);
  const effectiveZIndex = 100 + stackDepth * 20;

  return (
    <div data-testid={testId} className="fixed inset-0 flex justify-end" style={{ zIndex: effectiveZIndex }}>
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200 motion-reduce:animate-none dark:bg-black/80"
        onClick={onClose} 
      />
      <div className={`relative max-w-full bg-card h-full border-l border-slate-200/80 dark:border-white/[0.08] shadow-drawer dark:shadow-[-15px_0_60px_rgba(0,0,0,0.85)] animate-in slide-in-from-right duration-200 motion-reduce:animate-none flex flex-col ${
        size === "sm" ? "w-[300px]" :
        size === "md" ? "w-[400px]" :
        size === "lg" ? "w-[720px]" :
        size === "xl" ? "w-[920px]" :
        "w-[100vw]"
      }`}>
        {/* Header */}
        <div className="flex min-h-11 shrink-0 items-center justify-between border-b border-slate-200/70 px-3.5 py-2 dark:border-white/[0.06]">
          <div className="flex min-w-0 flex-1 items-center gap-2 pr-1">
            <h2 className="flex min-w-0 flex-1 truncate text-sm font-black text-text">
              {typeof title === "string" ? (
                <ModalHeaderTitle icon={<FileText size={15} />} title={title} />
              ) : title}
            </h2>
            {headerActions}
          </div>
          <Button aria-label="Đóng cửa sổ" title="Đóng" data-testid={closeTestId} variant="ghost" size="icon" onClick={onClose} className="relative h-8 w-8 shrink-0 rounded-lg text-muted after:absolute after:-inset-1.5 after:content-[''] hover:bg-slate-100 hover:text-text motion-reduce:transition-none dark:hover:bg-white/10">
            <X size={17} />
          </Button>
        </div>
        
        {/* Body */}
        <div className={`flex-1 overflow-y-auto p-4 hide-scrollbar ${className}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-slate-200/70 dark:border-white/[0.06] bg-slate-50/60 dark:bg-slate-900/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
