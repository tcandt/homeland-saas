"use client";

import React, { useEffect } from "react";

export default function ProductionSecurityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Chỉ kích hoạt bảo vệ chống soi mã và tắt console trên môi trường Production
    const isProduction =
      process.env.NODE_ENV === "production" ||
      (typeof window !== "undefined" &&
        !window.location.hostname.includes("localhost") &&
        !window.location.hostname.includes("127.0.0.1"));

    if (!isProduction) {
      return;
    }

    // 1. Tắt toàn bộ console logs trên browser
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
      // Ignore if console is frozen
    }

    // 2. Chặn phím tắt DevTools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U)
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const key = (e.key || "").toLowerCase();

      // Ctrl + Shift + I (Inspect)
      // Ctrl + Shift + J (Console)
      // Ctrl + Shift + C (Inspect Element)
      if (isCtrlOrCmd && isShift && (key === "i" || key === "j" || key === "c")) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + U (View Source)
      if (isCtrlOrCmd && key === "u") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + S (Save page)
      if (isCtrlOrCmd && key === "s") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 3. Chặn chuột phải (Context Menu / Inspect Element)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("contextmenu", handleContextMenu, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, []);

  return <>{children}</>;
}
