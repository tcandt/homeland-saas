export type SePayBankAccountMatchKind =
  | 'MISSING_WEBHOOK_ACCOUNT'
  | 'MISSING_EXPECTED_ACCOUNT'
  | 'EXACT_ACCOUNT'
  | 'SEPAY_VIRTUAL_ACCOUNT'
  | 'MISMATCH';

export function classifySePayWebhookBankAccount(input: {
  expectedAccountNumber?: string | null;
  expectedBankName?: string | null;
  webhookAccountNumbers?: Array<string | null | undefined>;
  webhookBankName?: string | null;
}) {
  const normalizeAccount = (value?: string | null) => String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const normalizeBank = (value?: string | null) => String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const identifiers = Array.from(new Set(
    (input.webhookAccountNumbers || []).map(normalizeAccount).filter(Boolean),
  ));
  if (identifiers.length === 0) return { matches: true, kind: 'MISSING_WEBHOOK_ACCOUNT' as const };

  const expected = normalizeAccount(input.expectedAccountNumber);
  if (!expected) return { matches: true, kind: 'MISSING_EXPECTED_ACCOUNT' as const };

  const expectedLooksLikeVirtualAccount = /^SBSEPAY[A-Z0-9]+$/.test(expected);
  const webhookHasMainAccountNumber = identifiers.some((identifier) => /^\d{1,16}$/.test(identifier));
  if (identifiers.includes(expected)) {
    return {
      matches: true,
      kind: expectedLooksLikeVirtualAccount && webhookHasMainAccountNumber
        ? 'SEPAY_VIRTUAL_ACCOUNT' as const
        : 'EXACT_ACCOUNT' as const,
    };
  }

  const expectedBank = normalizeBank(input.expectedBankName);
  const webhookBank = normalizeBank(input.webhookBankName);
  const sameBank = Boolean(
    expectedBank && webhookBank && (expectedBank.includes(webhookBank) || webhookBank.includes(expectedBank)),
  );
  if (expectedLooksLikeVirtualAccount && webhookHasMainAccountNumber && sameBank) {
    return { matches: true, kind: 'SEPAY_VIRTUAL_ACCOUNT' as const };
  }

  return { matches: false, kind: 'MISMATCH' as const };
}
