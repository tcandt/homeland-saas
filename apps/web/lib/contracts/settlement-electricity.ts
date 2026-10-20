export function settlementElectricityValues(electricity: any, occupants?: number | null) {
  if (!electricity || electricity.manualRequired) return null;
  const divisor = electricity.isSharedRoom
    ? Math.max(1, occupants ?? electricity.activeOccupants ?? 1)
    : 1;
  const amount = electricity.isSharedRoom
    ? electricity.totalCalculatedAmountVnd ?? electricity.totalRoomAmountVnd
    : electricity.calculatedAmountVnd ?? electricity.monthAmountVnd;
  const kwh = electricity.isSharedRoom ? electricity.totalRoomMonthKwh : electricity.monthKwh;
  if (amount == null || kwh == null || !Number.isFinite(Number(amount)) ||
      !Number.isFinite(Number(kwh)) || Number(amount) < 0 || Number(kwh) < 0) return null;
  return {
    electricityAmount: String(Math.round(Number(amount) / divisor)),
    electricityClosingKwh: String(Math.round(Number(kwh) / divisor * 100) / 100),
  };
}

export function identityDocumentImages(images: unknown): Array<{ url: string; index: number }> {
  if (!Array.isArray(images)) return [];
  return images.map((url, index) => ({ url, index }))
    .filter((entry): entry is { url: string; index: number } =>
      typeof entry.url === 'string' && entry.url.trim() !== '' && entry.url !== 'TEMP_RESIDENCE_DECLARED');
}
