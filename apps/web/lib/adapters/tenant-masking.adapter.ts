export function maskPhone(phone?: string | null): string {
  if (!phone) return "";
  const cleaned = phone.trim();
  if (cleaned.length <= 6) return cleaned;
  return `${cleaned.slice(0, 3)}****${cleaned.slice(-3)}`;
}

export function maskCccd(cccd?: string | null): string {
  if (!cccd) return "";
  const cleaned = cccd.trim();
  if (cleaned.length <= 6) return cleaned;
  return `${cleaned.slice(0, 3)}******${cleaned.slice(-3)}`;
}
