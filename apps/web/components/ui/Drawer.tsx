import React, { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

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
}

export const Drawer: React.FC<DrawerProps> = ({ isOpen, onClose, title, children, footer, size = "md", className = "", testId, closeTestId }) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div data-testid={testId} className="fixed inset-0 z-[100] flex justify-end">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose} 
      />
      <div className={`relative max-w-full bg-card h-full shadow-drawer animate-in slide-in-from-right duration-200 flex flex-col ${
        size === "sm" ? "w-[300px]" :
        size === "md" ? "w-[400px]" :
        size === "lg" ? "w-[720px]" :
        size === "xl" ? "w-[920px]" :
        "w-[100vw]"
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-black text-lg text-text">{title}</h2>
          <Button aria-label="Đóng" data-testid={closeTestId} variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X size={20} />
          </Button>
        </div>
        
        {/* Body */}
        <div className={`flex-1 overflow-y-auto p-4 hide-scrollbar ${className}`}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-border bg-surface">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
