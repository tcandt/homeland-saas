"use client";

import React, { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  Link2,
  LockKeyhole,
  Pencil,
  Plus,
  QrCode,
  RefreshCcw,
  Send,
  ShieldCheck,
  Star,
} from "lucide-react";
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
  authMode?: "apiKey" | "hmac" | "dual" | "none";
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
  if (normalized.length <= 14) return "••••••••••••";
  return `${normalized.slice(0, 4)}••••••••${normalized.slice(-4)}`;
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
  const [showApiKey, setShowApiKey] = useState(false);
  const [showHmacSecret, setShowHmacSecret] = useState(false);

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
  const [copiedUrl, setCopiedUrl] = useState(false);

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
      toast.success("Đã lưu tài khoản nhận tiền mặc định");
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
      toast.success(isActive ? "Đã tắt tài khoản ngân hàng" : "Đã kích hoạt tài khoản ngân hàng");
    } catch (error: any) {
      toast.error(error?.message || "Không thể cập nhật trạng thái ngân hàng");
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
      toast.success("Đã lưu cấu hình SePay thành công!");
    } catch (error: any) {
      toast.error(error?.message || "Lỗi lưu cấu hình");
    }
  };

  const copyText = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    toast.success(`Đã sao chép ${label}`);
  };

  const openSecretModal = () => {
    setSecretDraft({
      webhookApiKey: draft.webhookApiKey || "",
      hmacSecret: draft.hmacSecret || "",
    });
    setShowApiKey(false);
    setShowHmacSecret(false);
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
    toast.success("Đã cập nhật Secret (hãy bấm Lưu để áp dụng)");
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
      toast.success("Đã tạo mã QR kiểm tra thành công");
    } catch (error: any) {
      toast.error(error?.message || "Không tạo được QR kiểm tra");
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
      toast.success("Đã gửi QR kiểm tra tới nhóm Zalo Admin");
    } catch (error: any) {
      toast.error(error?.message || "Không gửi được QR tới nhóm Admin");
    } finally {
      setIsSendingQr(false);
    }
  };

  const getStatusBadge = (webhookStatus?: string | null) => {
    if (!webhookStatus) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
          Chưa có
        </span>
      );
    }
    if (webhookStatus === "PROCESSED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 size={12} /> Thành công
        </span>
      );
    }
    if (webhookStatus === "NEEDS_REVIEW") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <AlertCircle size={12} /> Cần đối soát
        </span>
      );
    }
    if (webhookStatus === "FAILED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
          <AlertCircle size={12} /> Lỗi
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
        {webhookStatus}
      </span>
    );
  };

  const actionBar = (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <div className="flex items-center gap-2 text-xs text-muted">
        <a
          href="https://developer.sepay.vn/vi/sepay-webhooks"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          <ExternalLink size={12} /> Tài liệu SePay Webhooks
        </a>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={openQrModal}
          className="h-10 rounded-xl px-4 text-xs font-bold shadow-sm"
        >
          <QrCode size={14} className="mr-1.5 text-primary" /> Test QR
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => mutateAdminConfig()}
          isLoading={isLoadingAdminConfig}
          className="h-10 rounded-xl px-4 text-xs font-bold shadow-sm"
        >
          <RefreshCcw size={14} className="mr-1.5" /> Làm mới
        </Button>
        <Button
          type="button"
          onClick={saveAll}
          className="h-10 rounded-xl bg-primary px-5 text-xs font-bold text-white shadow-sm hover:opacity-90 transition-all"
          isLoading={isSaving}
        >
          Lưu cấu hình
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col gap-4">
      <Card className="flex h-full flex-col gap-4 border-indigo-500/20 shadow-sm p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-2 border-b border-border/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                <CreditCard size={16} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                SePay Gateway
              </span>
              {draft.enabled ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Đang bật
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-500 border border-slate-500/20">
                  Đang tắt
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-text">Thanh toán và đối soát tự động</h3>
            <p className="text-xs text-muted">
              Tự động nhận diện biến động số dư ngân hàng qua SePay Webhook và đối soát hóa đơn/phiếu cọc.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 shadow-sm">
            <span className="text-xs font-medium text-muted hidden sm:inline">Kích hoạt:</span>
            <Switch
              checked={draft.enabled}
              onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          {/* Section 1: Tài khoản nhận tiền */}
          <div className="rounded-xl border border-border bg-background/80 p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                <CreditCard size={14} className="text-primary" /> Tài khoản nhận tiền theo Chủ nhà (Owner)
              </div>
              <span className="text-[11px] text-muted">{ownerRows.length} chủ nhà</span>
            </div>
            <div className="space-y-2">
              {ownerRows.map((owner: any) => {
                const ownerBanks = owner.bankAccounts || [];
                const defaultBankId = bankDefaultsDraft.defaults?.[owner.id] || "";
                const defaultBank =
                  ownerBanks.find((bank: any) => bank.id === defaultBankId) ||
                  ownerBanks.find((bank: any) => bank.isActive) ||
                  ownerBanks[0];
                return (
                  <button
                    key={owner.id}
                    type="button"
                    onClick={() => openOwnerModal(owner.id)}
                    className="flex w-full flex-col gap-2 rounded-xl border border-border/80 bg-card p-3 text-left transition-all hover:border-primary/50 hover:shadow-sm md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0 md:w-1/4">
                      <div className="text-xs font-black text-text truncate">{owner.name}</div>
                      <div className="mt-0.5 text-[11px] text-muted truncate">
                        {(owner.buildings || []).map((building: any) => building.code).join(", ") || "Chưa gắn tòa"}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 md:px-3">
                      <div className="truncate text-xs font-black text-text">
                        {defaultBank ? `${defaultBank.bankName} - ${defaultBank.accountNumber}` : "Chưa thiết lập tài khoản"}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted truncate">
                        {defaultBank ? defaultBank.accountName || "Chưa có tên thụ hưởng" : `${ownerBanks.length} tài khoản đang có`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-auto">
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-black text-primary">
                        {ownerBanks.length} bank
                      </span>
                      <span className="text-xs font-bold text-primary underline-offset-2 hover:underline">
                        Thiết lập
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Webhook Endpoint */}
          <div className="rounded-xl border border-border bg-background/80 p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                <Link2 size={14} className="text-primary" /> Webhook Endpoint (Nhận thông báo SePay)
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[240px_minmax(0,1fr)]">
              <div>
                <label className="text-[11px] font-semibold text-muted block mb-1">Base URL (Tùy chọn)</label>
                <Input
                  value={draft.webhookBaseUrl || ""}
                  onChange={(event) => setDraft((prev) => ({ ...prev, webhookBaseUrl: event.target.value }))}
                  placeholder={typeof window !== "undefined" ? window.location.origin : "https://homeland.ductinh.one"}
                  className="h-10 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted block mb-1">Webhook URL hoàn chỉnh (Dán vào SePay)</label>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 flex items-center justify-between overflow-hidden rounded-xl border border-border bg-card px-3 py-2">
                    <span className="truncate text-xs font-mono font-medium text-text select-all">{webhookUrl}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copyText(webhookUrl, "Webhook URL")}
                    className="h-10 px-3 shrink-0 rounded-xl text-xs font-bold"
                  >
                    {copiedUrl ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    <span className="ml-1.5 hidden sm:inline">{copiedUrl ? "Đã copy" : "Copy"}</span>
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-muted flex items-center gap-1.5">
              <Info size={13} className="shrink-0 text-primary" />
              <span>SePay yêu cầu endpoint phản hồi HTTP <strong>200 OK</strong> kèm body <code>{"{\"success\": true}"}</code> trong vòng 30s.</span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 pt-1">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-[11px] uppercase font-bold tracking-wider text-muted">Phương thức xác thực</div>
                <div className="mt-1 text-xs font-black text-text uppercase">
                  {draft.authMode === "none" ? "Không xác thực" : draft.authMode || "apiKey"}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-[11px] uppercase font-bold tracking-wider text-muted">Trạng thái Webhook</div>
                <div className="mt-1">{getStatusBadge(status?.lastWebhookStatus)}</div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-[11px] uppercase font-bold tracking-wider text-muted">Giao dịch gần nhất</div>
                <div className="mt-1 text-xs font-black text-text">{formatDateTime(status?.lastWebhookAt)}</div>
              </div>
            </div>
          </div>

          {/* Section 3: Secret & Chữ ký */}
          <div className="rounded-xl border border-border bg-background/80 p-3.5 sm:p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_120px] md:items-center">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                <ShieldCheck size={14} className="text-primary" /> Bảo mật & Khóa
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-[11px] uppercase font-bold tracking-wider text-muted">API Key</div>
                <div className="mt-1 truncate text-xs font-mono font-bold text-text">
                  {draft.webhookApiKey ? shortSecret(draft.webhookApiKey) : <span className="text-muted font-normal">Chưa cấu hình</span>}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="text-[11px] uppercase font-bold tracking-wider text-muted">HMAC-SHA256 Secret</div>
                <div className="mt-1 truncate text-xs font-mono font-bold text-text">
                  {draft.hmacSecret ? shortSecret(draft.hmacSecret) : <span className="text-muted font-normal">Chưa cấu hình</span>}
                </div>
              </div>
              <div className="md:text-right">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={openSecretModal}
                  className="w-full md:w-auto rounded-xl text-xs font-bold"
                >
                  <LockKeyhole size={13} className="mr-1.5 text-primary" />
                  {canEditSecrets ? "Thiết lập Secret" : "Khóa"}
                </Button>
              </div>
            </div>
          </div>

          {/* Section 4: Cấu hình chính */}
          <div className="rounded-xl border border-border bg-background/80 p-3.5 sm:p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-muted">Cấu hình tham số thanh toán</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="text-[11px] font-semibold text-muted block mb-1">Xác thực Webhook</label>
                <select
                  value={draft.authMode || "apiKey"}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, authMode: event.target.value as SePaySettings["authMode"] }))
                  }
                  className="h-10 w-full rounded-xl border border-border bg-card px-3 text-xs font-bold text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="apiKey">API Key (Authorization: Apikey)</option>
                  <option value="hmac">HMAC-SHA256 (Khuyến nghị)</option>
                  <option value="dual">Dual (Cả API Key & HMAC)</option>
                  <option value="none">Không xác thực (Thử nghiệm)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted block mb-1">Tiền tố mã thanh toán (Prefix)</label>
                <Input
                  value={draft.paymentCodePrefix}
                  onChange={(event) => setDraft((prev) => ({ ...prev, paymentCodePrefix: event.target.value }))}
                  placeholder="Ví dụ: PAY hoặc HL"
                  className="h-10 text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted block mb-1">Template xác nhận</label>
                <Input
                  value={draft.invoicePaidTemplateCode}
                  onChange={(event) => setDraft((prev) => ({ ...prev, invoicePaidTemplateCode: event.target.value }))}
                  placeholder="Mã template tin nhắn"
                  className="h-10 text-xs"
                />
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex h-10 items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 cursor-pointer">
                  <div className="text-xs font-bold text-text">Báo khách qua Zalo</div>
                  <Switch
                    checked={draft.sendPaymentResultToZalo}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, sendPaymentResultToZalo: event.target.checked }))
                    }
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar Footer */}
        <div className="mt-auto border-t border-border/60 pt-3">{actionBar}</div>
      </Card>

      {/* Modal: Cấu hình Secret */}
      <Modal
        isOpen={isSecretModalOpen}
        onClose={closeSecretModal}
        title="Thiết lập Secret SePay"
        maxWidth="max-w-[620px]"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeSecretModal}>
              Hủy
            </Button>
            <Button type="button" onClick={saveSecretModal} disabled={!canEditSecrets}>
              Lưu thay đổi
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-500/20 bg-blue-50/50 dark:bg-blue-950/30 p-3 text-xs text-blue-900 dark:text-blue-200">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <div>
                Sao chép <strong>API Key</strong> hoặc <strong>HMAC Secret</strong> từ trang cấu hình Webhook của SePay (
                <a href="https://my.sepay.vn" target="_blank" rel="noreferrer" className="underline font-bold">
                  my.sepay.vn
                </a>
                ) và dán vào đây.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-text">Webhook API Key</span>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={secretDraft.webhookApiKey}
                  onChange={(event) =>
                    setSecretDraft((prev) => ({ ...prev, webhookApiKey: event.target.value }))
                  }
                  placeholder="Nhập API key từ SePay"
                  disabled={!canEditSecrets}
                  className="pr-10 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-text">HMAC Secret (Khuyến nghị dùng để chống giả mạo)</span>
              <div className="relative">
                <Input
                  type={showHmacSecret ? "text" : "password"}
                  value={secretDraft.hmacSecret}
                  onChange={(event) =>
                    setSecretDraft((prev) => ({ ...prev, hmacSecret: event.target.value }))
                  }
                  placeholder="Nhập HMAC Secret từ SePay"
                  disabled={!canEditSecrets}
                  className="pr-10 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowHmacSecret(!showHmacSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                >
                  {showHmacSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          </div>
        </div>
      </Modal>

      {/* Modal: Quản lý ngân hàng Owner */}
      <Modal
        isOpen={Boolean(activeOwner)}
        onClose={() => !isSavingOwnerDefault && setActiveOwnerId(null)}
        title={activeOwner ? `Tài khoản nhận tiền • ${activeOwner.name}` : "Tài khoản nhận tiền"}
        maxWidth="max-w-[720px]"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setActiveOwnerId(null)} disabled={isSavingOwnerDefault}>
              Đóng
            </Button>
            <Button type="button" onClick={saveOwnerModal} isLoading={isSavingOwnerDefault}>
              Lưu mặc định
            </Button>
          </div>
        }
      >
        {activeOwner && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-background/70 p-3 text-xs">
              <div className="font-black text-text">{activeOwner.name}</div>
              <div className="mt-1 text-muted">
                Tòa nhà phụ trách: {(activeOwner.buildings || []).map((building: any) => building.code).join(", ") || "Chưa gắn tòa nhà"}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-muted uppercase tracking-wide">Tài khoản mặc định khi tạo QR phòng</span>
              <select
                value={ownerDefaultBankId}
                onChange={(event) => setOwnerDefaultBankId(event.target.value)}
                className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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

            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="text-xs font-bold uppercase tracking-wide text-muted">Danh sách tài khoản ngân hàng</div>
              <Button type="button" size="sm" variant="outline" onClick={() => openCreateBankModal(activeOwner.id)}>
                <Plus size={13} className="mr-1.5" /> Thêm ngân hàng
              </Button>
            </div>

            <div className="space-y-2">
              {(activeOwner.bankAccounts || []).length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs font-semibold text-muted">
                  Chủ nhà này chưa có tài khoản nhận tiền nào.
                </div>
              )}
              {(activeOwner.bankAccounts || []).map((bank: any) => (
                <div key={bank.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="text-xs font-black text-text">{bank.bankName}</div>
                        {ownerDefaultBankId === bank.id && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            <Star size={10} className="fill-amber-500" /> Mặc định
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs font-mono font-bold text-text">{bank.accountNumber}</div>
                      <div className="mt-0.5 text-[11px] text-muted">{bank.accountName || "Chưa có tên người thụ hưởng"}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                          bank.isActive ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                        }`}
                      >
                        {bank.isActive ? "Đang hoạt động" : "Đã tạm dừng"}
                      </span>
                      <Button type="button" size="sm" variant="outline" onClick={() => openEditBankModal(activeOwner.id, bank)}>
                        <Pencil size={12} className="mr-1" /> Sửa
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

      {/* Modal: Thêm / Sửa Bank Form */}
      <Modal
        isOpen={Boolean(bankModal)}
        onClose={() => !savingBankForm && setBankModal(null)}
        title={bankModal?.bankId ? "Chỉnh sửa tài khoản ngân hàng" : "Thêm tài khoản ngân hàng"}
        maxWidth="max-w-[520px]"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBankModal(null)} disabled={savingBankForm}>
              Hủy bỏ
            </Button>
            <Button type="button" onClick={saveBankModal} isLoading={savingBankForm}>
              Lưu tài khoản
            </Button>
          </div>
        }
      >
        {bankModal && (
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-background/70 p-3 text-xs">
              <div className="font-black text-text">
                Chủ nhà: {ownerRows.find((owner: any) => owner.id === bankModal.ownerId)?.name || "Chưa xác định"}
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-muted">Ngân hàng</span>
              <select
                value={bankModal.bankName}
                onChange={(event) => setBankModal((prev) => (prev ? { ...prev, bankName: event.target.value } : prev))}
                className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {BANK_OPTIONS.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-muted">Số tài khoản</span>
              <Input
                value={bankModal.accountNumber}
                onChange={(event) =>
                  setBankModal((prev) => (prev ? { ...prev, accountNumber: event.target.value } : prev))
                }
                placeholder="Ví dụ: 1017588888"
                className="h-10 text-xs font-mono"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-muted">Tên người thụ hưởng (Viết hoa không dấu)</span>
              <Input
                value={bankModal.accountName}
                onChange={(event) =>
                  setBankModal((prev) => (prev ? { ...prev, accountName: event.target.value.toUpperCase() } : prev))
                }
                placeholder="Ví dụ: NGUYEN VAN A"
                className="h-10 text-xs uppercase"
              />
            </label>
          </div>
        )}
      </Modal>

      {/* Modal: Test QR SePay */}
      <Modal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        title="Kiểm tra tạo mã QR VietQR / SePay"
        maxWidth="max-w-[min(880px,92vw)]"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={createQrPreview}
              isLoading={isTestingQr}
              className="h-10 rounded-xl px-4 text-xs font-bold"
            >
              <QrCode size={14} className="mr-1.5" /> Tạo mã QR
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={sendQrToAdmin}
              isLoading={isSendingQr}
              className="h-10 rounded-xl px-4 text-xs font-bold"
            >
              <Send size={14} className="mr-1.5" /> Gửi tới Zalo Admin
            </Button>
          </div>
        }
        testId="sepay-test-qr-modal"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-background p-1.5 flex gap-1.5">
              <button
                type="button"
                onClick={() => setTestMode("room")}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                  testMode === "room" ? "bg-primary text-white shadow-sm" : "bg-transparent text-muted hover:text-text"
                }`}
              >
                Theo phòng
              </button>
              <button
                type="button"
                onClick={() => setTestMode("account")}
                className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                  testMode === "account" ? "bg-primary text-white shadow-sm" : "bg-transparent text-muted hover:text-text"
                }`}
              >
                Theo tài khoản ngân hàng
              </button>
            </div>

            {testMode === "room" ? (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-muted">Chọn phòng thử nghiệm</div>
                <select
                  value={selectedRoomId}
                  onChange={(event) => setSelectedRoomId(event.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-text"
                >
                  {rooms.map((room: any) => (
                    <option key={room.id} value={room.id}>
                      {room.code} • {room.buildingName}
                    </option>
                  ))}
                </select>
                {activeRoom && (
                  <div className="rounded-xl border border-border bg-card p-2.5 text-xs">
                    <div className="font-bold text-text">{activeRoom.code} • {activeRoom.buildingName}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{activeRoom.mappedBankAccountLabel || "Theo Owner mặc định"}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-muted">Chọn tài khoản ngân hàng</div>
                <select
                  value={selectedBankAccountId}
                  onChange={(event) => setSelectedBankAccountId(event.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-text"
                >
                  {bankAccounts
                    .filter((bank: any) => bank.isActive)
                    .map((bank: any) => (
                      <option key={bank.id} value={bank.id}>
                        {bank.label}
                      </option>
                    ))}
                </select>
                {activeBank && (
                  <div className="rounded-xl border border-border bg-card p-2.5 text-xs">
                    <div className="font-bold text-text">{activeBank.label}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{activeBank.ownerName || "Không gắn owner"}</div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              <div className="text-xs font-bold text-muted">Số tiền thanh toán thử (VNĐ)</div>
              <Input
                value={testAmount}
                onChange={(event) => setTestAmount(event.target.value.replace(/[^\d]/g, ""))}
                placeholder="10000"
                className="h-10 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs font-bold text-muted">Mã thanh toán (Nội dung CK)</div>
              <Input
                value={testMemo}
                onChange={(event) => setTestMemo(event.target.value)}
                placeholder="Để trống để hệ thống tự sinh mã theo Prefix"
                className="h-10 text-xs font-mono"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background/80 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-wide text-muted">Kết quả tạo QR</div>
              {preview?.qrUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyText(preview.qrUrl, "QR URL")}
                  className="h-7 text-[11px] font-bold"
                >
                  <Copy size={12} className="mr-1" /> Copy link QR
                </Button>
              )}
            </div>

            {preview ? (
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border bg-card p-2.5">
                    <div className="text-[11px] text-muted">Ngân hàng</div>
                    <div className="font-black text-text mt-0.5">{preview.bankName}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-2.5">
                    <div className="text-[11px] text-muted">Số tài khoản</div>
                    <div className="font-black text-text mt-0.5">{preview.bankAccountNumberMasked}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-2.5">
                    <div className="text-[11px] text-muted">Số tiền</div>
                    <div className="font-black text-primary mt-0.5">{formatCurrency(preview.amount)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-2.5">
                    <div className="text-[11px] text-muted">Nguồn tài khoản</div>
                    <div className="font-black text-text mt-0.5">{preview.resolvedFrom}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-2.5">
                  <div className="text-[11px] text-muted">Nội dung chuyển khoản (Memo)</div>
                  <div className="font-mono font-black text-text mt-0.5 select-all">{preview.memo}</div>
                </div>

                {preview.qrUrl && (
                  <div className="flex justify-center p-2 rounded-xl bg-white border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.qrUrl}
                      alt="VietQR SePay"
                      className="max-h-[160px] object-contain rounded-lg"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-border bg-card">
                <QrCode size={36} className="text-muted/50 mb-2" />
                <div className="text-xs text-muted">Bấm &quot;Tạo mã QR&quot; để xem trước mã VietQR</div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
