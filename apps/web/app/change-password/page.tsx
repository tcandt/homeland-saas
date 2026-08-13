"use client";

import { FormEvent, useState } from "react";
import { AlertCircle, KeyRound, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import PasswordField from "@/components/auth/PasswordField";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth.api";
import { useAuthStore } from "@/lib/auth/auth-store";

export default function ChangePasswordPage() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

    setIsSubmitting(true);
    try {
      await authApi.changePassword({ oldPassword, newPassword, confirmPassword });
      clearSession();
      toast.success("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
      router.replace("/login");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Không thể đổi mật khẩu. Vui lòng thử lại.");
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard>
        <div className="mb-[28px] flex items-start gap-[12px]">
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
            <KeyRound size={20} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-[22px] font-black text-text">Thiết lập mật khẩu mới</h1>
            <p className="mt-[5px] text-[13px] font-medium leading-[20px] text-muted">
              Đây là lần đăng nhập đầu tiên. Hãy thay mật khẩu tạm trước khi tiếp tục.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-[20px] flex items-start gap-[10px] rounded-[8px] border border-danger/20 bg-danger/10 p-[12px] text-[13px] font-semibold text-danger" role="alert">
            <AlertCircle size={17} className="mt-[1px] shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form className="flex flex-col gap-[20px]" onSubmit={handleSubmit}>
          <PasswordField label="Mật khẩu tạm" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} required disabled={isSubmitting} autoComplete="current-password" />
          <PasswordField label="Mật khẩu mới" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={12} disabled={isSubmitting} autoComplete="new-password" />
          <PasswordField label="Xác nhận mật khẩu mới" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={12} disabled={isSubmitting} autoComplete="new-password" />
          <button type="submit" disabled={isSubmitting} className="mt-[4px] flex h-[48px] w-full items-center justify-center gap-[8px] rounded-[8px] bg-primary px-[18px] text-[14px] font-bold text-white transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60">
            {isSubmitting ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
            Đổi mật khẩu
          </button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
