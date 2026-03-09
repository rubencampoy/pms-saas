import { z } from 'zod';

export const createRoomBlockSchema = z
  .object({
    propertyId: z.string().uuid('Invalid property ID'),
    unitId: z.string().uuid('Invalid unit ID'),
    type: z.enum(['maintenance', 'blocked']),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)'),
    reason: z.string().max(500).optional().or(z.literal('')),
  })
  .refine(
    (data) => new Date(data.endDate) > new Date(data.startDate),
    { message: 'End date must be after start date', path: ['endDate'] },
  );

export const updateRoomBlockSchema = z
  .object({
    id: z.string().uuid('Invalid block ID'),
    type: z.enum(['maintenance', 'blocked']),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)'),
    reason: z.string().max(500).optional().or(z.literal('')),
  })
  .refine(
    (data) => new Date(data.endDate) > new Date(data.startDate),
    { message: 'End date must be after start date', path: ['endDate'] },
  );

export const deleteRoomBlockSchema = z.object({
  id: z.string().uuid('Invalid block ID'),
});

export type CreateRoomBlockInput = z.infer<typeof createRoomBlockSchema>;
export type UpdateRoomBlockInput = z.infer<typeof updateRoomBlockSchema>;
export type DeleteRoomBlockInput = z.infer<typeof deleteRoomBlockSchema>;
