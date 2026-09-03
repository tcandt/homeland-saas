import { z } from 'zod';
import { DepositType, DepositStatus } from '@prisma/client';

export const CreateDepositSchema = z.object({
  code: z.string().optional().nullable(),
  roomId: z.string().min(1, 'Room ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  contractId: z.string().optional().nullable(),
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
});

export const RefundDepositSchema = z.object({
  reason: z.string().min(1, 'Reason is required for refund'),
  receiptStatus: z.enum(['PENDING', 'COMPLETED']).optional(),
  attachmentUrls: z.array(z.string()).optional(),
  refundAmount: z.number().positive().optional(),
});

export const CancelDepositSchema = z.object({
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
