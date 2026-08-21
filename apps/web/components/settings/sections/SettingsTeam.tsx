"use client";

import React from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LockKeyhole,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { authApi, type TeamAccount } from "@/lib/api/auth.api";

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

function formatDateTime(value: string | null) {
  if (!value) return "Chưa đăng nhập";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Không xác định";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function SettingsTeam() {
  const { data, error, isLoading } = useSWR("auth-team-accounts", authApi.team, {
    revalidateOnFocus: false,
  });
  const accounts = data || [];

  return (
    <div className="flex flex-col gap-[20px]" data-testid="settings-team-real-data">
      <section className="rounded-[8px] border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-[14px] border-b border-border px-[20px] py-[18px] sm:flex-row sm:items-start sm:justify-between sm:px-[24px]">
          <div className="flex min-w-0 items-start gap-[12px]">
            <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
              <Users size={19} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-[16px] font-black text-text">Tài khoản và vai trò thực tế</h2>
              <p className="mt-[4px] text-[12px] font-medium leading-[18px] text-muted">
                Dữ liệu lấy trực tiếp từ người dùng và role trong database của tenant hiện tại.
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-[6px] rounded-[6px] border border-border bg-background px-[9px] py-[6px] text-[11px] font-bold text-muted">
            <ShieldCheck size={14} aria-hidden="true" />
            Chỉ đọc
          </span>
        </div>

        {isLoading ? (
          <div className="flex min-h-[220px] items-center justify-center text-[13px] font-medium text-muted">Đang tải tài khoản...</div>
        ) : error ? (
          <div className="m-[20px] flex items-start gap-[10px] rounded-[8px] border border-danger/30 bg-danger/5 px-[14px] py-[12px] text-[12px] font-medium text-danger">
            <AlertTriangle size={16} className="mt-[1px] shrink-0" aria-hidden="true" />
            Không tải được danh sách tài khoản. Kiểm tra quyền `setting.read` và trạng thái API.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-border bg-background text-left text-[10px] font-black uppercase text-muted">
                  <th className="px-[20px] py-[11px] sm:px-[24px]">Tài khoản</th>
                  <th className="px-[14px] py-[11px]">Vai trò</th>
                  <th className="px-[14px] py-[11px]">Trạng thái</th>
                  <th className="px-[14px] py-[11px]">Đăng nhập gần nhất</th>
                  <th className="px-[20px] py-[11px] text-right sm:px-[24px]">IP gần nhất</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-b border-border last:border-b-0">
                    <td className="px-[20px] py-[13px] sm:px-[24px]">
                      <div className="font-black text-text">{account.fullName}</div>
                      <div className="mt-[2px] font-medium text-muted">{account.email}</div>
                    </td>
                    <td className="px-[14px] py-[13px]">
                      <div className="flex flex-wrap gap-[5px]">
                        {account.roles.length > 0 ? account.roles.map((role) => (
                          <span key={role} className="rounded-[5px] bg-primary/10 px-[7px] py-[3px] font-bold text-primary">
                            {roleLabels[role] || role}
                          </span>
                        )) : <span className="text-muted">Chưa gán role</span>}
                      </div>
                    </td>
                    <td className="px-[14px] py-[13px]">
                      <div className="flex flex-col items-start gap-[5px]">
                        <span className={`inline-flex items-center gap-[5px] rounded-[5px] px-[7px] py-[3px] font-bold ${
                          account.status === "ACTIVE" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                        }`}>
                          <span className={`h-[5px] w-[5px] rounded-full ${account.status === "ACTIVE" ? "bg-success" : "bg-warning"}`} />
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
                      <span className="inline-flex items-center gap-[6px]"><Clock3 size={13} className="text-muted" />{formatDateTime(account.lastLoginAt)}</span>
                    </td>
                    <td className="px-[20px] py-[13px] text-right font-mono text-[11px] text-muted sm:px-[24px]">{account.lastLoginIp || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
    </div>
  );
}
