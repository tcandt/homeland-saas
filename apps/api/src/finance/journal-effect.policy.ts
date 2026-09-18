/**
 * The reporting surface reads immutable journal effects only.  A reversed
 * entry remains visible for audit and its posted REVERSAL counterpart carries
 * the opposite lines, so the two entries naturally net to zero.
 */
export const AUTHORITATIVE_JOURNAL_STATUSES = ['POSTED', 'REVERSED'];

export function authoritativeJournalLineWhere(
  tenantId: string,
  lineWhere: Record<string, any> = {},
  entryWhere: Record<string, any> = {},
) {
  return {
    tenantId,
    ...lineWhere,
    journalEntry: {
      tenantId,
      status: { in: AUTHORITATIVE_JOURNAL_STATUSES },
      ...entryWhere,
    },
  };
}

/** The single cash/bank account definition shared by ledger report facades. */
export const cashAccountWhere = {
  type: 'ASSET',
  OR: [
    { code: { in: ['1000', '1100'] } },
    { name: { contains: 'Cash', mode: 'insensitive' } },
    { name: { contains: 'Bank', mode: 'insensitive' } },
  ],
};

export function normalBalance(lines: Array<{ type: string; amount: any }>, normalType: 'DEBIT' | 'CREDIT') {
  return lines.reduce(
    (total, line) => total + (line.type === normalType ? 1 : -1) * Number(line.amount || 0),
    0,
  );
}
