"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Calendar, Clock, MessageSquare, ShieldCheck, Sparkles, Zap } from "lucide-react";
import {
  useMonthlySettlementSettingsQuery,
  useSaveSettlementSettingsMutation,
} from "@/lib/queries/monthly-settlement.queries";
import toast from "react-hot-toast";

interface SettlementSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettlementSettingsModal({
  isOpen,
  onClose,
}: SettlementSettingsModalProps) {
  const { data: settingsData, isLoading } = useMonthlySettlementSettingsQuery();
  const saveMutation = useSaveSettlementSettingsMutation();

  const [autoCloseEnabled, setAutoCloseEnabled] = useState(true);
  const [closingDay, setClosingDay] = useState<string>("LAST_DAY");
  const [autoSendNotification, setAutoSendNotification] = useState(true);
  const [notificationHour, setNotificationHour] = useState(8);
  const [notificationMinute, setNotificationMinute] = useState(0);
  const [notificationDay, setNotificationDay] = useState(1);
  const [notificationChannel, setNotificationChannel] = useState("ZALO");

  useEffect(() => {
    if (settingsData) {
      setAutoCloseEnabled(settingsData.autoCloseEnabled !== false);
      setClosingDay(settingsData.closingDay === "LAST_DAY" ? "LAST_DAY" : String(settingsData.closingDay || "LAST_DAY"));
      setAutoSendNotification(settingsData.autoSendNotification !== false);
      setNotificationHour(settingsData.notificationHour ?? 8);
      setNotificationMinute(settingsData.notificationMinute ?? 0);
      setNotificationDay(settingsData.notificationDay ?? 1);
      setNotificationChannel(settingsData.notificationChannel || "ZALO");
    }
  }, [settingsData]);

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync({
        autoCloseEnabled,
        closingDay: closingDay === "LAST_DAY" ? "LAST_DAY" : Number(closingDay),
        autoSendNotification,
        notificationHour: Number(notificationHour),
        notificationMinute: Number(notificationMinute),
        notificationDay: Number(notificationDay),
        notificationChannel,
      });
      toast.success("Đã lưu cấu hình tự động chốt & gửi thông báo thành công!");
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Lỗi lưu cấu hình");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cấu hình Tự động Chốt tháng & Gửi thông báo (GMT+7)"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pt-2">
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex items-start gap-3">
          <Sparkles size={18} className="text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-text leading-relaxed">
            Hệ thống áp dụng <strong>Múi giờ Việt Nam (GMT+7)</strong>. Mặc định tự động tổng hợp số liệu phòng, điện, nước vào <strong>ngày cuối cùng của tháng</strong> và tự động gửi tin nhắn thanh toán Zalo vào <strong>08:00 sáng ngày 01 của tháng mới</strong>.
          </p>
        </div>

        {/* 1. Tự động chốt số liệu */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs text-text">
              <Calendar size={16} className="text-primary" />
              Tự động chốt tháng & khóa số công tơ điện
            </div>
            <Switch checked={autoCloseEnabled} onChange={(e) => setAutoCloseEnabled(e.target.checked)} />
          </div>

          {autoCloseEnabled && (
            <div className="pt-2">
              <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                Ngày chốt mặc định
              </label>
              <select
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-text outline-none focus:border-primary shadow-xs"
              >
                <option value="LAST_DAY">Ngày cuối cùng của tháng (Mặc định: 28, 29, 30 hoặc 31)</option>
                <option value="25">Ngày 25 hàng tháng</option>
                <option value="28">Ngày 28 hàng tháng</option>
                <option value="30">Ngày 30 hàng tháng</option>
              </select>
            </div>
          )}
        </div>

        {/* 2. Tự động gửi thông báo thanh toán */}
        <div className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xs text-text">
              <Clock size={16} className="text-emerald-600" />
              Tự động gửi thông báo thanh toán cho khách
            </div>
            <Switch checked={autoSendNotification} onChange={(e) => setAutoSendNotification(e.target.checked)} />
          </div>

          {autoSendNotification && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                    Ngày gửi thông báo
                  </label>
                  <select
                    value={notificationDay}
                    onChange={(e) => setNotificationDay(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-text outline-none focus:border-primary shadow-xs"
                  >
                    <option value="1">Ngày 01 đầu tháng mới (Mặc định)</option>
                    <option value="2">Ngày 02 đầu tháng mới</option>
                    <option value="3">Ngày 03 đầu tháng mới</option>
                    <option value="5">Ngày 05 đầu tháng mới</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                    Giờ gửi tin nhắn (GMT+7)
                  </label>
                  <select
                    value={notificationHour}
                    onChange={(e) => setNotificationHour(Number(e.target.value))}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-text outline-none focus:border-primary shadow-xs"
                  >
                    <option value="7">07:00 Sáng</option>
                    <option value="8">08:00 Sáng (Mặc định khuyến nghị)</option>
                    <option value="9">09:00 Sáng</option>
                    <option value="10">10:00 Sáng</option>
                    <option value="14">14:00 Chiều</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1.5">
                  Kênh gửi thông báo
                </label>
                <select
                  value={notificationChannel}
                  onChange={(e) => setNotificationChannel(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-text outline-none focus:border-primary shadow-xs"
                >
                  <option value="ZALO">Zalo OA / Zalo Bot (Kèm mã VietQR SePay)</option>
                  <option value="SMS">SMS Brandname</option>
                  <option value="ALL">Đa kênh (Zalo + In-app)</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl font-bold text-xs">
            Hủy
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            isLoading={saveMutation.isPending}
            className="rounded-xl font-bold text-xs"
          >
            Lưu cấu hình
          </Button>
        </div>
      </div>
    </Modal>
  );
}
