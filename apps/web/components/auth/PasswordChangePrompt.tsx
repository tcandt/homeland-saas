"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, Clock3, KeyRound, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import PasswordField from "@/components/auth/PasswordField";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { ApiError } from "@/lib/api/client";
import { authApi, type User } from "@/lib/api/auth.api";
import { useAuthStore } from "@/lib/auth/auth-store";
import {
  clearPasswordChangePromptDeferral,
  deferPasswordChangePrompt,
} from "@/lib/auth/password-change-prompt";

interface PasswordChangePromptProps {
  isOpen: boolean;
  user: User;
  onDeferred: () => void;
}

function passwordErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Không thể cập nhật mật khẩu. Vui lòng thử lại.";
  if (error.code === "AUTH_INVALID_CREDENTIALS") return "Mật khẩu hiện tại không chính xác.";
  if (error.code === "AUTH_PASSWORD_REUSED") return "Mật khẩu mới phải khác mật khẩu hiện tại.";
  return error.message || "Không thể cập nhật mật khẩu. Vui lòng thử lại.";
}

export default function PasswordChangePrompt({ isOpen, user, onDeferred }: PasswordChangePromptProps) {
  const updateTokens = useAuthStore((state) => state.updateTokens);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isChanging, setIsChanging] = useState(false);
  const [isDeferring, setIsDeferring] = useState(false);
  const isBusy = isChanging || isDeferring;

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (newPassword.length < 12) {
      setError("Mật khẩu mới phải có ít nhất 12 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsChanging(true);
    try {
      await authApi.changePassword({ oldPassword, newPassword, confirmPassword });
      clearPasswordChangePromptDeferral(user.id);
      clearSession();
      toast.success("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
      window.location.href = "/login";
    } catch (caught) {
      setError(passwordErrorMessage(caught));
      setIsChanging(false);
    }
  };

  const handleDefer = async () => {
    if (isBusy) return;
    setError("");
    setIsDeferring(true);
    try {
      const tokens = await authApi.deferPasswordChange();
      updateTokens(tokens);
      deferPasswordChangePrompt(user.id);
      onDeferred();
      toast("Bạn có thể đổi mật khẩu trong phần Cài đặt.");
      window.location.reload();
    } catch (caught) {
      setError(passwordErrorMessage(caught));
      setIsDeferring(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleDefer}
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck size={21} className="text-primary" aria-hidden="true" />
          Bảo vệ tài khoản
        </span>
      }
      maxWidth="max-w-[520px]"
      zIndex={100100}
      testId="password-change-prompt"
    >
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-300/50 bg-amber-50 p-4 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
        <KeyRound size={19} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold">Bạn đang đăng nhập bằng mật khẩu tạm.</p>
          <p className="mt-1 text-xs font-medium leading-5 opacity-80">
            Đổi mật khẩu riêng để bảo vệ lịch sử thao tác và dữ liệu vận hành của tài khoản này.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger" role="alert">
          <AlertCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form className="space-y-4" onSubmit={handleChangePassword}>
        <PasswordField label="Mật khẩu tạm hiện tại" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} required disabled={isBusy} autoComplete="current-password" />
        <div className="space-y-1">
          <PasswordField label="Mật khẩu mới" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={12} disabled={isBusy} autoComplete="new-password" />
          <PasswordStrength password={newPassword} />
        </div>
        <PasswordField label="Xác nhận mật khẩu mới" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} disabled={isBusy} autoComplete="new-password" />

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={handleDefer} isLoading={isDeferring} disabled={isChanging} className="gap-2">
            <Clock3 size={17} aria-hidden="true" />
            Bỏ qua lúc này
          </Button>
          <Button type="submit" isLoading={isChanging} disabled={isDeferring} className="gap-2">
            <KeyRound size={17} aria-hidden="true" />
            Đổi mật khẩu
          </Button>
        </div>
      </form>
    </Modal>
  );
}
