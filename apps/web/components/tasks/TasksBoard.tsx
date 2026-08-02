"use client";

import React from "react";
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react";

export default function TasksBoard() {
  return (
    <div className="flex-1 w-full flex flex-col md:overflow-hidden h-full min-h-[500px]">
      <div className="hidden md:flex flex-1 gap-6 overflow-x-auto pb-4 pt-2 hide-scrollbar">
        {columns.map((col) => (
          <div
            key={col.id}
            className="flex-shrink-0 w-[300px] flex flex-col h-full bg-muted/20 dark:bg-muted/10 rounded-2xl p-4 border border-border/50 shadow-inner"
          >
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${col.color} shadow-sm`} />
                <h3 className="text-[13px] font-black text-text uppercase tracking-wide">{col.title}</h3>
              </div>
              <span className="text-[12px] font-bold text-muted bg-card px-2.5 py-0.5 rounded-full border border-border shadow-sm">
                0
              </span>
            </div>

            <div className="flex flex-col gap-3 flex-1 overflow-y-auto hide-scrollbar">
              <EmptyColumnState />
            </div>
          </div>
        ))}
      </div>

      <div className="flex md:hidden flex-col gap-4">
        <div>
          <h3 className="text-[12px] font-black text-muted uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">
            <AlertCircle size={14} className="text-[#ef4444]" /> Cần xử lý gấp
          </h3>
          <EmptyColumnState />
        </div>

        <div className="mt-2">
          <h3 className="text-[12px] font-black text-muted uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">
            <Clock size={14} /> Tất cả công việc
          </h3>
          <EmptyColumnState />
        </div>
      </div>
    </div>
  );
}

const columns = [
  { id: "todo", title: "Cần làm", color: "bg-muted" },
  { id: "inprogress", title: "Đang xử lý", color: "bg-[#3b82f6]" },
  { id: "review", title: "Chờ duyệt", color: "bg-[#f97316]" },
  { id: "done", title: "Hoàn thành", color: "bg-[#22c55e]" },
];

function EmptyColumnState() {
  return (
    <div className="flex flex-col items-center justify-center p-[24px] border-2 border-dashed border-border rounded-[16px] bg-black/5 dark:bg-white/5 opacity-70 min-h-[160px]">
      <CheckCircle2 size={24} className="text-muted mb-[8px]" />
      <span className="text-[12px] font-bold text-muted">Không có công việc nào</span>
    </div>
  );
}
