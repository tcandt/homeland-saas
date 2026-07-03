import { z } from 'zod';

export const CreateFloorSchema = z.object({
  buildingId: z.string().min(1, 'Building ID is required'),
  name: z.string().min(1, 'Name is required'),
  level: z.number().int(),
  notes: z.string().optional(),
});

export const UpdateFloorSchema = CreateFloorSchema.partial();

export type CreateFloorInput = z.infer<typeof CreateFloorSchema>;
export type UpdateFloorInput = z.infer<typeof UpdateFloorSchema>;
