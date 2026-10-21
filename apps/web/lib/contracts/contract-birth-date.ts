export function parseContractBirthDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/);
  const local = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!iso && !local) return null;
  const year = Number(iso ? iso[1] : local![3]);
  const month = Number(iso ? iso[2] : local![2]);
  const day = Number(iso ? iso[3] : local![1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const yyyy = String(year);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  if (`${yyyy}-${mm}-${dd}` > today) return null;
  return { day: dd, month: mm, year: yyyy, display: `${dd}/${mm}/${yyyy}` };
}

export function resolveContractBirthDate(contract: {
  customerId?: string;
  customer?: { id?: string; birthDate?: unknown };
  customerSnapshot?: { id?: string; birthDate?: unknown };
}) {
  if (contract.customerId && contract.customer?.id && contract.customerId !== contract.customer.id) return null;
  const current = contract.customer?.birthDate;
  if (typeof current === 'string' && current.trim()) return parseContractBirthDate(current);
  const customerId = contract.customerId || contract.customer?.id;
  const snapshot = contract.customerSnapshot;
  // A historical identity may only supply the same primary customer's date.
  if (!customerId || snapshot?.id !== customerId) return null;
  return parseContractBirthDate(snapshot.birthDate);
}

export function resolvePreviewBirthDate(contract: Parameters<typeof resolveContractBirthDate>[0] & {
  ngaySinh?: unknown;
  birthDate?: unknown;
}) {
  return parseContractBirthDate(contract.ngaySinh)
    || resolveContractBirthDate(contract)
    || parseContractBirthDate(contract.birthDate);
}
