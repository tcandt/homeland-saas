"use client";

import React from "react";

interface BrandLogoProps {
  variant?: "horizontal" | "icon" | "stacked" | "compact";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  theme?: "dark" | "light" | "auto";
  showTagline?: boolean;
}

export function HLEmblem({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 110 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Vibrant Emerald Gradient for 'H' */}
        <linearGradient id="hl-h-pure" x1="15" y1="18" x2="65" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#047857" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>

        {/* Radiant Mint Gradient for 'L' */}
        <linearGradient id="hl-l-pure" x1="50" y1="18" x2="98" y2="82" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>

        <filter id="hl-emblem-shadow" x="-8%" y="-8%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#047857" floodOpacity="0.2" />
        </filter>
      </defs>

      {/* Letter 'H' - Continuous Sharp Monogram */}
      <path
        d="M 33 18 
           L 46 18 
           L 38 45 
           L 54 45 
           L 62 18 
           L 75 18 
           L 54 82 
           L 41 82 
           L 48 56 
           L 32 56 
           L 24 82 
           L 11 82 
           Z"
        fill="url(#hl-h-pure)"
        filter="url(#hl-emblem-shadow)"
      />

      {/* Letter 'L' - Slanted Stem with Smooth Land Swoosh Base */}
      <path
        d="M 69 18 
           L 82 18 
           L 72.5 48.5 
           C 76 52 83 55.5 90 63 
           C 94 67.5 96.5 73.5 97 82 
           L 48 82 
           Z"
        fill="url(#hl-l-pure)"
        filter="url(#hl-emblem-shadow)"
      />

      {/* 4 Architectural Windows (2x2 Grid) */}
      <g fill="#10b981">
        <rect x="79" y="36" width="6.5" height="6.5" rx="1.2" />
        <rect x="88" y="36" width="6.5" height="6.5" rx="1.2" />
        <rect x="79" y="45.5" width="6.5" height="6.5" rx="1.2" />
        <rect x="88" y="45.5" width="6.5" height="6.5" rx="1.2" />
      </g>
    </svg>
  );
}

export default function BrandLogo({
  variant = "horizontal",
  size = "md",
  className = "",
  theme = "auto",
  showTagline = true,
}: BrandLogoProps) {
  const sizeMap = {
    xs: { icon: "h-6 w-7", text: "text-sm", sub: "text-[9px]", gap: "gap-1.5" },
    sm: { icon: "h-7 w-8", text: "text-base", sub: "text-[10px]", gap: "gap-2" },
    md: { icon: "h-9 w-10", text: "text-xl", sub: "text-[11px]", gap: "gap-2.5" },
    lg: { icon: "h-11 w-12", text: "text-2xl", sub: "text-xs", gap: "gap-3" },
    xl: { icon: "h-14 w-16", text: "text-3xl", sub: "text-sm", gap: "gap-3.5" },
  }[size];

  const textColor = {
    dark: "text-white",
    light: "text-slate-900",
    auto: "text-slate-900 dark:text-white",
  }[theme];

  const subColor = {
    dark: "text-emerald-400",
    light: "text-emerald-600",
    auto: "text-emerald-600 dark:text-emerald-400",
  }[theme];

  if (variant === "icon") {
    return (
      <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
        <HLEmblem className={sizeMap.icon} />
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center ${sizeMap.gap} ${className}`}>
        <HLEmblem className={sizeMap.icon} />
        <span className={`font-black tracking-tight ${sizeMap.text} ${textColor}`}>
          Home<span className="text-emerald-600 dark:text-emerald-400">Land</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center ${sizeMap.gap} ${className}`}>
      {/* Precision HL Emblem */}
      <div className="relative shrink-0 flex items-center justify-center">
        <HLEmblem className={sizeMap.icon} />
      </div>

      {/* Horizontal Typography */}
      <div className="flex flex-col leading-none select-none">
        <div className={`font-black tracking-tight flex items-baseline ${sizeMap.text} ${textColor}`}>
          <span className={theme === "light" ? "text-slate-900" : ""}>HOME</span>
          <span className="text-emerald-500 dark:text-emerald-400 ml-1.5">LAND</span>
        </div>

        {showTagline && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`font-bold uppercase tracking-[0.22em] ${sizeMap.sub} ${subColor}`}>
              PREMIUM CRM
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
