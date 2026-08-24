import { z } from 'zod';

export const CustomerStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);

export const CreateCustomerSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional().nullable(),
  citizenId: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  nationality: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  zaloChatId: z.string().optional().nullable(),
  zaloUserId: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  roomId: z.string().optional().nullable(),
  relationship: z.string().optional().nullable(),
  status: CustomerStatusEnum.default('ACTIVE'),
  notes: z.string().optional().nullable(),
  idImages: z.array(z.string()).optional(),
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
