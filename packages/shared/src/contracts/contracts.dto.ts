import { z } from 'zod';

export const ContractStatusEnum = z.enum(['ACTIVE', 'EXPIRED', 'TERMINATED']);

export const CreateContractSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  roomId: z.string().min(1, 'Room ID is required'),
  contractCode: z.string().optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  rentAmount: z.number().min(0),
  depositAmount: z.number().min(0),
  status: ContractStatusEnum.default('ACTIVE'),
  notes: z.string().optional().nullable(),
});

export const UpdateContractSchema = CreateContractSchema.partial();

export type CreateContractInput = z.infer<typeof CreateContractSchema>;
export type UpdateContractInput = z.infer<typeof UpdateContractSchema>;
