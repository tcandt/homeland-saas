"use client";

import React from "react";
import useSWR from "swr";
import { Activity, Building2, LockKeyhole, RefreshCcw, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { auditApi } from "@/lib/api/audit.api";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";

type OwnerSettings = {
  ownerAName: string;
  ownerBName: string;
  ownerAAccountEmail: string;
  ownerBAccountEmail: string;
  ownerAContactEmail: string;
  ownerBContactEmail: string;
  ownerAPhone: string;
  ownerBPhone: string;
  ownerABuildings: string[];
  ownerBBuildings: string[];
};

const fallback: OwnerSettings = {
  ownerAName: "Tính",
  ownerBName: "Thể",
  ownerAAccountEmail: "adminA@homeland.local",
  ownerBAccountEmail: "adminB@homeland.local",
  ownerAContactEmail: "",
  ownerBContactEmail: "",
  ownerAPhone: "",
  ownerBPhone: "",
  ownerABuildings: ["LK01-31", "LK08-25"],
  ownerBBuildings: ["LK01-32", "LK08-24"],
};

const actionLabels: Record<string, string> = {
  LOGIN_SUCCESS: "Đăng nhập thành công",
  LOGIN_FAILED: "Đăng nhập thất bại",
  LOGOUT_SUCCESS: "Đăng xuất",
  UPDATE: "Cập nhật",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}

function describeAuditChange(log: any) {
  if (log.module === "Auth") return log.entity || "User";
  if (log.module === "Settings") {
    const denied = Boolean((log.before as any)?.denied);
    if (denied) return "Từ chối cập nhật token Hunonic";
    return `Cài đặt ${log.entityId || ""}`.trim();
  }
  return log.entityId || log.entity;
}

function OwnerCard({
  title,
  name,
  email,
  contactEmail,
  phone,
  buildings,
  onNameChange,
  onContactEmailChange,
  onPhoneChange,
}: {
  title: string;
  name: string;
  email: string;
  contactEmail: string;
  phone: string;
  buildings: string[];
  onNameChange: (value: string) => void;
  onContactEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[16px] border border-border bg-background/70 p-[16px]">
      <div className="flex items-start justify-between gap-[12px]">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-muted">{title}</div>
          <div className="mt-[4px] text-[16px] font-black text-text">{name || "Chưa đặt tên"}</div>
        </div>
        <div className="flex h-[38px] w-[38px] items-center justify-center rounded-[12px] bg-primary/10 text-primary">
          <UsersRound size={18} />
        </div>
      </div>

      <div className="mt-[14px] grid grid-cols-1 gap-[12px]">
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Tên chủ sở hữu</label>
          <Input value={name} onChange={(event) => onNameChange(event.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Email liên hệ</label>
            <Input value={contactEmail} onChange={(event) => onContactEmailChange(event.target.value)} placeholder="Email nhận đối soát" />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Số điện thoại</label>
            <Input value={phone} onChange={(event) => onPhoneChange(event.target.value)} placeholder="Số điện thoại chủ" />
          </div>
        </div>
        <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
          <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted">
            <LockKeyhole size={14} /> Account quản trị riêng
          </div>
          <div className="mt-[4px] text-[13px] font-black text-text">{email}</div>
        </div>
        <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
          <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted">
            <Building2 size={14} /> Tòa đang quản lý
          </div>
          <div className="mt-[8px] flex flex-wrap gap-[8px]">
            {buildings.map((building) => (
              <span key={building} className="rounded-full bg-primary/10 px-[10px] py-[5px] text-[12px] font-black text-primary">
                {building}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsOwnerManagement() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<OwnerSettings>("owners", "TENANT", fallback);
  const audit = useSWR(["owner-audit-logs"], () => auditApi.logs({ limit: 20, module: "Auth,Settings" }), {
    revalidateOnFocus: false,
  });
  const auditRows = audit.data || [];

  return (
    <Card className="p-[20px]">
      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">Owner management</div>
          <h3 className="text-[20px] font-black text-text">Chủ sở hữu và phân tòa</h3>
          <p className="max-w-[780px] text-[13px] leading-relaxed text-muted">
            Cấu hình tên hiển thị của hai chủ sở hữu và account quản trị riêng để theo dõi lịch sử đăng nhập, thay đổi, chỉnh sửa. Admin vận hành không được chỉnh sửa token tích hợp nhạy cảm.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-[16px]">
          <OwnerCard
            title="Owner A"
            name={draft.ownerAName}
            email={draft.ownerAAccountEmail}
            contactEmail={draft.ownerAContactEmail}
            phone={draft.ownerAPhone}
            buildings={draft.ownerABuildings}
            onNameChange={(value) => setDraft((prev) => ({ ...prev, ownerAName: value }))}
            onContactEmailChange={(value) => setDraft((prev) => ({ ...prev, ownerAContactEmail: value }))}
            onPhoneChange={(value) => setDraft((prev) => ({ ...prev, ownerAPhone: value }))}
          />
          <OwnerCard
            title="Owner B"
            name={draft.ownerBName}
            email={draft.ownerBAccountEmail}
            contactEmail={draft.ownerBContactEmail}
            phone={draft.ownerBPhone}
            buildings={draft.ownerBBuildings}
            onNameChange={(value) => setDraft((prev) => ({ ...prev, ownerBName: value }))}
            onContactEmailChange={(value) => setDraft((prev) => ({ ...prev, ownerBContactEmail: value }))}
            onPhoneChange={(value) => setDraft((prev) => ({ ...prev, ownerBPhone: value }))}
          />
        </div>

        <div className="rounded-[14px] border border-blue-200 bg-blue-50 px-[14px] py-[12px] text-[12px] font-semibold leading-relaxed text-blue-900">
          Mapping hiện tại: LK01-31 và LK08-25 thuộc chủ Tính; LK01-32 và LK08-24 thuộc chủ Thể. Account owner A/B có toàn quyền vận hành, còn account admin thường chỉ vận hành và không chỉnh sửa token cài đặt.
        </div>

        <div className="overflow-hidden rounded-[16px] border border-border bg-background/70">
          <div className="flex flex-col gap-[10px] border-b border-border px-[14px] py-[12px] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-[8px] text-[13px] font-black text-text">
                <Activity size={16} className="text-primary" /> Lịch sử đăng nhập và chỉnh sửa
              </div>
              <p className="mt-[3px] text-[12px] text-muted">20 log gần nhất của Auth và Settings để truy vết owner/admin thao tác.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => audit.mutate()} isLoading={audit.isLoading}>
              <RefreshCcw size={13} className="mr-2" /> Làm mới
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left">
              <thead className="bg-muted/10">
                <tr>
                  <th className="px-[14px] py-[10px] text-[10px] font-black uppercase tracking-wide text-muted">Thời điểm</th>
                  <th className="px-[14px] py-[10px] text-[10px] font-black uppercase tracking-wide text-muted">Người thao tác</th>
                  <th className="px-[14px] py-[10px] text-[10px] font-black uppercase tracking-wide text-muted">Module</th>
                  <th className="px-[14px] py-[10px] text-[10px] font-black uppercase tracking-wide text-muted">Hành động</th>
                  <th className="px-[14px] py-[10px] text-[10px] font-black uppercase tracking-wide text-muted">Chi tiết</th>
                  <th className="px-[14px] py-[10px] text-[10px] font-black uppercase tracking-wide text-muted">IP</th>
                </tr>
              </thead>
              <tbody>
                {audit.isLoading && (
                  <tr>
                    <td colSpan={6} className="px-[14px] py-[24px] text-center text-[13px] font-semibold text-muted">Đang tải lịch sử...</td>
                  </tr>
                )}
                {!audit.isLoading && auditRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-[14px] py-[24px] text-center text-[13px] font-semibold text-muted">Chưa có log phù hợp.</td>
                  </tr>
                )}
                {auditRows.map((log) => (
                  <tr key={log.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-[14px] py-[11px] text-[12px] font-semibold text-muted">{formatDateTime(log.createdAt)}</td>
                    <td className="px-[14px] py-[11px]">
                      <div className="text-[12px] font-black text-text">{log.user?.fullName || "Hệ thống"}</div>
                      <div className="text-[11px] font-semibold text-muted">{log.user?.email || "Không có user"}</div>
                    </td>
                    <td className="px-[14px] py-[11px] text-[12px] font-bold text-text">{log.module || "-"}</td>
                    <td className="px-[14px] py-[11px]">
                      <span className="rounded-full bg-primary/10 px-[9px] py-[4px] text-[11px] font-black text-primary">
                        {actionLabels[log.action] || log.action}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-[14px] py-[11px] text-[12px] font-semibold text-text">{describeAuditChange(log)}</td>
                    <td className="whitespace-nowrap px-[14px] py-[11px] text-[12px] font-semibold text-muted">{log.ip || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={() => save(draft)} isLoading={isSaving} className="h-[42px] px-[18px]">
            Lưu cấu hình chủ sở hữu
          </Button>
        </div>
      </div>
    </Card>
  );
}
