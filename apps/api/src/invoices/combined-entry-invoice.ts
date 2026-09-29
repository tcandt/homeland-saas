import { ConflictException } from "@nestjs/common";

export const COMBINED_ENTRY_POLICY = "BOOKING_ENTRY_COMBINED_V1";
export const ENTRY_SECURITY_PERIOD = "ENTRY_SECURITY:";
export const ENTRY_TRANSFER_PERIOD = "ENTRY_BOOKING_TRANSFER:";

export function getCombinedEntryInvoice(contract: any) {
  const entry = contract?.termsSnapshot?.initialEntryInvoice ||
    contract?.termsSnapshot?.convertedFromBookingHold?.initialEntryInvoice;
  return entry?.paymentPolicyVersion === COMBINED_ENTRY_POLICY ? entry : null;
}

export function assertCombinedEntryInvoice(invoice: any, contract: any, entry: any) {
  const conversion = contract?.termsSnapshot?.convertedFromBookingHold?.bookingDepositConversion;
  const amounts = [entry.rentAmount, entry.securityRequired, entry.transferredAmount, entry.additionalCashRequired, entry.amount];
  if (
    amounts.some((value) => !Number.isSafeInteger(value) || value < 0) ||
    !entry.securityDepositId ||
    entry.additionalCashRequired !== entry.securityRequired - entry.transferredAmount ||
    entry.amount !== entry.rentAmount + entry.additionalCashRequired ||
    invoice.id !== entry.invoiceId || invoice.billingKind !== "ENTRY" ||
    invoice.tenantId !== contract.tenantId || invoice.contractId !== contract.id ||
    invoice.customerId !== contract.customerId || invoice.rentalCycleId !== contract.rentalCycleId ||
    Number(invoice.total) !== entry.amount || Number(invoice.discount || 0) !== 0
  ) throw new ConflictException("COMBINED_ENTRY_INVOICE_SCOPE_CONFLICT");
  if (conversion) {
    if (
      !entry.sourceDepositId ||
      entry.securityDepositId !== conversion.securityDepositId ||
      entry.sourceDepositId !== conversion.sourceDepositId ||
      entry.securityRequired !== Number(conversion.securityRequired) ||
      entry.transferredAmount !== Number(conversion.transferAmount) ||
      entry.additionalCashRequired !== Number(conversion.additionalCashRequired)
    ) throw new ConflictException("COMBINED_ENTRY_INVOICE_SCOPE_CONFLICT");
  } else if (entry.sourceDepositId || entry.transferredAmount !== 0 || entry.additionalCashRequired !== entry.securityRequired) {
    throw new ConflictException("COMBINED_ENTRY_INVOICE_SCOPE_CONFLICT");
  }

  const expected = [
    { type: "RENT", amount: entry.rentAmount },
    { type: "OTHER", amount: entry.securityRequired, servicePeriod: `${ENTRY_SECURITY_PERIOD}${entry.securityDepositId}` },
    ...(entry.transferredAmount > 0 ? [{ type: "DISCOUNT", amount: -entry.transferredAmount, servicePeriod: `${ENTRY_TRANSFER_PERIOD}${entry.sourceDepositId}` }] : []),
  ];
  const items = invoice.items || [];
  if (items.length !== expected.length || expected.some((item) =>
    items.filter((row: any) => row.type === item.type && Number(row.amount) === item.amount &&
      (!item.servicePeriod || row.servicePeriod === item.servicePeriod)).length !== 1,
  )) throw new ConflictException("COMBINED_ENTRY_INVOICE_ITEMS_CONFLICT");
}
