import { z } from 'zod';

export const createHousekeepingTaskSchema = z.object({
  propertyId: z.string().uuid('Invalid property ID'),
  unitId: z.string().uuid('Invalid unit ID'),
  type: z.enum(['checkout_clean', 'stay_over', 'deep_clean', 'inspection'], {
    message: 'Invalid task type',
  }),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assignedTo: z.string().uuid('Invalid user ID').optional(),
  scheduledDate: z.string().date('Invalid date (expected YYYY-MM-DD)'),
  notes: z.string().max(500).optional(),
});

export const updateHousekeepingTaskStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped'], {
    message: 'Invalid task status',
  }),
});

export const assignHousekeepingTaskSchema = z.object({
  id: z.string().uuid(),
  assignedTo: z.string().uuid('Invalid user ID').nullable(),
});

export const updateUnitHousekeepingStatusSchema = z.object({
  unitId: z.string().uuid(),
  housekeepingStatus: z.enum(['dirty', 'cleaning', 'clean', 'inspected'], {
    message: 'Invalid housekeeping status',
  }),
});

export const updateHousekeepingTaskSchema = z.object({
  id: z.string().uuid(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional(),
});

export type CreateHousekeepingTaskInput = z.infer<typeof createHousekeepingTaskSchema>;
export type UpdateHousekeepingTaskStatusInput = z.infer<typeof updateHousekeepingTaskStatusSchema>;
export type AssignHousekeepingTaskInput = z.infer<typeof assignHousekeepingTaskSchema>;
export type UpdateUnitHousekeepingStatusInput = z.infer<typeof updateUnitHousekeepingStatusSchema>;
export type UpdateHousekeepingTaskInput = z.infer<typeof updateHousekeepingTaskSchema>;
