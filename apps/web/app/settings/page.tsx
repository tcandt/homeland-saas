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
import SettingsAuditLogs from "@/components/settings/sections/SettingsAuditLogs";
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
  | "backup"
  | "audit"
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
        id: "team",
        domain: "organization",
        title: "Thành viên & Phân quyền",
        description: "Người dùng nội bộ, vai trò và quyền truy cập hệ thống.",
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
        description: "Nhắc nợ, nhắc hết hạn hợp đồng và thông báo hệ thống.",
        keywords: ["thong bao", "nhac no", "automation", "zalo", "email"],
        icon: <Bell size={17} />,
      },
      {
        id: "templates",
        domain: "operations",
        title: "Biểu mẫu",
        description: "Mẫu hợp đồng, hóa đơn, thông báo và tài liệu vận hành.",
        keywords: ["bieu mau", "template", "hop dong", "hoa don", "document"],
        icon: <ClipboardList size={17} />,
      },
    ],
  },
  {
    id: "finance",
    title: "Tài chính & Hóa đơn",
    description: "Kế toán, tài khoản nhận tiền và đối soát.",
    icon: <WalletCards size={18} />,
    items: [
      {
        id: "accounting",
        domain: "finance",
        title: "Kế toán & hạch toán",
        description: "Hệ thống tài khoản, danh mục hạch toán và mapping.",
        keywords: ["ke toan", "hach toan", "mapping", "doanh thu", "chi phi"],
        icon: <BookOpen size={17} />,
      },
      {
        id: "owners",
        domain: "finance",
        title: "Tài khoản ngân hàng",
        description: "Tài khoản nhận tiền và QR thanh toán dùng trên hóa đơn.",
        keywords: ["ngan hang", "tai khoan", "qr", "thanh toan", "vietqr"],
        icon: <WalletCards size={17} />,
      },
      {
        id: "integrations",
        domain: "finance",
        title: "Đối soát thanh toán",
        description: "Kết nối SePay, ngân hàng và webhook giao dịch.",
        keywords: ["sepay", "doi soat", "webhook", "giao dich", "mbbank"],
        icon: <Plug size={17} />,
      },
    ],
  },
  {
    id: "integrations",
    title: "Tích hợp",
    description: "Dịch vụ thanh toán, tin nhắn, IoT và developer.",
    icon: <Plug size={18} />,
    items: [
      {
        id: "integrations",
        domain: "integrations",
        title: "Tích hợp dịch vụ",
        description: "SePay, Zalo, Email, Telegram và các kết nối tenant.",
        keywords: ["integration", "sepay", "zalo", "email", "telegram", "smtp"],
        icon: <Link2 size={17} />,
      },
      {
        id: "hunonic",
        domain: "integrations",
        title: "Hunonic",
        description: "Công tơ điện, IoT và dữ liệu tiêu thụ.",
        keywords: ["hunonic", "dien", "iot", "cong to", "meter", "gia dien"],
        icon: <PlugZap size={17} />,
      },
      {
        id: "api",
        domain: "integrations",
        title: "API & Webhook",
        description: "API key, webhook và tích hợp dành cho developer.",
        keywords: ["api", "webhook", "developer", "key", "token"],
        icon: <Webhook size={17} />,
      },
    ],
  },
  {
    id: "system",
    title: "Hệ thống",
    description: "Bảo mật, nhật ký, sao lưu và dữ liệu hệ thống.",
    icon: <SlidersHorizontal size={18} />,
    items: [
      {
        id: "security",
        domain: "system",
        title: "Bảo mật tài khoản",
        description: "Mật khẩu, 2FA, phiên đăng nhập và bảo mật tài khoản.",
        keywords: ["bao mat", "security", "password", "2fa", "session"],
        icon: <Shield size={17} />,
      },
      {
        id: "backup",
        domain: "system",
        title: "Sao lưu dữ liệu",
        description: "Lịch sao lưu tự động và quản lý phiên bản dữ liệu.",
        keywords: ["backup", "sao luu", "restore", "phuc hoi", "du lieu"],
        icon: <Cloud size={17} />,
      },
      {
        id: "system-update",
        domain: "system",
        title: "Cập nhật hệ thống",
        description: "Kiểm tra version mới, xác nhận cập nhật và rollback có kiểm soát.",
        keywords: ["update", "cap nhat", "version", "rollback", "release", "git"],
        icon: <RefreshCcw size={17} />,
      },
      {
        id: "audit",
        domain: "system",
        title: "Nhật ký hệ thống",
        description: "Audit log, hoạt động người dùng và thay đổi quan trọng.",
        keywords: ["audit", "log", "nhat ky", "hoat dong", "history"],
        icon: <ClipboardList size={17} />,
      },
      {
        id: "license",
        domain: "system",
        title: "Đăng ký bảo trì",
        description: "Gói dịch vụ, quota và dữ liệu bảo trì phần mềm.",
        keywords: ["license", "billing", "bao tri", "goi dich vu", "quota"],
        icon: <Wrench size={17} />,
      },
    ],
  },
];

