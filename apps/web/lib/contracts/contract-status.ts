export type UIBadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

export interface ContractStatusConfig {
  value: string;
  label: string;
  color: UIBadgeVariant;
  isTerminal: boolean;
  order: number;
}

export const CONTRACT_STATUS_MAP: Record<string, ContractStatusConfig> = {
  DRAFT: { value: 'DRAFT', label: 'Bản nháp', color: 'neutral', isTerminal: false, order: 1 },
  PENDING_APPROVAL: { value: 'PENDING_APPROVAL', label: 'Chờ duyệt', color: 'warning', isTerminal: false, order: 2 },
  APPROVED: { value: 'APPROVED', label: 'Đã duyệt', color: 'primary', isTerminal: false, order: 3 },
  ACTIVE: { value: 'ACTIVE', label: 'Đang hiệu lực', color: 'success', isTerminal: false, order: 4 },
  EXPIRING: { value: 'EXPIRING', label: 'Sắp hết hạn', color: 'warning', isTerminal: false, order: 5 },
  EXPIRED: { value: 'EXPIRED', label: 'Đã hết hạn', color: 'neutral', isTerminal: true, order: 6 },
  TERMINATED: { value: 'TERMINATED', label: 'Đã chấm dứt', color: 'error', isTerminal: true, order: 7 },
  CANCELLED: { value: 'CANCELLED', label: 'Đã hủy', color: 'neutral', isTerminal: true, order: 8 },
  // Legacy

};

export function getContractStatusConfig(status: string | undefined): ContractStatusConfig {
  if (!status) return CONTRACT_STATUS_MAP.DRAFT;
  return CONTRACT_STATUS_MAP[status] || {
    value: status,
    label: status, // fallback
    color: 'neutral',
    isTerminal: false,
    order: 999
  };
}

export const ACTIVE_FILTERS = Object.values(CONTRACT_STATUS_MAP)
  .filter(c => !c.isTerminal)
  .sort((a, b) => a.order - b.order);

export const ALL_FILTERS = Object.values(CONTRACT_STATUS_MAP)
  .sort((a, b) => a.order - b.order);
