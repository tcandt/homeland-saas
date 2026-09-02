"use client";

import React, { useEffect, useState, useRef } from "react";
import { ShieldAlert, RefreshCw, Lock } from "lucide-react";

export default function ProductionSecurityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const isDetectedRef = useRef(false);

  useEffect(() => {
    // Chỉ kích hoạt bảo vệ trên Production (hoặc domain không phải localhost / 127.0.0.1)
    const isProduction =
      process.env.NODE_ENV === "production" ||
      (typeof window !== "undefined" &&
        !window.location.hostname.includes("localhost") &&
        !window.location.hostname.includes("127.0.0.1"));

    if (!isProduction) {
      return;
    }

    // 1. Vô hiệu hóa toàn bộ console
    const noop = () => {};
    try {
      window.console.log = noop;
      window.console.info = noop;
      window.console.warn = noop;
      window.console.error = noop;
      window.console.debug = noop;
      window.console.table = noop;
      window.console.trace = noop;
      window.console.dir = noop;
    } catch {
      // Ignore
    }

    const triggerDetected = () => {
      if (!isDetectedRef.current) {
        isDetectedRef.current = true;
        setIsDevToolsOpen(true);
      }
    };

    // 2. Kỹ thuật 1: Kiểm tra kích thước cửa sổ (Docked DevTools - F12 mở sẵn trước khi vào trang)
    const checkDimensions = () => {
      const widthThreshold = window.outerWidth - window.innerWidth > 160;
      const heightThreshold = window.outerHeight - window.innerHeight > 160;
      if (widthThreshold || heightThreshold) {
        triggerDetected();
      }
    };

    // 3. Kỹ thuật 2: Bẫy Timing Debugger (Phát hiện DevTools mở trước hoặc mở sau, kể cả Undocked)
    const checkTimingDebugger = () => {
      const start = performance.now();
      try {
        // eslint-disable-next-line no-debugger
        Function("debugger")();
      } catch {}
      const duration = performance.now() - start;
      if (duration > 100) {
        triggerDetected();
      }
    };

    // 4. Kỹ thuật 3: Bẫy Getter Console (Chrome DevTools đọc thuộc tính khi Console mở)
    const checkConsoleGetter = () => {
      try {
        const dummy = /./;
        dummy.toString = () => {
          triggerDetected();
          return "";
        };
        // Trigger ngầm
        window.console.log(dummy);
      } catch {}
    };

    // Chạy kiểm tra ngay lập tức khi trang vừa load
    checkDimensions();
    checkTimingDebugger();
    checkConsoleGetter();

    // Duy trì kiểm tra liên tục mỗi 600ms
    const intervalId = setInterval(() => {
      checkDimensions();
      checkTimingDebugger();
      checkConsoleGetter();

      // Nếu đã phát hiện DevTools mở, kích hoạt vòng lặp debugger liên tục để đóng băng mã nguồn
      if (isDetectedRef.current) {
        try {
          Function("debugger")();
        } catch {}
      }
    }, 600);

    // 5. Chặn phím tắt mở DevTools
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        triggerDetected();
        return false;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const key = (e.key || "").toLowerCase();

      // Ctrl + Shift + I (Inspect), J (Console), C (Element Inspector)
      if (isCtrlOrCmd && isShift && (key === "i" || key === "j" || key === "c")) {
        e.preventDefault();
        e.stopPropagation();
        triggerDetected();
        return false;
      }

      // Ctrl + U (View Source), Ctrl + S (Save Page)
      if (isCtrlOrCmd && (key === "u" || key === "s")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 6. Chặn chuột phải (Context Menu)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("contextmenu", handleContextMenu, true);
    window.addEventListener("resize", checkDimensions);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("contextmenu", handleContextMenu, true);
      window.removeEventListener("resize", checkDimensions);
    };
  }, []);

  // Màn hình khóa bảo mật khi phát hiện DevTools
  if (isDevToolsOpen) {
    return (
      <div className="fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 shadow-2xl shadow-rose-500/20 animate-pulse">
          <ShieldAlert size={42} />
        </div>

        <div className="mt-6 max-w-md space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-400">
            <Lock size={12} /> Cảnh báo an ninh
          </div>
          <h1 className="text-2xl font-black text-white">
            Phát hiện công cụ DevTools
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Để bảo vệ an toàn dữ liệu khách hàng và bí mật kinh doanh của hệ thống, phiên làm việc này đã được tạm dừng bảo vệ.
          </p>
          <p className="text-xs text-slate-500">
            Vui lòng đóng công cụ kiểm tra (Inspect / DevTools / F12) và tải lại trang để tiếp tục sử dụng.
          </p>
        </div>

        <div className="mt-8">
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/30 transition-all hover:scale-105 active:scale-95"
          >
            <RefreshCw size={16} /> Tải lại trang
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
