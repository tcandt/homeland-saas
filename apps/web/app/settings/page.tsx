"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  Bell,
  BookOpen,
  Building2,
  Cloud,
  ClipboardList,
  Database,
  FileKey2,
  Gauge,
  KeyRound,
  Link2,
  Plug,
  PlugZap,
  ReceiptText,
  Search,
  Server,
  Settings2,
  Shield,
  SlidersHorizontal,
  RefreshCcw,
  User,
  Users,
  UsersRound,
  WalletCards,
  Webhook,
  Wrench,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import SettingsProfile from "@/components/settings/sections/SettingsProfile";
import SettingsSecurity from "@/components/settings/sections/SettingsSecurity";
import SettingsTeam from "@/components/settings/sections/SettingsTeam";
import SettingsNotificationAutomation from "@/components/settings/sections/SettingsNotificationAutomation";
import SettingsAccounting from "@/components/settings/sections/SettingsAccounting";
import SettingsTemplates from "@/components/settings/sections/SettingsTemplates";
import SettingsIntegrations from "@/components/settings/sections/SettingsIntegrations";
import SettingsHunonicIntegration from "@/components/settings/sections/SettingsHunonicIntegration";
import SettingsOwnerManagement from "@/components/settings/sections/SettingsOwnerManagement";
import SettingsBackup from "@/components/settings/sections/SettingsBackup";
import SettingsContractRules from "@/components/settings/sections/SettingsContractRules";
import SettingsInvoiceRules from "@/components/settings/sections/SettingsInvoiceRules";
import SettingsApiKeys from "@/components/settings/sections/SettingsApiKeys";
import SettingsBuildingRooms from "@/components/settings/sections/SettingsBuildingRooms";
import SettingsLicense from "@/components/settings/sections/SettingsLicense";
import SettingsSystemUpdate from "@/components/settings/sections/SettingsSystemUpdate";
import { auditApi, AuditLogItem } from "@/lib/api/audit.api";
import { useSettingsSectionQuery } from "@/lib/queries/settings.queries";
import { useAuthStore } from "@/lib/auth/auth-store";

export type SettingsSection =
  | "overview"
  | "owners"
  | "team"
  | "building-rooms"
  | "contract-rules"
  | "invoice-rules"
  | "notifications"
  | "templates"
  | "accounting"
  | "integrations"
  | "hunonic"
  | "api"
  | "security"
  | "users"
  | "backup"
  | "license"
  | "system-update"
  | "profile";

type SettingsDomain = "organization" | "operations" | "finance" | "integrations" | "system" | "account";

interface SettingsItem {
  id: SettingsSection;
  domain: SettingsDomain;
  title: string;
  description: string;
  keywords: string[];
  icon: React.ReactNode;
}

interface SettingsGroup {
  id: SettingsDomain;
  title: string;
  description: string;
  icon: React.ReactNode;
  items: SettingsItem[];
}

