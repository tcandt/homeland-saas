"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, 
  DoorOpen, 
  User, 
  Coins, 
  FileText, 
  Plus, 
  Loader2, 
  Clock, 
  ShieldCheck,
  Check
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useBuildingsQuery } from "../../lib/queries/buildings.queries";
import { useRoomsQuery } from "../../lib/queries/rooms.queries";
import { useCustomersQuery } from "../../lib/queries/customers.queries";
import { useCreateDepositMutation } from "../../lib/mutations/deposits.mutations";
import { customersApi } from "../../lib/api/customers.api";

interface CreateDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultBuildingId?: string;
  defaultRoomId?: string;
}

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export default function CreateDepositModal({
  isOpen,
  onClose,
  defaultBuildingId,
  defaultRoomId,
}: CreateDepositModalProps) {
  const { data: buildings = [] } = useBuildingsQuery();
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(defaultBuildingId || "");
  const [selectedRoomId, setSelectedRoomId] = useState<string>(defaultRoomId || "");

  // Customer mode: select existing vs enter new
  const [customerMode, setCustomerMode] = useState<"SELECT" | "NEW">("SELECT");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [newCustomerName, setNewCustomerName] = useState<string>("");
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>("");

  const [depositType, setDepositType] = useState<"BOOKING" | "SECURITY" | "RESERVATION">("BOOKING");
  const [amount, setAmount] = useState<number>(3000000);
  const [expiredDays, setExpiredDays] = useState<number>(7);
  const [expiredDate, setExpiredDate] = useState<string>("");
  const [note, setNote] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Queries
  const { data: rooms = [], isLoading: isLoadingRooms } = useRoomsQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : undefined
  );
  const { data: customersData } = useCustomersQuery({ limit: 100 });
  const customers = customersData?.data || [];

  const createDepositMutation = useCreateDepositMutation();

  // Set default building
  useEffect(() => {
    if (buildings.length > 0 && !selectedBuildingId) {
      setSelectedBuildingId(defaultBuildingId || buildings[0]?.id || "");
    }
  }, [buildings, defaultBuildingId, selectedBuildingId]);

  // Set default room
  useEffect(() => {
    if (rooms.length > 0 && !selectedRoomId) {
      const firstAvailable = rooms.find((r: any) => r.status === "AVAILABLE") || rooms[0];
      if (firstAvailable) {
        setSelectedRoomId(defaultRoomId || firstAvailable.id);
        if (firstAvailable.price) {
          setAmount(Number(firstAvailable.price) || 3000000);
        }
      }
    }
  }, [rooms, defaultRoomId, selectedRoomId]);

  // Calculate default expiration date
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + expiredDays);
    const dateStr = d.toISOString().split("T")[0];
    setExpiredDate(dateStr);
  }, [expiredDays]);

  const selectedRoom = rooms.find((r: any) => r.id === selectedRoomId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedRoomId) {
      setErrorMessage("Vui lòng chọn phòng cần đặt cọc.");
      return;
    }

    if (amount <= 0) {
      setErrorMessage("Số tiền cọc phải lớn hơn 0.");
      return;
    }

    setIsSubmitting(true);

    try {
      let finalCustomerId = selectedCustomerId;

      // If new customer, create first
      if (customerMode === "NEW") {
        if (!newCustomerName.trim() || !newCustomerPhone.trim()) {
          throw new Error("Vui lòng nhập họ tên và số điện thoại khách hàng.");
        }
        const createdCustomer = await customersApi.create({
          fullName: newCustomerName.trim(),
          phone: newCustomerPhone.trim(),
        });
        finalCustomerId = (createdCustomer as any).id || (createdCustomer as any).data?.id;
      }

      if (!finalCustomerId) {
        throw new Error("Vui lòng chọn hoặc nhập thông tin khách hàng.");
      }

      const payload = {
        roomId: selectedRoomId,
        customerId: finalCustomerId,
        type: depositType,
        amount: Number(amount),
        expiredAt: expiredDate ? new Date(`${expiredDate}T23:59:59Z`).toISOString() : null,
        note: note.trim() || null,
      };

      await createDepositMutation.mutateAsync(payload);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || "Có lỗi xảy ra khi tạo phiếu cọc.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#6366f1]/10 text-[#6366f1] flex items-center justify-center font-bold">
            <Coins size={18} />
          </div>
          <span>Tạo phiếu đặt cọc mới</span>
        </div>
      }
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[13px] rounded-xl font-medium">
            {errorMessage}
          </div>
        )}

        {/* 1. Chọn Tòa nhà & Phòng */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-text flex items-center gap-1.5">
              <Building2 size={15} className="text-muted" /> Tòa nhà
            </label>
            <select
              value={selectedBuildingId}
              onChange={(e) => {
                setSelectedBuildingId(e.target.value);
                setSelectedRoomId("");
              }}
              className="h-10 px-3 rounded-xl border border-border bg-card text-text text-[13px] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            >
              {buildings.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-text flex items-center gap-1.5">
              <DoorOpen size={15} className="text-muted" /> Chọn phòng
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => {
                const rId = e.target.value;
                setSelectedRoomId(rId);
                const r = rooms.find((x: any) => x.id === rId);
                if (r && r.price) setAmount(Number(r.price) || amount);
              }}
              disabled={isLoadingRooms}
              className="h-10 px-3 rounded-xl border border-border bg-card text-text text-[13px] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all disabled:opacity-50"
            >
              <option value="">-- Chọn phòng --</option>
              {rooms.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.code || r.name} • {currencyFormatter.format(r.price || 0)}đ/th {r.status === "AVAILABLE" ? "(Trống)" : `(${r.status})`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2. Khách hàng */}
        <div className="bg-black/[0.02] dark:bg-white/[0.02] border border-border/80 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-text flex items-center gap-1.5">
              <User size={15} className="text-muted" /> Khách thuê
            </span>
            <div className="flex items-center bg-black/5 dark:bg-white/5 p-0.5 rounded-lg text-[12px] font-bold">
              <button
                type="button"
                onClick={() => setCustomerMode("SELECT")}
                className={`px-3 py-1 rounded-md transition-all ${
                  customerMode === "SELECT" ? "bg-card text-text shadow-sm" : "text-muted"
                }`}
              >
                Khách có sẵn
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("NEW")}
                className={`px-3 py-1 rounded-md transition-all ${
                  customerMode === "NEW" ? "bg-card text-text shadow-sm" : "text-muted"
                }`}
              >
                + Khách mới
              </button>
            </div>
          </div>

          {customerMode === "SELECT" ? (
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="h-10 px-3 rounded-xl border border-border bg-card text-text text-[13px] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            >
              <option value="">-- Chọn khách hàng --</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} • {c.phone || "Không có SĐT"}
                </option>
              ))}
            </select>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Họ và tên khách hàng *"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="h-10 px-3 rounded-xl border border-border bg-card text-text text-[13px] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
              <input
                type="text"
                placeholder="Số điện thoại *"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="h-10 px-3 rounded-xl border border-border bg-card text-text text-[13px] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              />
            </div>
          )}
        </div>

        {/* 3. Loại cọc & Số tiền */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-text flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-muted" /> Loại cọc
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDepositType("BOOKING")}
                className={`h-10 px-3 rounded-xl border text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                  depositType === "BOOKING"
                    ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                    : "border-border text-muted hover:border-border/80"
                }`}
              >
                {depositType === "BOOKING" && <Check size={14} />} Cọc giữ chỗ
              </button>
              <button
                type="button"
                onClick={() => setDepositType("SECURITY")}
                className={`h-10 px-3 rounded-xl border text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                  depositType === "SECURITY"
                    ? "border-[#6366f1] bg-[#6366f1]/10 text-[#6366f1]"
                    : "border-border text-muted hover:border-border/80"
                }`}
              >
                {depositType === "SECURITY" && <Check size={14} />} Cọc bảo đảm HĐ
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-bold text-text flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Coins size={15} className="text-muted" /> Số tiền đặt cọc (VND)
              </span>
              <span className="text-[12px] text-primary font-black">
                {currencyFormatter.format(amount)} đ
              </span>
            </label>
            <input
              type="number"
              step={100000}
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              className="h-10 px-3 rounded-xl border border-border bg-card text-text text-[14px] font-bold focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
        </div>

        {/* Quick Amount Suggestion Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-muted uppercase">Gợi ý nhanh:</span>
          {[1000000, 2000000, 3000000, 5000000].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setAmount(val)}
              className="px-2.5 py-1 rounded-lg border border-border bg-card text-[12px] font-bold text-muted hover:text-text hover:border-primary/50 transition-colors"
            >
              {currencyFormatter.format(val)}đ
            </button>
          ))}
          {selectedRoom?.price && (
            <button
              type="button"
              onClick={() => setAmount(Number(selectedRoom.price))}
              className="px-2.5 py-1 rounded-lg border border-primary/30 bg-primary/5 text-[12px] font-bold text-primary hover:bg-primary/10 transition-colors"
            >
              1 tháng tiền phòng ({currencyFormatter.format(selectedRoom.price)}đ)
            </button>
          )}
        </div>

        {/* 4. Hạn giữ phòng */}
        {depositType === "BOOKING" && (
          <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
            <label className="text-[13px] font-bold text-text flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[#f97316]">
                <Clock size={15} /> Hạn giữ chỗ / Hết hạn cọc
              </span>
              <div className="flex items-center gap-1">
                {[3, 5, 7, 14].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setExpiredDays(days)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      expiredDays === days
                        ? "bg-[#f97316] text-white"
                        : "bg-black/5 dark:bg-white/5 text-muted"
                    }`}
                  >
                    +{days} ngày
                  </button>
                ))}
              </div>
            </label>
            <input
              type="date"
              value={expiredDate}
              onChange={(e) => {
                setExpiredDate(e.target.value);
                setExpiredDays(0);
              }}
              className="h-9 px-3 rounded-lg border border-border bg-card text-text text-[13px] font-medium outline-none"
            />
          </div>
        )}

        {/* 5. Ghi chú */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-bold text-text flex items-center gap-1.5">
            <FileText size={15} className="text-muted" /> Ghi chú thỏa thuận
          </label>
          <textarea
            rows={2}
            placeholder="Ví dụ: Đặt cọc giữ phòng đến ngày 10/09, dự kiến vào ở..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="p-3 rounded-xl border border-border bg-card text-text text-[13px] font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Hủy bỏ
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-[#6366f1] hover:bg-[#4f46e5] text-white font-bold px-6 shadow-sm shadow-[#6366f1]/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" /> Đang tạo...
              </>
            ) : (
              <>
                <Plus size={16} className="mr-1.5" /> Tạo phiếu cọc
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
