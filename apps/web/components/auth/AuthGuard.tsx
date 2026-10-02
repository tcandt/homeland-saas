"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth/auth-store";
import { Loader2 } from "lucide-react";
import PasswordChangePrompt from "@/components/auth/PasswordChangePrompt";
import {
  isPasswordChangePromptDeferred,
  shouldShowPasswordChangePrompt,
} from "@/lib/auth/password-change-prompt";
import { authApi } from "@/lib/api/auth.api";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [mounted, setMounted] = useState(false);
  const [passwordPromptReady, setPasswordPromptReady] = useState(false);
  const [passwordPromptDeferred, setPasswordPromptDeferred] = useState(false);
  const idleTimerRef = useRef<number | null>(null);
  const lastActivityRecordedAtRef = useRef(0);

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
    const requiresPasswordChange = Boolean(user?.mustChangePassword);

    if (!isAuthenticated && !isPublicPath) {
      router.replace("/login");
    } else if (isAuthenticated && !requiresPasswordChange && pathname === "/change-password") {
      router.replace("/");
    } else if (isAuthenticated && isPublicPath) {
      router.replace("/");
    }
  }, [isAuthenticated, pathname, mounted, router, user?.mustChangePassword]);

  useEffect(() => {
    if (!mounted || !user?.id) {
      setPasswordPromptDeferred(false);
      setPasswordPromptReady(false);
      return;
    }
    setPasswordPromptDeferred(isPasswordChangePromptDeferred(user.id));
    setPasswordPromptReady(true);
  }, [mounted, user?.id, user?.mustChangePassword]);

  useEffect(() => {
    if (!mounted || !isAuthenticated) return;

    const publicPaths = ["/login", "/register", "/forgot-password", "/reset-password"];
    if (publicPaths.includes(pathname)) return;

    let timeoutMs = 24 * 60 * 60 * 1000;
    const getTimeoutMs = () => {
      // The backend security endpoint is authoritative. Do not start a
      // logout countdown from a stale value left in localStorage.
      return timeoutMs;
    };

    const logoutForIdle = () => {
      // Clear session locally and redirect cleanly
      useAuthStore.getState().clearSession();
      router.replace("/login");
    };

    const resetIdleTimer = () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(logoutForIdle, getTimeoutMs());
    };

    const recordUserActivity = () => {
      resetIdleTimer();
      const now = Date.now();
      if (now - lastActivityRecordedAtRef.current < 60_000) return;
      lastActivityRecordedAtRef.current = now;
      void authApi.recordActivity().catch(() => {
        // A transient activity write failure must not end a valid local session.
      });
    };

    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "focus"];
    events.forEach((eventName) => window.addEventListener(eventName, recordUserActivity, { passive: true }));

    const handleTimeoutUpdated = () => {
      const stored = Number(localStorage.getItem("homeland_session_idle_timeout_minutes"));
      if (Number.isFinite(stored) && stored > 0) timeoutMs = stored * 60 * 1000;
      resetIdleTimer();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "homeland_session_idle_timeout_minutes") {
        const stored = Number(event.newValue);
        if (Number.isFinite(stored) && stored > 0) timeoutMs = stored * 60 * 1000;
        resetIdleTimer();
      }
    };
    window.addEventListener("homeland:session-timeout-updated", handleTimeoutUpdated);
    window.addEventListener("storage", handleStorage);

    resetIdleTimer();
    let active = true;
    void authApi.security()
      .then((settings) => {
        if (!active) return;
        timeoutMs = settings.idleTimeoutMinutes * 60 * 1000;
        localStorage.setItem("homeland_session_idle_timeout_minutes", String(settings.idleTimeoutMinutes));
        resetIdleTimer();
      })
      .catch(() => {
        // Keep the last known local value while offline.
      });

    return () => {
      active = false;
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
      events.forEach((eventName) => window.removeEventListener(eventName, recordUserActivity));
      window.removeEventListener("homeland:session-timeout-updated", handleTimeoutUpdated);
      window.removeEventListener("storage", handleStorage);
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

  if (isAuthenticated && !user?.mustChangePassword && pathname === "/change-password") {
    return null;
  }

  const showPasswordPrompt = Boolean(
    passwordPromptReady &&
    user &&
    shouldShowPasswordChangePrompt(Boolean(user.mustChangePassword), passwordPromptDeferred, pathname),
  );

  return (
    <>
      {children}
      {user && (
        <PasswordChangePrompt
          isOpen={showPasswordPrompt}
          user={user}
          onDeferred={() => setPasswordPromptDeferred(true)}
        />
      )}
    </>
  );
}
