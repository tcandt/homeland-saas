"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root Global Error caught:", error);
  }, [error]);

  return (
    <html lang="vi">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 p-6 text-slate-900 dark:text-white antialiased font-sans">
        <div className="flex flex-col items-center justify-center max-w-md w-full p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 text-red-600 rounded-2xl flex items-center justify-center mb-5">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold mb-2">Đã có lỗi hệ thống xảy ra</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Trang web gặp sự cố tạm thời hoặc bộ nhớ đệm trình duyệt bị lệch phiên bản sau khi cập nhật.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={() => reset()}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              <RefreshCcw size={16} />
              Thử lại
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors"
            >
              Tải lại trang (F5)
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
