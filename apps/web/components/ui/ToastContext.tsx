"use client";
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { Check, AlertCircle, Info, X } from "lucide-react";
import { createPortal } from "react-dom";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {mounted && createPortal(
        <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-2 pointer-events-none">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto flex items-center gap-3 bg-card border border-border shadow-lg rounded-[12px] px-4 py-3 min-w-[280px] animate-in slide-in-from-right-8 fade-in duration-300">
              {t.type === "success" && <div className="w-[24px] h-[24px] rounded-full bg-indigo-500/10 flex items-center justify-center shrink-0"><Check size={14} className="text-indigo-500" /></div>}
              {t.type === "error" && <div className="w-[24px] h-[24px] rounded-full bg-rose-500/10 flex items-center justify-center shrink-0"><AlertCircle size={14} className="text-rose-500" /></div>}
              {t.type === "info" && <div className="w-[24px] h-[24px] rounded-full bg-blue-500/10 flex items-center justify-center shrink-0"><Info size={14} className="text-blue-500" /></div>}
              <span className="text-[13px] font-bold text-text flex-1">{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="text-muted hover:text-text transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
};
