"use client";

import React, { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { Copy, CreditCard, Link2, LockKeyhole, Pencil, Plus, QrCode, RefreshCcw, Send, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { useAuthStore } from "@/lib/auth/auth-store";
import toast from "react-hot-toast";
import { settingsApi } from "@/lib/api/settings.api";
import { financeApi } from "@/lib/api/finance.api";

type SePaySettings = {
  enabled: boolean;
  authMode?: "apiKey" | "hmac" | "dual";
  webhookBaseUrl?: string;
  paymentCodePrefix: string;
  qrTemplate: string;
  webhookApiKey: string;
  hmacSecret?: string;
  invoicePaidTemplateCode: string;
  sendPaymentResultToZalo: boolean;
  note: string;
};

type TestMode = "room" | "account";
type OwnerBankDefaults = {
  defaults: Record<string, string>;
};
type BankAccountForm = {
  bankId?: string | null;
  ownerId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
};

const fallback: SePaySettings = {
  enabled: false,
  authMode: "apiKey",
  paymentCodePrefix: "HL",
  qrTemplate: "",
  webhookApiKey: "",
  hmacSecret: "",
  invoicePaidTemplateCode: "",
  sendPaymentResultToZalo: true,
  note: "",
};
const bankDefaultsFallback: OwnerBankDefaults = {
  defaults: {},
};
const BANK_OPTIONS = [
  "Vietcombank",
  "BIDV",
  "Agribank",
  "VietinBank",
  "Techcombank",
  "ACB",
  "MBBank",
  "TPBank",
  "Sacombank",
  "VPBank",
  "OCB",
  "HDBank",
  "VIB",
  "SHB",
  "Eximbank",
  "SeABank",
  "MSB",
  "Nam A Bank",
  "PVcomBank",
];

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return value;
  }
}

function formatCurrency(value?: number | string | null) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function shortSecret(value?: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Chưa cấu hình";
  if (normalized.length <= 14) return normalized;
  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

function normalizeWebhookBaseUrl(value?: string | null) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (trimmed.endsWith("/api/v1")) return trimmed;
  if (trimmed.endsWith("/api")) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
}

