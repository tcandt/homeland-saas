"use client";

import React from "react";
import useSWR from "swr";
import { Activity, Building2, CreditCard, LockKeyhole, RefreshCcw, Star, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastContext";
import { auditApi } from "@/lib/api/audit.api";
import { buildingsApi } from "@/lib/api/buildings.api";
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

type BuildingOwnerConfirmState = {
  buildingId: string;
  buildingCode: string;
  buildingName: string;
  currentOwnerName: string;
  nextOwnerId: string;
  nextOwnerName: string;
} | null;

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
  CREATE: "Tạo mới",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}

function describeAuditChange(log: any) {
  if (log.module === "Auth") return log.entity || "Người dùng";
  if (log.module === "Settings") {
    const denied = Boolean((log.before as any)?.denied);
    if (denied) return "Từ chối cập nhật token Hunonic";
    return `Cài đặt ${log.entityId || ""}`.trim();
  }
  if (log.module === "Buildings" && log.entity === "Building") {
    return `Đổi owner: ${log.entityId || "tòa nhà"}`;
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
  const { showToast } = useToast();
  const { draft, setDraft, isSaving, save } = useSettingsSection<OwnerSettings>("owners", "TENANT", ownerFallback);
  const {
    draft: bankDefaultsDraft,
    setDraft: setBankDefaultsDraft,
    isSaving: isSavingBankDefaults,
    save: saveBankDefaults,
  } = useSettingsSection<OwnerBankDefaults>("owner-bank-defaults", "TENANT", bankDefaultsFallback);
  const audit = useSWR(["owner-audit-logs"], () => auditApi.logs({ limit: 20, module: "Auth,Settings,Buildings" }), {
    revalidateOnFocus: false,
  });
  const owners = useSWR(["finance-owners-for-settings"], () => financeApi.getOwners(), {
    revalidateOnFocus: false,
  });
  const auditRows = audit.data || [];
  const ownerRows = Array.isArray(owners.data) ? owners.data : [];
  const [savingBuildingId, setSavingBuildingId] = React.useState("");
  const [buildingOwnerDraft, setBuildingOwnerDraft] = React.useState<Record<string, string>>({});
  const [buildingOwnerConfirm, setBuildingOwnerConfirm] = React.useState<BuildingOwnerConfirmState>(null);

  const buildingAssignments = React.useMemo(
    () =>
      ownerRows.flatMap((owner: any) =>
        (owner.buildings || []).map((building: any) => ({
          id: building.id,
          code: building.code,
          name: building.name,
          ownerId: owner.id,
          ownerName: owner.name,
        })),
      ),
    [ownerRows],
  );

  React.useEffect(() => {
    if (buildingAssignments.length === 0) return;
    setBuildingOwnerDraft((prev) => {
      const next = { ...prev };
      for (const building of buildingAssignments) {
        if (!next[building.id]) next[building.id] = building.ownerId;
      }
      return next;
    });
  }, [buildingAssignments]);

  const setDefaultBank = (ownerId: string, bankAccountId: string) => {
    setBankDefaultsDraft((prev) => {
      const nextDefaults = { ...(prev.defaults || {}) };
      if (bankAccountId) nextDefaults[ownerId] = bankAccountId;
      else delete nextDefaults[ownerId];
      return { ...prev, defaults: nextDefaults };
    });
  };

  const requestSaveBuildingOwner = (buildingId: string) => {
    const nextOwnerId = buildingOwnerDraft[buildingId];
    const current = buildingAssignments.find((building) => building.id === buildingId);
    const nextOwner = ownerRows.find((owner: any) => owner.id === nextOwnerId);
    if (!current || !nextOwnerId || !nextOwner || nextOwnerId === current.ownerId) return;

    setBuildingOwnerConfirm({
      buildingId,
      buildingCode: current.code,
      buildingName: current.name,
      currentOwnerName: current.ownerName,
      nextOwnerId,
      nextOwnerName: nextOwner.name,
    });
  };

  const saveBuildingOwner = async () => {
    if (!buildingOwnerConfirm) return;

    try {
      setSavingBuildingId(buildingOwnerConfirm.buildingId);
      await buildingsApi.update(buildingOwnerConfirm.buildingId, { ownerId: buildingOwnerConfirm.nextOwnerId });
      await Promise.all([owners.mutate(), audit.mutate()]);
      showToast("Đã cập nhật chủ sở hữu tòa nhà", "success");
      setBuildingOwnerConfirm(null);
    } catch (error: any) {
      showToast(error?.message || "Không thể cập nhật chủ sở hữu", "error");
    } finally {
      setSavingBuildingId("");
    }
  };

  return (
    <>
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
                  <Building2 size={16} className="text-primary" /> Gán chủ sở hữu theo tòa
                </div>
                <p className="mt-[3px] text-[12px] text-muted">
                  Mỗi lần đổi owner sẽ ghi audit log before/after để truy vết vận hành.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => owners.mutate()} isLoading={owners.isLoading}>
                <RefreshCcw size={13} className="mr-2" /> Làm mới
              </Button>
            </div>

            <div className="overflow-x-auto border-b border-border">
              <table className="min-w-[720px] w-full text-left">
                <thead className="bg-muted/10">
                  <tr>
                    <th className="px-[14px] py-[10px] text-[10px] font-black uppercase tracking-wide text-muted">Tòa</th>
                    <th className="px-[14px] py-[10px] text-[10px] font-black uppercase tracking-wide text-muted">Chủ hiện tại</th>
                    <th className="px-[14px] py-[10px] text-[10px] font-black uppercase tracking-wide text-muted">Chuyển sang</th>
                    <th className="px-[14px] py-[10px] text-[10px] font-black uppercase tracking-wide text-muted text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {buildingAssignments.map((building) => {
                    const selectedOwnerId = buildingOwnerDraft[building.id] || building.ownerId;
                    const changed = selectedOwnerId !== building.ownerId;
                    return (
                      <tr key={building.id} className="border-t border-border">
                        <td className="px-[14px] py-[12px]">
                          <div className="text-[13px] font-black text-text">{building.code}</div>
                          <div className="text-[11px] font-semibold text-muted">{building.name}</div>
                        </td>
                        <td className="px-[14px] py-[12px] text-[12px] font-bold text-text">{building.ownerName}</td>
                        <td className="px-[14px] py-[12px]">
                          <select
                            value={selectedOwnerId}
                            onChange={(event) =>
                              setBuildingOwnerDraft((prev) => ({
                                ...prev,
                                [building.id]: event.target.value,
                              }))
                            }
                            className="h-[40px] min-w-[220px] rounded-[12px] border border-border bg-background px-[12px] text-[13px] font-bold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          >
                            {ownerRows.map((owner: any) => (
                              <option key={owner.id} value={owner.id}>
                                {owner.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-[14px] py-[12px] text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant={changed ? "primary" : "outline"}
                            disabled={!changed || savingBuildingId === building.id}
                            isLoading={savingBuildingId === building.id}
                            onClick={() => requestSaveBuildingOwner(building.id)}
                          >
                            Lưu owner
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {!owners.isLoading && buildingAssignments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-[14px] py-[24px] text-center text-[13px] font-semibold text-muted">
                        Chưa có dữ liệu tòa nhà để gán owner.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

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
                <p className="mt-[3px] text-[12px] text-muted">20 log gần nhất của Auth, Settings và Buildings để truy vết owner/admin thao tác.</p>
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

      <Modal
        isOpen={Boolean(buildingOwnerConfirm)}
        onClose={() => (savingBuildingId ? undefined : setBuildingOwnerConfirm(null))}
        title="Xác nhận đổi chủ sở hữu"
        maxWidth="max-w-[560px]"
        footer={
          <div className="flex justify-end gap-[10px]">
            <Button type="button" variant="outline" onClick={() => setBuildingOwnerConfirm(null)} disabled={Boolean(savingBuildingId)}>
              Hủy
            </Button>
            <Button type="button" onClick={saveBuildingOwner} isLoading={Boolean(savingBuildingId)} disabled={!buildingOwnerConfirm}>
              Xác nhận cập nhật
            </Button>
          </div>
        }
      >
        {buildingOwnerConfirm && (
          <div className="space-y-[14px]">
            <p className="text-[13px] leading-relaxed text-muted">
              Thao tác này sẽ đổi owner của tòa nhà và ghi audit log before/after để truy vết vận hành.
            </p>

            <div className="grid grid-cols-1 gap-[12px] rounded-[16px] border border-border bg-surface p-[14px] sm:grid-cols-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-wide text-muted">Tòa nhà</div>
                <div className="mt-[6px] text-[14px] font-black text-text">{buildingOwnerConfirm.buildingCode}</div>
                <div className="mt-[2px] text-[12px] font-semibold text-muted">{buildingOwnerConfirm.buildingName}</div>
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-wide text-muted">Owner hiện tại</div>
                <div className="mt-[6px] text-[14px] font-black text-text">{buildingOwnerConfirm.currentOwnerName}</div>
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-wide text-muted">Owner mới</div>
                <div className="mt-[6px] text-[14px] font-black text-primary">{buildingOwnerConfirm.nextOwnerName}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
