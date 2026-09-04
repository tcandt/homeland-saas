"use client";

import React, { useEffect } from "react";

export default function ProductionSecurityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // 1. Chặn các lỗi không mong muốn từ Web Vitals / Cloudflare beacon / extensions bên thứ ba (startTime, reportAllChanges)
    const handleGlobalError = (event: ErrorEvent) => {
      const msg = event?.message || "";
      const errorMsg = event?.error?.message || "";
      if (
        msg.includes("startTime") ||
        msg.includes("reportAllChanges") ||
        errorMsg.includes("startTime") ||
        errorMsg.includes("reportAllChanges")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
        return true;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reasonMsg = event?.reason?.message || String(event?.reason || "");
      if (
        reasonMsg.includes("startTime") ||
        reasonMsg.includes("reportAllChanges")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation?.();
      }
    };

    window.addEventListener("error", handleGlobalError, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection, true);

    // 2. Chỉ chạy bảo mật bổ sung trên môi trường production thực tế
    const isProduction =
      process.env.NODE_ENV === "production" &&
      typeof window !== "undefined" &&
      !window.location.hostname.includes("localhost") &&
      !window.location.hostname.includes("127.0.0.1");

    let cleanupKeys: (() => void) | undefined;

    if (isProduction) {
      // Giảm thiểu rò rỉ log trên môi trường production
      try {
        const noop = () => {};
        window.console.debug = noop;
      } catch {
        // Ignore
      }
    }

    return () => {
      window.removeEventListener("error", handleGlobalError, true);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection, true);
      cleanupKeys?.();
    };
  }, []);

  return <>{children}</>;
}


