import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

describe('finance transaction history surface', () => {
  it('exposes both authoritative journal movements and bank/SePay review', () => {
    const workspace = readFileSync(join(process.cwd(), 'components', 'finance', 'FinanceTransactionsWorkspace.tsx'), 'utf8');
    const unified = readFileSync(join(process.cwd(), 'components', 'finance', 'UnifiedTransactionHistory.tsx'), 'utf8');
    const bank = readFileSync(join(process.cwd(), 'components', 'finance', 'BankTransactionHistory.tsx'), 'utf8');

    expect(workspace).toContain('Tất cả dòng tiền');
    expect(workspace).toContain('Ngân hàng');
    expect(workspace).toContain('Đối soát');
    expect(workspace).toContain('<UnifiedTransactionHistory />');
    expect(workspace).toContain('<BankTransactionHistory />');
    expect(unified).toContain('useReconciliationQuery');
    expect(unified).toContain('sourceType');
    expect(unified).toContain('cashIn');
    expect(unified).toContain('cashOut');
    expect(unified).toContain('unified-transaction-detail-modal');
    expect(bank).toContain('bank-transaction-detail-modal');
  });
});
