import { z } from 'zod';

export const createReservationSchema = z
  .object({
    propertyId: z.string().uuid('Invalid property ID'),
    roomTypeId: z.string().uuid('Invalid room type ID'),
    guestId: z.string().uuid('Invalid guest ID'),
    unitId: z.string().uuid('Invalid unit ID').optional(),
    source: z.enum([
      'direct',
      'booking_com',
      'expedia',
      'airbnb',
      'phone',
      'walkin',
      'website',
    ]),
    checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)'),
    checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)'),
    adults: z.number().int().min(1, 'At least 1 adult required').max(20),
    children: z.number().int().min(0).max(20).default(0),
    totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
    currency: z.string().length(3).optional(),
    specialRequests: z.string().max(1000).optional().or(z.literal('')),
    internalNotes: z.string().max(1000).optional().or(z.literal('')),
  })
  .refine(
    (data) => new Date(data.checkOutDate) > new Date(data.checkInDate),
    { message: 'Check-out date must be after check-in date', path: ['checkOutDate'] },
  );

export const changeReservationStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']),
  reason: z.string().max(500).optional(),
});

export const assignUnitSchema = z.object({
  reservationId: z.string().uuid(),
  unitId: z.string().uuid(),
});

export const availabilityCheckSchema = z.object({
  roomTypeId: z.string().uuid(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const moveReservationSchema = z.object({
  reservationId: z.string().uuid(),
  unitId: z.string().uuid(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  newTotalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount').optional(),
});

export const unassignRoomSchema = z.object({
  reservationId: z.string().uuid(),
});

export const updateReservationNotesSchema = z.object({
  id: z.string().uuid(),
  internalNotes: z.string().max(2000),
});

export const updateReservationSchema = z
  .object({
    id: z.string().uuid(),
    roomTypeId: z.string().uuid().optional(),
    guestId: z.string().uuid().optional(),
    source: z
      .enum(['direct', 'booking_com', 'expedia', 'airbnb', 'phone', 'walkin', 'website'])
      .optional(),
    checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)').optional(),
    checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)').optional(),
    adults: z.number().int().min(1).max(20).optional(),
    children: z.number().int().min(0).max(20).optional(),
    totalAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount').optional(),
    specialRequests: z.string().max(1000).optional().or(z.literal('')),
    internalNotes: z.string().max(1000).optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      if (data.checkInDate && data.checkOutDate) {
        return new Date(data.checkOutDate) > new Date(data.checkInDate);
      }
      return true;
    },
    { message: 'Check-out date must be after check-in date', path: ['checkOutDate'] },
  );

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type ChangeReservationStatusInput = z.infer<typeof changeReservationStatusSchema>;
export type UpdateReservationNotesInput = z.infer<typeof updateReservationNotesSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
