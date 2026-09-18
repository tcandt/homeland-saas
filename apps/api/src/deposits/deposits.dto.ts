import { z } from 'zod';
import { DepositType, DepositStatus } from '@prisma/client';

export const CreateDepositSchema = z.object({
  code: z.string().optional().nullable(),
  roomId: z.string().min(1, 'Room ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  contractId: z.string().optional().nullable(),
  rentalCycleId: z.string().optional().nullable(),
  type: z.nativeEnum(DepositType).default(DepositType.BOOKING),
  status: z.nativeEnum(DepositStatus).optional(),
  amount: z.number().min(0, 'Amount must be positive'),
  expiredAt: z.string().datetime().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const UpdateDepositSchema = z.object({
  type: z.nativeEnum(DepositType).optional(),
  amount: z.number().min(0, 'Amount must be positive').optional(),
  expiredAt: z.string().datetime().optional().nullable(),
  note: z.string().optional().nullable(),
});

export const CollectDepositSchema = z.object({
  note: z.string().optional().nullable(),
  idempotencyKey: z.string().min(8).max(128).optional(),
  holdExpiresAt: z.string().datetime().optional().nullable(),
});

export const ConvertDepositToSecuritySchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  securityRequired: z.number().positive(),
  contractId: z.string().min(1).optional().nullable(),
  securityDepositId: z.string().min(1).optional().nullable(),
  excessAction: z.enum(['CREDIT', 'REFUND']).optional(),
  refundStatus: z.enum(['PENDING', 'COMPLETED']).optional(),
});

export const CoreCancelDepositSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  reason: z.string().trim().min(1),
  refundAmount: z.number().min(0).optional(),
  keepAmount: z.number().min(0).optional(),
  deductAmount: z.number().min(0).optional(),
  refundStatus: z.enum(['PENDING', 'COMPLETED']).optional(),
});

export const CompleteCoreRefundSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const RenewRoomHoldSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  expiresAt: z.string().datetime(),
});

export const TransferRoomHoldSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  targetRoomId: z.string().min(1),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const ReleaseRoomHoldSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  reason: z.string().trim().min(1),
});

export const ExpireRoomHoldsSchema = z.object({
  asOf: z.string().datetime().optional(),
});

export const ReverseDepositLedgerSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  reason: z.string().trim().min(1),
});

export const RefundDepositSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  reason: z.string().min(1, 'Reason is required for refund'),
  receiptStatus: z.enum(['PENDING', 'COMPLETED']).optional(),
  attachmentUrls: z.array(z.string()).optional(),
  refundAmount: z.number().positive().optional(),
});

export const CancelDepositSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).optional(),
  reason: z.string().min(1, 'Reason is required for cancel'),
  resolutionAction: z.enum(['REFUND', 'KEEP', 'DEDUCT']).optional(),
  resolutionAmount: z.number().positive().optional(),
  receiptStatus: z.enum(['PENDING', 'COMPLETED']).optional(),
  attachmentUrls: z.array(z.string()).optional(),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});
