import { db } from '@/server/db';
import {
  organizations,
  properties,
  roomTypes,
  ratePlans,
  rates,
  reservations,
  units,
  bookingEngineSettings,
  bookingEngineAddons,
} from '@/server/db/schema';
import { and, eq, gte, lt, gt, lte, asc, desc, inArray, not, sql } from 'drizzle-orm';

export const bookingEngineRepo = {
  /** Resolve organization from URL slug — no orgId filter since this IS how we get it */
  async findOrganizationBySlug(slug: string) {
    return db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    });
  },

  async findActiveProperties(organizationId: string) {
    return db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.organizationId, organizationId),
          eq(properties.isActive, true),
        ),
      )
      .orderBy(asc(properties.name));
  },

  async findPropertyByCode(organizationId: string, code: string) {
    return db.query.properties.findFirst({
      where: and(
        eq(properties.organizationId, organizationId),
        eq(properties.code, code),
        eq(properties.isActive, true),
      ),
    });
  },

  async findActiveRoomTypes(organizationId: string, propertyId: string) {
    return db
      .select()
      .from(roomTypes)
      .where(
        and(
          eq(roomTypes.organizationId, organizationId),
          eq(roomTypes.propertyId, propertyId),
          eq(roomTypes.isActive, true),
        ),
      )
      .orderBy(asc(roomTypes.sortOrder));
  },

  /**
   * Count available units for a room type in a date range.
   *
   * Uses **peak concurrency** instead of distinct-unit counting so that
   * room-type availability is calculated correctly even when reservations
   * could be reshuffled across units of the same type.
   *
   * Algorithm:
   *   1. Count total active units (excluding out-of-order).
   *   2. Fetch all overlapping reservations (confirmed / checked_in).
   *   3. For each night in the range, count how many reservations are active
   *      (checkIn <= night < checkOut).
   *   4. Peak = max nightly count.
   *   5. availableUnits = totalUnits − peak.
   */
  async countAvailableUnits(
    organizationId: string,
    roomTypeId: string,
    checkInDate: string,
    checkOutDate: string,
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
    const overlapping = await db
      .select({
        checkIn: reservations.checkInDate,
        checkOut: reservations.checkOutDate,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.organizationId, organizationId),
          eq(reservations.roomTypeId, roomTypeId),
          inArray(reservations.status, ['confirmed', 'checked_in']),
          lt(reservations.checkInDate, checkOutDate),
          gt(reservations.checkOutDate, checkInDate),
        ),
      );

    if (overlapping.length === 0) {
      return { totalUnits, blockedUnits: 0, availableUnits: totalUnits };
    }

    // 3. Calculate peak concurrency across all nights in the requested range
    //    A reservation occupies a night when: reservationCheckIn <= night < reservationCheckOut
    let peakConcurrency = 0;
    const startNight = new Date(checkInDate + 'T00:00:00Z');
    const endNight = new Date(checkOutDate + 'T00:00:00Z'); // exclusive (checkout day)

    for (
      let night = new Date(startNight);
      night < endNight;
      night.setUTCDate(night.getUTCDate() + 1)
    ) {
      const nightStr = night.toISOString().split('T')[0]!;
      let count = 0;
      for (const res of overlapping) {
        // Reservation is active on this night if checkIn <= night < checkOut
        if (res.checkIn <= nightStr && nightStr < res.checkOut) {
          count++;
        }
      }
      if (count > peakConcurrency) {
        peakConcurrency = count;
      }
    }

    // 4. Available = total − peak
    const blockedUnits = peakConcurrency;
    return {
      totalUnits,
      blockedUnits,
      availableUnits: Math.max(0, totalUnits - blockedUnits),
    };
  },

  /** Find active rate plans for a property, ordered by priority */
  async findActiveRatePlans(organizationId: string, propertyId: string) {
    return db
      .select()
      .from(ratePlans)
      .where(
        and(
          eq(ratePlans.organizationId, organizationId),
          eq(ratePlans.propertyId, propertyId),
          eq(ratePlans.isActive, true),
        ),
      )
      .orderBy(desc(ratePlans.priority));
  },

  /** Find rates for a room type under a specific rate plan for a date range */
  async findRatesForRoomType(
    organizationId: string,
    ratePlanId: string,
    roomTypeId: string,
    checkInDate: string,
    checkOutDate: string,
  ) {
    // Rates cover check-in through the night before check-out
    // So we need dates from checkIn to checkOut - 1 day
    // Use UTC to avoid DST issues with toISOString()
    const lastNight = new Date(checkOutDate + 'T00:00:00Z');
    lastNight.setUTCDate(lastNight.getUTCDate() - 1);
    const lastNightStr = lastNight.toISOString().split('T')[0]!;

    return db
      .select()
      .from(rates)
      .where(
        and(
          eq(rates.organizationId, organizationId),
          eq(rates.ratePlanId, ratePlanId),
          eq(rates.roomTypeId, roomTypeId),
          gte(rates.date, checkInDate),
          lte(rates.date, lastNightStr),
        ),
      )
      .orderBy(asc(rates.date));
  },

  async findActiveAddons(organizationId: string, propertyId: string) {
    return db
      .select()
      .from(bookingEngineAddons)
      .where(
        and(
          eq(bookingEngineAddons.organizationId, organizationId),
          eq(bookingEngineAddons.propertyId, propertyId),
          eq(bookingEngineAddons.isActive, true),
        ),
      )
      .orderBy(asc(bookingEngineAddons.sortOrder));
  },

  async findSettings(organizationId: string, propertyId: string) {
    return db.query.bookingEngineSettings.findFirst({
      where: and(
        eq(bookingEngineSettings.organizationId, organizationId),
        eq(bookingEngineSettings.propertyId, propertyId),
      ),
    });
  },
};
