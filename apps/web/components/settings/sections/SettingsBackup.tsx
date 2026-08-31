"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  Database,
  Download,
  FileArchive,
  HardDrive,
  KeyRound,
  Lock,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";

export interface BackupItem {
  id: string;
  filename: string;
  note: string;
  size: string;
  sizeBytes: number;
  type: "MANUAL" | "AUTO" | "SYSTEM_UPDATE";
  createdAt: string;
  createdBy: string;
  status: "COMPLETED" | "VERIFIED";
}

const DEFAULT_BACKUPS: BackupItem[] = [
  {
    id: "bk-01",
    filename: "homeland_db_auto_20260831_020000.sql.gz",
    note: "Sao lưu tự động hàng ngày (Scheduled daily snapshot)",
    size: "24.6 MB",
    sizeBytes: 25794969,
    type: "AUTO",
    createdAt: "2026-08-31T02:00:00.000Z",
    createdBy: "Hệ thống tự động",
    status: "VERIFIED",
  },
  {
    id: "bk-02",
    filename: "homeland_db_preupdate_v116_20260830_153020.sql.gz",
    note: "Sao lưu trước khi nâng cấp hệ thống phiên bản v1.1.8",
    size: "23.8 MB",
    sizeBytes: 24956108,
    type: "SYSTEM_UPDATE",
    createdAt: "2026-08-30T15:30:20.000Z",
    createdBy: "System Admin",
    status: "VERIFIED",
  },
  {
    id: "bk-03",
    filename: "homeland_db_manual_reconcile_20260828_182045.sql.gz",
    note: "Sao lưu trước kỳ kết chuyển đối soát tài chính & cọc",
    size: "22.4 MB",
    sizeBytes: 23488102,
    type: "MANUAL",
    createdAt: "2026-08-28T18:20:45.000Z",
    createdBy: "Nguyễn Văn Tính (Admin)",
    status: "COMPLETED",
  },
  {
    id: "bk-04",
    filename: "homeland_db_auto_20260824_020000.sql.gz",
    note: "Sao lưu tự động định kỳ đầu tuần",
    size: "21.1 MB",
    sizeBytes: 22124953,
    type: "AUTO",
    createdAt: "2026-08-24T02:00:00.000Z",
    createdBy: "Hệ thống tự động",
    status: "VERIFIED",
  },
];

const STORAGE_KEY = "homeland_system_backups_v2";

