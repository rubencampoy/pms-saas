import { z } from 'zod';

export const createUnitSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  roomTypeId: z.string().uuid('Invalid room type ID'),
  name: z.string().min(1, 'Room name/number is required').max(50),
  floor: z.string().max(10).optional().or(z.literal('')),
  status: z.enum(['available', 'maintenance', 'out_of_order']).optional(),
  housekeepingStatus: z.enum(['dirty', 'cleaning', 'clean', 'inspected']).optional(),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export const updateUnitSchema = z.object({
  id: z.string().uuid(),
  roomTypeId: z.string().uuid('Invalid room type ID').optional(),
  name: z.string().min(1, 'Room name/number is required').max(50).optional(),
  floor: z.string().max(10).optional().or(z.literal('')),
  status: z.enum(['available', 'maintenance', 'out_of_order']).optional(),
  housekeepingStatus: z.enum(['dirty', 'cleaning', 'clean', 'inspected']).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
});

export type CreateUnitInput = z.infer<typeof createUnitSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
