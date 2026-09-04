"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  HardDrive,
  Loader2,
  Lock,
  MoreVertical,
  Plus,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { systemUpdateApi, SystemBackupStatus, BackupManifestInfo } from "@/lib/api/system-update.api";
import toast from "react-hot-toast";

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "Chưa có";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function SettingsBackup() {
  const { data: backupData, mutate, isLoading } = useSWR<SystemBackupStatus>(
    "system-backup-status",
    () => systemUpdateApi.backups(),
    { revalidateOnFocus: false },
  );

  const [isCreating, setIsCreating] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showWipeModal, setShowWipeModal] = useState(false);
  const [selectedSnapshotForRestore, setSelectedSnapshotForRestore] = useState<BackupManifestInfo | null>(null);

  // Daily Schedule state
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean>(true);

  // 3-dots dropdown menu state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [snapshotToDelete, setSnapshotToDelete] = useState<BackupManifestInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Restore state
  const [restorePassword, setRestorePassword] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  // Form state for Reset / Wipe data
  const [wipePassword, setWipePassword] = useState("");
  const [wipeConfirmPhrase, setWipeConfirmPhrase] = useState("");
  const [wipeScope, setWipeScope] = useState<"ALL_BUSINESS_DATA" | "DRAFT_TRANSACTIONS">("ALL_BUSINESS_DATA");
  const [autoBackupBeforeWipe, setAutoBackupBeforeWipe] = useState(true);
  const [isWiping, setIsWiping] = useState(false);

  const backups = backupData?.backups || [];

  // Load schedule setting from localStorage or backend
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("system_backup_schedule_enabled");
      if (saved !== null) {
        setScheduleEnabled(saved === "true");
      } else if (backupData?.scheduleEnabled !== undefined) {
        setScheduleEnabled(backupData.scheduleEnabled);
      }
    }
  }, [backupData]);

  const handleToggleSchedule = () => {
    const next = !scheduleEnabled;
    setScheduleEnabled(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("system_backup_schedule_enabled", String(next));
    }
    if (next) {
      toast.success("Đã bật lịch trình sao lưu tự động hàng ngày (02:00 AM)");
    } else {
      toast("Đã tạm tắt lịch trình sao lưu tự động hàng ngày", { icon: "⏸️" });
    }
  };

  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      await systemUpdateApi.createBackup({ note: "Tạo bản sao lưu thủ công từ giao diện web" });
      await mutate();
      toast.success("Đã tạo bản sao lưu snapshot mới thành công!");
    } catch (error: any) {
      toast.error(error?.message || "Lỗi khi tạo bản sao lưu");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDownloadManifest = (backup: BackupManifestInfo) => {
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${backup.id}-manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã tải file cấu hình của ${backup.name}`);
  };

  const handleOpenRestore = (snapshot?: BackupManifestInfo) => {
    const target = snapshot || backups[0] || null;
    setSelectedSnapshotForRestore(target);
    setRestorePassword("");
    setShowRestoreModal(true);
  };

  const handleExecuteRestore = async () => {
    const target = selectedSnapshotForRestore || backups[0];
    if (!target?.id) {
      toast.error("Không tìm thấy thông tin bản sao lưu");
      return;
    }
    if (!restorePassword) {
      toast.error("Vui lòng nhập mật khẩu quản trị viên để xác nhận");
      return;
    }

    setIsRestoring(true);
    try {
      const res = await systemUpdateApi.restoreBackup({
        snapshotId: target.id,
        password: restorePassword,
      });
      await mutate();
      setShowRestoreModal(false);
      setRestorePassword("");
      setSelectedSnapshotForRestore(null);
      toast.success(res.message || "Khôi phục dữ liệu từ snapshot thành công!", { duration: 5000 });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Khôi phục thất bại. Vui lòng kiểm tra lại mật khẩu.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteSnapshot = async () => {
    if (!snapshotToDelete) return;
    setIsDeleting(true);
    try {
      await systemUpdateApi.deleteBackup(snapshotToDelete.id);
      await mutate();
      toast.success(`Đã xóa bản sao lưu ${snapshotToDelete.name}`);
      setSnapshotToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || "Không thể xóa bản sao lưu");
    } finally {
      setIsDeleting(false);
    }
  };

  const isConfirmPhraseValid = wipeConfirmPhrase.trim().toUpperCase() === "XAC NHAN XOA";
  const isWipeFormValid = Boolean(wipePassword && isConfirmPhraseValid);

  const handleExecuteWipeData = async () => {
    if (!wipePassword) {
      toast.error("Vui lòng nhập mật khẩu quản trị viên để xác nhận");
      return;
    }
    if (!isConfirmPhraseValid) {
      toast.error('Vui lòng nhập chính xác cụm từ "XAC NHAN XOA"');
      return;
    }

    setIsWiping(true);
    try {
      if (autoBackupBeforeWipe) {
        toast("Đang tạo bản sao lưu snapshot bảo vệ trước khi xóa...", { icon: "🛡️" });
        await systemUpdateApi.createBackup({ note: "Tự động sao lưu trước khi Reset / Xóa dữ liệu" }).catch(() => null);
      }

      const res = await systemUpdateApi.wipeData({
        password: wipePassword,
        scope: wipeScope,
        confirmPhrase: "XAC NHAN XOA",
      });

      await mutate();
      setShowWipeModal(false);
      setWipePassword("");
      setWipeConfirmPhrase("");

      const counts = res.deletedCounts || {};
      const countMsg = `Đã dọn dẹp: ${counts.contracts ?? 0} hợp đồng, ${counts.customers ?? 0} khách thuê, ${counts.invoices ?? 0} hóa đơn, ${counts.deposits ?? 0} tiền cọc.`;
      toast.success(`Đặt lại dữ liệu thành công! ${countMsg}`, { duration: 6000 });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Xóa dữ liệu thất bại. Vui lòng kiểm tra lại mật khẩu.");
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5" data-testid="settings-backup-safe-state">
      {/* 1. 4 Action Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <Button
          variant="primary"
          onClick={handleCreateBackup}
          disabled={isCreating || isLoading}
          className="h-10 rounded-xl text-xs font-bold gap-2 shadow-2xs cursor-pointer"
        >
          {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Tạo bản sao lưu
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            mutate();
            toast.success("Đã làm mới dữ liệu sao lưu");
          }}
          disabled={isLoading}
          className="h-10 rounded-xl text-xs font-bold gap-2 cursor-pointer shadow-2xs hover:border-primary/50"
        >
          <RefreshCcw size={14} className={isLoading ? "animate-spin" : ""} /> Làm mới dữ liệu
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (backups.length > 0) {
              handleDownloadManifest(backups[0]);
            } else {
              toast.error("Chưa có bản lưu trữ nào để tải về");
            }
          }}
          className="h-10 rounded-xl text-xs font-bold gap-2 cursor-pointer shadow-2xs hover:border-primary/50"
        >
          <Download size={14} /> Tải bản lưu mới nhất
        </Button>
        <Button
          variant="outline"
          onClick={() => handleOpenRestore()}
          disabled={backups.length === 0}
          className="h-10 rounded-xl text-xs font-bold gap-2 text-text hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer shadow-2xs hover:border-blue-500/40"
        >
          <RotateCcw size={14} /> Khôi phục dữ liệu
        </Button>
      </div>

      {/* 2. Interactive Schedule Config Card */}
      <Card className="rounded-xl border border-border/70 bg-card p-3.5 md:p-4 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Clock size={16} />
            </span>
            <div>
              <div className="text-xs font-bold text-text">Lịch trình sao lưu tự động hàng ngày</div>
              <div className="text-[11px] text-muted font-medium">
                {backupData?.scheduleDescription || "Tự động chụp snapshot định kỳ vào 02:00 AM"}
              </div>
            </div>
          </div>

          {/* Interactive Toggle Switch */}
          <button
            type="button"
            role="switch"
            aria-checked={scheduleEnabled}
            onClick={handleToggleSchedule}
            className="flex items-center gap-2.5 cursor-pointer select-none group focus:outline-none p-1 rounded-lg hover:bg-muted/10 transition"
            title={scheduleEnabled ? "Bấm để tạm tắt lịch trình sao lưu tự động" : "Bấm để bật lịch trình sao lưu tự động"}
          >
            <span className={`text-xs font-bold transition-colors ${scheduleEnabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted"}`}>
              {scheduleEnabled ? "Đang hoạt động" : "Tạm tắt"}
            </span>
            <div
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
                scheduleEnabled ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-700"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                  scheduleEnabled ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
          </button>
        </div>
      </Card>

      {/* 3. Snapshots Table - Với menu Thao tác 3 chấm (...) */}
      <Card className="rounded-xl border border-border/70 bg-card overflow-visible shadow-2xs">
        <div className="p-3.5 md:p-4 border-b border-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-primary" />
            <h4 className="text-xs font-black text-text uppercase tracking-wider">
              Danh sách bản sao lưu ({backups.length})
            </h4>
          </div>
          <span className="text-xs text-muted font-medium">
            Tổng dung lượng: <b className="text-text font-mono font-bold">{formatBytes(backupData?.storageUsedBytes || 0)}</b>
          </span>
        </div>

        {backups.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
            <HardDrive size={32} className="text-muted/60" />
            <h4 className="text-sm font-black text-text mt-2">Chưa có bản sao lưu nào</h4>
            <p className="text-xs text-muted max-w-sm">
              Bấm nút &quot;Tạo bản sao lưu&quot; ở trên để tạo snapshot đầu tiên cho hệ thống.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/15 text-muted font-bold border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-4">Tên Snapshot / ID</th>
                  <th className="py-2.5 px-4">Loại sao lưu</th>
                  <th className="py-2.5 px-4">Dung lượng</th>
                  <th className="py-2.5 px-4">Thời gian tạo</th>
                  <th className="py-2.5 px-4">Trạng thái</th>
                  <th className="py-2.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/10 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-text font-mono">{b.name}</div>
                      <div className="text-[11px] text-muted font-mono">{b.id}</div>
                    </td>
                    <td className="py-3 px-4">
                      {b.type === "pre_update" ? (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px] border border-purple-500/20">
                          Trước cập nhật
                        </span>
                      ) : b.type === "daily_schedule" ? (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px] border border-blue-500/20">
                          Định kỳ hàng ngày
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400 font-bold text-[10px] border border-slate-500/20">
                          Thủ công
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium">{formatBytes(b.sizeBytes)}</td>
                    <td className="py-3 px-4 text-muted">{formatDate(b.createdAt)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                        <CheckCircle2 size={13} /> Sẵn sàng
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right relative">
                      {/* 3-Dots Action Dropdown Menu */}
                      <div className="relative inline-block text-left">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(openDropdownId === b.id ? null : b.id);
                          }}
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-muted/20 active:scale-95 transition cursor-pointer"
                          title="Thao tác"
                        >
                          <MoreVertical size={16} />
                        </button>

                        {openDropdownId === b.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setOpenDropdownId(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-border/80 bg-card p-1.5 shadow-xl z-50 flex flex-col gap-0.5 text-left">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  handleDownloadManifest(b);
                                }}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-text hover:bg-muted/20 transition cursor-pointer"
                              >
                                <Download size={13} className="text-primary" />
                                <span>Tải về</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  handleOpenRestore(b);
                                }}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition cursor-pointer"
                              >
                                <RotateCcw size={13} />
                                <span>Khôi phục</span>
                              </button>

                              <div className="h-[1px] bg-border/60 my-0.5" />

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenDropdownId(null);
                                  setSnapshotToDelete(b);
                                }}
                                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                              >
                                <Trash2 size={13} />
                                <span>Xóa bản lưu</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 4. Vùng Nguy Hiểm: Đặt lại & Xóa dữ liệu (Danger Zone) */}
      <Card className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 sm:p-5 flex flex-col gap-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 mt-0.5">
              <ShieldAlert size={22} />
            </span>
            <div className="flex flex-col gap-1">
              <h4 className="text-sm font-black text-rose-600 dark:text-rose-400">
                Vùng nguy hiểm: Đặt lại & Xóa dữ liệu vận hành (Reset Data)
              </h4>
              <p className="text-xs text-muted leading-relaxed max-w-2xl">
                Dành cho Quản trị viên khi cần dọn dẹp sạch toàn bộ dữ liệu kiểm thử (Hợp đồng, Khách thuê, Tiền cọc, Hóa đơn & Lịch sử gửi Zalo) để bắt đầu nhập dữ liệu mới. 
                <b className="text-text font-bold"> Danh sách Tòa nhà, Phòng, Tài khoản Admin và Cấu hình tích hợp luôn được bảo tồn an toàn.</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowWipeModal(true)}
            className="h-10 px-4.5 shrink-0 rounded-xl text-xs font-bold flex items-center justify-center gap-2 text-white bg-rose-600 hover:bg-rose-700 active:scale-98 transition shadow-md shadow-rose-600/20 cursor-pointer"
          >
            <Trash2 size={15} /> Đặt lại dữ liệu vận hành
          </button>
        </div>
      </Card>

      {/* Modal Xác nhận Xóa Snapshot */}
      {snapshotToDelete && (
        <Modal
          isOpen={Boolean(snapshotToDelete)}
          onClose={() => {
            if (!isDeleting) setSnapshotToDelete(null);
          }}
          maxWidth="max-w-md"
          title={
            <span className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-base font-black">
              <Trash2 size={18} className="shrink-0" />
              Xác nhận xóa bản sao lưu
            </span>
          }
        >
          <div className="flex flex-col gap-3 py-1 text-xs">
            <p className="text-text font-medium leading-relaxed">
              Bạn có chắc chắn muốn xóa bản sao lưu <b className="font-mono text-text">{snapshotToDelete.name}</b> (ID: <span className="font-mono text-muted">{snapshotToDelete.id}</span>) không?
            </p>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-muted text-[11px] leading-normal">
              Hành động này sẽ giải phóng dung lượng đĩa và không thể hoàn tác lại file sao lưu này.
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSnapshotToDelete(null)}
                disabled={isDeleting}
                className="h-8.5 rounded-xl text-xs font-bold cursor-pointer"
              >
                Hủy
              </Button>
              <button
                type="button"
                onClick={handleDeleteSnapshot}
                disabled={isDeleting}
                className="h-8.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-white bg-rose-600 hover:bg-rose-700 active:scale-98 transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? "Đang xóa..." : "Xác nhận xóa"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Xác nhận Reset / Wipe Data */}
      {showWipeModal && (
        <Modal
          isOpen={showWipeModal}
          onClose={() => {
            if (!isWiping) setShowWipeModal(false);
          }}
          maxWidth="max-w-2xl"
          title={
            <span className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-lg font-black">
              <AlertTriangle size={20} className="shrink-0" />
              Xác nhận Đặt lại & Xóa dữ liệu vận hành
            </span>
          }
        >
          <div className="flex flex-col gap-4 text-xs leading-relaxed">
            {/* Warning Box */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex items-start gap-3">
              <AlertTriangle size={20} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-text font-medium leading-normal">
                Thao tác này sẽ <b className="text-rose-600 dark:text-rose-400">xóa vĩnh viễn</b> các dữ liệu giao dịch vận hành theo phạm vi bạn chọn. Vui lòng kiểm tra kỹ danh sách bên dưới trước khi xác nhận.
              </div>
            </div>

            {/* Scope Comparison Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3.5 flex flex-col gap-1.5">
                <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 text-xs">
                  <XCircle size={15} /> Dữ liệu sẽ bị xóa sạch:
                </span>
                <ul className="list-disc pl-4 text-muted space-y-1 text-[11px]">
                  <li>Khách thuê & Thành viên ở ghép</li>
                  <li>Hợp đồng thuê & Đặt cọc giữ phòng</li>
                  <li>Hóa đơn, Phiếu thu & Lịch sử thanh toán</li>
                  <li>Lịch sử gửi tin nhắn Zalo & Thông báo</li>
                  <li>Lịch sử chốt chỉ số công tơ điện nước</li>
                </ul>
              </div>

              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 flex flex-col gap-1.5">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
                  <CheckCircle2 size={15} /> Dữ liệu được bảo tồn an toàn:
                </span>
                <ul className="list-disc pl-4 text-muted space-y-1 text-[11px]">
                  <li>Danh sách Tòa nhà, Tầng & Phòng</li>
                  <li>Tài khoản Quản trị viên & Phân quyền</li>
                  <li>Cấu hình tích hợp (Hunonic, SePay, Zalo Bot)</li>
                  <li>Biểu mẫu hợp đồng & Cài đặt hệ thống</li>
                  <li>Phòng tự động chuyển về trạng thái Trống</li>
                </ul>
              </div>
            </div>

            {/* Scope Selection */}
            <div className="flex flex-col gap-2 pt-1">
              <label className="font-bold text-text text-xs">Chọn phạm vi dữ liệu cần đặt lại:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${wipeScope === "ALL_BUSINESS_DATA" ? "border-rose-500/60 bg-rose-500/10" : "border-border hover:bg-muted/10"}`}>
                  <input
                    type="radio"
                    name="wipeScope"
                    value="ALL_BUSINESS_DATA"
                    checked={wipeScope === "ALL_BUSINESS_DATA"}
                    onChange={() => setWipeScope("ALL_BUSINESS_DATA")}
                    className="accent-rose-600 mt-0.5"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-text text-xs">Toàn bộ dữ liệu vận hành & kiểm thử</span>
                    <span className="text-[11px] text-muted leading-tight">Xóa sạch khách thuê, hợp đồng, hóa đơn, cọc và đặt lại tất cả phòng về Trống</span>
                  </div>
                </label>
                <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${wipeScope === "DRAFT_TRANSACTIONS" ? "border-rose-500/60 bg-rose-500/10" : "border-border hover:bg-muted/10"}`}>
                  <input
                    type="radio"
                    name="wipeScope"
                    value="DRAFT_TRANSACTIONS"
                    checked={wipeScope === "DRAFT_TRANSACTIONS"}
                    onChange={() => setWipeScope("DRAFT_TRANSACTIONS")}
                    className="accent-rose-600 mt-0.5"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-text text-xs">Chỉ xóa dữ liệu Nháp (DRAFT)</span>
                    <span className="text-[11px] text-muted leading-tight">Chỉ xóa các hợp đồng, cọc và hóa đơn chưa phát hành chính thức</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Auto backup checkbox */}
            <label className="flex items-center gap-2.5 font-medium text-text text-xs cursor-pointer select-none bg-muted/20 p-2.5 rounded-xl border border-border">
              <input
                type="checkbox"
                checked={autoBackupBeforeWipe}
                onChange={(e) => setAutoBackupBeforeWipe(e.target.checked)}
                className="accent-primary rounded h-4 w-4"
              />
              <span>Tự động tạo bản sao lưu snapshot bảo vệ trước khi xóa (Khuyến nghị bật)</span>
            </label>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Password input */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-text text-xs flex items-center gap-1.5">
                  <Lock size={13} className="text-muted" /> Mật khẩu tài khoản Quản trị viên:
                </label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu tài khoản của bạn"
                  value={wipePassword}
                  onChange={(e) => setWipePassword(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-border bg-card text-xs text-text focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              {/* Confirm phrase input */}
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-text text-xs">
                  Nhập cụm từ xác nhận: <b className="font-mono text-rose-600 dark:text-rose-400 select-all">XAC NHAN XOA</b>
                </label>
                <input
                  type="text"
                  placeholder="Nhập chính xác: XAC NHAN XOA"
                  value={wipeConfirmPhrase}
                  onChange={(e) => setWipeConfirmPhrase(e.target.value)}
                  className={`h-10 px-3 rounded-xl border bg-card text-xs font-mono text-text focus:outline-none focus:ring-2 ${isConfirmPhraseValid ? "border-emerald-500 focus:ring-emerald-500/20" : "border-border focus:ring-rose-500/20 focus:border-rose-500"}`}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="mt-4 flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="md"
                onClick={() => setShowWipeModal(false)}
                disabled={isWiping}
                className="h-10 px-4 rounded-xl text-xs font-bold cursor-pointer"
              >
                Hủy bỏ
              </Button>
              <button
                type="button"
                onClick={handleExecuteWipeData}
                disabled={isWiping || !isWipeFormValid}
                className={`h-10 px-5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 text-white transition shadow-sm ${isWipeFormValid && !isWiping ? "bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-rose-600/20" : "bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60"}`}
              >
                {isWiping ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {isWiping ? "Đang xử lý đặt lại..." : isWipeFormValid ? "Xác nhận xóa & Đặt lại dữ liệu" : "Vui lòng nhập mật khẩu & cụm từ xác nhận"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Khôi phục Dữ liệu từ Snapshot đã chọn */}
      {showRestoreModal && (
        <Modal
          isOpen={showRestoreModal}
          onClose={() => {
            if (!isRestoring) {
              setShowRestoreModal(false);
              setSelectedSnapshotForRestore(null);
              setRestorePassword("");
            }
          }}
          maxWidth="max-w-xl"
          title={
            <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-lg font-black">
              <RotateCcw size={20} className="shrink-0" />
              Khôi phục dữ liệu từ bản sao lưu
            </span>
          }
        >
          <div className="flex flex-col gap-4 text-xs leading-relaxed">
            {/* Snapshot info */}
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 flex flex-col gap-1.5">
              <div className="font-bold text-text text-xs flex items-center justify-between">
                <span>Snapshot: <b className="font-mono text-primary">{selectedSnapshotForRestore?.name || (backups[0]?.name ?? "Bản sao lưu mới nhất")}</b></span>
                <span className="text-[11px] text-muted">{formatDate(selectedSnapshotForRestore?.createdAt || backups[0]?.createdAt)}</span>
              </div>
              <div className="text-[11px] text-muted">
                Dung lượng: <b className="font-mono text-text">{formatBytes(selectedSnapshotForRestore?.sizeBytes || backups[0]?.sizeBytes || 0)}</b> | ID: <span className="font-mono">{selectedSnapshotForRestore?.id || backups[0]?.id}</span>
              </div>
            </div>

            {/* Warning */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-text font-medium">
                Hệ thống sẽ phục hồi lại trạng thái dữ liệu tại thời điểm chụp snapshot. Trước khi thực hiện, hệ thống sẽ tự động tạo một snapshot lưu lại hiện trạng hiện tại để bảo đảm an toàn tuyệt đối.
              </div>
            </div>

            {/* Password input */}
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-text text-xs flex items-center gap-1.5">
                <Lock size={13} className="text-muted" /> Mật khẩu tài khoản Quản trị viên:
              </label>
              <input
                type="password"
                placeholder="Nhập mật khẩu tài khoản Admin để xác nhận"
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
                className="h-10 px-3 rounded-xl border border-border bg-card text-xs text-text focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="mt-3 flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  setShowRestoreModal(false);
                  setSelectedSnapshotForRestore(null);
                  setRestorePassword("");
                }}
                disabled={isRestoring}
                className="h-9 px-3 rounded-xl text-xs font-bold cursor-pointer"
              >
                Hủy bỏ
              </Button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring || !restorePassword}
                className="h-9 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 text-white bg-blue-600 hover:bg-blue-700 active:scale-98 transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRestoring ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                {isRestoring ? "Đang khôi phục dữ liệu..." : "Xác nhận khôi phục"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