const settingsGroups: SettingsGroup[] = [
  {
    id: "organization",
    title: "Chủ sở hữu & phân quyền",
    description: "Phân tòa, tài khoản owner và quyền truy cập.",
    icon: <Building2 size={18} />,
    items: [
      {
        id: "owners",
        domain: "organization",
        title: "Chủ sở hữu",
        description: "Phân owner, tòa nhà, tỷ lệ sở hữu và tài khoản nhận tiền.",
        keywords: ["owner", "chu so huu", "toa nha", "phan toa", "loi nhuan"],
        icon: <UsersRound size={17} />,
      },
      {
        id: "users",
        domain: "organization",
        title: "Users",
        description: "Tài khoản nội bộ, vai trò và quyền truy cập hệ thống.",
        keywords: ["nhan su", "phan quyen", "role", "user", "rbac", "thanh vien"],
        icon: <Users size={17} />,
      },
    ],
  },
  {
    id: "operations",
    title: "Thiết lập vận hành",
    description: "Quy tắc hợp đồng, hóa đơn, thông báo và biểu mẫu.",
    icon: <Gauge size={18} />,
    items: [
      {
        id: "building-rooms",
        domain: "operations",
        title: "Tòa nhà & phòng",
        description: "Loại phòng và các thiết lập vận hành phòng.",
        keywords: ["toa nha", "phong", "room type", "gia dien", "gia nuoc"],
        icon: <Building2 size={17} />,
      },
      {
        id: "contract-rules",
        domain: "operations",
        title: "Quy tắc hợp đồng",
        description: "Tiền cọc, gia hạn, điều khoản và phụ lục hợp đồng.",
        keywords: ["hop dong", "tien coc", "gia han", "ky han", "dieu khoan"],
        icon: <FileKey2 size={17} />,
      },
      {
        id: "invoice-rules",
        domain: "operations",
        title: "Thiết lập hóa đơn",
        description: "Mẫu hóa đơn, ký hiệu, số hóa đơn và quy tắc tạo hóa đơn.",
        keywords: ["hoa don", "vat", "han thanh toan", "ngay tao", "billing"],
        icon: <ReceiptText size={17} />,
      },
      {
        id: "notifications",
        domain: "operations",
        title: "Thông báo tự động",
        description: "Nhắc nợ, nhắc hết hạn hợp đồng và mẫu tin nhắn.",
        keywords: ["thong bao", "sms", "zalo", "nhac no", "automation"],
        icon: <Bell size={17} />,
      },
      {
        id: "templates",
        domain: "operations",
        title: "Biểu mẫu",
        description: "Mẫu hợp đồng, phiếu thu, phiếu chi và biên bản.",
        keywords: ["bieu mau", "template", "hop dong mau", "in an"],
        icon: <ClipboardList size={17} />,
      },
    ],
  },
  {
    id: "finance",
    title: "Tài chính & kế toán",
    description: "Tài khoản kế toán, danh mục hạch toán và đối soát.",
    icon: <WalletCards size={18} />,
    items: [
      {
        id: "accounting",
        domain: "finance",
        title: "Hạch toán & kế toán",
        description: "Tài khoản kế toán, danh mục thu chi và quy tắc ghi sổ.",
        keywords: ["ke toan", "hach toan", "tai khoan", "so cai", "ledger"],
        icon: <BookOpen size={17} />,
      },
    ],
  },
  {
    id: "integrations",
    title: "Tích hợp & mở rộng",
    description: "Kết nối dịch vụ ngoài, IoT và nhà cung cấp API.",
    icon: <Plug size={18} />,
    items: [
      {
        id: "integrations",
        domain: "integrations",
        title: "Dịch vụ tích hợp",
        description: "SePay, Zalo OA, Email SMTP, Telegram và Webhook.",
        keywords: ["sepay", "zalo", "email", "smtp", "telegram", "webhook"],
        icon: <PlugZap size={17} />,
      },
      {
        id: "hunonic",
        domain: "integrations",
        title: "Hunonic IoT",
        description: "Công tơ điện thông minh, tự động chốt số và điều khiển.",
        keywords: ["hunonic", "iot", "cong to dien", "chot so", "thiet bi"],
        icon: <SlidersHorizontal size={17} />,
      },
      {
        id: "api",
        domain: "integrations",
        title: "API & Webhook",
        description: "API Key, phân quyền developer và tài liệu tích hợp.",
        keywords: ["api", "api key", "developer", "token", "webhook"],
        icon: <FileKey2 size={17} />,
      },
    ],
  },
  {
    id: "system",
    title: "Hệ thống & bảo mật",
    description: "Bảo mật tài khoản, sao lưu và bảo trì nền tảng.",
    icon: <Shield size={18} />,
    items: [
      {
        id: "security",
        domain: "system",
        title: "Bảo mật",
        description: "Mật khẩu, 2FA, phiên đăng nhập và chính sách bảo mật.",
        keywords: ["bao mat", "mat khau", "2fa", "session", "security"],
        icon: <KeyRound size={17} />,
      },
      {
        id: "backup",
        domain: "system",
        title: "Cập nhật, sao lưu & rollback",
        description: "Kiểm tra version mới, xác nhận cập nhật, sao lưu và rollback.",
        keywords: ["backup", "sao luu", "khoi phuc", "restore", "snapshot", "update", "rollback", "version"],
        icon: <Database size={17} />,
      },
      {
        id: "license",
        domain: "system",
        title: "Đăng ký & bảo trì",
        description: "Gói dịch vụ, bản quyền và trạng thái bảo trì hệ thống.",
        keywords: ["license", "bao tri", "ban quyen", "goi dich vu", "han dung"],
        icon: <Wrench size={17} />,
      },
    ],
  },
];

const accountItems: SettingsItem[] = [
  {
    id: "profile",
    domain: "account",
    title: "Hồ sơ cá nhân",
    description: "Thông tin tài khoản, avatar và liên hệ.",
    keywords: ["ho so", "ca nhan", "profile", "avatar", "email"],
    icon: <User size={17} />,
  },
  {
    id: "security",
    domain: "account",
    title: "Bảo mật tài khoản",
    description: "Đổi mật khẩu, 2FA và thiết bị tin cậy.",
    keywords: ["doi mat khau", "password", "2fa", "bao mat"],
    icon: <Shield size={17} />,
  },
];

