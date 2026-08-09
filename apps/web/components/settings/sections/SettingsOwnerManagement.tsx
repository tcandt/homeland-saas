"use client";

import React from "react";
import useSWR from "swr";
import { Activity, Building2, CreditCard, LockKeyhole, RefreshCcw, Star, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { auditApi } from "@/lib/api/audit.api";
import { financeApi } from "@/lib/api/finance.api";
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

type OwnerBankDefaults = {
  defaults: Record<string, string>;
};

const ownerFallback: OwnerSettings = {
  ownerAName: "Tính",
  ownerBName: "Thể",
  ownerAAccountEmail: "adminA@homeland.local",
  ownerBAccountEmail: "adminB@homeland.local",
  ownerAContactEmail: "",
  ownerBContactEmail: "",
  ownerAPhone: "",
  ownerBPhone: "",
  ownerBBuildings: ["LK01-32", "LK08-24"],
  ownerABuildings: ["LK01-31", "LK08-25"],
};

const bankDefaultsFallback: OwnerBankDefaults = {
  defaults: {},
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

function maskAccountNumber(value?: string) {
  if (!value) return "-";
  if (value.length <= 4) return value;
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
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
          <Input value={name || ""} onChange={(event) => onNameChange(event.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-[12px] sm:grid-cols-2">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Email liên hệ</label>
            <Input value={contactEmail || ""} onChange={(event) => onContactEmailChange(event.target.value)} placeholder="Email nhận đối soát" />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Số điện thoại</label>
            <Input value={phone || ""} onChange={(event) => onPhoneChange(event.target.value)} placeholder="Số điện thoại chủ" />
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
  const { draft, setDraft, isSaving, save } = useSettingsSection<OwnerSettings>("owners", "TENANT", ownerFallback);
  const {
    draft: bankDefaultsDraft,
    setDraft: setBankDefaultsDraft,
    isSaving: isSavingBankDefaults,
    save: saveBankDefaults,
  } = useSettingsSection<OwnerBankDefaults>("owner-bank-defaults", "TENANT", bankDefaultsFallback);
  const audit = useSWR(["owner-audit-logs"], () => auditApi.logs({ limit: 20, module: "Auth,Settings" }), {
    revalidateOnFocus: false,
  });
  const owners = useSWR(["finance-owners-for-settings"], () => financeApi.getOwners(), {
    revalidateOnFocus: false,
  });
  const auditRows = audit.data || [];
  const ownerRows = Array.isArray(owners.data) ? owners.data : [];

  const setDefaultBank = (ownerId: string, bankAccountId: string) => {
    setBankDefaultsDraft((prev) => {
      const nextDefaults = { ...(prev.defaults || {}) };
      if (bankAccountId) nextDefaults[ownerId] = bankAccountId;
      else delete nextDefaults[ownerId];
      return { ...prev, defaults: nextDefaults };
    });
  };

  return (
    <Card className="p-[20px]">
      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">Owner management</div>
          <h3 className="text-[20px] font-black text-text">Chủ sở hữu và phân tòa</h3>
          <p className="max-w-[780px] text-[13px] leading-relaxed text-muted">
            Cấu hình tên hiển thị của hai chủ sở hữu, account quản trị riêng và bank mặc định để tạo QR SePay đúng chủ. Admin vận hành không được chỉnh token tích hợp nhạy cảm.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-[16px] xl:grid-cols-2">
          <OwnerCard
            title="Owner A"
            name={draft.ownerAName}
            email={draft.ownerAAccountEmail}
            contactEmail={draft.ownerAContactEmail}
            phone={draft.ownerAPhone}
            buildings={draft.ownerABuildings || []}
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
            buildings={draft.ownerBBuildings || []}
            onNameChange={(value) => setDraft((prev) => ({ ...prev, ownerBName: value }))}
            onContactEmailChange={(value) => setDraft((prev) => ({ ...prev, ownerBContactEmail: value }))}
            onPhoneChange={(value) => setDraft((prev) => ({ ...prev, ownerBPhone: value }))}
          />
        </div>

        <div className="rounded-[14px] border border-blue-200 bg-blue-50 px-[14px] py-[12px] text-[12px] font-semibold leading-relaxed text-blue-900">
          Mapping hiện tại: LK01-31 và LK08-25 thuộc chủ Tính; LK01-32 và LK08-24 thuộc chủ Thể. Account owner A/B có toàn quyền vận hành, còn account admin thường chỉ vận hành và không chỉnh sửa token cài đặt.
        </div>

        <div className="overflow-hidden rounded-[16px] border border-border bg-background/70">
          <div className="flex flex-col gap-[10px] border-b border-border px-[14px] py-[12px] lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-[8px] text-[13px] font-black text-text">
                <CreditCard size={16} className="text-primary" /> Bank SePay theo chủ sở hữu
              </div>
              <p className="mt-[3px] text-[12px] text-muted">
                Chọn bank mặc định cho từng owner. Khi tạo QR, hệ thống ưu tiên bank mặc định rồi mới fallback về bank đang bật đầu tiên của owner.
              </p>
            </div>
            <div className="flex flex-wrap gap-[8px]">
              <Button type="button" variant="outline" size="sm" onClick={() => owners.mutate()} isLoading={owners.isLoading}>
                <RefreshCcw size={13} className="mr-2" /> Làm mới
              </Button>
              <Button type="button" size="sm" onClick={() => saveBankDefaults(bankDefaultsDraft)} isLoading={isSavingBankDefaults}>
                <Star size={13} className="mr-2" /> Lưu bank mặc định
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-[12px] p-[14px] xl:grid-cols-2">
            {owners.isLoading && (
              <div className="col-span-full rounded-[14px] border border-border bg-card px-[14px] py-[20px] text-center text-[13px] font-semibold text-muted">
                Đang tải danh sách bank...
              </div>
            )}
            {!owners.isLoading && ownerRows.length === 0 && (
              <div className="col-span-full rounded-[14px] border border-border bg-card px-[14px] py-[20px] text-center text-[13px] font-semibold text-muted">
                Chưa có bank account theo owner.
              </div>
            )}
            {ownerRows.map((owner: any) => {
              const activeBanks = (owner.bankAccounts || []).filter((bank: any) => bank.isActive);
              const defaultBankId = bankDefaultsDraft.defaults?.[owner.id] || "";
              return (
                <div key={owner.id} className="rounded-[14px] border border-border bg-card p-[14px]">
                  <div className="flex items-start justify-between gap-[12px]">
                    <div>
                      <div className="text-[12px] font-black text-text">{owner.name}</div>
                      <div className="mt-[2px] text-[11px] font-semibold text-muted">
                        {(owner.buildings || []).map((building: any) => building.code).join(", ") || "Chưa gắn tòa"}
                      </div>
                    </div>
                    <span className="rounded-full bg-primary/10 px-[9px] py-[4px] text-[11px] font-black text-primary">
                      {(owner.bankAccounts || []).length} bank
                    </span>
                  </div>

                  <label className="mt-[12px] flex flex-col gap-[6px]">
                    <span className="text-[11px] font-black uppercase tracking-wide text-muted">Bank mặc định khi tạo QR</span>
                    <select
                      value={defaultBankId}
                      onChange={(event) => setDefaultBank(owner.id, event.target.value)}
                      className="h-[42px] rounded-[12px] border border-border bg-background px-[12px] text-[13px] font-bold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">Tự động chọn bank đầu tiên đang bật</option>
                      {activeBanks.map((bank: any) => (
                        <option key={bank.id} value={bank.id}>
                          {bank.bankName} - {bank.accountName || maskAccountNumber(bank.accountNumber)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="mt-[12px] flex flex-col gap-[8px]">
                    {(owner.bankAccounts || []).length === 0 && (
                      <div className="rounded-[12px] border border-dashed border-border px-[12px] py-[10px] text-[12px] font-semibold text-muted">
                        Owner này chưa có bank account.
                      </div>
                    )}
                    {(owner.bankAccounts || []).map((bank: any) => (
                      <div key={bank.id} className="rounded-[12px] border border-border bg-background/80 px-[12px] py-[10px]">
                        <div className="flex items-start justify-between gap-[12px]">
                          <div className="min-w-0">
                            <div className="flex items-center gap-[6px]">
                              <div className="truncate text-[13px] font-black text-text">{bank.bankName}</div>
                              {defaultBankId === bank.id && <Star size={13} className="shrink-0 fill-primary text-primary" />}
                            </div>
                            <div className="mt-[2px] truncate text-[12px] font-semibold text-muted">{bank.accountName}</div>
                          </div>
                          <span className={`rounded-full px-[8px] py-[3px] text-[10px] font-black ${bank.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {bank.isActive ? "Đang bật" : "Đã tắt"}
                          </span>
                        </div>
                        <div className="mt-[8px] text-[12px] font-black text-text">{maskAccountNumber(bank.accountNumber)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
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
                    <td colSpan={6} className="px-[14px] py-[24px] text-center text-[13px] font-semibold text-muted">
                      Đang tải lịch sử...
                    </td>
                  </tr>
                )}
                {!audit.isLoading && auditRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-[14px] py-[24px] text-center text-[13px] font-semibold text-muted">
                      Chưa có log phù hợp.
                    </td>
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
