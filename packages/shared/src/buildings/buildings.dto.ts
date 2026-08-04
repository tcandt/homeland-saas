import { z } from 'zod';

export const CreateBuildingSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  address: z.string().min(1, 'Address is required'),
  notes: z.string().optional(),
  displayOrder: z.coerce.number().int().min(0).optional(),
});

export const UpdateBuildingSchema = CreateBuildingSchema.partial();
export const MoveBuildingSchema = z.object({
  direction: z.enum(['up', 'down']),
});

export type CreateBuildingInput = z.infer<typeof CreateBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof UpdateBuildingSchema>;
export type MoveBuildingInput = z.infer<typeof MoveBuildingSchema>;
