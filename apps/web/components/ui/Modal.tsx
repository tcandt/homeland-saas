import React, { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  maxWidth = "max-w-md"
}) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose} 
      />
      <div className={`relative w-full ${maxWidth} bg-card rounded-2xl shadow-modal flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-black text-xl text-text">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full -mr-2">
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
