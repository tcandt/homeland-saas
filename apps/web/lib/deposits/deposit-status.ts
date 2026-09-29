import type { UI_Deposit } from '../adapters/deposit.adapter';

export function getDepositStatusLabel(deposit: Pick<UI_Deposit, 'status' | 'type' | 'contractStatus'>): string {
  const isSecurity = deposit.type === 'SECURITY';
  switch (deposit.status) {
    case 'DRAFT': return 'Bản nháp';
    case 'PENDING': return isSecurity ? 'Chờ thu cọc hợp đồng' : 'Chờ thu cọc giữ phòng';
    case 'PAID':
      return isSecurity
        ? ['ACTIVE', 'EXPIRING'].includes(deposit.contractStatus || '')
          ? 'HĐ có hiệu lực'
          : 'Đã thu cọc hợp đồng'
        : 'Đã thu cọc giữ phòng';
    case 'CONVERTED_TO_CONTRACT': return 'Đã chuyển đổi';
    case 'REFUNDED': return 'Đã hoàn cọc';
    case 'CANCELLED': return 'Đã hủy / Phạt';
    default: return deposit.status;
  }
}
