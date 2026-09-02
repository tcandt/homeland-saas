"use client";

import React from "react";
import { 
  GitMerge, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  PhoneCall, 
  ShieldCheck,
  Loader2,
  Users
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

interface TenantDeduplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export const TenantDeduplicateModal: React.FC<TenantDeduplicateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isLoading ? () => {} : onClose}
      maxWidth="max-w-lg"
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] font-bold text-slate-900 dark:text-white">
                Dọn dẹp & Gộp trùng lặp
              </h3>
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                Tự động
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quét và tối ưu hóa hồ sơ khách thuê thông minh
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="h-10 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Hủy bỏ
          </Button>

          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="group relative h-10 rounded-xl bg-gradient-to-r from-[#6d3df8] to-[#8b5cf6] px-5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all duration-200 hover:from-[#5e32dd] hover:to-[#7c4deb] hover:shadow-purple-500/40 active:scale-[0.98] disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang xử lý dữ liệu...
              </>
            ) : (
              <>
                <GitMerge className="mr-2 h-4 w-4 transition-transform group-hover:rotate-12" />
                Bắt đầu gộp hồ sơ
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        {/* Intro Message */}
        <p className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
          Hệ thống sẽ thực hiện kiểm tra toàn bộ danh bạ khách thuê và tiến hành xử lý tự động theo các bước:
        </p>

        {/* Feature breakdown cards */}
        <div className="grid gap-2.5">
          <div className="flex items-start gap-3 rounded-xl border border-purple-100 bg-purple-50/50 p-3 transition-colors dark:border-purple-900/30 dark:bg-purple-950/20">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300">
              <PhoneCall className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                1. Phát hiện trùng lặp SĐT & CCCD
              </h4>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Tìm kiếm chính xác các hồ sơ có cùng Số điện thoại hoặc số CCCD/CMND.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3 transition-colors dark:border-blue-900/30 dark:bg-blue-950/20">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                2. Chuyển giao toàn bộ giao dịch
              </h4>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Hợp nhất hợp đồng thuê, cọc phòng, hóa đơn và lịch sử sang hồ sơ chính.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 transition-colors dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                3. Giữ dữ liệu sạch & chuẩn xác 100%
              </h4>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Xóa các bản ghi rác thừa, giúp tính toán báo cáo và vận hành mượt mà.
              </p>
            </div>
          </div>
        </div>

        {/* Warning Callout */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-[11.5px] leading-relaxed">
            <strong className="font-semibold">Lưu ý quan trọng:</strong> Hành động này sẽ cập nhật trực tiếp cơ sở dữ liệu và <span className="underline decoration-amber-500/50">không thể hoàn tác</span>. Vui lòng xác nhận trước khi tiếp tục.
          </p>
        </div>
      </div>
    </Modal>
  );
};
export default TenantDeduplicateModal;
