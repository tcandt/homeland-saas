"use client";

import React, { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import {
  AlertTriangle,
  Ban,
  Camera,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  PencilLine,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { authApi, type TeamAccount } from "@/lib/api/auth.api";
import { ApiError } from "@/lib/api/client";
import { settingsApi } from "@/lib/api/settings.api";
import { compressImageFile } from "@/lib/utils/image";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

type TeamRole = "ADMIN" | "MANAGER" | "SALES" | "FINANCE";

const requiredTestAccounts = [
  { email: "manager@homeland.local", label: "Manager" },
  { email: "sales@homeland.local", label: "Kinh doanh" },
  { email: "finance@homeland.local", label: "Kế toán" },
  { email: "admin@homeland.vn", label: "Toàn quyền" },
] as const;

const roleLabels: Record<string, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý vận hành",
  SALES: "Kinh doanh",
  FINANCE: "Kế toán",
};

const statusLabels: Record<TeamAccount["status"], string> = {
  ACTIVE: "Đang hoạt động",
  PENDING_VERIFICATION: "Chờ xác minh",
  DISABLED: "Đã vô hiệu hóa",
  LOCKED: "Đã khóa",
};

const statusToneClasses: Record<TeamAccount["status"], string> = {
  ACTIVE: "bg-success/10 text-success",
  PENDING_VERIFICATION: "bg-warning/10 text-warning",
  DISABLED: "bg-danger/10 text-danger",
  LOCKED: "bg-danger/10 text-danger",
};

function formatDateTime(value: string | null) {
  if (!value) return "Chưa đăng nhập";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không xác định";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getAccountRole(account: TeamAccount): TeamRole {
  return (account.roles[0] as TeamRole | undefined) || "MANAGER";
}

function getInitials(fullName: string, email: string) {
  const source = fullName.trim() || email.trim() || "VP";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "VP";
}

function normalizeText(value: string) {
  return value.trim();
}

export default function SettingsTeam() {
  const { data, error, isLoading, mutate } = useSWR("auth-team-accounts", authApi.team, {
    revalidateOnFocus: false,
  });
  const editAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const actionMenuButtonRef = useRef<HTMLButtonElement | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("MANAGER");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const [editingAccount, setEditingAccount] = useState<TeamAccount | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState<TeamRole>("MANAGER");
  const [editStatus, setEditStatus] = useState<TeamAccount["status"]>("ACTIVE");
  const [editPassword, setEditPassword] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editAvatarBroken, setEditAvatarBroken] = useState(false);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [openActionMenuPosition, setOpenActionMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    accountId: string;
    email: string;
    nextStatus: TeamAccount["status"];
  } | null>(null);

  const accounts = data || [];
  const pendingStatusAccountId = pendingStatusChange?.accountId ?? null;
  const statusDialogEmail = pendingStatusChange?.email ?? "";
  const statusDialogNextStatus = pendingStatusChange?.nextStatus ?? "DISABLED";
  const statusDialogIsActivate = statusDialogNextStatus === "ACTIVE";
  const editingCurrentAvatar = normalizeText(editingAccount?.avatarUrl || "");
  const editingCurrentRole = editingAccount ? getAccountRole(editingAccount) : "MANAGER";
  const editingCurrentName = editingAccount?.fullName || "";
  const editAvatarPreview = editAvatarUrl || editingCurrentAvatar;
  const editHasChanges = Boolean(editingAccount) && (
    normalizeText(editFullName) !== normalizeText(editingCurrentName) ||
    editRole !== editingCurrentRole ||
    editStatus !== editingAccount?.status ||
    normalizeText(editPassword).length > 0 ||
    normalizeText(editAvatarPreview) !== normalizeText(editingCurrentAvatar)
  );

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!openActionMenuId) return;
      const target = event.target as Node | null;
      if (actionMenuButtonRef.current && target && actionMenuButtonRef.current.contains(target)) return;
      if (actionMenuRef.current && target && actionMenuRef.current.contains(target)) return;
      setOpenActionMenuId(null);
      setOpenActionMenuPosition(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openActionMenuId]);

  useEffect(() => {
    if (!openActionMenuId) return;

    const closeMenu = () => {
      setOpenActionMenuId(null);
      setOpenActionMenuPosition(null);
    };

    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [openActionMenuId]);

  const closeActionMenu = () => {
    setOpenActionMenuId(null);
    setOpenActionMenuPosition(null);
  };

  const closeStatusConfirm = () => {
    setPendingStatusChange(null);
  };

  const openEditor = (account: TeamAccount, focusPassword = false) => {
    closeActionMenu();
    setEditingAccount(account);
    setEditFullName(account.fullName);
    setEditRole(getAccountRole(account));
    setEditStatus(account.status);
    setEditPassword("");
    setEditAvatarUrl(account.avatarUrl || "");
    setEditAvatarBroken(false);
    setShowEditPassword(focusPassword);
  };

  const closeEditor = () => {
    setEditingAccount(null);
    setEditFullName("");
    setEditRole("MANAGER");
    setEditStatus("ACTIVE");
    setEditPassword("");
    setEditAvatarUrl("");
    setShowEditPassword(false);
    setEditAvatarBroken(false);
  };

  const openAvatarEditor = (account: TeamAccount) => {
    openEditor(account, false);
  };

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedPassword = normalizeText(temporaryPassword);
    if (normalizedPassword.length < 12) {
      toast.error("Mật khẩu tạm phải có ít nhất 12 ký tự.");
      return;
    }

    setIsCreating(true);
    try {
      await authApi.createTeamMember({
        fullName: normalizeText(fullName),
        email: normalizeText(email),
        role,
        temporaryPassword: normalizedPassword,
      });
      toast.success("Đã tạo tài khoản người dùng.");
      setFullName("");
      setEmail("");
      setRole("MANAGER");
      setTemporaryPassword("");
      setShowCreatePassword(false);
      await mutate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Không thể tạo tài khoản.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 384,
        maxHeight: 384,
        quality: 0.78,
        mimeType: "image/webp",
      });
      const uploaded = await settingsApi.uploadAsset(compressed, {
        folder: "avatars",
        purpose: "team-avatar",
        scope: "USER",
      });
      setEditAvatarBroken(false);
      setEditAvatarUrl(uploaded.url || "");
      toast.success("Đã tải lên ảnh đại diện.");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Không thể tải ảnh đại diện lên.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const saveEditedAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingAccount) return;

    const payload: {
      fullName?: string;
      role?: TeamRole;
      status?: TeamAccount["status"];
      temporaryPassword?: string;
      avatarUrl?: string;
    } = {};

    const nextFullName = normalizeText(editFullName);
    if (nextFullName && nextFullName !== editingCurrentName) {
      payload.fullName = nextFullName;
    }
    if (editRole !== editingCurrentRole) {
      payload.role = editRole;
    }
    if (editStatus !== editingAccount.status) {
      payload.status = editStatus;
    }

    const nextPassword = normalizeText(editPassword);
    if (nextPassword) {
      if (nextPassword.length < 12) {
        toast.error("Mật khẩu tạm phải có ít nhất 12 ký tự.");
        return;
      }
      payload.temporaryPassword = nextPassword;
    }

    const nextAvatarUrl = normalizeText(editAvatarPreview);
    if (nextAvatarUrl && nextAvatarUrl !== editingCurrentAvatar) {
      payload.avatarUrl = nextAvatarUrl;
    }

    if (Object.keys(payload).length === 0) {
      toast.error("Không có thay đổi để lưu.");
      return;
    }

    setIsSavingMember(true);
    try {
      await authApi.updateTeamMember(editingAccount.id, payload);
      toast.success("Đã cập nhật tài khoản.");
      closeEditor();
      await mutate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Không thể cập nhật tài khoản.");
    } finally {
      setIsSavingMember(false);
    }
  };

  const toggleStatus = async (account: TeamAccount) => {
    closeActionMenu();
    const nextStatus: TeamAccount["status"] = account.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    setPendingStatusChange({
      accountId: account.id,
      email: account.email,
      nextStatus,
    });
  };

  const confirmToggleStatus = async () => {
    if (!pendingStatusChange) return;

    const { accountId, nextStatus } = pendingStatusChange;
    setStatusLoadingId(accountId);
    closeStatusConfirm();
    try {
      await authApi.updateTeamMember(accountId, { status: nextStatus });
      toast.success(nextStatus === "ACTIVE" ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản.");
      if (editingAccount?.id === accountId) {
        closeEditor();
      }
      await mutate();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Không thể cập nhật trạng thái.");
    } finally {
      setStatusLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-[20px]" data-testid="settings-users-real-data">
      <section className="rounded-[8px] border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-[14px] border-b border-border px-[20px] py-[18px] sm:flex-row sm:items-start sm:justify-between sm:px-[24px]">
          <div className="flex min-w-0 items-start gap-[12px]">
            <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
              <Users size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[16px] font-black text-text">Users</h2>
              <p className="mt-[4px] text-[12px] font-medium leading-[18px] text-muted">
                Danh sách tài khoản người dùng của tenant hiện tại và form tạo account nội bộ.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-[8px]">
            <span className="inline-flex w-fit items-center gap-[6px] rounded-[6px] border border-border bg-background px-[9px] py-[6px] text-[11px] font-bold text-muted">
              <ShieldCheck size={14} aria-hidden="true" />
              Quản lý tài khoản
            </span>
            <span className="inline-flex w-fit items-center gap-[6px] rounded-[6px] border border-warning/30 bg-warning/10 px-[9px] py-[6px] text-[11px] font-bold text-warning">
              <LockKeyhole size={14} aria-hidden="true" />
              Tạo mới cần `setting.update`
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[14px] border-b border-border px-[20px] py-[18px] xl:grid-cols-[1.4fr_0.9fr] sm:px-[24px]">
          <div>
            {isLoading ? (
              <div className="flex min-h-[220px] items-center justify-center text-[13px] font-medium text-muted">Đang tải tài khoản...</div>
            ) : error ? (
              <div className="flex items-start gap-[10px] rounded-[8px] border border-danger/30 bg-danger/5 px-[14px] py-[12px] text-[12px] font-medium text-danger">
                <AlertTriangle size={16} className="mt-[1px] shrink-0" aria-hidden="true" />
                Không tải được danh sách tài khoản. Kiểm tra quyền `setting.read` và trạng thái API.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-border bg-background text-left text-[10px] font-black uppercase text-muted">
                      <th className="px-[20px] py-[11px] sm:px-[24px]">Tài khoản</th>
                      <th className="px-[14px] py-[11px]">Vai trò</th>
                      <th className="px-[14px] py-[11px]">Trạng thái</th>
                      <th className="px-[14px] py-[11px]">Đăng nhập gần nhất</th>
                      <th className="px-[20px] py-[11px] text-right sm:px-[24px]">IP gần nhất</th>
                      <th className="px-[20px] py-[11px] text-right sm:px-[24px]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => {
                      const initials = getInitials(account.fullName, account.email);
                      const quickStatusLabel = account.status === "ACTIVE" ? "Khóa" : "Mở";
                      const quickStatusIcon = account.status === "ACTIVE" ? <Ban size={14} /> : <ShieldCheck size={14} />;
                      const isMenuOpen = openActionMenuId === account.id;

                      return (
                        <tr key={account.id} className="border-b border-border last:border-b-0">
                          <td className="px-[20px] py-[13px] sm:px-[24px]">
                            <div className="flex min-w-0 items-center gap-[12px]">
                              <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-background text-[12px] font-black text-primary">
                                {account.avatarUrl ? (
                                  <img
                                    src={account.avatarUrl}
                                    alt={account.fullName}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  initials
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-black text-text">{account.fullName}</div>
                                <div className="mt-[2px] truncate font-medium text-muted">{account.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-[14px] py-[13px]">
                            <div className="flex flex-wrap gap-[5px]">
                              {account.roles.length > 0 ? account.roles.map((item) => (
                                <span key={item} className="rounded-[5px] bg-primary/10 px-[7px] py-[3px] font-bold text-primary">
                                  {roleLabels[item] || item}
                                </span>
                              )) : <span className="text-muted">Chưa gán role</span>}
                            </div>
                          </td>
                          <td className="px-[14px] py-[13px]">
                            <div className="flex flex-col items-start gap-[5px]">
                              <span className={`inline-flex items-center gap-[5px] rounded-[5px] px-[7px] py-[3px] font-bold ${statusToneClasses[account.status]}`}>
                                <span className={`h-[5px] w-[5px] rounded-full ${account.status === "ACTIVE" ? "bg-success" : account.status === "PENDING_VERIFICATION" ? "bg-warning" : "bg-danger"}`} />
                                {statusLabels[account.status]}
                              </span>
                              {account.mustChangePassword && (
                                <span className="inline-flex items-center gap-[4px] text-[10px] font-bold text-warning">
                                  <LockKeyhole size={11} aria-hidden="true" /> Phải đổi mật khẩu tạm
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-[14px] py-[13px] font-medium text-text">
                            <span className="inline-flex items-center gap-[6px]">
                              <Clock3 size={13} className="text-muted" />
                              {formatDateTime(account.lastLoginAt)}
                            </span>
                          </td>
                          <td className="px-[20px] py-[13px] text-right font-mono text-[11px] text-muted sm:px-[24px]">
                            {account.lastLoginIp || "-"}
                          </td>
                          <td className="px-[20px] py-[13px] sm:px-[24px]">
                            <div className="relative flex justify-end">
                              <Button
                                ref={isMenuOpen ? actionMenuButtonRef : undefined}
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-[32px] w-[32px]"
                                onClick={(event) => {
                                  if (openActionMenuId === account.id) {
                                    closeActionMenu();
                                    return;
                                  }
                                  const rect = event.currentTarget.getBoundingClientRect();
                                  actionMenuButtonRef.current = event.currentTarget;
                                  setOpenActionMenuId(account.id);
                                  setOpenActionMenuPosition({
                                    top: rect.bottom + 8,
                                    right: Math.max(12, window.innerWidth - rect.right),
                                  });
                                }}
                                title="Mở hành động"
                                aria-label="Mở hành động"
                              >
                                <span className="flex items-center gap-[3px]" aria-hidden="true">
                                  <span className="h-[3px] w-[3px] rounded-full bg-current" />
                                  <span className="h-[3px] w-[3px] rounded-full bg-current" />
                                  <span className="h-[3px] w-[3px] rounded-full bg-current" />
                                </span>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Card className="border border-border bg-background/60 p-[16px] shadow-none">
            <div className="flex items-start justify-between gap-[12px] border-b border-border pb-[12px]">
              <div>
                <h3 className="text-[14px] font-black text-text">Tạo tài khoản mới</h3>
                <p className="mt-[4px] text-[12px] font-medium text-muted">Tạo user tenant nội bộ với role và mật khẩu tạm.</p>
              </div>
            </div>

            <form className="mt-[14px] flex flex-col gap-[12px]" onSubmit={createUser}>
              <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
                <label className="flex flex-col gap-[6px]">
                  <span className="text-[11px] font-black uppercase text-muted">Họ và tên</span>
                  <Input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Họ và tên"
                    required
                    disabled={isCreating}
                  />
                </label>
                <label className="flex flex-col gap-[6px]">
                  <span className="text-[11px] font-black uppercase text-muted">Vai trò</span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as TeamRole)}
                    disabled={isCreating}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-text outline-none focus:border-primary"
                  >
                    <option value="MANAGER">Manager</option>
                    <option value="SALES">Sales</option>
                    <option value="FINANCE">Finance</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
                <label className="flex flex-col gap-[6px]">
                  <span className="text-[11px] font-black uppercase text-muted">Email</span>
                  <Input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Email"
                    type="email"
                    required
                    disabled={isCreating}
                  />
                </label>
                <label className="flex flex-col gap-[6px]">
                  <span className="text-[11px] font-black uppercase text-muted">Mật khẩu tạm</span>
                  <div className="relative">
                    <Input
                      value={temporaryPassword}
                      onChange={(event) => setTemporaryPassword(event.target.value)}
                      placeholder="Mật khẩu tạm"
                      type={showCreatePassword ? "text" : "password"}
                      minLength={12}
                      required
                      disabled={isCreating}
                      className="pr-[44px]"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-[2px] top-1/2 h-[34px] w-[34px] -translate-y-1/2"
                      onClick={() => setShowCreatePassword((value) => !value)}
                      aria-label={showCreatePassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      disabled={isCreating}
                    >
                      {showCreatePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </Button>
                  </div>
                </label>
              </div>

              <div className="rounded-[8px] border border-warning/30 bg-warning/5 px-[12px] py-[10px] text-[11px] font-medium leading-[18px] text-muted">
                Chỉ tài khoản bootstrap `admin@homeland.vn` hoặc user có quyền `setting.update` mới tạo được account. User mới sẽ bị buộc đổi mật khẩu ở lần đăng nhập đầu.
              </div>
              <Button type="submit" isLoading={isCreating} className="w-full">
                Tạo tài khoản
              </Button>
            </form>
          </Card>
        </div>
      </section>

      {typeof document !== "undefined" && openActionMenuId && openActionMenuPosition && createPortal(
        <div className="fixed inset-0 z-[10040] pointer-events-none">
          <div
            ref={actionMenuRef}
            className="pointer-events-auto fixed w-[212px] overflow-hidden rounded-[10px] border border-border bg-card shadow-lg"
            style={{
              top: `${openActionMenuPosition.top}px`,
              right: `${openActionMenuPosition.right}px`,
            }}
          >
            {accounts.find((item) => item.id === openActionMenuId) && (() => {
              const account = accounts.find((item) => item.id === openActionMenuId)!;
              const quickStatusLabel = account.status === "ACTIVE" ? "Khóa" : "Mở";

              return (
                <>
                  <button
                    type="button"
                    className="flex w-full items-center gap-[10px] px-[14px] py-[11px] text-left text-[12px] font-semibold text-text hover:bg-background"
                    onClick={() => {
                      closeActionMenu();
                      openEditor(account, false);
                    }}
                  >
                    <PencilLine size={14} className="text-muted" />
                    Chỉnh sửa thông tin
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-[10px] px-[14px] py-[11px] text-left text-[12px] font-semibold text-text hover:bg-background"
                    onClick={() => {
                      closeActionMenu();
                      openEditor(account, true);
                    }}
                  >
                    <KeyRound size={14} className="text-muted" />
                    Đổi mật khẩu
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-[10px] px-[14px] py-[11px] text-left text-[12px] font-semibold text-text hover:bg-background"
                    onClick={() => {
                      closeActionMenu();
                      openAvatarEditor(account);
                    }}
                  >
                    <Camera size={14} className="text-muted" />
                    Cập nhật ảnh đại diện
                  </button>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-[10px] px-[14px] py-[11px] text-left text-[12px] font-semibold hover:bg-background ${account.status === "ACTIVE" ? "text-danger" : "text-success"}`}
                                  onClick={() => toggleStatus(account)}
                                  disabled={statusLoadingId === account.id}
                                >
                                  {account.status === "ACTIVE" ? <Ban size={14} /> : <ShieldCheck size={14} />}
                                  {quickStatusLabel} tài khoản
                                </button>
                </>
              );
            })()}
          </div>
        </div>,
        document.body,
      )}

      <section className="grid grid-cols-1 gap-[10px] sm:grid-cols-2 xl:grid-cols-4" data-testid="required-role-accounts">
        {requiredTestAccounts.map((required) => {
          const account = accounts.find((item) => item.email.toLowerCase() === required.email.toLowerCase());
          const ready = account?.status === "ACTIVE" && account.roles.length > 0;
          const pendingPasswordChange = Boolean(account?.mustChangePassword);

          return (
            <div key={required.email} className="rounded-[8px] border border-border bg-card p-[14px] shadow-sm">
              <div className="flex items-center justify-between gap-[10px]">
                <UserCog size={17} className={ready ? "text-success" : "text-warning"} aria-hidden="true" />
                {ready ? <CheckCircle2 size={16} className="text-success" aria-label="Sẵn sàng" /> : <AlertTriangle size={16} className="text-warning" aria-label="Chưa sẵn sàng" />}
              </div>
              <div className="mt-[10px] text-[13px] font-black text-text">{required.label}</div>
              <div className="mt-[3px] break-all text-[10px] font-medium text-muted">{required.email}</div>
              <div className={`mt-[8px] text-[10px] font-black ${ready && !pendingPasswordChange ? "text-success" : "text-warning"}`}>
                {!ready ? "CHƯA ĐỦ DỮ LIỆU" : pendingPasswordChange ? "CHỜ ĐỔI MẬT KHẨU TẠM" : "SẴN SÀNG KIỂM THỬ"}
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex items-start gap-[10px] rounded-[8px] border border-warning/30 bg-warning/5 px-[16px] py-[13px]">
        <LockKeyhole size={17} className="mt-[1px] shrink-0 text-warning" aria-hidden="true" />
        <div>
          <h3 className="text-[13px] font-black text-text">Provisioning được bảo vệ ở backend</h3>
          <p className="mt-[4px] text-[11px] font-medium leading-[17px] text-muted">
            API tạo thành viên yêu cầu quyền `setting.update`, mật khẩu tạm tối thiểu 12 ký tự, role có sẵn và ghi audit. Tài khoản mới bị chặn khỏi nghiệp vụ cho đến khi đổi mật khẩu tạm; phiên đăng nhập cũ bị thu hồi ngay sau khi đổi.
          </p>
        </div>
      </section>

      <Modal
        isOpen={Boolean(editingAccount)}
        onClose={closeEditor}
        title="Chỉnh sửa tài khoản"
        maxWidth="max-w-2xl"
        testId="team-member-edit-modal"
        footer={
          <div className="flex flex-col-reverse gap-[10px] sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeEditor} disabled={isSavingMember || isUploadingAvatar}>
              Hủy
            </Button>
            <Button
              type="submit"
              form="team-member-edit-form"
              isLoading={isSavingMember}
              disabled={!editHasChanges || isUploadingAvatar}
            >
              Lưu thay đổi
            </Button>
          </div>
        }
      >
        <form id="team-member-edit-form" className="flex flex-col gap-[14px]" onSubmit={saveEditedAccount}>
          <div className="flex items-start gap-[14px] rounded-[8px] border border-border bg-background/70 p-[14px]">
            <div className="relative h-[84px] w-[84px] shrink-0">
              {editAvatarPreview && !editAvatarBroken ? (
                <img
                  src={editAvatarPreview}
                  alt={editingAccount?.fullName || "Avatar"}
                  onError={() => setEditAvatarBroken(true)}
                  className="h-full w-full rounded-full border border-border object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-[26px] font-black text-primary">
                  {editingAccount ? getInitials(editingAccount.fullName, editingAccount.email) : "VP"}
                </div>
              )}
              <button
                type="button"
                onClick={() => editAvatarInputRef.current?.click()}
                className="absolute -right-1 -bottom-1 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-card bg-primary text-white shadow-md"
                aria-label="Đổi ảnh đại diện"
                disabled={isUploadingAvatar}
              >
                <Camera size={13} />
              </button>
              <input
                ref={editAvatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleEditAvatarUpload}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black uppercase text-muted">Email</div>
              <div className="mt-[4px] break-all text-[13px] font-bold text-text">{editingAccount?.email}</div>
              <div className="mt-[8px] flex flex-wrap gap-[6px]">
                <span className={`inline-flex items-center gap-[5px] rounded-[5px] px-[8px] py-[4px] text-[10px] font-black ${statusToneClasses[editingAccount?.status || "ACTIVE"]}`}>
                  {editingAccount ? statusLabels[editingAccount.status] : "Trạng thái"}
                </span>
                {editingAccount?.mustChangePassword && (
                  <span className="inline-flex items-center gap-[4px] rounded-[5px] border border-warning/30 bg-warning/10 px-[8px] py-[4px] text-[10px] font-black text-warning">
                    <LockKeyhole size={11} /> Bắt buộc đổi mật khẩu
                  </span>
                )}
              </div>
              <p className="mt-[8px] text-[11px] font-medium leading-[17px] text-muted">
                Ảnh đại diện được lưu ở `settings` scope `USER`. Chọn file rồi lưu thay đổi để cập nhật.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
            <label className="flex flex-col gap-[6px]">
              <span className="text-[11px] font-black uppercase text-muted">Họ và tên</span>
              <Input
                value={editFullName}
                onChange={(event) => setEditFullName(event.target.value)}
                placeholder="Họ và tên"
                required
              />
            </label>
            <label className="flex flex-col gap-[6px]">
              <span className="text-[11px] font-black uppercase text-muted">Vai trò</span>
              <select
                value={editRole}
                onChange={(event) => setEditRole(event.target.value as TeamRole)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-text outline-none focus:border-primary"
              >
                <option value="MANAGER">Manager</option>
                <option value="SALES">Sales</option>
                <option value="FINANCE">Finance</option>
                <option value="ADMIN">Admin</option>
              </select>
            </label>
            <label className="flex flex-col gap-[6px]">
              <span className="text-[11px] font-black uppercase text-muted">Trạng thái</span>
              <select
                value={editStatus}
                onChange={(event) => setEditStatus(event.target.value as TeamAccount["status"])}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-text outline-none focus:border-primary"
              >
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="PENDING_VERIFICATION">Chờ xác minh</option>
                <option value="DISABLED">Đã vô hiệu hóa</option>
                <option value="LOCKED">Đã khóa</option>
              </select>
            </label>
            <label className="flex flex-col gap-[6px]">
              <span className="text-[11px] font-black uppercase text-muted">Mật khẩu tạm mới</span>
              <div className="relative">
                <Input
                  value={editPassword}
                  onChange={(event) => setEditPassword(event.target.value)}
                  placeholder="Để trống nếu không đổi"
                  type={showEditPassword ? "text" : "password"}
                  minLength={12}
                  className="pr-[44px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-[2px] top-1/2 h-[34px] w-[34px] -translate-y-1/2"
                  onClick={() => setShowEditPassword((value) => !value)}
                  aria-label={showEditPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </Button>
              </div>
            </label>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(pendingStatusChange)}
        onClose={closeStatusConfirm}
        title={pendingStatusChange?.nextStatus === "ACTIVE" ? "Xác nhận mở khóa" : "Xác nhận khóa tài khoản"}
        maxWidth="max-w-md"
        testId="team-status-confirm-modal"
        footer={
          <div className="flex flex-col-reverse gap-[10px] sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeStatusConfirm} disabled={statusLoadingId !== null}>
              Hủy
            </Button>
            <Button
              type="button"
              variant={statusDialogIsActivate ? "primary" : "danger"}
              onClick={confirmToggleStatus}
              isLoading={Boolean(pendingStatusAccountId && statusLoadingId === pendingStatusAccountId)}
              disabled={statusLoadingId !== null}
            >
              {statusDialogIsActivate ? "Mở khóa" : "Khóa tài khoản"}
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-[12px] rounded-[8px] border border-border bg-background/70 p-[14px]">
          <div className={`mt-[1px] flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] ${statusDialogIsActivate ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            {statusDialogIsActivate ? <ShieldCheck size={16} /> : <Ban size={16} />}
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-black text-text">
              {statusDialogIsActivate ? "Mở khóa tài khoản" : "Khóa tài khoản"}
            </div>
            <p className="mt-[4px] text-[12px] font-medium leading-[18px] text-muted">
              {statusDialogIsActivate
                ? `Bạn sắp mở khóa ${statusDialogEmail}. Tài khoản sẽ có thể đăng nhập và sử dụng lại bình thường.`
                : `Bạn sắp khóa ${statusDialogEmail}. Tài khoản sẽ không thể đăng nhập cho đến khi được mở khóa lại.`}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
