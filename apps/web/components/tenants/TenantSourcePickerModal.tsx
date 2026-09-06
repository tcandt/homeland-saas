"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  FileClock,
  Loader2,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { useCustomersQuery } from "@/lib/queries/customers.queries";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";

export type ExistingCustomerOption = {
  id: string;
  fullName?: string | null;
  phone?: string | null;
  identityNo?: string | null;
  address?: string | null;
  roomId?: string | null;
  _count?: {
    contracts?: number;
  };
};

type TenantSourcePickerModalProps = {
  isOpen: boolean;
  currentRoomId: string;
  currentOccupantIds: string[];
  onClose: () => void;
  onCreateNew: () => void;
  onSelectExisting: (customer: ExistingCustomerOption) => Promise<boolean>;
};

export default function TenantSourcePickerModal({
  isOpen,
  currentRoomId,
  currentOccupantIds,
  onClose,
  onCreateNew,
  onSelectExisting,
}: TenantSourcePickerModalProps) {
  const [view, setView] = useState<"choose" | "existing">("choose");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectingCustomerId, setSelectingCustomerId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setView("choose");
    setSearch("");
    setDebouncedSearch("");
    setSelectingCustomerId(null);
  }, [isOpen]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const customerQuery = useCustomersQuery({
    page: 1,
    limit: 50,
    search: debouncedSearch || undefined,
  });

  const occupantIdSet = useMemo(() => new Set(currentOccupantIds.filter(Boolean)), [currentOccupantIds]);
  const availableCustomers = useMemo(() => {
    const items = customerQuery.data?.data || [];
    return items.filter((customer: ExistingCustomerOption) => !occupantIdSet.has(customer.id));
  }, [customerQuery.data, occupantIdSet]);

  const handleSelect = async (customer: ExistingCustomerOption) => {
    if (selectingCustomerId) return;
    setSelectingCustomerId(customer.id);
    try {
      await onSelectExisting(customer);
    } finally {
      setSelectingCustomerId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={view === "choose" ? "Thêm khách thuê" : "Chọn khách thuê có sẵn"}
      maxWidth={view === "choose" ? "max-w-2xl" : "max-w-xl"}
      testId="tenant-source-picker-modal"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          {view === "existing" ? (
            <Button
              variant="outline"
              onClick={() => setView("choose")}
              disabled={Boolean(selectingCustomerId)}
            >
              <ArrowLeft size={16} className="mr-2" />
              Quay lại
            </Button>
          ) : (
            <span />
          )}
          <Button variant="outline" onClick={onClose} disabled={Boolean(selectingCustomerId)}>
            Hủy
          </Button>
        </div>
      }
    >
      {view === "choose" ? (
        <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-2">
          <button
            type="button"
            data-testid="tenant-source-existing"
            onClick={() => setView("existing")}
            className="group min-h-[168px] rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/50 hover:bg-primary/[0.03] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
              <Users size={22} />
            </span>
            <span className="block text-base font-black text-text">Khách có sẵn</span>
            <span className="mt-1.5 block text-sm leading-5 text-muted">
              Tìm theo tên, số điện thoại hoặc CCCD và dùng lại hồ sơ đã lưu.
            </span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-primary">
              Chọn trong danh sách
              <CheckCircle2 size={14} />
            </span>
          </button>

          <button
            type="button"
            data-testid="tenant-source-new"
            onClick={onCreateNew}
            className="group min-h-[168px] rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-emerald-500/50 hover:bg-emerald-500/[0.03] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 transition-colors group-hover:bg-emerald-500 group-hover:text-white dark:text-emerald-400">
              <UserPlus size={22} />
            </span>
            <span className="block text-base font-black text-text">Khách mới</span>
            <span className="mt-1.5 block text-sm leading-5 text-muted">
              Tạo hồ sơ khách mới, nhập thông tin cá nhân và thiết lập hợp đồng.
            </span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              Tạo hồ sơ mới
              <UserPlus size={14} />
            </span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 py-1">
          <div>
            <label htmlFor="existing-tenant-search" className="mb-1.5 block text-sm font-bold text-text">
              Tìm khách thuê
            </label>
            <div className="relative">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <Input
                id="existing-tenant-search"
                data-testid="existing-tenant-search"
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nhập tên, số điện thoại hoặc CCCD..."
                className="pl-10"
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Hệ thống sẽ kiểm tra phòng và hợp đồng hiện tại trước khi sử dụng hồ sơ.
            </p>
          </div>

          <div className="max-h-[360px] overflow-y-auto rounded-2xl border border-border bg-surface/30 p-2">
            {customerQuery.isLoading || customerQuery.isFetching ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-sm text-muted">
                <Loader2 size={22} className="animate-spin text-primary" />
                Đang tìm khách thuê...
              </div>
            ) : customerQuery.isError ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-5 text-center">
                <FileClock size={24} className="text-rose-500" />
                <p className="text-sm font-bold text-text">Không thể tải danh sách khách thuê</p>
                <p className="text-xs text-muted">Vui lòng đóng popup và thử lại.</p>
              </div>
            ) : availableCustomers.length === 0 ? (
              <div className="flex min-h-44 flex-col items-center justify-center px-5 text-center">
                <Users size={26} className="mb-2 text-muted" />
                <p className="text-sm font-bold text-text">
                  {debouncedSearch ? "Không tìm thấy hồ sơ phù hợp" : "Chưa có khách nào có thể chọn"}
                </p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted">
                  Kiểm tra lại từ khóa hoặc tạo hồ sơ mới cho khách thuê này.
                </p>
                <Button size="sm" className="mt-3" onClick={onCreateNew}>
                  <UserPlus size={14} className="mr-1.5" />
                  Tạo khách mới
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {availableCustomers.map((customer: ExistingCustomerOption) => {
                  const isInAnotherRoom = Boolean(customer.roomId && customer.roomId !== currentRoomId);
                  const isInCurrentRoom = customer.roomId === currentRoomId;
                  const isAssignedToRoom = isInAnotherRoom || isInCurrentRoom;
                  const isSelecting = selectingCustomerId === customer.id;
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      data-testid={`existing-tenant-${customer.id}`}
                      onClick={() => handleSelect(customer)}
                      disabled={Boolean(selectingCustomerId) || isAssignedToRoom}
                      className="flex min-h-[72px] w-full items-center gap-3 rounded-xl border border-transparent bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/30 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">
                        {(customer.fullName || "K").trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black text-text">
                          {customer.fullName || "Khách chưa có tên"}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">
                          {customer.phone || "Chưa có SĐT"}
                          {customer.identityNo ? ` · CCCD ${customer.identityNo}` : ""}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                          {isAssignedToRoom ? (
                            <span className="text-amber-600 dark:text-amber-400">
                              {isInCurrentRoom ? "Đã có trong phòng hiện tại" : "Đang được gắn với phòng khác"}
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400">Có thể kiểm tra và chọn</span>
                          )}
                          {Number(customer._count?.contracts || 0) > 0 && (
                            <span className="text-muted">
                              {customer._count?.contracts} hợp đồng trong lịch sử
                            </span>
                          )}
                        </span>
                      </span>
                      {isSelecting ? (
                        <Loader2 size={18} className="shrink-0 animate-spin text-primary" />
                      ) : (
                        <CheckCircle2 size={18} className="shrink-0 text-muted" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
