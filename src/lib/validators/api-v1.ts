import { z } from 'zod';
import { API_PAGE_SIZE_DEFAULT, API_PAGE_SIZE_MAX } from '@/lib/constants/api';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date (YYYY-MM-DD)');

/** Comma-separated list of reservation statuses: `?status=confirmed,checked_in` */
const statusList = z
  .string()
  .transform((value) => value.split(',').map((s) => s.trim()).filter(Boolean))
  .pipe(
    z
      .array(
        z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']),
      )
      .min(1),
  );

/**
 * `?include=a,b` — expand related resources. Each endpoint declares which
 * expansions it understands, so asking a list for something only the detail
 * can give back is a 400 rather than a silently ignored parameter.
 */
function includeParam<T extends readonly [string, ...string[]]>(values: T) {
  return z
    .string()
    .transform((value) => value.split(',').map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)))
    .optional()
    .default([]);
}

export const listReservationsQuerySchema = z
  .object({
    propertyId: z.string().uuid('Invalid property ID').optional(),
    status: statusList.optional(),
    /** RFC 3339 timestamp — return only rows modified at or after this instant. */
    updatedSince: z.iso.datetime({ offset: true }).optional(),
    checkInFrom: isoDate.optional(),
    checkInTo: isoDate.optional(),
    cursor: z.string().min(1).optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(API_PAGE_SIZE_MAX)
      .default(API_PAGE_SIZE_DEFAULT),
    /**
     * `guest` and `unit` only. `folio` is deliberately absent: one folio per
     * reservation times a 200-row page is a query storm, and nothing needs
     * balances in bulk.
     */
    include: includeParam(['guest', 'unit']),
  })
  .refine(
    (data) =>
      !data.checkInFrom || !data.checkInTo || data.checkInTo >= data.checkInFrom,
    { message: 'checkInTo must be on or after checkInFrom', path: ['checkInTo'] },
  );

export type ListReservationsQuery = z.infer<typeof listReservationsQuerySchema>;

export const listRoomTypesQuerySchema = z.object({
  propertyId: z.string().uuid('Invalid property ID').optional(),
});

/** `?include=guest,unit,folio` — expand related resources on a single reservation. */
export const reservationIncludeSchema = z.object({
  include: includeParam(['guest', 'unit', 'folio']),
});

export const lookupReservationQuerySchema = z.object({
  confirmationCode: z.string().trim().min(1).max(30),
  lastName: z.string().trim().min(1).max(100),
});

export const availabilityQuerySchema = z
  .object({
    propertyId: z.string().uuid('Invalid property ID').optional(),
    checkIn: isoDate,
    checkOut: isoDate,
    adults: z.coerce.number().int().min(1).max(20).default(2),
    children: z.coerce.number().int().min(0).max(20).default(0),
  })
  .refine((data) => data.checkOut > data.checkIn, {
    message: 'checkOut must be after checkIn',
    path: ['checkOut'],
  });
