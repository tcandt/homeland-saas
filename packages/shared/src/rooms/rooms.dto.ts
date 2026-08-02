import { z } from 'zod';

export const RoomStatusEnum = z.enum(['AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE', 'CLEANING', 'INACTIVE']);
export const RoomTypeEnum = z.enum(['STUDIO', 'ONE_BED', 'TWO_BED', 'THREE_BED', 'SHOP', 'OFFICE']);

export const CreateRoomSchema = z.object({
  buildingId: z.string().min(1, 'Building ID is required'),
  floorId: z.string().min(1, 'Floor ID is required'),
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  capacity: z.number().int().min(1).optional(),
  area: z.number().min(0).optional(),
  monthlyPrice: z.number().min(0),
});

export const UpdateRoomSchema = CreateRoomSchema.extend({
  status: RoomStatusEnum.optional(),
}).partial();

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;
export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;
