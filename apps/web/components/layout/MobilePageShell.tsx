"use client";

import React from "react";

export default function MobilePageShell({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`mobile-page-shell w-full ${className}`}>
      {children}
    </div>
  );
}
