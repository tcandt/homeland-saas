import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

describe('finance transaction history surface', () => {
  it('exposes both authoritative journal movements and bank/SePay review', () => {
    const page = readFileSync(join(process.cwd(), 'app', 'finance', 'transactions', 'page.tsx'), 'utf8');
    const unified = readFileSync(join(process.cwd(), 'components', 'finance', 'UnifiedTransactionHistory.tsx'), 'utf8');

    expect(page).toContain('Tất cả dòng tiền');
    expect(page).toContain('Ngân hàng / SePay');
    expect(page).toContain('<UnifiedTransactionHistory />');
    expect(page).toContain('<BankTransactionHistory />');
    expect(unified).toContain('useReconciliationQuery');
    expect(unified).toContain('sourceType');
    expect(unified).toContain('cashIn');
    expect(unified).toContain('cashOut');
  });
});
