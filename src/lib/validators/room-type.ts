import { z } from 'zod';

export const createRoomTypeSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  name: z.string().min(1, 'Room type name is required').max(255),
  code: z.string().min(1, 'Room type code is required').max(10),
  description: z.string().max(2000).optional().or(z.literal('')),
  baseOccupancy: z.number().int().min(1, 'Base occupancy must be at least 1').max(50),
  maxOccupancy: z.number().int().min(1, 'Max occupancy must be at least 1').max(50),
  amenities: z.array(z.string()).optional(),
  sortOrder: z.number().int().min(0).optional(),
}).refine(
  (data) => data.maxOccupancy >= data.baseOccupancy,
  { message: 'Max occupancy must be >= base occupancy', path: ['maxOccupancy'] },
);

export const updateRoomTypeSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid('Invalid property ID').optional(),
  name: z.string().min(1, 'Room type name is required').max(255).optional(),
  code: z.string().min(1, 'Room type code is required').max(10).optional(),
  description: z.string().max(2000).optional().or(z.literal('')),
  baseOccupancy: z.number().int().min(1).max(50).optional(),
  maxOccupancy: z.number().int().min(1).max(50).optional(),
  amenities: z.array(z.string()).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>;
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>;
