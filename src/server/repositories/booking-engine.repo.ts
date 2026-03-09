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

  /** Count available units for a room type in a date range */
  async countAvailableUnits(
    organizationId: string,
    roomTypeId: string,
    checkInDate: string,
    checkOutDate: string,
  ) {
    // Total active units for this room type
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

    // Units blocked by existing reservations
    const blockedResult = await db
      .select({ count: sql<number>`count(DISTINCT ${reservations.unitId})::int` })
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
    const blockedUnits = blockedResult[0]?.count ?? 0;

    // Reservations without assigned unit
    const unassignedResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reservations)
      .where(
        and(
          eq(reservations.organizationId, organizationId),
          eq(reservations.roomTypeId, roomTypeId),
          inArray(reservations.status, ['confirmed', 'checked_in']),
          lt(reservations.checkInDate, checkOutDate),
          gt(reservations.checkOutDate, checkInDate),
          sql`${reservations.unitId} IS NULL`,
        ),
      );
    const unassignedBlocks = unassignedResult[0]?.count ?? 0;

    return {
      totalUnits,
      blockedUnits: blockedUnits + unassignedBlocks,
      availableUnits: Math.max(0, totalUnits - blockedUnits - unassignedBlocks),
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
    const lastNight = new Date(checkOutDate);
    lastNight.setDate(lastNight.getDate() - 1);
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