export default function SettingsBackup() {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isWipeModalOpen, setIsWipeModalOpen] = useState(false);

  const [activeItem, setActiveItem] = useState<BackupItem | null>(null);

  // Form states
  const [newBackupNote, setNewBackupNote] = useState("");
  const [newBackupScope, setNewBackupScope] = useState("FULL");
  const [password, setPassword] = useState("");
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  const [wipeScope, setWipeScope] = useState("DEMO_DATA");
  const [isProcessing, setIsProcessing] = useState(false);

  // Load from local storage or fallback
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setBackups(JSON.parse(saved));
      } else {
        setBackups(DEFAULT_BACKUPS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_BACKUPS));
      }
    } catch {
      setBackups(DEFAULT_BACKUPS);
    }
  }, []);

  const saveBackups = (newItems: BackupItem[]) => {
    setBackups(newItems);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
    } catch {
      // ignore
    }
  };

  // Filtered backups
  const filteredBackups = useMemo(() => {
    return backups.filter((item) => {
      if (selectedType !== "ALL" && item.type !== selectedType) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.filename.toLowerCase().includes(q) ||
        item.note.toLowerCase().includes(q) ||
        item.createdBy.toLowerCase().includes(q)
      );
    });
  }, [backups, search, selectedType]);

  // Statistics
  const totalSizeBytes = useMemo(() => {
    return backups.reduce((acc, item) => acc + item.sizeBytes, 0);
  }, [backups]);

  const totalSizeFormatted = (totalSizeBytes / (1024 * 1024)).toFixed(1) + " MB";
  const latestBackup = backups[0];

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      const seconds = String(d.getSeconds()).padStart(2, "0");
      return `${hours}:${minutes}:${seconds} - ${day}/${month}/${year}`;
    } catch {
      return iso;
    }
  };

  // Handle Download Backup
  const handleDownload = (item: BackupItem) => {
    toast.loading("Đang chuẩn bị tệp sao lưu...", { duration: 1000 });
    setTimeout(() => {
      const dummyContent = `HOMELAND DATABASE DUMP\nSNAPSHOT_ID: ${item.id}\nFILENAME: ${item.filename}\nTIMESTAMP: ${item.createdAt}\nNOTE: ${item.note}\nCHECKSUM: SHA256_${Math.random().toString(36).slice(2)}`;
      const blob = new Blob([dummyContent], { type: "application/gzip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Đã tải xuống bản sao lưu: ${item.filename}`);
    }, 1000);
  };

  // Handle Create Backup
  const handleCreateBackup = () => {
    if (!password) {
      toast.error("Vui lòng nhập mật khẩu quản trị viên để xác nhận");
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `homeland_db_manual_${timestampStr}.sql.gz`;

      const newItem: BackupItem = {
        id: `bk-${Date.now().toString(36)}`,
        filename,
        note: newBackupNote.trim() || "Bản sao lưu thủ công (Manual snapshot)",
        size: "25.2 MB",
        sizeBytes: 26424115,
        type: "MANUAL",
        createdAt: now.toISOString(),
        createdBy: "Quản trị viên (Admin)",
        status: "VERIFIED",
      };

      const updated = [newItem, ...backups];
      saveBackups(updated);

      toast.success(`Tạo bản sao lưu thành công: ${filename}`);
      setIsCreateModalOpen(false);
      setPassword("");
      setNewBackupNote("");
    }, 1200);
  };

  // Handle Restore Backup
  const handleRestoreBackup = () => {
    if (!password) {
      toast.error("Vui lòng nhập mật khẩu quản trị viên để xác nhận");
      return;
    }
    if (!activeItem) return;

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      toast.success(`Đã khôi phục CSDL thành công từ bản: ${activeItem.filename}`);
      setIsRestoreModalOpen(false);
      setActiveItem(null);
      setPassword("");
    }, 1500);
  };

  // Handle Delete Backup
  const handleDeleteBackup = () => {
    if (!password) {
      toast.error("Vui lòng nhập mật khẩu quản trị viên để xác nhận");
      return;
    }
    if (!activeItem) return;

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const updated = backups.filter((b) => b.id !== activeItem.id);
      saveBackups(updated);
      toast.success(`Đã xóa vĩnh viễn bản sao lưu: ${activeItem.filename}`);
      setIsDeleteModalOpen(false);
      setActiveItem(null);
      setPassword("");
    }, 800);
  };

  // Handle Wipe Data
  const handleWipeData = () => {
    if (wipeConfirmText !== "XAC NHAN XOA") {
      toast.error('Vui lòng gõ chính xác cụm từ "XAC NHAN XOA" để tiếp tục');
      return;
    }
    if (!password) {
      toast.error("Vui lòng nhập mật khẩu quản trị viên");
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      toast.success("Đã dọn dẹp và làm sạch dữ liệu thành công");
      setIsWipeModalOpen(false);
      setWipeConfirmText("");
      setPassword("");
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-3.5" data-testid="settings-backup-root">
      {/* 1. TOP HEADER & PRIMARY ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-black text-text tracking-tight">
              Sao lưu & Khôi phục Dữ liệu (Backup & Disaster Recovery)
            </h2>
            <p className="text-xs text-muted font-medium mt-0.5">
              Quản lý các bản Snapshot CSDL PostgreSQL, khôi phục an toàn và bảo vệ dữ liệu với xác thực mật khẩu.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPassword("");
              setWipeConfirmText("");
              setIsWipeModalOpen(true);
            }}
            className="h-9 gap-1.5 rounded-xl border-rose-500/30 text-rose-600 hover:bg-rose-500/10 hover:border-rose-500 text-xs font-bold shadow-2xs"
          >
            <Trash2 size={13} />
            <span>Dọn dẹp / Xóa data</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setPassword("");
              setNewBackupNote("");
              setIsCreateModalOpen(true);
            }}
            className="h-9 gap-1.5 rounded-xl px-3.5 text-xs font-bold shadow-2xs"
          >
            <Plus size={14} />
            <span>Tạo bản sao lưu ngay</span>
          </Button>
        </div>
      </div>

      {/* 2. 4 SLIM KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Database size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Tổng bản sao lưu</div>
            <div className="font-mono font-black text-[17px] text-text leading-tight">{backups.length} bản ghi</div>
            <div className="text-[10px] text-muted truncate mt-0.5">Lưu trữ phân tán S3</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Clock size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Sao lưu mới nhất</div>
            <div className="font-mono font-bold text-[12px] text-emerald-600 dark:text-emerald-400 truncate leading-tight">
              {latestBackup ? formatDateTime(latestBackup.createdAt) : "Chưa có"}
            </div>
            <div className="text-[10px] text-muted truncate mt-0.5">Tự động kiểm tra tính toàn vẹn</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 shrink-0">
            <HardDrive size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Dung lượng sao lưu</div>
            <div className="font-mono font-black text-[17px] text-text leading-tight">{totalSizeFormatted}</div>
            <div className="text-[10px] text-muted truncate mt-0.5">Nén GZIP chuẩn AES-256</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Tình trạng hệ thống</div>
            <div className="font-bold text-[14px] text-emerald-600 dark:text-emerald-400 leading-tight">Sẵn sàng khôi phục</div>
            <div className="text-[10px] text-muted truncate mt-0.5">Khóa bảo mật 2 lớp Admin</div>
          </div>
        </Card>
      </div>

      {/* 3. BACKUP SNAPSHOTS TABLE & TOOLBAR */}
      <section className="rounded-xl border border-border/70 bg-card shadow-2xs flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/60 p-3 bg-muted/5">
          {/* Type Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { value: "ALL", label: "Tất cả bản sao" },
              { value: "AUTO", label: "Tự động" },
              { value: "MANUAL", label: "Thủ công" },
              { value: "SYSTEM_UPDATE", label: "Trước nâng cấp" },
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSelectedType(t.value)}
                className={`h-8 px-3 rounded-xl text-xs font-bold transition-all ${
                  selectedType === t.value
                    ? "border border-primary/30 bg-primary/10 text-primary shadow-2xs"
                    : "border border-transparent text-muted hover:bg-muted/10 hover:text-text"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="search"
              name="backup_search_query"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên tệp, ghi chú, người tạo..."
              className="h-8.5 w-full rounded-xl border border-border/70 bg-background pl-8 pr-3 text-xs font-semibold text-text placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-2xs"
            />
          </div>
        </div>

        {/* Desktop Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="border-b border-border/70 bg-card text-[10px] uppercase font-black text-muted select-none">
              <tr>
                <th className="px-3.5 py-2.5">Tên tệp bản sao (.sql.gz)</th>
                <th className="px-3.5 py-2.5">Ghi chú / Mục đích</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Ngày giờ tạo</th>
                <th className="px-3.5 py-2.5 text-center">Dung lượng</th>
                <th className="px-3.5 py-2.5 text-center">Phân loại</th>
                <th className="px-3.5 py-2.5">Người thực hiện</th>
                <th className="px-3.5 py-2.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredBackups.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted font-medium">
                    Không tìm thấy bản sao lưu nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredBackups.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                    {/* Filename */}
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <FileArchive size={14} />
                        </div>
                        <div>
                          <span className="font-mono font-bold text-text text-xs hover:text-primary transition-colors">
                            {item.filename}
                          </span>
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                            <CheckCircle2 size={10} /> Đã kiểm tra tính toàn vẹn
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Note */}
                    <td className="px-3.5 py-3 max-w-[280px]">
                      <div className="font-medium text-text text-xs line-clamp-2 leading-relaxed">
                        {item.note || "Không có ghi chú"}
                      </div>
                    </td>

                    {/* Datetime */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-text text-xs">
                        {formatDateTime(item.createdAt)}
                      </div>
                    </td>

                    {/* Size */}
                    <td className="px-3.5 py-3 text-center whitespace-nowrap">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-muted/10 text-text">
                        {item.size}
                      </span>
                    </td>

                    {/* Type Badge */}
                    <td className="px-3.5 py-3 text-center whitespace-nowrap">
                      {item.type === "AUTO" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 font-bold">
                          Tự động
                        </span>
                      )}
                      {item.type === "MANUAL" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 font-bold">
                          Thủ công
                        </span>
                      )}
                      {item.type === "SYSTEM_UPDATE" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                          Trước nâng cấp
                        </span>
                      )}
                    </td>

                    {/* Created By */}
                    <td className="px-3.5 py-3">
                      <span className="font-medium text-muted text-xs">{item.createdBy}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownload(item)}
                          title="Tải tệp .sql.gz về máy"
                          className="h-7 px-2 rounded-lg border border-border/70 bg-card hover:bg-muted/10 hover:border-primary/50 text-text font-bold text-[11px] flex items-center gap-1 transition-all shadow-2xs"
                        >
                          <Download size={12} className="text-primary" />
                          <span>Tải về</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveItem(item);
                            setPassword("");
                            setIsRestoreModalOpen(true);
                          }}
                          title="Khôi phục dữ liệu từ bản này"
                          className="h-7 px-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-[11px] flex items-center gap-1 transition-all shadow-2xs"
                        >
                          <RotateCcw size={12} />
                          <span>Khôi phục</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveItem(item);
                            setPassword("");
                            setIsDeleteModalOpen(true);
                          }}
                          title="Xóa bản sao lưu"
                          className="h-7 w-7 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 flex items-center justify-center transition-all shadow-2xs"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ================= MODAL 1: TẠO BẢN SAO LƯU MỚI ================= */}
      <Modal
        title="Tạo bản sao lưu mới (Backup)"
        isOpen={isCreateModalOpen}
        onClose={() => !isProcessing && setIsCreateModalOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isProcessing}
              className="h-9 rounded-xl text-xs font-bold"
            >
              Hủy bỏ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateBackup}
              disabled={isProcessing || !password || !newBackupNote.trim()}
              className="h-9 gap-1.5 rounded-xl px-4 text-xs font-bold"
            >
              {isProcessing ? <RefreshCcw size={13} className="animate-spin" /> : <Plus size={13} />}
              <span>{isProcessing ? "Đang sao lưu..." : "Bắt đầu sao lưu"}</span>
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          <div>
            <label className="text-xs font-bold text-text block mb-1">Ghi chú bản sao lưu (Bắt buộc):</label>
            <input
              type="text"
              value={newBackupNote}
              onChange={(e) => setNewBackupNote(e.target.value)}
              placeholder="Ví dụ: Bản sao lưu trước khi điều chỉnh hóa đơn tháng 8..."
              className="h-9 w-full rounded-xl border border-border/70 bg-background px-3 text-xs font-semibold text-text placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-text block mb-1">Phạm vi sao lưu:</label>
            <select
              value={newBackupScope}
              onChange={(e) => setNewBackupScope(e.target.value)}
              className="h-9 w-full rounded-xl border border-border/70 bg-background px-2.5 text-xs font-bold text-text focus:border-primary focus:outline-none"
            >
              <option value="FULL">Toàn bộ CSDL & File đính kèm (Full Backup)</option>
              <option value="DATABASE_ONLY">Chỉ CSDL quan hệ (Database Only)</option>
              <option value="FINANCIAL_ONLY">Chỉ dữ liệu tài chính & giao dịch (Finance Data)</option>
            </select>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/10 p-3 flex flex-col gap-1 text-[11px] text-muted">
            <div className="flex items-center gap-1.5 font-bold text-text">
              <ShieldCheck size={13} className="text-emerald-500" />
              <span>Bảo mật cấp cao</span>
            </div>
            <p>Hệ thống yêu cầu nhập mật khẩu quản trị viên để xác thực quyền tạo backup.</p>
          </div>

          <div>
            <label className="text-xs font-bold text-rose-600 dark:text-rose-400 block mb-1 flex items-center gap-1">
              <Lock size={12} />
              <span>Nhập mật khẩu Admin để xác nhận:</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu tài khoản hiện tại..."
              className="h-9 w-full rounded-xl border border-rose-500/40 bg-background px-3 text-xs font-semibold text-text placeholder:text-muted focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* ================= MODAL 2: KHÔI PHỤC BẢN SAO LƯU (RESTORE) ================= */}
      <Modal
        title="Khôi phục dữ liệu (Restore Snapshot)"
        isOpen={isRestoreModalOpen}
        onClose={() => !isProcessing && setIsRestoreModalOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRestoreModalOpen(false)}
              disabled={isProcessing}
              className="h-9 rounded-xl text-xs font-bold"
            >
              Hủy bỏ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRestoreBackup}
              disabled={isProcessing || !password}
              className="h-9 gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 text-xs font-bold"
            >
              {isProcessing ? <RefreshCcw size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              <span>{isProcessing ? "Đang khôi phục..." : "Xác nhận khôi phục"}</span>
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          {/* Warning box */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed flex items-start gap-2.5">
            <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
            <div>
              <strong className="block font-black mb-0.5">CẢNH BÁO QUAN TRỌNG:</strong>
              Thao tác khôi phục sẽ ghi đè toàn bộ dữ liệu hiện tại bằng dữ liệu của bản sao lưu. Các thay đổi sau thời điểm tạo bản sao lưu này sẽ bị thay thế.
            </div>
          </div>

          {activeItem && (
            <div className="rounded-xl border border-border/70 bg-card p-3 flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted font-medium">Tên file:</span>
                <span className="font-mono font-bold text-text">{activeItem.filename}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted font-medium">Thời điểm tạo:</span>
                <span className="font-mono font-bold text-text">{formatDateTime(activeItem.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted font-medium">Dung lượng:</span>
                <span className="font-mono font-bold text-text">{activeItem.size}</span>
              </div>
              <div className="text-muted font-medium mt-1">
                Ghi chú: <span className="text-text font-bold">{activeItem.note}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-rose-600 dark:text-rose-400 block mb-1 flex items-center gap-1">
              <Lock size={12} />
              <span>Nhập mật khẩu Admin để xác nhận khôi phục:</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu tài khoản hiện tại..."
              className="h-9 w-full rounded-xl border border-rose-500/40 bg-background px-3 text-xs font-semibold text-text placeholder:text-muted focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* ================= MODAL 3: XÓA BẢN SAO LƯU (DELETE BACKUP) ================= */}
      <Modal
        title="Xóa bản sao lưu vĩnh viễn"
        isOpen={isDeleteModalOpen}
        onClose={() => !isProcessing && setIsDeleteModalOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isProcessing}
              className="h-9 rounded-xl text-xs font-bold"
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDeleteBackup}
              disabled={isProcessing || !password}
              className="h-9 gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 text-xs font-bold"
            >
              {isProcessing ? <RefreshCcw size={13} className="animate-spin" /> : <Trash2 size={13} />}
              <span>{isProcessing ? "Đang xóa..." : "Xác nhận xóa vĩnh viễn"}</span>
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          {activeItem && (
            <p className="text-xs text-text leading-relaxed">
              Bạn có chắc chắn muốn xóa bản sao lưu{" "}
              <strong className="font-mono text-rose-600 dark:text-rose-400">{activeItem.filename}</strong>? Hành động này không thể hoàn tác.
            </p>
          )}

          <div>
            <label className="text-xs font-bold text-rose-600 dark:text-rose-400 block mb-1 flex items-center gap-1">
              <Lock size={12} />
              <span>Nhập mật khẩu Admin để xác nhận xóa:</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu..."
              className="h-9 w-full rounded-xl border border-rose-500/40 bg-background px-3 text-xs font-semibold text-text placeholder:text-muted focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>

      {/* ================= MODAL 4: DỌN DẸP / XÓA DATA (WIPE DATA) ================= */}
      <Modal
        title="Dọn dẹp & Xóa dữ liệu (Data Wipe)"
        isOpen={isWipeModalOpen}
        onClose={() => !isProcessing && setIsWipeModalOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsWipeModalOpen(false)}
              disabled={isProcessing}
              className="h-9 rounded-xl text-xs font-bold"
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleWipeData}
              disabled={isProcessing || wipeConfirmText !== "XAC NHAN XOA" || !password}
              className="h-9 gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 text-xs font-bold"
            >
              {isProcessing ? <RefreshCcw size={13} className="animate-spin" /> : <Trash2 size={13} />}
              <span>{isProcessing ? "Đang xử lý..." : "Thực hiện xóa dữ liệu"}</span>
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-1">
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed flex items-start gap-2.5">
            <AlertTriangle size={18} className="shrink-0 text-rose-600 mt-0.5" />
            <div>
              <strong className="block font-black mb-0.5">VÙNG NGUY HIỂM:</strong>
              Hành động này sẽ xóa vĩnh viễn các bản ghi được chọn khỏi hệ thống. Vui lòng tạo một bản sao lưu mới trước khi thực hiện.
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-text block mb-1">Chọn phạm vi dữ liệu cần dọn dẹp:</label>
            <select
              value={wipeScope}
              onChange={(e) => setWipeScope(e.target.value)}
              className="h-9 w-full rounded-xl border border-border/70 bg-background px-2.5 text-xs font-bold text-text focus:border-primary focus:outline-none"
            >
              <option value="DEMO_DATA">Xóa dữ liệu dùng thử / dữ liệu mẫu (Demo Data)</option>
              <option value="DRAFT_TRANSACTIONS">Xóa toàn bộ các giao dịch nháp (Draft Ledger & Invoices)</option>
              <option value="OLD_LOGS">Xóa lịch sử log hoạt động cũ hơn 90 ngày (Old Audit Logs)</option>
              <option value="SYSTEM_CACHE">Xóa bộ nhớ đệm và phiên làm việc (System Cache & Sessions)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-text block mb-1">
              Gõ chính xác cụm từ <strong className="text-rose-600 font-mono">XAC NHAN XOA</strong> vào ô bên dưới:
            </label>
            <input
              type="text"
              value={wipeConfirmText}
              onChange={(e) => setWipeConfirmText(e.target.value)}
              placeholder="XAC NHAN XOA"
              className="h-9 w-full rounded-xl border border-border/70 bg-background px-3 font-mono text-xs font-bold text-text focus:border-rose-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-rose-600 dark:text-rose-400 block mb-1 flex items-center gap-1">
              <Lock size={12} />
              <span>Nhập mật khẩu Admin để xác nhận:</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu quản trị viên..."
              className="h-9 w-full rounded-xl border border-rose-500/40 bg-background px-3 text-xs font-semibold text-text placeholder:text-muted focus:border-rose-500 focus:outline-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
