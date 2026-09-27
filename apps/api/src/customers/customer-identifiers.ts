export function normalizeCustomerPhone(phone?: string | null): string {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

export function normalizeCustomerIdentityNo(identityNo?: string | null): string {
  if (!identityNo) return '';
  return String(identityNo)
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .toUpperCase();
}