export default function SettingsSePayIntegration() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<SePaySettings>("sepay", "TENANT", fallback);
  const {
    draft: bankDefaultsDraft,
    setDraft: setBankDefaultsDraft,
    save: saveBankDefaults,
  } = useSettingsSection<OwnerBankDefaults>("owner-bank-defaults", "TENANT", bankDefaultsFallback);
  const { data: adminConfig, mutate: mutateAdminConfig, isLoading: isLoadingAdminConfig } = useSWR(
    ["sepay-admin-config"],
    () => settingsApi.getSePayAdminConfig(),
    { revalidateOnFocus: false },
  );
  const owners = useSWR(["finance-owners-for-sepay"], () => financeApi.getOwners(), { revalidateOnFocus: false });
  const user = useAuthStore((state) => state.user);
  const [webhookApiKeyTouched, setWebhookApiKeyTouched] = useState(false);
  const [hmacSecretTouched, setHmacSecretTouched] = useState(false);
  const [isSecretModalOpen, setIsSecretModalOpen] = useState(false);
  const [secretDraft, setSecretDraft] = useState({ webhookApiKey: "", hmacSecret: "" });
  const [isTestingQr, setIsTestingQr] = useState(false);
  const [isSendingQr, setIsSendingQr] = useState(false);
  const [testAmount, setTestAmount] = useState("10000");
  const [testMemo, setTestMemo] = useState("");
  const [testMode, setTestMode] = useState<TestMode>("room");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [activeOwnerId, setActiveOwnerId] = useState<string | null>(null);
  const [ownerDefaultBankId, setOwnerDefaultBankId] = useState("");
  const [isSavingOwnerDefault, setIsSavingOwnerDefault] = useState(false);
  const [bankModal, setBankModal] = useState<BankAccountForm | null>(null);
  const [savingBankForm, setSavingBankForm] = useState(false);
  const [togglingBankId, setTogglingBankId] = useState("");
  const canEditSecrets = (user?.email || "").toLowerCase() === "admin@homeland.vn";

  const config = adminConfig?.config;
  const status = config?.status;
  const rooms = Array.isArray(config?.rooms) ? config.rooms : [];
  const bankAccounts = Array.isArray(config?.bankAccounts) ? config.bankAccounts : [];
  const ownerRows = Array.isArray(owners.data) ? owners.data : [];

  useEffect(() => {
    if (!selectedRoomId && rooms[0]?.id) setSelectedRoomId(rooms[0].id);
  }, [rooms, selectedRoomId]);

  useEffect(() => {
    if (!selectedBankAccountId && bankAccounts[0]?.id) setSelectedBankAccountId(bankAccounts[0].id);
  }, [bankAccounts, selectedBankAccountId]);

  const effectiveWebhookBaseUrl = useMemo(() => {
    const savedBaseUrl = normalizeWebhookBaseUrl(draft.webhookBaseUrl);
    if (savedBaseUrl) return savedBaseUrl;
    if (typeof window !== "undefined") return normalizeWebhookBaseUrl(window.location.origin);
    return normalizeWebhookBaseUrl(process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001");
  }, [draft.webhookBaseUrl]);

  const webhookUrl = useMemo(() => {
    return `${effectiveWebhookBaseUrl.replace(/\/$/, "")}/payments/sepay/webhook`;
  }, [effectiveWebhookBaseUrl]);

  const activeRoom = rooms.find((room: any) => room.id === selectedRoomId) || null;
  const activeBank = bankAccounts.find((bank: any) => bank.id === selectedBankAccountId) || null;
  const activeOwner = ownerRows.find((owner: any) => owner.id === activeOwnerId) || null;
  const openOwnerModal = (ownerId: string) => {
    setActiveOwnerId(ownerId);
    setOwnerDefaultBankId(bankDefaultsDraft.defaults?.[ownerId] || "");
  };

  const saveOwnerModal = async () => {
    if (!activeOwnerId) return;
    try {
      setIsSavingOwnerDefault(true);
      const nextDefaults = { ...(bankDefaultsDraft.defaults || {}) };
      if (ownerDefaultBankId) nextDefaults[activeOwnerId] = ownerDefaultBankId;
      else delete nextDefaults[activeOwnerId];
      setBankDefaultsDraft({ defaults: nextDefaults });
      await saveBankDefaults({ defaults: nextDefaults });
      setActiveOwnerId(null);
      toast.success("Đã lưu tài khoản nhận tiền");
    } catch (error: any) {
      toast.error(error?.message || "Không lưu được tài khoản nhận tiền");
    } finally {
      setIsSavingOwnerDefault(false);
    }
  };

  const openCreateBankModal = (ownerId: string) => {
    setBankModal({ bankId: null, ownerId, bankName: BANK_OPTIONS[0], accountNumber: "", accountName: "" });
  };

  const openEditBankModal = (ownerId: string, bank: any) => {
    setBankModal({
      bankId: bank.id,
      ownerId,
      bankName: String(bank.bankName || ""),
      accountNumber: String(bank.accountNumber || ""),
      accountName: String(bank.accountName || ""),
    });
  };

  const saveBankModal = async () => {
    if (!bankModal) return;
    try {
      setSavingBankForm(true);
      const payload = {
        ownerId: bankModal.ownerId,
        bankName: bankModal.bankName,
        accountNumber: bankModal.accountNumber,
        accountName: bankModal.accountName,
      };
      if (bankModal.bankId) await financeApi.updateBankAccount(bankModal.bankId, payload);
      else await financeApi.createBankAccount(payload);
      await owners.mutate();
      await mutateAdminConfig();
      setBankModal(null);
      toast.success(bankModal.bankId ? "Đã cập nhật tài khoản ngân hàng" : "Đã thêm tài khoản ngân hàng");
    } catch (error: any) {
      toast.error(error?.message || "Không lưu được tài khoản ngân hàng");
    } finally {
      setSavingBankForm(false);
    }
  };

  const toggleBankStatus = async (bankId: string, isActive: boolean) => {
    try {
      setTogglingBankId(bankId);
      await financeApi.updateBankAccountStatus(bankId, { isActive: !isActive });
      await owners.mutate();
      await mutateAdminConfig();
      toast.success(isActive ? "Đã tắt bank account" : "Đã bật lại bank account");
    } catch (error: any) {
      toast.error(error?.message || "Không thể cập nhật trạng thái bank");
    } finally {
      setTogglingBankId("");
    }
  };

  const saveAll = async () => {
    const payload: Partial<SePaySettings> = { ...draft };
    if (!canEditSecrets || !webhookApiKeyTouched) delete payload.webhookApiKey;
    if (!canEditSecrets || !hmacSecretTouched) delete payload.hmacSecret;
    try {
      await save(payload as SePaySettings);
      await saveBankDefaults(bankDefaultsDraft);
      setWebhookApiKeyTouched(false);
      setHmacSecretTouched(false);
      await mutateAdminConfig();
    } finally {}
  };

  const copyText = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(`Đã copy ${label}`);
  };

  const openSecretModal = () => {
    setSecretDraft({
      webhookApiKey: draft.webhookApiKey || "",
      hmacSecret: draft.hmacSecret || "",
    });
    setIsSecretModalOpen(true);
  };

  const closeSecretModal = () => {
    setIsSecretModalOpen(false);
  };

  const saveSecretModal = () => {
    if (!canEditSecrets) return;
    setWebhookApiKeyTouched(secretDraft.webhookApiKey !== (draft.webhookApiKey || ""));
    setHmacSecretTouched(secretDraft.hmacSecret !== (draft.hmacSecret || ""));
    setDraft((prev) => ({
      ...prev,
      webhookApiKey: secretDraft.webhookApiKey,
      hmacSecret: secretDraft.hmacSecret,
    }));
    setIsSecretModalOpen(false);
  };

  const openQrModal = () => {
    setPreview(null);
    setIsQrModalOpen(true);
  };

  const createQrPreview = async () => {
    setIsTestingQr(true);
    try {
      const payload = {
        amount: Number(testAmount || 0),
        memo: testMemo.trim() || undefined,
        roomId: testMode === "room" ? selectedRoomId : undefined,
        bankAccountId: testMode === "account" ? selectedBankAccountId : undefined,
      };
      const result = await settingsApi.testSePayQr(payload);
      setPreview(result.preview);
      toast.success("Đã tạo QR test");
    } catch (error: any) {
      toast.error(error?.message || "Không tạo được QR test");
    } finally {
      setIsTestingQr(false);
    }
  };

  const sendQrToAdmin = async () => {
    setIsSendingQr(true);
    try {
      const payload = {
        amount: Number(testAmount || 0),
        memo: testMemo.trim() || undefined,
        roomId: testMode === "room" ? selectedRoomId : undefined,
        bankAccountId: testMode === "account" ? selectedBankAccountId : undefined,
      };
      const result = await settingsApi.sendSePayQrToAdmin(payload);
      setPreview(result.preview);
      toast.success("Đã gửi QR test tới nhóm admin");
    } catch (error: any) {
      toast.error(error?.message || "Không gửi được QR test");
    } finally {
      setIsSendingQr(false);
    }
  };

  const actionBar = (
    <div className="flex flex-wrap items-center justify-end gap-[10px]">
      <Button
        type="button"
        variant="outline"
        onClick={openQrModal}
        className="h-[42px] rounded-[10px] px-[16px] text-[13px] font-bold"
      >
        <QrCode size={14} className="mr-[6px]" /> Test QR
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => mutateAdminConfig()}
        isLoading={isLoadingAdminConfig}
        className="h-[42px] rounded-[10px] px-[16px] text-[13px] font-bold"
      >
        <RefreshCcw size={14} className="mr-[6px]" /> Refresh
      </Button>
      <Button
        type="button"
        onClick={saveAll}
        className="h-[42px] rounded-[10px] bg-primary px-[20px] text-[13px] font-bold text-white"
        isLoading={isSaving}
      >
        Lưu
      </Button>
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-[16px]">
      <Card className="flex h-full flex-col gap-[16px] border-[#6366f1]/15 p-[16px]">
        <div className="flex items-start justify-between gap-[16px]">
          <div>
            <div className="flex items-center gap-[8px] text-[12px] font-black uppercase tracking-[0.16em] text-[#6366f1]">
              <CreditCard size={14} /> SePay
            </div>
            <h3 className="mt-[8px] text-[18px] font-black text-text">Thanh toán và đối soát</h3>
          </div>
          <div className="flex items-center gap-[10px] rounded-full border border-border bg-background px-[12px] py-[8px]">
            <Switch checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <div className="rounded-[14px] border border-border bg-background/80 p-[14px]">
            <div className="flex items-center gap-[8px] text-[12px] font-bold uppercase tracking-wide text-muted">
              <CreditCard size={14} /> Tài khoản nhận tiền
            </div>
            <div className="mt-[10px] space-y-[10px]">
              {ownerRows.map((owner: any) => {
                const ownerBanks = owner.bankAccounts || [];
                const defaultBankId = bankDefaultsDraft.defaults?.[owner.id] || "";
                const defaultBank = ownerBanks.find((bank: any) => bank.id === defaultBankId) || ownerBanks.find((bank: any) => bank.isActive) || ownerBanks[0];
                return (
                  <button
                    key={owner.id}
                    type="button"
                    onClick={() => openOwnerModal(owner.id)}
                    className="flex w-full flex-col gap-[10px] rounded-[12px] border border-border bg-card px-[12px] py-[12px] text-left transition hover:border-primary/40 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-black text-text">{owner.name}</div>
                      <div className="mt-[2px] text-[12px] text-muted">
                        {(owner.buildings || []).map((building: any) => building.code).join(", ") || "Chưa gắn tòa nhà"}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 md:px-[12px]">
                      <div className="truncate text-[13px] font-black text-text">
                        {defaultBank ? `${defaultBank.bankName} - ${defaultBank.accountNumber}` : "Chưa thiết lập tài khoản nhận"}
                      </div>
                      <div className="mt-[2px] text-[12px] text-muted">
                        {defaultBank ? defaultBank.accountName || "Chưa có tên người thụ hưởng" : `${ownerBanks.length} tài khoản đang có`}
                      </div>
                    </div>
                    <div className="flex items-center gap-[8px]">
                      <span className="rounded-full bg-primary/10 px-[8px] py-[4px] text-[11px] font-black text-primary">
                        {ownerBanks.length} bank
                      </span>
                      <span className="text-[12px] font-black text-text">Thiết lập</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[14px] border border-border bg-background/80 p-[14px]">
            <div className="flex items-center gap-[8px] text-[12px] font-bold uppercase tracking-wide text-muted">
              <Link2 size={14} /> Webhook
            </div>
            <div className="mt-[10px] grid grid-cols-1 gap-[10px] lg:grid-cols-[260px_minmax(0,1fr)]">
              <Input
                value={draft.webhookBaseUrl || ""}
                onChange={(event) => setDraft((prev) => ({ ...prev, webhookBaseUrl: event.target.value }))}
                placeholder={typeof window !== "undefined" ? window.location.origin : "https://homeland.ductinh.one"}
              />
              <button
                type="button"
                onClick={() => copyText(webhookUrl, "webhook URL")}
                className="rounded-[12px] border border-border bg-card px-[12px] py-[10px] text-left"
              >
                <div className="truncate text-[13px] font-black text-text">{webhookUrl}</div>
              </button>
            </div>
            <div className="mt-[6px] text-[11px] text-muted">Để trống Base URL sẽ dùng domain hiện tại. Webhook tự ghép thành `/api/v1/payments/sepay/webhook`.</div>
            <div className="mt-[10px] grid grid-cols-1 gap-[10px] md:grid-cols-3">
              <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
                <div className="text-[11px] uppercase tracking-wide text-muted">Auth</div>
                <div className="mt-[3px] text-[13px] font-black text-text">{draft.authMode || "apiKey"}</div>
              </div>
              <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
                <div className="text-[11px] uppercase tracking-wide text-muted">Status</div>
                <div className="mt-[3px] text-[13px] font-black text-text">{status?.lastWebhookStatus || "Chưa có"}</div>
              </div>
              <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
                <div className="text-[11px] uppercase tracking-wide text-muted">Last</div>
                <div className="mt-[3px] text-[13px] font-black text-text">{formatDateTime(status?.lastWebhookAt)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-border bg-background/80 p-[14px]">
            <div className="grid grid-cols-1 gap-[10px] md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_100px] md:items-center">
              <div className="flex items-center gap-[8px] text-[12px] font-bold uppercase tracking-wide text-muted">
                <ShieldCheck size={14} /> Secret
              </div>
              <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
                <div className="text-[11px] uppercase tracking-wide text-muted">API key</div>
                <div className="mt-[4px] truncate text-[13px] font-black text-text">{shortSecret(draft.webhookApiKey)}</div>
              </div>
              <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
                <div className="text-[11px] uppercase tracking-wide text-muted">HMAC</div>
                <div className="mt-[4px] truncate text-[13px] font-black text-text">{shortSecret(draft.hmacSecret)}</div>
              </div>
              <div className="md:text-right">
                <Button type="button" size="sm" variant="outline" onClick={openSecretModal}>
                  {canEditSecrets ? "Thiết lập" : "Locked"}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-border bg-background/80 p-[14px]">
            <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Cấu hình chính</div>
            <div className="mt-[10px] grid grid-cols-1 gap-[10px] xl:grid-cols-[180px_160px_minmax(0,1fr)_220px]">
              <select
                value={draft.authMode || "apiKey"}
                onChange={(event) => setDraft((prev) => ({ ...prev, authMode: event.target.value as SePaySettings["authMode"] }))}
                className="h-[42px] rounded-[10px] border border-border bg-card px-[12px] text-[13px] font-semibold text-text"
              >
                <option value="apiKey">ApiKey</option>
                <option value="hmac">HMAC</option>
                <option value="dual">Dual</option>
              </select>
              <Input
                value={draft.paymentCodePrefix}
                onChange={(event) => setDraft((prev) => ({ ...prev, paymentCodePrefix: event.target.value }))}
                placeholder="Prefix"
              />
              <Input
                value={draft.invoicePaidTemplateCode}
                onChange={(event) => setDraft((prev) => ({ ...prev, invoicePaidTemplateCode: event.target.value }))}
                placeholder="Template xác nhận"
              />
              <label className="flex items-center justify-between gap-[12px] rounded-[10px] border border-border bg-card px-[12px] py-[10px]">
                <div>
                  <div className="text-[12px] font-black text-text">Zalo Notification</div>
                </div>
                <Switch checked={draft.sendPaymentResultToZalo} onChange={(event) => setDraft((prev) => ({ ...prev, sendPaymentResultToZalo: event.target.checked }))} />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-auto border-t border-border pt-[14px]">
          {actionBar}
        </div>
      </Card>

      <Modal
        isOpen={Boolean(activeOwner)}
        onClose={() => !isSavingOwnerDefault && setActiveOwnerId(null)}
        title={activeOwner ? `Tài khoản nhận tiền • ${activeOwner.name}` : "Tài khoản nhận tiền"}
        maxWidth="max-w-[760px]"
        footer={
          <div className="flex items-center justify-end gap-[8px]">
            <Button type="button" variant="outline" onClick={() => setActiveOwnerId(null)} disabled={isSavingOwnerDefault}>
              Hủy
            </Button>
            <Button type="button" onClick={saveOwnerModal} isLoading={isSavingOwnerDefault}>
              Lưu
            </Button>
          </div>
        }
      >
        {activeOwner && (
          <div className="space-y-[12px]">
            <div className="rounded-[12px] border border-border bg-background/70 px-[12px] py-[10px] text-[12px]">
              <div className="font-black text-text">{activeOwner.name}</div>
              <div className="mt-[4px] text-muted">
                {(activeOwner.buildings || []).map((building: any) => building.code).join(", ") || "Chưa gắn tòa nhà"}
              </div>
            </div>

            <label className="flex flex-col gap-[6px]">
              <span className="text-[12px] font-bold uppercase tracking-wide text-muted">Tài khoản mặc định khi tạo QR</span>
              <select
                value={ownerDefaultBankId}
                onChange={(event) => setOwnerDefaultBankId(event.target.value)}
                className="h-[42px] rounded-[12px] border border-border bg-background px-[12px] text-[13px] font-bold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Tự động chọn tài khoản đầu tiên đang bật</option>
                {(activeOwner.bankAccounts || [])
                  .filter((bank: any) => bank.isActive)
                  .map((bank: any) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.bankName} - {bank.accountNumber} - {bank.accountName || "Chưa có tên"}
                    </option>
                  ))}
              </select>
            </label>

            <div className="flex items-center justify-between gap-[12px]">
              <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Danh sách bank</div>
              <Button type="button" size="sm" variant="outline" onClick={() => openCreateBankModal(activeOwner.id)}>
                <Plus size={13} className="mr-2" /> Thêm bank
              </Button>
            </div>

            <div className="space-y-[8px]">
              {(activeOwner.bankAccounts || []).length === 0 && (
                <div className="rounded-[12px] border border-dashed border-border px-[12px] py-[10px] text-[12px] font-semibold text-muted">
                  Chủ này chưa có tài khoản nhận tiền.
                </div>
              )}
              {(activeOwner.bankAccounts || []).map((bank: any) => (
                <div key={bank.id} className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
                  <div className="flex flex-col gap-[10px] md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-[6px]">
                        <div className="truncate text-[13px] font-black text-text">{bank.bankName}</div>
                        {ownerDefaultBankId === bank.id && <Star size={13} className="shrink-0 fill-primary text-primary" />}
                      </div>
                      <div className="mt-[2px] text-[12px] text-muted">{bank.accountName || "Chưa có tên người thụ hưởng"}</div>
                      <div className="mt-[6px] text-[13px] font-black text-text">{bank.accountNumber}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-[8px]">
                      <span className={`rounded-full px-[8px] py-[3px] text-[10px] font-black ${bank.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {bank.isActive ? "Đang bật" : "Đã tắt"}
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={() => openEditBankModal(activeOwner.id, bank)}>
                        <Pencil size={13} className="mr-2" /> Sửa
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={bank.isActive ? "outline" : "primary"}
                        isLoading={togglingBankId === bank.id}
                        onClick={() => toggleBankStatus(bank.id, bank.isActive)}
                      >
                        {bank.isActive ? "Tắt" : "Bật"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isSecretModalOpen}
        onClose={closeSecretModal}
        title="Secret"
        maxWidth="max-w-[760px]"
        footer={
          <div className="flex items-center justify-end gap-[8px]">
            <Button type="button" variant="outline" onClick={closeSecretModal}>
              Hủy
            </Button>
            <Button type="button" onClick={saveSecretModal} disabled={!canEditSecrets}>
              Lưu
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
          <label className="flex flex-col gap-[8px] rounded-[12px] border border-border bg-background/70 p-[12px]">
            <span className="text-[12px] font-black uppercase tracking-wide text-muted">API key</span>
            <Input
              type="password"
              value={secretDraft.webhookApiKey}
              onChange={(event) => setSecretDraft((prev) => ({ ...prev, webhookApiKey: event.target.value }))}
              placeholder="Nhập API key"
              disabled={!canEditSecrets}
            />
          </label>
          <label className="flex flex-col gap-[8px] rounded-[12px] border border-border bg-background/70 p-[12px]">
            <span className="text-[12px] font-black uppercase tracking-wide text-muted">HMAC secret</span>
            <Input
              type="password"
              value={secretDraft.hmacSecret}
              onChange={(event) => setSecretDraft((prev) => ({ ...prev, hmacSecret: event.target.value }))}
              placeholder="Nhập HMAC secret"
              disabled={!canEditSecrets}
            />
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(bankModal)}
        onClose={() => !savingBankForm && setBankModal(null)}
        title={bankModal?.bankId ? "Sửa tài khoản ngân hàng" : "Thêm tài khoản ngân hàng"}
        maxWidth="max-w-[560px]"
        footer={
          <div className="flex items-center justify-end gap-[8px]">
            <Button type="button" variant="outline" onClick={() => setBankModal(null)} disabled={savingBankForm}>
              Hủy bỏ
            </Button>
            <Button type="button" onClick={saveBankModal} isLoading={savingBankForm}>
              Lưu lại
            </Button>
          </div>
        }
      >
        {bankModal && (
          <div className="space-y-[12px]">
            <div className="rounded-[12px] border border-border bg-background/70 px-[12px] py-[10px] text-[12px]">
              <div className="font-black text-text">
                {ownerRows.find((owner: any) => owner.id === bankModal.ownerId)?.name || "Chưa xác định owner"}
              </div>
              <div className="mt-[4px] text-muted">
                {(ownerRows.find((owner: any) => owner.id === bankModal.ownerId)?.buildings || [])
                  .map((building: any) => building.code)
                  .join(", ") || "Chưa gắn tòa nhà"}
              </div>
            </div>
            <label className="flex flex-col gap-[6px]">
              <span className="text-[12px] font-bold uppercase tracking-wide text-muted">Ngân hàng</span>
              <select
                value={bankModal.bankName}
                onChange={(event) => setBankModal((prev) => (prev ? { ...prev, bankName: event.target.value } : prev))}
                className="h-[42px] rounded-[12px] border border-border bg-background px-[12px] text-[13px] font-bold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {BANK_OPTIONS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-[6px]">
              <span className="text-[12px] font-bold uppercase tracking-wide text-muted">Số tài khoản</span>
              <Input
                value={bankModal.accountNumber}
                onChange={(event) => setBankModal((prev) => (prev ? { ...prev, accountNumber: event.target.value } : prev))}
                placeholder="Nhập số tài khoản"
              />
            </label>
            <label className="flex flex-col gap-[6px]">
              <span className="text-[12px] font-bold uppercase tracking-wide text-muted">Tên người thụ hưởng</span>
              <Input
                value={bankModal.accountName}
                onChange={(event) => setBankModal((prev) => (prev ? { ...prev, accountName: event.target.value } : prev))}
                placeholder="Nhập tên người thụ hưởng"
              />
            </label>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title="Test QR SePay"
        maxWidth="max-w-[min(920px,92vw)]"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-[10px]">
            <Button type="button" variant="outline" onClick={createQrPreview} isLoading={isTestingQr} className="h-[42px] rounded-[10px] px-[16px] text-[13px] font-bold">
              <QrCode size={14} className="mr-[6px]" /> Tạo QR
            </Button>
            <Button type="button" variant="outline" onClick={sendQrToAdmin} isLoading={isSendingQr} className="h-[42px] rounded-[10px] px-[16px] text-[13px] font-bold">
              <Send size={14} className="mr-[6px]" /> Gửi Admin
            </Button>
          </div>
        }
        testId="sepay-test-qr-modal"
      >
        <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-[12px]">
            <div className="rounded-[12px] border border-border bg-background px-[12px] py-[10px]">
              <div className="flex gap-[10px]">
                <button
                  type="button"
                  onClick={() => setTestMode("room")}
                  className={`flex-1 rounded-[10px] px-[12px] py-[10px] text-[13px] font-black ${testMode === "room" ? "bg-primary text-white" : "bg-card text-text"}`}
                >
                  Theo phòng
                </button>
                <button
                  type="button"
                  onClick={() => setTestMode("account")}
                  className={`flex-1 rounded-[10px] px-[12px] py-[10px] text-[13px] font-black ${testMode === "account" ? "bg-primary text-white" : "bg-card text-text"}`}
                >
                  Theo tài khoản
                </button>
              </div>
            </div>

            {testMode === "room" ? (
              <div className="space-y-[8px]">
                <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Phòng</div>
                <select
                  value={selectedRoomId}
                  onChange={(event) => setSelectedRoomId(event.target.value)}
                  className="h-[42px] w-full rounded-[10px] border border-border bg-background px-[12px] text-[13px] font-semibold text-text"
                >
                  {rooms.map((room: any) => (
                    <option key={room.id} value={room.id}>{room.code} • {room.buildingName}</option>
                  ))}
                </select>
                {activeRoom && (
                  <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px] text-[12px]">
                    <div className="font-black text-text">{activeRoom.code} • {activeRoom.buildingName}</div>
                    <div className="mt-[4px] text-muted">{activeRoom.mappedBankAccountLabel || "Theo owner mặc định"}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-[8px]">
                <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Tài khoản nhận</div>
                <select
                  value={selectedBankAccountId}
                  onChange={(event) => setSelectedBankAccountId(event.target.value)}
                  className="h-[42px] w-full rounded-[10px] border border-border bg-background px-[12px] text-[13px] font-semibold text-text"
                >
                  {bankAccounts.filter((bank: any) => bank.isActive).map((bank: any) => (
                    <option key={bank.id} value={bank.id}>{bank.label}</option>
                  ))}
                </select>
                {activeBank && (
                  <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px] text-[12px]">
                    <div className="font-black text-text">{activeBank.label}</div>
                    <div className="mt-[4px] text-muted">{activeBank.ownerName || "Không gắn owner"}</div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-[8px]">
              <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Số tiền test</div>
              <Input value={testAmount} onChange={(event) => setTestAmount(event.target.value.replace(/[^\d]/g, ""))} placeholder="10000" />
            </div>

            <div className="space-y-[8px]">
              <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Mã thanh toán</div>
              <Input value={testMemo} onChange={(event) => setTestMemo(event.target.value)} placeholder="Để trống để tự sinh" />
            </div>
          </div>

          <div className="rounded-[14px] border border-border bg-background/80 p-[14px]">
            <div className="flex items-center justify-between gap-[10px]">
              <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Preview</div>
              {preview?.qrUrl && (
                <Button type="button" variant="outline" onClick={() => copyText(preview.qrUrl, "QR URL")} className="h-[34px] rounded-[9px] px-[10px] text-[12px] font-bold">
                  <Copy size={13} className="mr-[5px]" /> Copy
                </Button>
              )}
            </div>

            {preview ? (
              <div className="mt-[12px] space-y-[12px]">
                <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
                  <div className="text-[13px] font-black text-text">{preview.roomCode || "Manual account"}</div>
                  <div className="mt-[4px] text-[12px] text-muted">{preview.buildingName || preview.bankLabel}</div>
                </div>
                <div className="grid grid-cols-2 gap-[10px] text-[12px]">
                  <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
                    <div className="text-muted">Ngân hàng</div>
                    <div className="mt-[4px] font-black text-text">{preview.bankName}</div>
                  </div>
                  <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
                    <div className="text-muted">STK</div>
                    <div className="mt-[4px] font-black text-text">{preview.bankAccountNumberMasked}</div>
                  </div>
                  <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
                    <div className="text-muted">Số tiền</div>
                    <div className="mt-[4px] font-black text-text">{formatCurrency(preview.amount)}</div>
                  </div>
                  <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
                    <div className="text-muted">Resolve</div>
                    <div className="mt-[4px] font-black text-text">{preview.resolvedFrom}</div>
                  </div>
                </div>
                <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
                  <div className="text-[12px] text-muted">Nội dung</div>
                  <div className="mt-[4px] break-all text-[13px] font-black text-text">{preview.memo}</div>
                </div>
                <div className="rounded-[12px] border border-border bg-card px-[12px] py-[10px]">
                  <div className="text-[12px] text-muted">QR URL</div>
                  <a href={preview.qrUrl} target="_blank" rel="noreferrer" className="mt-[4px] block break-all text-[13px] font-black text-primary">
                    {preview.qrUrl}
                  </a>
                </div>
              </div>
            ) : (
              <div className="mt-[18px] rounded-[12px] border border-dashed border-border bg-card px-[12px] py-[22px] text-center text-[13px] text-muted">
                Chưa tạo preview.
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
