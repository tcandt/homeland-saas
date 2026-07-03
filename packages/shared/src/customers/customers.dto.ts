import { z } from 'zod';

export const CustomerStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

export const CreateCustomerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional().nullable(),
  citizenId: z.string().optional().nullable(),
  status: CustomerStatusEnum.default('ACTIVE'),
  notes: z.string().optional().nullable(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
