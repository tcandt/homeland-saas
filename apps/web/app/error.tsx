"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

import AppShell from "@/components/layout/AppShell";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global Error Boundary caught:", error);
  }, [error]);

  const errorMessage = error?.message || "";
  const isNetworkError = errorMessage.includes("fetch") || errorMessage.includes("Network") || errorMessage.includes("Timeout");
  const is403 = errorMessage.includes("403");
  const is404 = errorMessage.includes("404");

  let title = "Something went wrong!";
  let desc = "An unexpected error occurred. Our team has been notified.";

  if (isNetworkError) {
    title = "Network Connection Error";
    desc = "We're having trouble connecting to the server. Please check your internet connection.";
  } else if (is403) {
    title = "Permission Denied";
    desc = "You do not have access to view this resource.";
  } else if (is404) {
    title = "Not Found";
    desc = "The resource you are looking for could not be found.";
  }

  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">
          {title}
        </h2>
        <p className="text-slate-500 max-w-md mx-auto mb-8">
          {desc}
        </p>
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
        >
          <RefreshCcw size={18} />
          Try again
        </button>
      </div>
    </AppShell>
  );
}
