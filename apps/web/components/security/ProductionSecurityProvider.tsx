"use client";

import React, { useEffect } from "react";

export default function ProductionSecurityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Chỉ chạy trên môi trường production thực tế
    const isProduction =
      process.env.NODE_ENV === "production" &&
      typeof window !== "undefined" &&
      !window.location.hostname.includes("localhost") &&
      !window.location.hostname.includes("127.0.0.1");

    if (!isProduction) {
      return;
    }

    // 1. Giảm thiểu rò rỉ log trên môi trường production
    try {
      const noop = () => {};
      window.console.log = noop;
      window.console.info = noop;
      window.console.debug = noop;
      window.console.dir = noop;
      window.console.table = noop;
    } catch {
      // Ignore
    }

    // 2. Chặn các phím tắt kiểm tra mã nguồn cơ bản trên desktop (không ảnh hưởng mobile)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        return false;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const key = (e.key || "").toLowerCase();

      // Ctrl + Shift + I (Inspect), J (Console), C (Element Inspector)
      if (isCtrlOrCmd && isShift && (key === "i" || key === "j" || key === "c")) {
        e.preventDefault();
        return false;
      }

      // Ctrl + U (View Source)
      if (isCtrlOrCmd && key === "u") {
        e.preventDefault();
        return false;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, []);

  return <>{children}</>;
}