const settingsItems = [...settingsGroups.flatMap((group) => group.items), ...accountItems];

const topTabs: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Tổng quan", icon: <Settings2 size={15} /> },
  { id: "security", label: "Bảo mật", icon: <Shield size={15} /> },
  { id: "users", label: "Users", icon: <Users size={15} /> },
  { id: "notifications", label: "Thông báo", icon: <Bell size={15} /> },
  { id: "integrations", label: "Tích hợp", icon: <Plug size={15} /> },
  { id: "license", label: "Đăng ký & bảo trì", icon: <Wrench size={15} /> },
  { id: "backup", label: "Cập nhật, sao lưu & rollback", icon: <Database size={15} /> },
];

function hasValue(value: unknown): boolean {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => {
      if (Array.isArray(item)) return item.length > 0;
      if (typeof item === "object" && item !== null) return hasValue(item);
      if (typeof item === "boolean") return item;
      return item !== "" && item !== null && item !== undefined;
    });
  }
  return value !== "";
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function getSectionTitle(section: SettingsSection) {
  const resolvedSection = section === "team" ? "users" : section;
  return settingsItems.find((item) => item.id === resolvedSection)?.title ?? "Cài đặt";
}

function resolveSectionParam(section: string | null): SettingsSection | null {
  if (!section || section === "overview" || section === "reports") return "overview";
  if (section === "team") return "users";
  if (section === "system-update") return "backup";
  if (settingsItems.some((item) => item.id === section)) return section as SettingsSection;
  return "overview";
}