const accountItems: SettingsItem[] = [
  {
    id: "profile",
    domain: "account",
    title: "Hồ sơ của tôi",
    description: "Thông tin cá nhân của tài khoản đang đăng nhập.",
    keywords: ["profile", "ho so", "ca nhan", "avatar"],
    icon: <User size={17} />,
  },
  {
    id: "security",
    domain: "account",
    title: "Bảo mật & đăng nhập",
    description: "Mật khẩu, 2FA và phiên đăng nhập cá nhân.",
    keywords: ["password", "mat khau", "2fa", "session", "dang nhap"],
    icon: <Shield size={17} />,
  },
];

const settingsItems = [...settingsGroups.flatMap((group) => group.items), ...accountItems];

const topTabs: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Tổng quan", icon: <Settings2 size={16} /> },
  { id: "security", label: "Bảo mật", icon: <Shield size={16} /> },
  { id: "notifications", label: "Thông báo", icon: <Bell size={16} /> },
  { id: "integrations", label: "Tích hợp", icon: <Plug size={16} /> },
  { id: "audit", label: "Nhật ký hệ thống", icon: <ClipboardList size={16} /> },
  { id: "license", label: "Đăng ký & bảo trì", icon: <Wrench size={16} /> },
  { id: "backup", label: "Sao lưu & khôi phục", icon: <Database size={16} /> },
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
  return settingsItems.find((item) => item.id === section)?.title ?? "Cài đặt";
}

function resolveSectionParam(section: string | null): SettingsSection | null {
  if (!section || section === "overview" || section === "reports") return "overview";
  if (settingsItems.some((item) => item.id === section)) return section as SettingsSection;
  return "overview";
}

function SettingsCard({ item, onSelect }: { item: SettingsItem; onSelect: (section: SettingsSection) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="group flex min-h-[104px] w-full items-start gap-[12px] rounded-[10px] border border-border bg-card p-[14px] text-left shadow-sm transition hover:-translate-y-[1px] hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
    >
      <span className="mt-[2px] flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
        {item.icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-black leading-[18px] text-text">{item.title}</span>
        <span className="mt-[6px] block text-[12px] font-medium leading-[18px] text-muted">{item.description}</span>
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
      className="group flex min-h-[134px] flex-col items-start justify-between rounded-[12px] border border-border bg-card p-[16px] text-left shadow-sm transition hover:-translate-y-[1px] hover:border-primary/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30"
    >
      <div className="flex items-start gap-[14px]">
        <span className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[14px] ${toneClass}`}>{icon}</span>
        <span className="min-w-0">
          <span className="block text-[14px] font-black leading-[20px] text-text">{title}</span>
          <span className="mt-[7px] block text-[13px] font-medium leading-[20px] text-muted">{description}</span>
        </span>
      </div>
      <span className="ml-[60px] mt-[14px] text-[12px] font-black text-primary transition group-hover:translate-x-[2px]">
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
      <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] ${warning ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"}`}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-black text-text">{name}</div>
        <div className="mt-[2px] text-[12px] font-medium text-muted">{desc}</div>
      </div>
      <div className={`hidden items-center gap-[7px] text-[12px] font-bold sm:flex ${warning ? "text-warning" : "text-success"}`}>
        <span className={`h-[6px] w-[6px] rounded-full ${warning ? "bg-warning" : "bg-success"}`} />
        {status}
      </div>
      <Button variant="outline" className="h-[34px] rounded-[8px] px-[12px] text-[12px]" onClick={onSelect}>
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
    <div className="flex items-center gap-[12px] border-b border-border/70 px-[12px] py-[12px] last:border-b-0">
      <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] ${toneClass}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-black text-text">{title}</div>
        <div className="mt-[2px] text-[12px] font-medium text-muted">{desc}</div>
      </div>
      <div className="hidden min-w-[150px] text-right md:block">
        <div className="text-[12px] font-black text-text">{actor}</div>
        <div className="mt-[2px] text-[12px] font-medium text-muted">{time}</div>
      </div>
    </div>
  );
}

