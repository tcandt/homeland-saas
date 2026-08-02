"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth/auth-store";
import { Loader2 } from "lucide-react";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [mounted, setMounted] = useState(false);

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
