"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { Building2, LockKeyhole, UsersRound, Landmark, History, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";

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

type BuildingItem = {
  id: string;
  code: string;
  name: string;
  ownerId?: string;
};

type BankAccountItem = {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  isActive: boolean;
  usage?: {
    requestCount: number;
    pendingCount: number;
    confirmedCount: number;
    inUse: boolean;
  };
};

type OwnerItem = {
  id: string;
  name: string;
  buildings: BuildingItem[];
  bankAccounts: BankAccountItem[];
};

type AuditLogItem = {
  id: string;
  createdAt: string;
  module: string;
  action: string;
  entity: string;
  entityId: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
  };
};

const ownerFallback: OwnerSettings = {
  ownerAName: "Tính",
  ownerBName: "Thể",
  ownerAAccountEmail: "admin@homeland.vn",
  ownerBAccountEmail: "admin@homeland.vn",
  ownerAContactEmail: "",
  ownerBContactEmail: "",
  ownerAPhone: "",
  ownerBPhone: "",
  ownerBBuildings: ["LK01-32", "LK08-24"],
  ownerABuildings: ["LK01-31", "LK08-25"],
};

function OwnerCard({
  testIdPrefix,
  title,
  name,
  email,
  contactEmail,
  phone,
  buildings,
  onNameChange,
  onEmailChange,
  onContactEmailChange,
  onPhoneChange,
}: {
  testIdPrefix: string;
  title: string;
  name: string;
  email: string;
  contactEmail: string;
  phone: string;
  buildings: string[];
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
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
          <Input data-testid={`${testIdPrefix}-name`} value={name || ""} onChange={(event) => onNameChange(event.target.value)} />
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
        <div className="flex flex-col gap-[6px] rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
          <label className="flex items-center gap-[8px] text-[12px] font-bold text-muted">
            <LockKeyhole size={14} /> Account quản trị riêng
          </label>
          <Input
            data-testid={`${testIdPrefix}-account-email`}
            value={email || ""}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="Email account owner"
            className="border-0 bg-transparent px-0 py-0 text-[13px] font-black text-text shadow-none focus-visible:ring-0"
          />
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

  const { data: ownersData, mutate: mutateOwners } = useSWR("settings-owners-list", async () => {
    const res: any = await apiClient.fetch("/finance/owners");
    return (res?.data || res || []) as OwnerItem[];
  });

  const { data: bankDefaultsData, mutate: mutateBankDefaults } = useSWR("settings-owner-bank-defaults", async () => {
    const res: any = await apiClient.fetch("/settings/owner-bank-defaults");
    const val = res?.data?.value || res?.value || {};
    return val as OwnerBankDefaults;
  });

  const { data: auditLogsData } = useSWR("settings-owner-audit-logs", async () => {
    const res: any = await apiClient.fetch("/audit/logs");
    return (res?.data || res || []) as AuditLogItem[];
  });

  const owners: OwnerItem[] = Array.isArray(ownersData) ? ownersData : [];
  const auditLogs: AuditLogItem[] = Array.isArray(auditLogsData) ? auditLogsData : [];
  const bankDefaults: Record<string, string> = bankDefaultsData?.defaults || {};

  const [selectedBuildingOwner, setSelectedBuildingOwner] = useState<Record<string, string>>({});
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    buildingId: string;
    buildingCode: string;
    newOwnerId: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    buildingId: "",
    buildingCode: "",
    newOwnerId: "",
    isSubmitting: false,
  });

  const [selectedBankDefaults, setSelectedBankDefaults] = useState<Record<string, string>>({});
  const [isSavingBankDefaults, setIsSavingBankDefaults] = useState(false);

  // Flatten buildings from owners
  const allBuildings = owners.flatMap((o) =>
    (o.buildings || []).map((b) => ({
      ...b,
      ownerId: o.id,
      ownerName: o.name,
    }))
  );

  const handleOpenConfirmReassign = (buildingId: string, buildingCode: string) => {
    const newOwnerId = selectedBuildingOwner[buildingId];
    if (!newOwnerId) return;
    setConfirmModalState({
      isOpen: true,
      buildingId,
      buildingCode,
      newOwnerId,
      isSubmitting: false,
    });
  };

  const handleConfirmReassign = async () => {
    setConfirmModalState((prev) => ({ ...prev, isSubmitting: true }));
    try {
      await apiClient.fetch(`/buildings/${confirmModalState.buildingId}`, {
        method: "PATCH",
        body: JSON.stringify({ ownerId: confirmModalState.newOwnerId }),
      });
      toast.success(`Đã phân tòa ${confirmModalState.buildingCode} sang chủ sở hữu mới`);
      setConfirmModalState({ isOpen: false, buildingId: "", buildingCode: "", newOwnerId: "", isSubmitting: false });
      await mutateOwners();
    } catch (e: any) {
      toast.error(e?.message || "Lỗi phân tòa");
      setConfirmModalState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleSaveBankDefaults = async () => {
    setIsSavingBankDefaults(true);
    try {
      const mergedDefaults = { ...bankDefaults, ...selectedBankDefaults };
      await apiClient.fetch("/settings/owner-bank-defaults", {
        method: "PATCH",
        body: JSON.stringify({
          scope: "TENANT",
          value: { defaults: mergedDefaults },
        }),
      });
      toast.success("Đã lưu thiết lập tài khoản nhận tiền mặc định");
      await mutateBankDefaults();
    } catch (e: any) {
      toast.error(e?.message || "Lỗi lưu tài khoản nhận tiền");
    } finally {
      setIsSavingBankDefaults(false);
    }
  };

  return (
    <div className="flex flex-col gap-[20px]" data-testid="settings-owners-root">
      {/* 1. Profile Owners Card */}
      <Card className="p-[20px]">
        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-[6px]">
            <div className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">Owner profile configuration</div>
            <h3 className="text-[20px] font-black text-text">Chủ sở hữu và phân tòa</h3>
            <p className="max-w-[780px] text-[13px] leading-relaxed text-muted">
              Khu này chỉ dùng để chốt rõ 2 chủ sở hữu, thông tin liên hệ và account quản trị riêng. Thiết lập ngân hàng SePay được quản lý tại mục tích hợp SePay.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-[16px] xl:grid-cols-2" data-testid="settings-owners-cards">
            <OwnerCard
              testIdPrefix="settings-owner-a"
              title="Owner A"
              name={draft.ownerAName}
              email={draft.ownerAAccountEmail}
              contactEmail={draft.ownerAContactEmail}
              phone={draft.ownerAPhone}
              buildings={draft.ownerABuildings || []}
              onNameChange={(value) => setDraft((prev) => ({ ...prev, ownerAName: value }))}
              onEmailChange={(value) => setDraft((prev) => ({ ...prev, ownerAAccountEmail: value }))}
              onContactEmailChange={(value) => setDraft((prev) => ({ ...prev, ownerAContactEmail: value }))}
              onPhoneChange={(value) => setDraft((prev) => ({ ...prev, ownerAPhone: value }))}
            />
            <OwnerCard
              testIdPrefix="settings-owner-b"
              title="Owner B"
              name={draft.ownerBName}
              email={draft.ownerBAccountEmail}
              contactEmail={draft.ownerBContactEmail}
              phone={draft.ownerBPhone}
              buildings={draft.ownerBBuildings || []}
              onNameChange={(value) => setDraft((prev) => ({ ...prev, ownerBName: value }))}
              onEmailChange={(value) => setDraft((prev) => ({ ...prev, ownerBAccountEmail: value }))}
              onContactEmailChange={(value) => setDraft((prev) => ({ ...prev, ownerBContactEmail: value }))}
              onPhoneChange={(value) => setDraft((prev) => ({ ...prev, ownerBPhone: value }))}
            />
          </div>

          <div className="flex justify-end border-t border-border pt-[14px]">
            <Button
              type="button"
              data-testid="settings-owner-config-save"
              onClick={() => save(draft)}
              isLoading={isSaving}
              className="bg-primary text-white font-bold"
            >
              Lưu owner
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. Building Assignment Table */}
      <Card className="p-[20px]">
        <div className="flex flex-col gap-[14px]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-text flex items-center gap-2">
                <Building2 size={18} className="text-primary" /> Phân bổ tòa nhà theo chủ sở hữu
              </h3>
              <p className="text-xs text-muted mt-0.5">Chuyển quyền quản lý tòa nhà giữa các chủ sở hữu với xác nhận bảo mật</p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border" data-testid="settings-owners-building-table">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="py-2.5 px-3 font-black text-text">Mã tòa</th>
                  <th className="py-2.5 px-3 font-black text-text">Tên tòa</th>
                  <th className="py-2.5 px-3 font-black text-text">Chủ sở hữu hiện tại</th>
                  <th className="py-2.5 px-3 font-black text-text">Gán chủ mới</th>
                  <th className="py-2.5 px-3 font-black text-right text-text">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {allBuildings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted">
                      Chưa có dữ liệu tòa nhà
                    </td>
                  </tr>
                ) : (
                  allBuildings.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/10">
                      <td className="py-2.5 px-3 font-mono font-bold text-text">{b.code}</td>
                      <td className="py-2.5 px-3 font-medium text-text">{b.name}</td>
                      <td className="py-2.5 px-3 font-bold text-primary">{b.ownerName || (b.ownerId === "owner-a" ? draft.ownerAName : draft.ownerBName)}</td>
                      <td className="py-2.5 px-3">
                        <select
                          data-testid={`settings-owner-select-${b.id}`}
                          value={selectedBuildingOwner[b.id] || b.ownerId || "owner-a"}
                          onChange={(e) => setSelectedBuildingOwner((prev) => ({ ...prev, [b.id]: e.target.value }))}
                          className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-bold text-text outline-none"
                        >
                          <option value="owner-a">{draft.ownerAName || "Owner A"}</option>
                          <option value="owner-b">{draft.ownerBName || "Owner B"}</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`settings-owner-save-${b.id}`}
                          onClick={() => handleOpenConfirmReassign(b.id, b.code)}
                          className="h-7 px-2.5 text-xs font-bold"
                        >
                          Lưu phân tòa
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* 3. Owner Bank Accounts Defaults Grid */}
      <Card className="p-[20px]">
        <div className="flex flex-col gap-[14px]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-text flex items-center gap-2">
                <Landmark size={18} className="text-primary" /> Tài khoản ngân hàng nhận tiền mặc định
              </h3>
              <p className="text-xs text-muted mt-0.5">Chọn tài khoản ngân hàng chính nhận tiền đối soát cho từng chủ sở hữu</p>
            </div>
            <Button
              size="sm"
              data-testid="settings-owner-bank-defaults-save"
              onClick={handleSaveBankDefaults}
              isLoading={isSavingBankDefaults}
              className="bg-primary text-white font-bold"
            >
              Lưu tài khoản mặc định
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="settings-owner-bank-grid">
            {owners.map((owner) => {
              const currentDefault = selectedBankDefaults[owner.id] || bankDefaults[owner.id] || (owner.bankAccounts?.[0]?.id || "");
              return (
                <div key={owner.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-text">{owner.name}</span>
                    <span className="text-xs text-muted font-bold font-mono">{(owner.bankAccounts || []).length} tài khoản</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted uppercase">Tài khoản nhận tiền mặc định</label>
                    <select
                      data-testid={`settings-owner-bank-default-${owner.id}`}
                      value={currentDefault}
                      onChange={(e) => setSelectedBankDefaults((prev) => ({ ...prev, [owner.id]: e.target.value }))}
                      className="h-9 w-full rounded-xl border border-border bg-background px-3 text-xs font-bold text-text outline-none"
                    >
                      {(owner.bankAccounts || []).map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.bankName} - {acc.accountNumber} ({acc.accountName})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* 4. Owner Audit Logs Table */}
      <Card className="p-[20px]">
        <div className="flex flex-col gap-[14px]">
          <div>
            <h3 className="text-base font-black text-text flex items-center gap-2">
              <History size={18} className="text-primary" /> Nhật ký phân tòa & thay đổi chủ sở hữu
            </h3>
            <p className="text-xs text-muted mt-0.5">Ghi nhận toàn bộ thao tác điều chỉnh quyền sở hữu tòa nhà và cấu hình ngân hàng</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border" data-testid="settings-owner-audit-table">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="py-2.5 px-3 font-black text-text">Thời gian</th>
                  <th className="py-2.5 px-3 font-black text-text">Thao tác</th>
                  <th className="py-2.5 px-3 font-black text-text">Đối tượng</th>
                  <th className="py-2.5 px-3 font-black text-text">Mã tòa / ID</th>
                  <th className="py-2.5 px-3 font-black text-text">Người thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-muted">
                      Chưa có nhật ký ghi nhận
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} data-testid={`settings-owner-audit-row-${log.id}`} className="hover:bg-muted/10">
                      <td className="py-2.5 px-3 font-mono text-muted">{new Date(log.createdAt).toLocaleString("vi-VN")}</td>
                      <td className="py-2.5 px-3 font-bold text-text">{log.action}</td>
                      <td className="py-2.5 px-3 font-medium text-text">{log.entity}</td>
                      <td className="py-2.5 px-3 font-mono font-black text-primary">{log.entityId}</td>
                      <td className="py-2.5 px-3 font-medium text-text">{log.user?.fullName || log.user?.email || "Hệ thống"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
        title="Xác nhận chuyển giao chủ sở hữu tòa nhà"
        testId="settings-owner-confirm-modal"
        maxWidth="max-w-[500px]"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}>
              Hủy
            </Button>
            <Button
              size="sm"
              data-testid="settings-owner-confirm-submit"
              onClick={handleConfirmReassign}
              isLoading={confirmModalState.isSubmitting}
              className="bg-primary text-white font-bold"
            >
              Xác nhận chuyển tòa
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs py-2">
          <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-200">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <span>
              Bạn đang thực hiện chuyển đổi tòa <b>{confirmModalState.buildingCode}</b> sang chủ sở hữu mới. Doanh thu và đối soát các kỳ tới sẽ được tính cho chủ sở hữu này.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
