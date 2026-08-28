import { describe, it, expect } from 'vitest';
import {
  listReservationsQuerySchema,
  reservationIncludeSchema,
} from './api-v1';

describe('listReservationsQuerySchema — include', () => {
  it('defaults to no expansions', () => {
    const parsed = listReservationsQuerySchema.parse({});
    expect(parsed.include).toEqual([]);
  });

  it('accepts guest and unit, trimming whitespace and empty entries', () => {
    const parsed = listReservationsQuerySchema.parse({
      include: ' guest , ,unit ',
    });
    expect(parsed.include).toEqual(['guest', 'unit']);
  });

  it('rejects folio, which only the detail endpoint expands', () => {
    const parsed = listReservationsQuerySchema.safeParse({ include: 'folio' });
    expect(parsed.success).toBe(false);
  });

  it('rejects an unknown expansion rather than ignoring it', () => {
    expect(
      listReservationsQuerySchema.safeParse({ include: 'guest,payments' }).success,
    ).toBe(false);
  });
});

describe('reservationIncludeSchema', () => {
  it('accepts every expansion the detail endpoint supports', () => {
    const parsed = reservationIncludeSchema.parse({ include: 'guest,unit,folio' });
    expect(parsed.include).toEqual(['guest', 'unit', 'folio']);
  });

  it('defaults to no expansions', () => {
    expect(reservationIncludeSchema.parse({}).include).toEqual([]);
  });
});
