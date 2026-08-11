"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth/auth-store";
import { Loader2 } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [mounted, setMounted] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // Wait for Zustand persist to hydrate before checking auth state
    const checkHydration = () => {
      if (useAuthStore.persist.hasHydrated()) {
        setMounted(true);
      } else {
        setTimeout(checkHydration, 10);
      }
    };
    checkHydration();
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password"];
    const isPublicPath = publicPaths.includes(pathname);

    if (!isAuthenticated && !isPublicPath) {
      router.replace("/login");
    } else if (isAuthenticated && isPublicPath) {
      router.replace("/");
    }
  }, [isAuthenticated, pathname, mounted, router]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;

    const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password"];
    if (publicPaths.includes(pathname)) return;

    const logoutForIdle = () => {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api/v1"}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        }).catch(() => undefined);
      }
      useAuthStore.getState().clearSession();
      router.replace("/login");
    };

    const resetIdleTimer = () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(logoutForIdle, 5 * 60 * 1000);
    };

    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "focus"];
    events.forEach((eventName) => window.addEventListener(eventName, resetIdleTimer, { passive: true }));
    resetIdleTimer();

    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      events.forEach((eventName) => window.removeEventListener(eventName, resetIdleTimer));
    };
  }, [mounted, isAuthenticated, pathname, router]);

  // Prevent hydration mismatch and hide content until auth state is known
  if (!mounted) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 className="w-8 h-8 animate-spin text-[#6366f1]" />
      </div>
    );
  }

  const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password"];
  if (!isAuthenticated && !publicPaths.includes(pathname)) {
    return null; // Will redirect
  }

  if (isAuthenticated && publicPaths.includes(pathname)) {
    return null; // Will redirect
  }

  return <>{children}</>;
}
