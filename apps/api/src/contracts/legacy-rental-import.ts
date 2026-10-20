import { BadRequestException } from '@nestjs/common';

export const LEGACY_OPENING_POLICY = 'LEGACY_OPENING_V1';

export function legacyImportMarker(contract: any) {
  const marker = contract?.termsSnapshot?.legacyImport;
  return marker?.policyVersion === LEGACY_OPENING_POLICY ? marker : null;
}

export function isLegacyBillingCovered(contract: any, period: string): boolean {
  const marker = legacyImportMarker(contract);
  return !!marker && /^\d{4}-\d{2}$/.test(period) &&
    period <= String(marker.paidThrough).slice(0, 7);
}

export function parseLegacyDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('LEGACY_IMPORT_DATE_INVALID');
  }
  return date;
}

export function missingLegacyDocuments(customer: any, attachments: string[]): string[] {
  const approved = Array.isArray(customer?.idImageProvenance)
    ? customer.idImageProvenance.filter((image: any) => image?.status === 'APPROVED' &&
      image.approvedBy && image.url && customer.idImages?.includes(image.url)) : [];
  return [
    ...(!approved.some((image: any) => image.side === 'front') ? ['CCCD_FRONT'] : []),
    ...(!approved.some((image: any) => image.side === 'back') ? ['CCCD_BACK'] : []),
    ...(attachments.length === 0 ? ['CONTRACT_FILE'] : []),
  ];
}
