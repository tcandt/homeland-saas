import React, { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  zIndex?: number;
  headerActions?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  maxWidth = "max-w-md",
  zIndex = 10020,
  headerActions
}) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex }}>
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose} 
      />
      <div className={`relative w-full ${maxWidth} bg-card rounded-2xl shadow-modal flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
            <h2 className="font-black text-xl text-text truncate">{title}</h2>
            {headerActions}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full -mr-2 shrink-0">
            <X size={20} />
          </Button>
        </div>
        
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 hide-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-5 border-t border-border bg-surface rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
