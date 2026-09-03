"use client";

import React, { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, X, Loader2 } from "lucide-react";
import { registerOverlay, unregisterOverlay, getOverlayStackDepth } from "./Modal";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
  icon?: React.ReactNode;
  zIndex?: number;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Xác nhận",
  cancelText = "Hủy bỏ",
  variant = "danger",
  isLoading = false,
  icon,
  zIndex = 100100,
}: ConfirmDialogProps) {
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

  const variantStyles = {
    danger: {
      iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
      btn: "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-sm shadow-rose-600/20",
    },
    warning: {
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      btn: "bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-sm shadow-amber-600/20",
    },
    primary: {
      iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20",
      btn: "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white shadow-sm shadow-indigo-600/20",
    },
  }[variant];

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4 selection:bg-indigo-600 selection:text-white"
      style={{ zIndex: effectiveZIndex }}
    >
      {/* Dark Blur Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Modern Slim Card */}
      <div className="relative w-full max-w-[440px] rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl shadow-black/30 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${variantStyles.iconBg}`}>
              {icon || (variant === "danger" ? <Trash2 size={18} /> : <AlertTriangle size={18} />)}
            </div>
            <h3 className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <div className="text-[13.5px] font-normal leading-relaxed text-slate-600 dark:text-slate-300">
            {description}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="inline-flex h-9 items-center justify-center px-4 rounded-xl text-[13px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-xs transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`inline-flex h-9 items-center justify-center gap-1.5 px-4.5 rounded-xl text-[13px] font-bold transition-all cursor-pointer disabled:opacity-60 disabled:pointer-events-none active:scale-[0.98] ${variantStyles.btn}`}
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin text-white" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