function SearchResults({ query, onSelect }: { query: string; onSelect: (section: SettingsSection) => void }) {
  const filteredItems = useMemo(() => {
    const term = normalize(query.trim());
    if (!term) return [];
    return settingsItems.filter((item) => {
      const haystack = normalize([item.title, item.description, ...item.keywords].join(" "));
      return haystack.includes(term);
    });
  }, [query]);

  if (!query.trim()) return null;

  return (
    <section className="rounded-[14px] border border-border bg-card p-[16px] shadow-sm">
      <div className="mb-[12px] text-[14px] font-black text-text">Kết quả tìm kiếm</div>
      <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.length ? (
          filteredItems.map((item) => <SettingsCard key={`${item.domain}-${item.id}-${item.title}`} item={item} onSelect={onSelect} />)
        ) : (
          <div className="rounded-[10px] border border-dashed border-border bg-background p-[18px] text-[13px] font-semibold text-muted md:col-span-2 xl:col-span-3">
            Không tìm thấy cài đặt phù hợp.
          </div>
        )}
      </div>
    </section>
  );
}

function SettingsDashboard({ onSelect }: { onSelect: (section: SettingsSection) => void }) {
  const [query, setQuery] = useState("");
  const owners = useSettingsSectionQuery<Record<string, unknown>>("owners", "TENANT");
  const team = useSettingsSectionQuery<Record<string, unknown>>("team", "TENANT");
  const invoiceRules = useSettingsSectionQuery<Record<string, unknown>>("invoice-rules", "TENANT");
  const email = useSettingsSectionQuery<Record<string, unknown>>("email-provider", "TENANT");
  const sepay = useSettingsSectionQuery<Record<string, unknown>>("sepay", "TENANT");
  const zalo = useSettingsSectionQuery<Record<string, unknown>>("zalo-provider", "TENANT");
  const hunonic = useSettingsSectionQuery<Record<string, unknown>>("hunonic", "TENANT");
  const audit = useSWR(["settings-dashboard-audit"], () => auditApi.logs({ limit: 5 }), { revalidateOnFocus: false });
  const auditRows = Array.isArray(audit.data) ? audit.data : [];

  const healthItems = [
    { label: "Chủ sở hữu", configured: hasValue(owners.data?.value) },
    { label: "Thành viên & phân quyền", configured: hasValue(team.data?.value) },
    { label: "Quy tắc hóa đơn", configured: hasValue(invoiceRules.data?.value) },
    { label: "Email SMTP", configured: hasValue(email.data?.value) },
    { label: "SePay webhook", configured: hasValue(sepay.data?.value) },
    { label: "Zalo OA", configured: hasValue(zalo.data?.value) },
  ];
  const configuredCount = healthItems.filter((item) => item.configured).length;

  return (
    <div className="flex flex-col gap-[18px]">
      <section className="rounded-[14px] border border-border bg-card p-[18px] shadow-sm">
        <div className="mb-[16px] flex flex-col gap-[4px]">
          <h2 className="text-[18px] font-black text-text">Thiết lập nhanh</h2>
          <p className="text-[13px] font-medium text-muted">Truy cập nhanh các cài đặt quan trọng thường dùng</p>
        </div>
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 xl:grid-cols-4">
          <QuickSetupCard icon={<RefreshCcw size={22} />} title="Cập nhật hệ thống" description="Kiểm tra version mới, chạy cập nhật và rollback có kiểm soát" tone="blue" onSelect={() => onSelect("system-update")} />
          <QuickSetupCard icon={<Shield size={22} />} title="Bảo mật tài khoản" description="Quản lý mật khẩu, 2FA, phiên đăng nhập và bảo mật tài khoản" tone="primary" onSelect={() => onSelect("security")} />
          <QuickSetupCard icon={<Bell size={22} />} title="Thông báo tự động" description="Thiết lập nhắc nợ, nhắc hết hạn hợp đồng và thông báo hệ thống" tone="orange" onSelect={() => onSelect("notifications")} />
          <QuickSetupCard icon={<Link2 size={22} />} title="Tích hợp dịch vụ" description="Kết nối ngân hàng, SePay, Zalo, Email, Hunonic và dịch vụ khác" tone="green" onSelect={() => onSelect("integrations")} />
          <QuickSetupCard icon={<ReceiptText size={22} />} title="Thiết lập hóa đơn" description="Cấu hình mẫu hóa đơn, ký hiệu, số hóa đơn và quy tắc tạo hóa đơn" tone="blue" onSelect={() => onSelect("invoice-rules")} />
          <QuickSetupCard icon={<FileKey2 size={22} />} title="Quy tắc hợp đồng" description="Thiết lập tiền cọc, gia hạn, điều khoản và phụ lục hợp đồng" tone="primary" onSelect={() => onSelect("contract-rules")} />
          <QuickSetupCard icon={<BookOpen size={22} />} title="Kế toán & hạch toán" description="Quản lý hệ thống tài khoản, danh mục hạch toán và mapping" tone="blue" onSelect={() => onSelect("accounting")} />
          <QuickSetupCard icon={<Cloud size={22} />} title="Sao lưu dữ liệu" description="Thiết lập lịch sao lưu tự động và quản lý phiên bản dữ liệu" tone="green" onSelect={() => onSelect("backup")} />
          <QuickSetupCard icon={<Wrench size={22} />} title="Đăng ký bảo trì" description="Quản lý lịch bảo trì hệ thống, thiết bị và nhà cung cấp" tone="orange" onSelect={() => onSelect("license")} />
        </div>
      </section>

      <SearchResults query={query} onSelect={onSelect} />

      <section className="grid grid-cols-1 gap-[16px] xl:grid-cols-[0.95fr_1.45fr]">
        <div className="rounded-[14px] border border-border bg-card p-[18px] shadow-sm">
          <div className="mb-[14px]">
            <h3 className="text-[17px] font-black text-text">Trạng thái hệ thống</h3>
            <p className="mt-[4px] text-[13px] font-medium text-muted">Tình trạng các dịch vụ và kết nối quan trọng</p>
          </div>
          <div>
            <ServiceRow icon={<WalletCards size={17} />} name="SePay" desc="Thanh toán" status={hasValue(sepay.data?.value) ? "Đã cấu hình" : "Chưa cấu hình"} warning={!hasValue(sepay.data?.value)} onSelect={() => onSelect("integrations")} />
            <ServiceRow icon={<Bell size={17} />} name="Zalo OA" desc="Gửi thông báo" status={hasValue(zalo.data?.value) ? "Đã cấu hình" : "Chưa cấu hình"} warning={!hasValue(zalo.data?.value)} onSelect={() => onSelect("integrations")} />
            <ServiceRow icon={<ReceiptText size={17} />} name="Email SMTP" desc="Gửi email" status={hasValue(email.data?.value) ? "Đã cấu hình" : "Chưa cấu hình"} warning={!hasValue(email.data?.value)} onSelect={() => onSelect("integrations")} />
            <ServiceRow icon={<PlugZap size={17} />} name="Hunonic" desc="Điện & IoT" status={hasValue(hunonic.data?.value) ? "Đã cấu hình" : "Chưa cấu hình"} warning={!hasValue(hunonic.data?.value)} onSelect={() => onSelect("hunonic")} />
            <ServiceRow icon={<Server size={17} />} name="API hệ thống" desc="Kết nối audit" status={audit.isLoading ? "Đang kiểm tra" : audit.error ? "Không kết nối" : "Đã kết nối"} warning={Boolean(audit.error)} onSelect={() => onSelect("audit")} />
          </div>
          <button type="button" onClick={() => onSelect("overview")} className="mt-[12px] w-full text-center text-[13px] font-black text-primary">
            Xem tất cả trạng thái hệ thống -&gt;
          </button>
        </div>

        <div className="rounded-[14px] border border-border bg-card p-[18px] shadow-sm">
          <div className="mb-[14px] flex items-center justify-between gap-[12px]">
            <div>
              <h3 className="text-[17px] font-black text-text">Nhật ký hoạt động gần đây</h3>
              <p className="mt-[4px] text-[13px] font-medium text-muted">Dữ liệu audit mới nhất từ hệ thống</p>
            </div>
            <Button variant="outline" className="h-[36px] rounded-[8px] px-[14px] text-[12px]" onClick={() => onSelect("audit")}>
              Xem tất cả
            </Button>
          </div>
          <div className="overflow-hidden rounded-[12px] border border-border">
            {audit.isLoading && <div className="px-[14px] py-[28px] text-center text-[13px] font-semibold text-muted">Đang tải nhật ký...</div>}
            {!audit.isLoading && audit.error && <div className="px-[14px] py-[28px] text-center text-[13px] font-semibold text-rose-600">Không tải được nhật ký hoạt động.</div>}
            {!audit.isLoading && !audit.error && auditRows.length === 0 && <div className="px-[14px] py-[28px] text-center text-[13px] font-semibold text-muted">Chưa có nhật ký hoạt động.</div>}
            {auditRows.map((log) => (
              <ActivityRow
                key={log.id}
                icon={<ClipboardList size={16} />}
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

      <section className="rounded-[14px] border border-border bg-card p-[18px] shadow-sm">
        <div className="mb-[12px] flex flex-col gap-[8px] md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-[17px] font-black text-text">Tra cứu cài đặt</h3>
            <p className="mt-[4px] text-[13px] font-medium text-muted">{configuredCount}/{healthItems.length} cấu hình nền tảng đang có dữ liệu.</p>
          </div>
          <div className="relative">
            <Search size={18} className="absolute left-[14px] top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm kiếm cài đặt..."
              className="h-[42px] w-full rounded-[10px] border border-border bg-background pl-[42px] pr-[14px] text-[14px] font-semibold text-text outline-none transition focus:border-primary md:w-[320px]"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2 xl:grid-cols-4">
          {settingsGroups.slice(0, 4).map((group) => (
            <div key={group.id} className="rounded-[10px] border border-border bg-background p-[14px]">
              <div className="flex items-center gap-[10px]">
                <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">{group.icon}</span>
                <div className="font-black text-text">{group.title}</div>
              </div>
              <p className="mt-[8px] text-[12px] font-medium leading-[18px] text-muted">{group.description}</p>
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
    <div className="sticky top-[80px] z-20 -mx-[16px] overflow-x-auto border-b border-border bg-background/95 px-[16px] backdrop-blur sm:-mx-[24px] sm:px-[24px] lg:-mx-[32px] lg:px-[32px]">
      <div className="flex min-w-max items-center gap-[22px]">
        {topTabs.map((tab, index) => {
          const isActive = active === tab.id || (active === "overview" && index === 0);
          return (
            <button
              key={`${tab.id}-${tab.label}`}
              type="button"
              onClick={() => onSelect(tab.id)}
              className={`relative flex h-[64px] items-center gap-[9px] px-[4px] text-[14px] font-black transition ${
                isActive ? "text-primary" : "text-muted hover:text-text"
              }`}
            >
              {tab.icon}
              {tab.label}
              {isActive && <span className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full bg-primary" />}
            </button>
          );
        })}
      </div>
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
      case "backup": return <SettingsBackup />;
      case "system-update": return <SettingsSystemUpdate />;
      case "audit": return <SettingsAuditLogs />;
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
      <div className="flex w-full max-w-none flex-col gap-[20px] px-[16px] pb-[120px] sm:px-[24px] sm:pb-[96px] lg:px-[32px]">
        <SettingsTopTabs activeSection={activeSection} onSelect={changeSection} />

        <div className={`min-w-0 transition-all duration-200 ease-out ${isPending ? "opacity-70 translate-y-[1px]" : "opacity-100 translate-y-0"}`}>
          {renderContent()}
        </div>
      </div>
    </AppShell>
  );
}
