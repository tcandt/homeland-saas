export type SalesLeadRecord = {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email?: string | null;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export const SALES_STAGE_ALIASES: Record<string, string> = {
  lead: 'NEW',
  new: 'NEW',
  contacted: 'CONTACTED',
  consulting: 'QUALIFIED',
  qualified: 'QUALIFIED',
  viewing: 'PROPOSAL',
  proposal: 'PROPOSAL',
  negotiating: 'PROPOSAL',
  deposit: 'WON',
  won: 'WON',
  lost: 'LOST',
};

export const SALES_STAGE_LABELS: Record<string, string> = {
  NEW: 'Mới nhận',
  CONTACTED: 'Đã liên hệ',
  QUALIFIED: 'Đủ điều kiện',
  PROPOSAL: 'Đề xuất',
  WON: 'Thành công',
  LOST: 'Thất bại',
};

export function normalizeSalesStage(stage?: string | null) {
  if (!stage) return null;
  return SALES_STAGE_ALIASES[stage.toLowerCase()] || stage.toUpperCase();
}

export function getSalesStageLabel(status?: string | null) {
  if (!status) return 'Không xác định';
  return SALES_STAGE_LABELS[status.toUpperCase()] || status;
}

export function formatSalesDate(value?: string | Date | null) {
  if (!value) return 'Chưa cập nhật';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
