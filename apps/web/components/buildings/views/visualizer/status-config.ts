import { CheckCircle, Home, DollarSign, Settings, HelpCircle, Calendar, AlertTriangle, ShieldAlert } from "lucide-react";

export const PRIMARY_STATUS_CONFIG = {
  occupied: {
    label: "Đang thuê",
    color: "#10b981", // Emerald green
    solidBg: "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/30",
    textClass: "text-emerald-500",
    Icon: CheckCircle,
  },
  vacant: {
    label: "Phòng trống",
    color: "#64748b", // Slate gray
    solidBg: "bg-slate-500/10 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400",
    border: "border-slate-500/20",
    textClass: "text-slate-500",
    Icon: Home,
  },
  deposited: {
    label: "Đã đặt cọc",
    color: "#0ea5e9", // Cyan
    solidBg: "bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400",
    border: "border-sky-500/30",
    textClass: "text-sky-500",
    Icon: DollarSign,
  },
  maintenance: {
    label: "Bảo trì",
    color: "#d97706", // Amber gold
    solidBg: "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
    border: "border-amber-500/30",
    textClass: "text-amber-600",
    Icon: Settings,
  },
  unknown: {
    label: "Chưa xác định",
    color: "#94a3b8",
    solidBg: "bg-zinc-500/10 text-muted",
    border: "border-zinc-500/20",
    textClass: "text-muted",
    Icon: HelpCircle,
  },
};

export const WARNING_CONFIG = {
  contract_expiring: {
    label: "HĐ sắp hết hạn",
    type: "warning" as const,
    color: "#f97316", // Orange
    bg: "bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/20",
    Icon: Calendar,
  },
  payment_overdue: {
    label: "Quá hạn thanh toán",
    type: "danger" as const,
    color: "#dc2626", // Red
    bg: "bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20",
    Icon: AlertTriangle,
  },
  temp_residence_missing: {
    label: "Thiếu khai báo tạm trú",
    type: "danger" as const,
    color: "#e11d48", // Rose
    bg: "bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20",
    Icon: ShieldAlert,
  },
  historical_debt: {
    label: "Công nợ hợp đồng trước",
    type: "warning" as const,
    color: "#e11d48",
    bg: "bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20",
    Icon: AlertTriangle,
  },
};
