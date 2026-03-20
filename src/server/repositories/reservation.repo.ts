import { db } from '@/server/db';
import { reservations, units } from '@/server/db/schema';
import { and, eq, gt, gte, lt, or, ilike, inArray, asc, desc, sql, not } from 'drizzle-orm';

export const reservationRepo = {
  async findAll(
    organizationId: string,
    options?: {
      propertyId?: string;
      status?: string[];
      limit?: number;
      offset?: number;
    },
  ) {
    const conditions = [eq(reservations.organizationId, organizationId)];

    if (options?.propertyId) {
      conditions.push(eq(reservations.propertyId, options.propertyId));
    }
    if (options?.status && options.status.length > 0) {
      conditions.push(inArray(reservations.status, options.status));
    }

    return db
      .select()
      .from(reservations)
      .where(and(...conditions))
      .orderBy(desc(reservations.checkInDate))
      .limit(options?.limit ?? 50)
      .offset(options?.offset ?? 0);
  },

  async findById(organizationId: string, id: string) {
    return db.query.reservations.findFirst({
      where: and(
        eq(reservations.organizationId, organizationId),
        eq(reservations.id, id),
      ),
    });
  },

  async findByConfirmationCode(organizationId: string, code: string) {
    return db.query.reservations.findFirst({
      where: and(
        eq(reservations.organizationId, organizationId),
        eq(reservations.confirmationCode, code),
      ),
    });
  },

  async search(organizationId: string, query: string) {
    const searchTerm = `%${query}%`;
    return db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.organizationId, organizationId),
          or(
            ilike(reservations.confirmationCode, searchTerm),
            ilike(reservations.specialRequests, searchTerm),
            ilike(reservations.internalNotes, searchTerm),
          ),
        ),
      )
      .orderBy(desc(reservations.checkInDate))
      .limit(50);
  },

  async findByGuest(organizationId: string, guestId: string) {
    return db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.organizationId, organizationId),
          eq(reservations.guestId, guestId),
        ),
      )
      .orderBy(desc(reservations.checkInDate))
      .limit(50);
  },

  /** Find reservations overlapping a date range for a property (for calendar view) */
  async findByDateRange(
    organizationId: string,
    propertyId: string,
    startDate: string,
    endDate: string,
  ) {
    return db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.organizationId, organizationId),
          eq(reservations.propertyId, propertyId),
          lt(reservations.checkInDate, endDate),
          gte(reservations.checkOutDate, startDate),
          not(eq(reservations.status, 'cancelled')),
          not(eq(reservations.status, 'no_show')),
        ),
      )
      .orderBy(asc(reservations.checkInDate));
  },

  /**
   * Check how many units of a room type are available for a date range.
   *
   * Uses **peak concurrency** so that room-type availability accounts for
   * the possibility of reshuffling unit assignments (room Tetris).
   */
  async countAvailableUnits(
    organizationId: string,
    roomTypeId: string,
    checkInDate: string,
    checkOutDate: string,
    excludeReservationId?: string,
  ) {
    // 1. Total active units for this room type
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(units)
      .where(
        and(
          eq(units.organizationId, organizationId),
          eq(units.roomTypeId, roomTypeId),
          eq(units.isActive, true),
          not(eq(units.status, 'out_of_order')),
        ),
      );
    const totalUnits = totalResult[0]?.count ?? 0;

    // 2. Fetch all overlapping reservations (both assigned & unassigned)
    const overlapConditions = [
      eq(reservations.organizationId, organizationId),
      eq(reservations.roomTypeId, roomTypeId),
      inArray(reservations.status, ['confirmed', 'checked_in']),
      lt(reservations.checkInDate, checkOutDate),
      gt(reservations.checkOutDate, checkInDate),
    ];

    if (excludeReservationId) {
      overlapConditions.push(not(eq(reservations.id, excludeReservationId)));
    }

    const overlapping = await db
      .select({
        checkIn: reservations.checkInDate,
        checkOut: reservations.checkOutDate,
      })
      .from(reservations)
      .where(and(...overlapConditions));

    if (overlapping.length === 0) {
      return { totalUnits, blockedUnits: 0, availableUnits: totalUnits };
    }

    // 3. Calculate peak concurrency across all nights in the requested range
    let peakConcurrency = 0;
    const startNight = new Date(checkInDate + 'T00:00:00Z');
    const endNight = new Date(checkOutDate + 'T00:00:00Z');

    for (
      let night = new Date(startNight);
      night < endNight;
      night.setUTCDate(night.getUTCDate() + 1)
    ) {
      const nightStr = night.toISOString().split('T')[0]!;
      let count = 0;
      for (const res of overlapping) {
        if (res.checkIn <= nightStr && nightStr < res.checkOut) {
          count++;
        }
      }
      if (count > peakConcurrency) {
        peakConcurrency = count;
      }
    }

    // 4. Available = total − peak
    return {
      totalUnits,
      blockedUnits: peakConcurrency,
      availableUnits: Math.max(0, totalUnits - peakConcurrency),
    };
  },

  /** Find available units of a room type for a date range */
  async findAvailableUnits(
    organizationId: string,
    roomTypeId: string,
    checkInDate: string,
    checkOutDate: string,
  ) {
    // Overlap: existing.checkIn < newCheckOut AND existing.checkOut > newCheckIn
    // Uses strict gt (>) because checkout day is not an occupied night —
    // a guest checking out on Oct 25 does not block a check-in on Oct 25.
    const blockedUnitIds = db
      .select({ id: reservations.unitId })
      .from(reservations)
      .where(
        and(
          eq(reservations.organizationId, organizationId),
          eq(reservations.roomTypeId, roomTypeId),
          inArray(reservations.status, ['confirmed', 'checked_in']),
          lt(reservations.checkInDate, checkOutDate),
          gt(reservations.checkOutDate, checkInDate),
          sql`${reservations.unitId} IS NOT NULL`,
        ),
      );

    return db
      .select()
      .from(units)
      .where(
        and(
          eq(units.organizationId, organizationId),
          eq(units.roomTypeId, roomTypeId),
          eq(units.isActive, true),
          not(eq(units.status, 'out_of_order')),
          not(inArray(units.id, blockedUnitIds)),
        ),
      )
      .orderBy(asc(units.sortOrder));
  },

  /** Find available units excluding a specific reservation (for moves) */
  async findAvailableUnitsExcluding(
    organizationId: string,
    roomTypeId: string,
    checkInDate: string,
    checkOutDate: string,
    excludeReservationId: string,
  ) {
    // Same strict gt (>) overlap logic — checkout day allows same-day check-in
    const blockedUnitIds = db
      .select({ id: reservations.unitId })
      .from(reservations)
      .where(
        and(
          eq(reservations.organizationId, organizationId),
          eq(reservations.roomTypeId, roomTypeId),
          inArray(reservations.status, ['confirmed', 'checked_in']),
          lt(reservations.checkInDate, checkOutDate),
          gt(reservations.checkOutDate, checkInDate),
          sql`${reservations.unitId} IS NOT NULL`,
          not(eq(reservations.id, excludeReservationId)),
        ),
      );

    return db
      .select()
      .from(units)
      .where(
        and(
          eq(units.organizationId, organizationId),
          eq(units.roomTypeId, roomTypeId),
          eq(units.isActive, true),
          not(eq(units.status, 'out_of_order')),
          not(inArray(units.id, blockedUnitIds)),
        ),
      )
      .orderBy(asc(units.sortOrder));
  },

  async getNextConfirmationNumber(organizationId: string, propertyCode: string) {
    const year = new Date().getFullYear();
    const prefix = `${propertyCode}-${year}-`;

    const lastRes = await db
      .select({ confirmationCode: reservations.confirmationCode })
      .from(reservations)
      .where(
        and(
          eq(reservations.organizationId, organizationId),
          sql`${reservations.confirmationCode} LIKE ${prefix + '%'}`,
        ),
      )
      .orderBy(desc(reservations.confirmationCode))
      .limit(1);

    if (lastRes.length === 0 || !lastRes[0]) {
      return `${prefix}00001`;
    }

    const lastNum = parseInt(lastRes[0].confirmationCode.replace(prefix, ''), 10);
    return `${prefix}${String(lastNum + 1).padStart(5, '0')}`;
  },

  async create(
    organizationId: string,
    data: {
      propertyId: string;
      confirmationCode: string;
      guestId: string;
      roomTypeId: string;
      unitId?: string;
      status?: string;
      source: string;
      checkInDate: string;
      checkOutDate: string;
      nights: number;
      adults: number;
      children: number;
      totalAmount: string;
      currency?: string;
      specialRequests?: string;
      internalNotes?: string;
    },
  ) {
    const [reservation] = await db
      .insert(reservations)
      .values({ organizationId, ...data })
      .returning();
    return reservation!;
  },

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      unitId: string | null;
      roomTypeId: string;
      guestId: string;
      status: string;
      source: string;
      checkInDate: string;
      checkOutDate: string;
      nights: number;
      adults: number;
      children: number;
      totalAmount: string;
      specialRequests: string;
      internalNotes: string;
      cancelledAt: Date;
      cancellationReason: string;
    }>,
  ) {
    const [reservation] = await db
      .update(reservations)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(reservations.organizationId, organizationId),
          eq(reservations.id, id),
        ),
      )
      .returning();
    return reservation;
  },

  async count(
    organizationId: string,
    options?: { propertyId?: string; status?: string[] },
  ) {
    const conditions = [eq(reservations.organizationId, organizationId)];
    if (options?.propertyId) {
      conditions.push(eq(reservations.propertyId, options.propertyId));
    }
    if (options?.status && options.status.length > 0) {
      conditions.push(inArray(reservations.status, options.status));
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reservations)
      .where(and(...conditions));
    return result?.count ?? 0;
  },
};
