import { describe, it, expect } from 'vitest';
import { toReservationDto } from './reservation.dto';
import type { reservations } from '@/server/db/schema';

type ReservationRow = typeof reservations.$inferSelect;

/** A row with every column populated, including the ones that must not leak. */
const row: ReservationRow = {
  id: '3f1a2b3c-4d5e-6f70-8192-a3b4c5d6e7f8',
  organizationId: '11111111-1111-1111-1111-111111111111',
  propertyId: '22222222-2222-2222-2222-222222222222',
  confirmationCode: 'HGU-000123',
  guestId: '33333333-3333-3333-3333-333333333333',
  roomTypeId: '44444444-4444-4444-4444-444444444444',
  unitId: '55555555-5555-5555-5555-555555555555',
  status: 'confirmed',
  source: 'direct',
  checkInDate: '2026-09-01',
  checkOutDate: '2026-09-05',
  nights: 4,
  adults: 2,
  children: 1,
  totalAmount: '480.00',
  currency: 'EUR',
  specialRequests: 'Late arrival',
  internalNotes: 'Guest complained last stay — comp breakfast',
  cancelledAt: null,
  cancellationReason: 'Duplicate booking',
  createdAt: new Date('2026-08-01T09:00:00.000Z'),
  updatedAt: new Date('2026-08-20T14:30:00.000Z'),
};

describe('toReservationDto', () => {
  it('exposes exactly the documented fields — no more, no less', () => {
    expect(Object.keys(toReservationDto(row)).sort()).toEqual(
      [
        'adults',
        'cancelledAt',
        'checkInDate',
        'checkOutDate',
        'children',
        'confirmationCode',
        'createdAt',
        'currency',
        'guestId',
        'id',
        'nights',
        'propertyId',
        'roomTypeId',
        'source',
        'specialRequests',
        'status',
        'totalAmount',
        'unitId',
        'updatedAt',
      ].sort(),
    );
  });

  it('never leaks staff-only fields', () => {
    const serialized = JSON.stringify(toReservationDto(row));

    expect(serialized).not.toContain('internalNotes');
    expect(serialized).not.toContain('comp breakfast');
    expect(serialized).not.toContain('cancellationReason');
    expect(serialized).not.toContain('Duplicate booking');
  });

  it('does not expose the tenant id', () => {
    // The caller is already scoped to one organization by its API key; echoing
    // the internal tenant id back adds nothing and widens the surface.
    expect(JSON.stringify(toReservationDto(row))).not.toContain(row.organizationId);
  });

  it('serializes timestamps as RFC 3339 and dates as-is', () => {
    const dto = toReservationDto(row);

    expect(dto.updatedAt).toBe('2026-08-20T14:30:00.000Z');
    expect(dto.createdAt).toBe('2026-08-01T09:00:00.000Z');
    expect(dto.cancelledAt).toBeNull();
    expect(dto.checkInDate).toBe('2026-09-01');
  });

  it('maps a cancellation timestamp when present', () => {
    const cancelled = toReservationDto({
      ...row,
      status: 'cancelled',
      cancelledAt: new Date('2026-08-22T08:00:00.000Z'),
    });

    expect(cancelled.cancelledAt).toBe('2026-08-22T08:00:00.000Z');
  });
});
