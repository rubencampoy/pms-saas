import type { reservations } from '@/server/db/schema';

type ReservationRow = typeof reservations.$inferSelect;

/**
 * The public shape of a reservation.
 *
 * Fields are listed explicitly and mapped by hand — never spread a Drizzle row
 * into an API response. Deliberately withheld from external consumers:
 *
 *   - `internalNotes`       staff-only free text
 *   - `cancellationReason`  staff-only free text
 *
 * `api-contract.test.ts` fails if this list ever drifts from the mapper.
 */
export interface ReservationDto {
  id: string;
  confirmationCode: string;
  propertyId: string;
  guestId: string;
  roomTypeId: string;
  unitId: string | null;
  status: string;
  source: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  totalAmount: string;
  currency: string;
  specialRequests: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toReservationDto(row: ReservationRow): ReservationDto {
  return {
    id: row.id,
    confirmationCode: row.confirmationCode,
    propertyId: row.propertyId,
    guestId: row.guestId,
    roomTypeId: row.roomTypeId,
    unitId: row.unitId,
    status: row.status,
    source: row.source,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    nights: row.nights,
    adults: row.adults,
    children: row.children,
    totalAmount: row.totalAmount,
    currency: row.currency,
    specialRequests: row.specialRequests,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
