"use client";

import React from "react";
import {
  AlertTriangle,
  CalendarClock,
  CloudOff,
  Database,
  Download,
  FileArchive,
  History,
  LockKeyhole,
  RefreshCcw,
  ServerCog,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";

const unavailableActions = [
  {
    label: "Sao lưu ngay",
    description: "Tạo một bản sao lưu mới",
    icon: Database,
  },
  {
    label: "Tải bản sao",
    description: "Tải bản sao đã được xác minh",
    icon: Download,
  },
  {
    label: "Nhập dữ liệu",
    description: "Nhập tệp sao lưu từ bên ngoài",
    icon: Upload,
  },
  {
    label: "Khôi phục dữ liệu",
    description: "Phục hồi cơ sở dữ liệu từ bản sao",
    icon: RefreshCcw,
  },
] as const;

const connectionStates = [
  {
    label: "API sao lưu",
    value: "Chưa kết nối",
    detail: "Chưa có API tạo và xác minh bản sao lưu.",
    icon: ServerCog,
  },
  {
    label: "Kho lưu trữ",
    value: "Chưa xác định",
    detail: "Hệ thống chưa nhận thông tin kho lưu trữ từ máy chủ.",
    icon: CloudOff,
  },
  {
    label: "Lịch tự động",
    value: "Chưa khả dụng",
    detail: "Chưa có tác vụ nền được kết nối với giao diện này.",
    icon: CalendarClock,
  },
] as const;

export default function SettingsBackup() {
  return (
    <div className="flex flex-col gap-[20px]" data-testid="settings-backup-safe-state">
      <section className="overflow-hidden rounded-[8px] border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-[16px] border-b border-border px-[20px] py-[20px] sm:flex-row sm:items-start sm:justify-between sm:px-[24px]">
          <div className="flex min-w-0 items-start gap-[12px]">
            <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[17px] font-black text-text">Sao lưu và khôi phục dữ liệu</h2>
              <p className="mt-[4px] max-w-[760px] text-[13px] font-medium leading-[20px] text-muted">
                Giao diện chỉ hiển thị trạng thái do máy chủ cung cấp. Không có thao tác sao lưu hoặc khôi phục nào được mô phỏng trên trình duyệt.
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit shrink-0 items-center gap-[7px] rounded-[6px] border border-warning/30 bg-warning/10 px-[10px] py-[7px] text-[12px] font-bold text-warning">
            <LockKeyhole size={14} aria-hidden="true" />
            Backup thủ công chưa kết nối
          </span>
        </div>

        <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {connectionStates.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.label} className="flex min-h-[146px] flex-col gap-[10px] px-[20px] py-[18px] sm:px-[24px]">
                <div className="flex items-center gap-[9px] text-muted">
                  <Icon size={17} aria-hidden="true" />
                  <span className="text-[12px] font-bold">{item.label}</span>
                </div>
                <strong className="text-[15px] font-black text-text">{item.value}</strong>
                <p className="text-[12px] font-medium leading-[18px] text-muted">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[8px] border border-warning/30 bg-warning/5 px-[20px] py-[18px] sm:px-[24px]">
        <div className="flex items-start gap-[12px]">
          <AlertTriangle className="mt-[1px] shrink-0 text-warning" size={19} aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-[14px] font-black text-text">Chưa thể quản lý bản sao lưu tại đây</h3>
            <p className="mt-[5px] text-[13px] font-medium leading-[20px] text-muted">
              Backend chưa cung cấp API tạo, liệt kê, tải xuống, xác minh hoặc khôi phục bản sao thủ công. Backup trước khi cập nhật vẫn do update runner xử lý theo job cập nhật; phần này chỉ dành cho quản lý backup dữ liệu độc lập.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[8px] border border-border bg-card shadow-sm">
        <div className="border-b border-border px-[20px] py-[16px] sm:px-[24px]">
          <h3 className="text-[15px] font-black text-text">Thao tác dữ liệu</h3>
          <p className="mt-[3px] text-[12px] font-medium text-muted">Các thao tác được khóa cho đến khi API và kiểm soát quyền hoàn chỉnh.</p>
        </div>

        <div className="grid grid-cols-1 gap-[10px] p-[16px] sm:grid-cols-2 sm:p-[20px] xl:grid-cols-4">
          {unavailableActions.map((action) => {
            const Icon = action.icon;

            return (
              <Button
                key={action.label}
                type="button"
                variant="outline"
                disabled
                aria-disabled="true"
                data-testid="backup-disabled-action"
                className="h-auto min-h-[72px] w-full justify-start gap-[12px] rounded-[8px] px-[14px] py-[12px] text-left"
              >
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[7px] bg-background text-muted">
                  <Icon size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-black text-text">{action.label}</span>
                  <span className="mt-[2px] block whitespace-normal text-[11px] font-medium leading-[16px] text-muted">
                    {action.description}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-[20px] xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]">
        <div className="rounded-[8px] border border-border bg-card shadow-sm">
          <div className="flex items-center gap-[9px] border-b border-border px-[20px] py-[16px] sm:px-[24px]">
            <History size={17} className="text-primary" aria-hidden="true" />
            <h3 className="text-[15px] font-black text-text">Lịch sử sao lưu</h3>
          </div>
          <div className="flex min-h-[210px] flex-col items-center justify-center px-[20px] py-[32px] text-center" data-testid="backup-history-unavailable">
            <span className="flex h-[48px] w-[48px] items-center justify-center rounded-[8px] border border-border bg-background text-muted">
              <FileArchive size={21} aria-hidden="true" />
            </span>
            <strong className="mt-[13px] text-[14px] font-black text-text">Chưa có dữ liệu từ máy chủ</strong>
            <p className="mt-[5px] max-w-[480px] text-[12px] font-medium leading-[18px] text-muted">
              Danh sách chỉ xuất hiện sau khi backend trả về bản sao thật cùng thời gian, kích thước và trạng thái xác minh.
            </p>
          </div>
        </div>

        <div className="rounded-[8px] border border-border bg-card shadow-sm">
          <div className="flex items-center gap-[9px] border-b border-border px-[20px] py-[16px]">
            <CalendarClock size={17} className="text-primary" aria-hidden="true" />
            <h3 className="text-[15px] font-black text-text">Lịch tự động</h3>
          </div>
          <div className="flex min-h-[210px] flex-col gap-[14px] p-[20px]">
            <div className="flex items-start justify-between gap-[16px]">
              <div>
                <div className="text-[13px] font-black text-text">Sao lưu định kỳ</div>
                <p className="mt-[3px] text-[11px] font-medium leading-[16px] text-muted">Chưa kết nối tác vụ nền.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked="false"
                aria-label="Sao lưu định kỳ chưa khả dụng"
                disabled
                data-testid="backup-schedule-disabled"
                className="relative h-[24px] w-[42px] shrink-0 cursor-not-allowed rounded-full bg-muted/20 opacity-60"
              >
                <span className="absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-card shadow-sm" />
              </button>
            </div>
            <div className="mt-auto rounded-[7px] border border-border bg-background px-[12px] py-[10px] text-[11px] font-medium leading-[17px] text-muted">
              Chỉ cho phép cấu hình lịch sau khi máy chủ có cơ chế chạy nền, nhật ký thực thi và cảnh báo khi sao lưu thất bại.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
