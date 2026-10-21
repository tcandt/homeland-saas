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

export function settlementElectricityIssue(electricity: any): string {
  const messages: Record<string, string> = {
    CURRENT_PERIOD_READING_REQUIRED: 'Chưa có chỉ số công tơ của tháng trả phòng. Hãy đồng bộ lại công tơ phòng.',
    ELECTRICITY_BASELINE_REQUIRED: 'Thiếu chỉ số điện đầu kỳ tại ngày vào ở. Cần bổ sung chỉ số chốt cho đúng thời gian khách ở.',
    BILLED_PERIOD_BASELINE_REQUIRED: 'Kỳ này đã có hóa đơn điện nhưng thiếu chỉ số đã chốt. Cần đối chiếu hóa đơn trước khi thu tiếp.',
    ELECTRICITY_BOUNDARY_INVALID: 'Chỉ số công tơ chưa phù hợp với kỳ ở của khách. Cần kiểm tra ngày và chỉ số chốt.',
    ELECTRICITY_PRICING_REQUIRED: 'Thiếu đơn giá điện hoặc số tiền điện hợp lệ của kỳ trả phòng.',
  };
  return messages[electricity?.manualRequiredReason] || 'Chưa đủ số liệu điện đúng kỳ để tự tính. Nhập điện sử dụng và số tiền cần thu sau khi đối chiếu.';
}
