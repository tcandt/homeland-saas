"use client";

import React, { useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Download,
  HardDrive,
  Loader2,
  Lock,
  Plus,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
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

  // Form state for Reset / Wipe data
  const [wipePassword, setWipePassword] = useState("");
  const [wipeConfirmPhrase, setWipeConfirmPhrase] = useState("");
  const [wipeScope, setWipeScope] = useState<"ALL_BUSINESS_DATA" | "DRAFT_TRANSACTIONS">("ALL_BUSINESS_DATA");
  const [autoBackupBeforeWipe, setAutoBackupBeforeWipe] = useState(true);
  const [isWiping, setIsWiping] = useState(false);

  const isConnected = backupData?.connected ?? true;
  const backups = backupData?.backups || [];

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
    toast.success(`Đã tải manifest của ${backup.name}`);
  };

  const handleExecuteWipeData = async () => {
    if (!wipePassword) {
      toast.error("Vui lòng nhập mật khẩu quản trị viên để xác nhận");
      return;
    }
    if (wipeConfirmPhrase.trim() !== "XAC NHAN XOA") {
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
    <div className="flex flex-col gap-4" data-testid="settings-backup-safe-state">
      {/* 1. Header & Backend Connection Status Banner */}
      <div className="flex flex-col gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Database size={18} />
            </span>
            <div>
              <h3 className="text-sm font-black text-text">Sao lưu & Phục hồi dữ liệu hệ thống</h3>
              <p className="text-xs text-muted">
                {isConnected
                  ? "Kết nối agent sao lưu backend máy chủ hoạt động ổn định"
                  : "Chế độ an toàn: Dữ liệu sao lưu vận hành máy chủ"}
              </p>
            </div>
          </div>
          <Badge
            variant="success"
            className="border-emerald-500/30 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] flex items-center gap-1.5"
          >
            <ShieldCheck size={13} />
            Đã kết nối backend
          </Badge>
        </div>
      </div>

      {/* 2. 4 Action Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button
          variant="primary"
          onClick={handleCreateBackup}
          disabled={isCreating || isLoading}
          className="h-11 rounded-xl text-xs font-bold gap-2 shadow-sm cursor-pointer"
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
          className="h-11 rounded-xl text-xs font-bold gap-2 cursor-pointer"
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
          className="h-11 rounded-xl text-xs font-bold gap-2 cursor-pointer"
        >
          <Download size={14} /> Tải bản lưu mới nhất
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowWipeModal(true)}
          className="h-11 rounded-xl text-xs font-bold gap-2 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10 cursor-pointer"
        >
          <Trash2 size={14} /> Đặt lại dữ liệu (Reset)
        </Button>
      </div>

      {/* 3. Schedule config */}
      <Card className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock size={16} />
            </span>
            <div>
              <div className="text-xs font-bold text-text">Lịch trình sao lưu tự động hàng ngày</div>
              <div className="text-[11px] text-muted">
                {backupData?.scheduleDescription || "Tự động chụp snapshot định kỳ vào 02:00 AM"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Đang hoạt động</span>
            <div className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-emerald-500">
              <span className="inline-block h-3.5 w-3.5 transform rounded-full bg-white translate-x-4 transition" />
            </div>
          </div>
        </div>
      </Card>

      {/* 4. Snapshots Table */}
      <Card className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive size={16} className="text-primary" />
            <h4 className="text-xs font-bold text-text uppercase tracking-wider">
              Danh sách bản sao lưu ({backups.length})
            </h4>
          </div>
          <span className="text-xs text-muted font-medium">
            Tổng dung lượng: <b className="text-text font-mono">{formatBytes(backupData?.storageUsedBytes || 0)}</b>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/20 text-muted font-bold border-b border-border">
                <tr>
                  <th className="py-2.5 px-4">Tên Snapshot / ID</th>
                  <th className="py-2.5 px-4">Loại sao lưu</th>
                  <th className="py-2.5 px-4">Dung lượng</th>
                  <th className="py-2.5 px-4">Thời gian tạo</th>
                  <th className="py-2.5 px-4">Trạng thái</th>
                  <th className="py-2.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-muted/10 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-text font-mono">{b.name}</div>
                      <div className="text-[11px] text-muted font-mono">{b.id}</div>
                    </td>
                    <td className="py-3 px-4">
                      {b.type === "pre_update" ? (
                        <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px]">
                          Trước cập nhật
                        </span>
                      ) : b.type === "daily_schedule" ? (
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px]">
                          Định kỳ hàng ngày
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-500/10 text-slate-600 dark:text-slate-400 font-bold text-[10px]">
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
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadManifest(b)}
                        className="h-7 px-2 text-xs text-primary font-bold hover:bg-primary/10"
                      >
                        <Download size={13} className="mr-1" /> Tải về
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* 5. Vùng Nguy Hiểm: Đặt lại & Xóa dữ liệu (Danger Zone) */}
      <Card className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 mt-0.5">
              <ShieldAlert size={20} />
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
          <Button
            variant="outline"
            onClick={() => setShowWipeModal(true)}
            className="h-10 px-4 shrink-0 rounded-xl text-xs font-bold gap-2 text-white bg-rose-600 hover:bg-rose-700 border-transparent shadow-xs cursor-pointer"
          >
            <Trash2 size={14} /> Đặt lại dữ liệu
          </Button>
        </div>
      </Card>

      {/* Modal Xác nhận Reset / Wipe Data */}
      {showWipeModal && (
        <Modal
          isOpen={showWipeModal}
          onClose={() => {
            if (!isWiping) setShowWipeModal(false);
          }}
          title="Xác nhận Đặt lại & Xóa dữ liệu vận hành"
        >
          <div className="flex flex-col gap-4 text-xs leading-relaxed">
            {/* Warning Box */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-text font-medium">
                Thao tác này sẽ xóa vĩnh viễn các dữ liệu giao dịch vận hành theo phạm vi bạn chọn. Vui lòng kiểm tra kỹ trước khi xác nhận.
              </div>
            </div>

            {/* Scope Explanation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 flex flex-col gap-1">
                <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <XCircle size={13} /> Sẽ bị xóa sạch:
                </span>
                <ul className="list-disc pl-4 text-muted space-y-0.5">
                  <li>Khách thuê & Thành viên ở ghép</li>
                  <li>Hợp đồng thuê & Đặt cọc giữ phòng</li>
                  <li>Hóa đơn, Phiếu thu & Lịch sử thanh toán</li>
                  <li>Lịch sử gửi tin nhắn Zalo / Thông báo</li>
                  <li>Lịch sử chốt chỉ số công tơ điện nước</li>
                </ul>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex flex-col gap-1">
                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 size={13} /> Được bảo tồn an toàn:
                </span>
                <ul className="list-disc pl-4 text-muted space-y-0.5">
                  <li>Danh sách Tòa nhà, Tầng & Phòng</li>
                  <li>Tài khoản Quản trị viên & Phân quyền</li>
                  <li>Cấu hình tích hợp (Hunonic, SePay, Zalo Bot)</li>
                  <li>Biểu mẫu hợp đồng & Cài đặt hệ thống</li>
                  <li>Phòng tự động chuyển về trạng thái Trống</li>
                </ul>
              </div>
            </div>

            {/* Scope Selection */}
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="font-bold text-text text-xs">Phạm vi dữ liệu cần đặt lại:</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 rounded-xl border border-border p-2.5 hover:bg-muted/10 cursor-pointer">
                  <input
                    type="radio"
                    name="wipeScope"
                    value="ALL_BUSINESS_DATA"
                    checked={wipeScope === "ALL_BUSINESS_DATA"}
                    onChange={() => setWipeScope("ALL_BUSINESS_DATA")}
                    className="accent-primary"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-text text-xs">Toàn bộ dữ liệu vận hành & kiểm thử (Khuyến nghị)</span>
                    <span className="text-[11px] text-muted">Xóa toàn bộ khách thuê, hợp đồng, cọc, hóa đơn và đặt lại phòng về Trống</span>
                  </div>
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-border p-2.5 hover:bg-muted/10 cursor-pointer">
                  <input
                    type="radio"
                    name="wipeScope"
                    value="DRAFT_TRANSACTIONS"
                    checked={wipeScope === "DRAFT_TRANSACTIONS"}
                    onChange={() => setWipeScope("DRAFT_TRANSACTIONS")}
                    className="accent-primary"
                  />
                  <div className="flex flex-col">
                    <span className="font-bold text-text text-xs">Chỉ xóa dữ liệu Nháp (DRAFT)</span>
                    <span className="text-[11px] text-muted">Chỉ xóa các hợp đồng, cọc và hóa đơn chưa phát hành chính thức</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Auto backup checkbox */}
            <label className="flex items-center gap-2 font-medium text-text text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoBackupBeforeWipe}
                onChange={(e) => setAutoBackupBeforeWipe(e.target.checked)}
                className="accent-primary rounded"
              />
              <span>Tự động tạo bản sao lưu snapshot bảo vệ trước khi xóa (Khuyến nghị)</span>
            </label>

            {/* Password input */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-text text-xs flex items-center gap-1">
                <Lock size={12} className="text-muted" /> Mật khẩu tài khoản Quản trị viên:
              </label>
              <input
                type="password"
                placeholder="Nhập mật khẩu tài khoản đăng nhập của bạn"
                value={wipePassword}
                onChange={(e) => setWipePassword(e.target.value)}
                className="h-10 px-3 rounded-xl border border-border bg-card text-xs text-text focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Confirm phrase input */}
            <div className="flex flex-col gap-1">
              <label className="font-bold text-text text-xs">
                Nhập cụm từ xác nhận: <b className="font-mono text-rose-600 dark:text-rose-400 select-all">XAC NHAN XOA</b>
              </label>
              <input
                type="text"
                placeholder="Nhập chính xác: XAC NHAN XOA"
                value={wipeConfirmPhrase}
                onChange={(e) => setWipeConfirmPhrase(e.target.value)}
                className="h-10 px-3 rounded-xl border border-border bg-card text-xs font-mono text-text focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowWipeModal(false)}
                disabled={isWiping}
                className="h-9 px-3 rounded-xl text-xs font-bold"
              >
                Hủy bỏ
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteWipeData}
                disabled={isWiping || !wipePassword || wipeConfirmPhrase.trim() !== "XAC NHAN XOA"}
                className="h-9 px-4 rounded-xl text-xs font-bold gap-2 text-white bg-rose-600 hover:bg-rose-700 border-transparent cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isWiping ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {isWiping ? "Đang xử lý đặt lại..." : "Xác nhận xóa & Đặt lại"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Hướng dẫn Phục hồi Dữ liệu */}
      {showRestoreModal && (
        <Modal
          isOpen={showRestoreModal}
          onClose={() => setShowRestoreModal(false)}
          title="Quy trình Khôi phục Dữ liệu An toàn"
        >
          <div className="flex flex-col gap-3 text-xs text-muted leading-relaxed">
            <p>
              Để bảo đảm an toàn tuyệt đối cho toàn bộ hợp đồng, khách thuê, hóa đơn và lịch sử điện nước đang vận hành, quy trình phục hồi dữ liệu từ snapshot được bảo vệ nghiêm ngặt:
            </p>
            <ol className="list-decimal pl-4 flex flex-col gap-1.5 font-medium text-text">
              <li>Hệ thống tự động tạo một snapshot lưu giữ hiện trạng trước khi tiến hành rollback.</li>
              <li>Chỉ tài khoản Quản trị viên cấp cao (<b className="font-mono text-primary">admin@homeland.vn</b>) mới có quyền yêu cầu khôi phục.</li>
              <li>Lệnh khôi phục sẽ được chạy cô lập qua CLI của máy chủ để tránh rủi ro ngắt kết nối giữa chừng.</li>
            </ol>
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowRestoreModal(false)}>
                Đã hiểu
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
