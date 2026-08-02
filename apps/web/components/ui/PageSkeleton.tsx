"use client";

import React from "react";

type PageSkeletonProps = {
  titleLines?: number;
  kpiCount?: number;
  panelCount?: number;
};

export default function PageSkeleton({ titleLines = 1, kpiCount = 4, panelCount = 3 }: PageSkeletonProps) {
  return (
    <div className="flex flex-col gap-4 md:gap-5 animate-pulse">
      <div className="flex flex-col gap-2">
        <div className="h-8 w-64 rounded-xl bg-black/5 dark:bg-white/10" />
        {Array.from({ length: Math.max(0, titleLines - 1) }).map((_, index) => (
          <div key={index} className="h-4 w-96 max-w-full rounded-xl bg-black/5 dark:bg-white/10" />
        ))}
      </div>

      {kpiCount > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
          {Array.from({ length: kpiCount }).map((_, index) => (
            <div key={index} className="rounded-[16px] border border-border bg-card p-4 h-[84px]">
              <div className="h-3 w-20 rounded-full bg-black/5 dark:bg-white/10 mb-3" />
              <div className="h-6 w-16 rounded-full bg-black/5 dark:bg-white/10" />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {Array.from({ length: panelCount }).map((_, index) => (
          <div key={index} className="rounded-[20px] border border-border bg-card p-5 min-h-[180px]">
            <div className="h-4 w-40 rounded-full bg-black/5 dark:bg-white/10 mb-4" />
            <div className="space-y-3">
              <div className="h-3 w-full rounded-full bg-black/5 dark:bg-white/10" />
              <div className="h-3 w-5/6 rounded-full bg-black/5 dark:bg-white/10" />
              <div className="h-3 w-3/4 rounded-full bg-black/5 dark:bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
