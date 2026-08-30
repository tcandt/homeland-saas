import { z } from 'zod';

export const InvoiceStatusEnum = z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED']);

export const CreateInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  roomId: z.string().min(1, 'Room ID is required'),
  contractId: z.string().min(1, 'Contract ID is required'),
  period: z.string().min(1, 'Period is required (e.g. YYYY-MM)'),
  dueDate: z.string().or(z.date()),
  totalAmount: z.number().min(0),
  paidAmount: z.number().min(0).default(0),
  status: InvoiceStatusEnum.default('UNPAID'),
  notes: z.string().optional().nullable(),
  items: z.array(z.any()).optional(),
});

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial();

export type CreateInvoiceInput = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof UpdateInvoiceSchema>;