function SettingsCard({ item, onSelect }: { item: SettingsItem; onSelect: (section: SettingsSection) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="group flex min-h-[104px] w-full items-start gap-[12px] rounded-xl border border-border bg-card p-[14px] text-left shadow-2xs transition hover:-translate-y-[1px] hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <span className="mt-[2px] flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
        {item.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black leading-[18px] text-text">{item.title}</span>
        <span className="mt-[6px] block text-xs font-medium leading-[18px] text-muted">{item.description}</span>
      </span>
    </button>
  );
}

function QuickSetupCard({
  icon,
  title,
  description,
  tone,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: "primary" | "blue" | "green" | "orange";
  onSelect: () => void;
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-600",
    green: "bg-success/10 text-success",
    orange: "bg-warning/10 text-warning",
  }[tone];

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex min-h-[134px] flex-col items-start justify-between rounded-xl border border-border bg-card p-[16px] text-left shadow-2xs transition hover:-translate-y-[1px] hover:border-primary/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      <div className="flex items-start gap-[14px]">
        <span className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl ${toneClass}`}>{icon}</span>
        <span className="min-w-0">
          <span className="block text-sm font-black leading-[20px] text-text">{title}</span>
          <span className="mt-[7px] block text-xs font-medium leading-[20px] text-muted">{description}</span>
        </span>
      </div>
      <span className="ml-[60px] mt-[14px] text-xs font-black text-primary transition group-hover:translate-x-[2px]">
        Cấu hình -&gt;
      </span>
    </button>
  );
}

function formatAuditAction(log: AuditLogItem) {
  const labels: Record<string, string> = {
    CREATE: "Tạo mới",
    UPDATE: "Cập nhật",
    DELETE: "Xóa",
    CANCEL: "Hủy",
    LOGIN_SUCCESS: "Đăng nhập thành công",
    LOGIN_FAILED: "Đăng nhập thất bại",
    LOGOUT_SUCCESS: "Đăng xuất",
  };
  return labels[log.action] || log.action;
}

function formatAuditTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "--" : date.toLocaleString("vi-VN");
}

function ServiceRow({
  icon,
  name,
  desc,
  status,
  warning,
  onSelect,
}: {
  icon: React.ReactNode;
  name: string;
  desc: string;
  status: string;
  warning?: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="flex items-center gap-[12px] border-b border-border/70 py-[12px] last:border-b-0">
      <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl ${warning ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-black text-text">{name}</div>
        <div className="mt-[2px] text-[11px] font-medium text-muted">{desc}</div>
      </div>
      <div className={`hidden items-center gap-[7px] text-xs font-bold sm:flex ${warning ? "text-warning" : "text-success"}`}>
        <span className={`h-[6px] w-[6px] rounded-full ${warning ? "bg-warning" : "bg-success"}`} />
        {status}
      </div>
      <Button variant="outline" className="h-[32px] rounded-xl px-[12px] text-xs font-bold" onClick={onSelect}>
        Mở
      </Button>
    </div>
  );
}

function ActivityRow({
  icon,
  title,
  desc,
  actor,
  time,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  actor: string;
  time: string;
  tone: "primary" | "blue" | "orange" | "green" | "neutral";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    blue: "bg-blue-500/10 text-blue-600",
    orange: "bg-warning/10 text-warning",
    green: "bg-success/10 text-success",
    neutral: "bg-muted/10 text-muted",
  }[tone];

  return (
    <div className="flex items-center gap-[12px] border-b border-border/70 p-[12px] last:border-b-0">
      <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl ${toneClass}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-black text-text">{title}</div>
        <div className="mt-[2px] text-[11px] font-medium text-muted">{desc}</div>
      </div>
      <div className="text-right">
        <div className="text-xs font-bold text-text">{actor}</div>
        <div className="mt-[2px] text-[10px] font-medium text-muted">{time}</div>
      </div>
    </div>
  );
}

function SearchResults({ query, onSelect }: { query: string; onSelect: (section: SettingsSection) => void }) {
  const normalizedQuery = normalize(query.trim());
  if (!normalizedQuery) return null;

  const results = settingsItems.filter((item) => {
    const haystack = [item.title, item.description, ...item.keywords].map(normalize).join(" ");
    return haystack.includes(normalizedQuery);
  });

  return (
    <section className="rounded-xl border border-border bg-card p-[18px] shadow-2xs">
      <div className="mb-[14px] flex items-center justify-between">
        <h3 className="text-sm font-black text-text">Kết quả tìm kiếm ({results.length})</h3>
        <span className="text-xs font-medium text-muted">Từ khóa: &quot;{query}&quot;</span>
      </div>
      {results.length === 0 ? (
        <div className="p-[20px] text-center text-xs text-muted">Không tìm thấy cài đặt phù hợp.</div>
      ) : (
        <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2 xl:grid-cols-3">
          {results.map((item) => (
            <SettingsCard key={`${item.domain}-${item.id}`} item={item} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  );
}

function SettingsDashboard({ onSelect }: { onSelect: (section: SettingsSection) => void }) {
  const [query, setQuery] = useState("");
  const sepay = useSettingsSectionQuery("sepay");
  const zalo = useSettingsSectionQuery("zalo");
  const email = useSettingsSectionQuery("email");
  const hunonic = useSettingsSectionQuery("hunonic");
  const audit = useSWR("settings-overview-audit", () => auditApi.logs({ limit: 5 }), { revalidateOnFocus: false });

  const healthItems = [
    { label: "SePay", isConfigured: hasValue(sepay.data?.value) },
    { label: "Zalo", isConfigured: hasValue(zalo.data?.value) },
    { label: "Email", isConfigured: hasValue(email.data?.value) },
    { label: "Hunonic", isConfigured: hasValue(hunonic.data?.value) },
  ];

  const configuredCount = healthItems.filter((item) => item.isConfigured).length;
  const auditRows: AuditLogItem[] = Array.isArray(audit.data) ? audit.data : [];

  return (
    <div className="flex flex-col gap-3" data-testid="settings-overview-root">
      <section className="rounded-xl border border-border bg-card p-4 shadow-2xs">
        <div className="mb-3 flex flex-col gap-1">
          <h2 className="text-base font-black text-text">Thiết lập nhanh</h2>
          <p className="text-xs font-medium text-muted">Truy cập nhanh các cài đặt quan trọng thường dùng</p>
        </div>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          <QuickSetupCard icon={<RefreshCcw size={20} />} title="Cập nhật, sao lưu & rollback" description="Kiểm tra version mới, xác nhận cập nhật, sao lưu và rollback có kiểm soát" tone="blue" onSelect={() => onSelect("backup")} />
          <QuickSetupCard icon={<Shield size={20} />} title="Bảo mật tài khoản" description="Quản lý mật khẩu, 2FA, phiên đăng nhập và bảo mật tài khoản" tone="primary" onSelect={() => onSelect("security")} />
          <QuickSetupCard icon={<Bell size={20} />} title="Thông báo tự động" description="Thiết lập nhắc nợ, nhắc hết hạn hợp đồng và thông báo hệ thống" tone="orange" onSelect={() => onSelect("notifications")} />
          <QuickSetupCard icon={<Link2 size={20} />} title="Tích hợp dịch vụ" description="Kết nối ngân hàng, SePay, Zalo, Email, Hunonic và dịch vụ khác" tone="green" onSelect={() => onSelect("integrations")} />
          <QuickSetupCard icon={<ReceiptText size={20} />} title="Thiết lập hóa đơn" description="Cấu hình mẫu hóa đơn, ký hiệu, số hóa đơn và quy tắc tạo hóa đơn" tone="blue" onSelect={() => onSelect("invoice-rules")} />
          <QuickSetupCard icon={<FileKey2 size={20} />} title="Quy tắc hợp đồng" description="Thiết lập tiền cọc, gia hạn, điều khoản và phụ lục hợp đồng" tone="primary" onSelect={() => onSelect("contract-rules")} />
          <QuickSetupCard icon={<BookOpen size={20} />} title="Kế toán & hạch toán" description="Quản lý hệ thống tài khoản, danh mục hạch toán và mapping" tone="blue" onSelect={() => onSelect("accounting")} />
          <QuickSetupCard icon={<Wrench size={20} />} title="Đăng ký bảo trì" description="Quản lý lịch bảo trì hệ thống, thiết bị và nhà cung cấp" tone="orange" onSelect={() => onSelect("license")} />
        </div>
      </section>

      <SearchResults query={query} onSelect={onSelect} />

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-[0.95fr_1.45fr]">
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="mb-3">
            <h3 className="text-sm font-black text-text">Trạng thái hệ thống</h3>
            <p className="mt-0.5 text-xs font-medium text-muted">Tình trạng các dịch vụ và kết nối quan trọng</p>
          </div>
          <div>
            <ServiceRow icon={<WalletCards size={16} />} name="SePay" desc="Thanh toán" status={hasValue(sepay.data?.value) ? "Đã cấu hình" : "Chưa cấu hình"} warning={!hasValue(sepay.data?.value)} onSelect={() => onSelect("integrations")} />
            <ServiceRow icon={<Bell size={16} />} name="Zalo OA" desc="Gửi thông báo" status={hasValue(zalo.data?.value) ? "Đã cấu hình" : "Chưa cấu hình"} warning={!hasValue(zalo.data?.value)} onSelect={() => onSelect("integrations")} />
            <ServiceRow icon={<ReceiptText size={16} />} name="Email SMTP" desc="Gửi email" status={hasValue(email.data?.value) ? "Đã cấu hình" : "Chưa cấu hình"} warning={!hasValue(email.data?.value)} onSelect={() => onSelect("integrations")} />
            <ServiceRow icon={<PlugZap size={16} />} name="Hunonic" desc="Điện & IoT" status={hasValue(hunonic.data?.value) ? "Đã cấu hình" : "Chưa cấu hình"} warning={!hasValue(hunonic.data?.value)} onSelect={() => onSelect("hunonic")} />
            <ServiceRow icon={<Server size={16} />} name="API hệ thống" desc="Kết nối audit" status={audit.isLoading ? "Đang kiểm tra" : audit.error ? "Không kết nối" : "Đã kết nối"} warning={Boolean(audit.error)} onSelect={() => onSelect("overview")} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-text">Nhật ký hoạt động gần đây</h3>
              <p className="mt-0.5 text-xs font-medium text-muted">Dữ liệu audit mới nhất từ hệ thống</p>
            </div>
            <Button variant="outline" size="sm" className="h-8 rounded-xl px-3 text-xs font-bold" onClick={() => onSelect("overview")}>
              Xem tất cả
            </Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-border/70">
            {audit.isLoading && <div className="p-6 text-center text-xs font-semibold text-muted">Đang tải nhật ký...</div>}
            {!audit.isLoading && audit.error && <div className="p-6 text-center text-xs font-semibold text-rose-600">Không tải được nhật ký hoạt động.</div>}
            {!audit.isLoading && !audit.error && auditRows.length === 0 && <div className="p-6 text-center text-xs font-semibold text-muted">Chưa có nhật ký hoạt động.</div>}
            {auditRows.map((log: AuditLogItem) => (
              <ActivityRow
                key={log.id}
                icon={<ClipboardList size={15} />}
                title={formatAuditAction(log)}
                desc={`${log.module || "Hệ thống"} · ${log.entity}${log.entityId ? ` · ${log.entityId}` : ""}`}
                actor={log.user?.fullName || log.user?.email || "Hệ thống"}
                time={formatAuditTime(log.createdAt)}
                tone={log.action === "LOGIN_FAILED" ? "orange" : "neutral"}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-2xs">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-black text-text">Tra cứu cài đặt</h3>
            <p className="mt-0.5 text-xs font-medium text-muted">{configuredCount}/{healthItems.length} cấu hình nền tảng đang có dữ liệu.</p>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm kiếm cài đặt..."
              className="h-9 w-full rounded-xl border border-border/70 bg-background pl-9 pr-3 text-xs font-semibold text-text outline-none transition focus:border-primary md:w-[320px]"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {settingsGroups.slice(0, 4).map((group) => (
            <div key={group.id} className="rounded-xl border border-border/70 bg-background p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{group.icon}</span>
                <div className="text-xs font-black text-text">{group.title}</div>
              </div>
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-muted">{group.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingsTopTabs({ activeSection, onSelect }: { activeSection: SettingsSection | null; onSelect: (section: SettingsSection) => void }) {
  const active = activeSection ?? "overview";

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border/70 bg-card p-1.5 shadow-2xs shrink-0">
      {topTabs.map((tab, index) => {
        const isActive = active === tab.id || (active === "overview" && index === 0);
        return (
          <button
            key={`${tab.id}-${tab.label}`}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all ${
              isActive
                ? "bg-primary text-white shadow-2xs"
                : "text-muted hover:bg-muted/10 hover:text-text"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(resolveSectionParam(searchParams.get("section")));
  const [isPending, startTransition] = useTransition();
  const canReadSettings = Boolean(user?.roles?.includes("ADMIN") || user?.permissions?.includes("setting.read"));

  useEffect(() => {
    setActiveSection(resolveSectionParam(searchParams.get("section")));
  }, [searchParams]);

  const changeSection = (section: SettingsSection | null) => {
    const nextSection = section ?? "overview";
    startTransition(() => {
      setActiveSection(nextSection);
      router.replace(nextSection === "overview" ? "/settings" : `/settings?section=${nextSection}`, { scroll: false });
    });
  };

  const renderContent = () => {
    switch (activeSection) {
      case "overview": return <SettingsDashboard onSelect={changeSection} />;
      case "profile": return <SettingsProfile />;
      case "security": return <SettingsSecurity />;
      case "users": return <SettingsTeam />;
      case "team": return <SettingsTeam />;
      case "building-rooms": return <SettingsBuildingRooms />;
      case "contract-rules": return <SettingsContractRules />;
      case "invoice-rules": return <SettingsInvoiceRules />;
      case "notifications": return <SettingsNotificationAutomation />;
      case "accounting": return <SettingsAccounting />;
      case "templates": return <SettingsTemplates />;
      case "integrations": return <SettingsIntegrations />;
      case "hunonic": return <SettingsHunonicIntegration />;
      case "api": return <SettingsApiKeys />;
      case "owners": return <SettingsOwnerManagement />;
      case "backup":
      case "system-update":
        return (
          <div className="flex flex-col gap-3">
            <SettingsSystemUpdate />
            <SettingsBackup />
          </div>
        );
      case "license": return <SettingsLicense />;
      default: return <SettingsDashboard onSelect={changeSection} />;
    }
  };

  if (!canReadSettings) {
    return (
      <AppShell>
        <div className="mx-auto flex min-h-[60vh] w-full max-w-[720px] items-center justify-center px-[20px]">
          <div className="w-full rounded-[8px] border border-warning/30 bg-card p-[24px] text-center shadow-sm" data-testid="settings-access-denied">
            <Shield size={24} className="mx-auto text-warning" aria-hidden="true" />
            <h1 className="mt-[12px] text-[17px] font-black text-text">Không có quyền truy cập cài đặt</h1>
            <p className="mt-[6px] text-[12px] font-medium leading-[18px] text-muted">Tài khoản cần quyền `setting.read` để xem khu vực này.</p>
            <Button type="button" onClick={() => router.replace("/")} className="mt-[16px] rounded-[8px]">Về tổng quan</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div
        data-testid="settings-page-root"
        className="-m-4 -mt-4 min-h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:min-h-[calc(100dvh-80px)] p-2.5 md:p-3 flex flex-col gap-2.5"
      >
        <SettingsTopTabs activeSection={activeSection} onSelect={changeSection} />

        <div className={`min-w-0 transition-all duration-200 ease-out ${isPending ? "opacity-70 translate-y-[1px]" : "opacity-100 translate-y-0"}`}>
          {renderContent()}
        </div>
      </div>
    </AppShell>
  );
}
