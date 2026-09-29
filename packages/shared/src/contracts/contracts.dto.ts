import { z } from 'zod';

export const ContractStatusEnum = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'ACTIVE',
  'EXPIRING',

  'EXPIRED',
  'TERMINATED',
  'CANCELLED'
]);

export const CreateContractSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  roomId: z.string().min(1, 'Room ID is required'),
  contractCode: z.string().optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  signedAt: z.string().or(z.date()).optional().nullable(),
  firstPaymentDate: z.string().or(z.date()).optional().nullable(),
  purpose: z.string().optional().nullable(),
  rentAmount: z.number().min(0),
  depositAmount: z.number().min(0),
  memberCount: z.number().int().min(1).optional(),
  status: ContractStatusEnum.default('DRAFT'),
  notes: z.string().optional().nullable(),
  attachments: z.array(z.string()).optional(),
  coRepresentativeIds: z.array(z.string()).optional(),
});

export const UpdateContractSchema = CreateContractSchema.partial();

/** A renewal is a new contract version, never an update to the source. */
export const RenewContractSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  rentAmount: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
  memberCount: z.number().int().min(1).optional(),
  firstPaymentDate: z.string().or(z.date()).optional().nullable(),
  purpose: z.string().max(2000).optional().nullable(),
  coRepresentativeIds: z.array(z.string().min(1)).optional(),
});

/**
 * A booking hold conversion creates the new rental draft and transfers the
 * booking deposit in the same command.  Any excess must be explicitly
 * classified; there is deliberately no silent CREDIT/REFUND default.
 */
export const ConvertBookingHoldSchema = RenewContractSchema.extend({
  /** Required only when the source hold is missing/expired and conversion explicitly recovers it. */
  holdExpiresAt: z.string().or(z.date()).optional().nullable(),
  securityDepositId: z.string().min(1).optional().nullable(),
  excessAction: z.enum(['CREDIT', 'REFUND']).optional(),
  refundStatus: z.enum(['PENDING', 'COMPLETED']).optional(),
  refundAttachmentUrls: z.array(z.string().trim().min(1).max(2048)).max(10).optional(),
});

/** Explicitly issue or recover the canonical pre-move-in ENTRY invoice. */
export const PrepareImmediateEntryBillingSchema = z.object({});

export const ContractSettlementInputSchema = z.object({
  actualMoveOutDate: z.string().or(z.date()),
  roomTurnoverStatus: z.enum(['AVAILABLE', 'CLEANING', 'MAINTENANCE']).optional(),
  rentDaysCharged: z.number().min(0).max(31).optional(),
  baseRentAmount: z.number().min(0).optional(),
  electricityAmount: z.number().min(0).optional(),
  electricityClosingKwh: z.number().min(0).optional(),
  waterAmount: z.number().min(0).optional(),
  waterPreviousReading: z.number().min(0).optional(),
  waterCurrentReading: z.number().min(0).optional(),
  waterUsage: z.number().min(0).optional(),
  waterUnitPrice: z.number().min(0).optional(),
  serviceAmount: z.number().min(0).optional(),
  damageFee: z.number().min(0).optional(),
  penaltyFee: z.number().min(0).optional(),
  otherChargeAmount: z.number().min(0).optional(),
  roomRefundAmount: z.number().min(0).optional(),
  waterSupportAmount: z.number().min(0).optional(),
  otherCreditAmount: z.number().min(0).optional(),
  depositToRefund: z.number().min(0).optional(),
  depositToDeduct: z.number().min(0).optional(),
  refundReceiptStatus: z.enum(['PENDING', 'COMPLETED']).optional(),
  refundReason: z.string().max(1000).optional().nullable(),
  refundAttachmentUrls: z.array(z.string()).optional(),
  note: z.string().max(2000).optional().nullable(),
});

export const ContractSettlementRefundCompletionSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  note: z.string().trim().max(2000).optional(),
  attachmentUrls: z.array(z.string().trim().min(1).max(2048)).max(10).optional(),
});

export const MoveOutOccupantInputSchema = ContractSettlementInputSchema.partial().extend({
  roomId: z.string().min(1, 'Room ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  contractId: z.string().min(1).optional().nullable(),
  reason: z.string().max(1000).optional().nullable(),
});

/** Adds a secondary occupant to an already active whole-room contract. */
export const AddWholeRoomOccupantSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  moveInAt: z.string().or(z.date()),
  relationship: z.string().trim().max(200).optional().nullable(),
});

/** A transfer always names both the source contract/cycle and the target room. */
export const TransferOccupantInputSchema = z.object({
  contractId: z.string().min(1, 'Contract ID is required'),
  rentalCycleId: z.string().min(1, 'Rental cycle ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  sourceRoomId: z.string().min(1, 'Source room ID is required'),
  targetRoomId: z.string().min(1, 'Target room ID is required'),
  transferAt: z.string().or(z.date()),
  reason: z.string().max(1000).optional().nullable(),
});

export type CreateContractInput = z.infer<typeof CreateContractSchema>;
export type UpdateContractInput = z.infer<typeof UpdateContractSchema>;
export type RenewContractInput = z.infer<typeof RenewContractSchema>;
export type ConvertBookingHoldInput = z.infer<typeof ConvertBookingHoldSchema>;
export type PrepareImmediateEntryBillingInput = z.infer<typeof PrepareImmediateEntryBillingSchema>;
export type ContractSettlementInput = z.infer<typeof ContractSettlementInputSchema>;
export type ContractSettlementRefundCompletionInput = z.infer<
  typeof ContractSettlementRefundCompletionSchema
>;
export type MoveOutOccupantInput = z.infer<typeof MoveOutOccupantInputSchema>;
export type AddWholeRoomOccupantInput = z.infer<typeof AddWholeRoomOccupantSchema>;
export type TransferOccupantInput = z.infer<typeof TransferOccupantInputSchema>;
