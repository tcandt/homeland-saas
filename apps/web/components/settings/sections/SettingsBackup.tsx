"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Clock,
  Database,
  Download,
  HardDrive,
  Lock,
  Plus,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function SettingsBackup() {
  return (
    <div className="flex flex-col gap-4" data-testid="settings-backup-safe-state">
      {/* 1. Header & Safe State Banner */}
      <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Database size={18} />
            </span>
            <div>
              <h3 className="text-sm font-black text-text">Sao lưu & Phục hồi dữ liệu hệ thống</h3>
              <p className="text-xs text-muted">Chế độ an toàn: Dữ liệu sao lưu vận hành máy chủ</p>
            </div>
          </div>
          <Badge variant="warning" className="border-amber-500/30 bg-amber-500/10 text-amber-600 font-bold text-[11px]">
            Chưa kết nối backend
          </Badge>
        </div>
      </div>

      {/* 2. 4 Action Controls (Disabled in Safe State) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button
          variant="outline"
          disabled
          data-testid="backup-disabled-action"
          className="h-11 rounded-xl text-xs font-bold gap-2 cursor-not-allowed opacity-60"
        >
          <Plus size={14} /> Tạo bản sao lưu
        </Button>
        <Button
          variant="outline"
          disabled
          data-testid="backup-disabled-action"
          className="h-11 rounded-xl text-xs font-bold gap-2 cursor-not-allowed opacity-60"
        >
          <RotateCcw size={14} /> Khôi phục dữ liệu
        </Button>
        <Button
          variant="outline"
          disabled
          data-testid="backup-disabled-action"
          className="h-11 rounded-xl text-xs font-bold gap-2 cursor-not-allowed opacity-60"
        >
          <Download size={14} /> Tải bản lưu trữ
        </Button>
        <Button
          variant="outline"
          disabled
          data-testid="backup-disabled-action"
          className="h-11 rounded-xl text-xs font-bold gap-2 cursor-not-allowed opacity-60"
        >
          <Trash2 size={14} /> Dọn dẹp dữ liệu
        </Button>
      </div>

      {/* 3. Schedule config (Disabled) */}
      <Card className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock size={16} />
            </span>
            <div>
              <div className="text-xs font-bold text-text">Lịch trình sao lưu tự động hàng ngày</div>
              <div className="text-[11px] text-muted">Tự động chụp snapshot định kỳ vào 02:00 AM</div>
            </div>
          </div>
          <button
            type="button"
            disabled
            data-testid="backup-schedule-disabled"
            className="relative inline-flex h-5 w-9 shrink-0 cursor-not-allowed rounded-full bg-muted/30 opacity-50"
          >
            <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-0" />
          </button>
        </div>
      </Card>

      {/* 4. Empty State Table */}
      <Card className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="flex flex-col items-center justify-center gap-2">
          <HardDrive size={32} className="text-muted/60" />
          <h4 className="text-sm font-black text-text mt-2">Chưa có dữ liệu từ máy chủ</h4>
          <p className="text-xs text-muted max-w-sm">
            Tính năng quản lý snapshot trên web chỉ hiển thị khi có kết nối trực tiếp đến agent sao lưu backend.
          </p>
        </div>
      </Card>
    </div>
  );
}
