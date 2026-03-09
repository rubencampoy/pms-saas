import { db } from '@/server/db';
import { reservations, units, folios, folioLineItems, guests, housekeepingTasks } from '@/server/db/schema';
import { and, eq, sql, gte, lte, inArray, count } from 'drizzle-orm';

export const dashboardRepo = {
  /**
   * Today's KPI snapshot: occupancy, ADR, RevPAR
   */
  async getOccupancyKpis(organizationId: string, date: string, propertyId?: string) {
    // Total active rooms
    const unitConditions = [
      eq(units.organizationId, organizationId),
      eq(units.isActive, true),
    ];
    if (propertyId) unitConditions.push(eq(units.propertyId, propertyId));

    const [totalRoomsResult] = await db
      .select({ count: count() })
      .from(units)
      .where(and(...unitConditions));

    const totalRooms = totalRoomsResult?.count ?? 0;

    // Occupied rooms (checked_in reservations whose stay covers today)
    const resConditions = [
      eq(reservations.organizationId, organizationId),
      eq(reservations.status, 'checked_in'),
      lte(reservations.checkInDate, date),
      gte(reservations.checkOutDate, date),
    ];
    if (propertyId) resConditions.push(eq(reservations.propertyId, propertyId));

    const [occupiedResult] = await db
      .select({ count: count() })
      .from(reservations)
      .where(and(...resConditions));

    const occupiedRooms = occupiedResult?.count ?? 0;

    // Room revenue for today (line items of type room_charge on this date)
    // folioLineItems don't have propertyId, so join through folios → reservations if property filter is needed
    let roomRevenue = 0;
    if (propertyId) {
      const [revenueResult] = await db
        .select({
          revenue: sql<string>`COALESCE(SUM(${folioLineItems.amount}), 0)::numeric(10,2)`,
        })
        .from(folioLineItems)
        .innerJoin(folios, eq(folios.id, folioLineItems.folioId))
        .innerJoin(reservations, eq(reservations.id, folios.reservationId))
        .where(
          and(
            eq(folioLineItems.organizationId, organizationId),
            eq(folioLineItems.type, 'room_charge'),
            eq(folioLineItems.date, date),
            eq(reservations.propertyId, propertyId),
          ),
        );
      roomRevenue = parseFloat(revenueResult?.revenue ?? '0');
    } else {
      const [revenueResult] = await db
        .select({
          revenue: sql<string>`COALESCE(SUM(${folioLineItems.amount}), 0)::numeric(10,2)`,
        })
        .from(folioLineItems)
        .where(
          and(
            eq(folioLineItems.organizationId, organizationId),
            eq(folioLineItems.type, 'room_charge'),
            eq(folioLineItems.date, date),
          ),
        );
      roomRevenue = parseFloat(revenueResult?.revenue ?? '0');
    }

    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;
    const adr = occupiedRooms > 0 ? roomRevenue / occupiedRooms : 0;
    const revpar = totalRooms > 0 ? roomRevenue / totalRooms : 0;

    return {
      totalRooms,
      occupiedRooms,
      occupancyRate: Math.round(occupancyRate * 10) / 10,
      roomRevenue,
      adr: Math.round(adr * 100) / 100,
      revpar: Math.round(revpar * 100) / 100,
    };
  },

  /**
   * Today's arrivals & departures count
   */
  async getMovements(organizationId: string, date: string, propertyId?: string) {
    const baseConditions = [eq(reservations.organizationId, organizationId)];
    if (propertyId) baseConditions.push(eq(reservations.propertyId, propertyId));

    const [arrivalsResult] = await db
      .select({ count: count() })
      .from(reservations)
      .where(
        and(
          ...baseConditions,
          eq(reservations.checkInDate, date),
          inArray(reservations.status, ['confirmed', 'checked_in']),
        ),
      );

    const [departuresResult] = await db
      .select({ count: count() })
      .from(reservations)
      .where(
        and(
          ...baseConditions,
          eq(reservations.checkOutDate, date),
          inArray(reservations.status, ['checked_in', 'checked_out']),
        ),
      );

    const [inHouseResult] = await db
      .select({ count: count() })
      .from(reservations)
      .where(
        and(
          ...baseConditions,
          eq(reservations.status, 'checked_in'),
        ),
      );

    return {
      arrivals: arrivalsResult?.count ?? 0,
      departures: departuresResult?.count ?? 0,
      inHouse: inHouseResult?.count ?? 0,
    };
  },

  /**
   * Revenue breakdown by charge type for a date range
   */
  async getRevenueByType(organizationId: string, startDate: string, endDate: string, propertyId?: string) {
    if (propertyId) {
      return db
        .select({
          type: folioLineItems.type,
          total: sql<string>`SUM(${folioLineItems.amount})::numeric(10,2)`,
        })
        .from(folioLineItems)
        .innerJoin(folios, eq(folios.id, folioLineItems.folioId))
        .innerJoin(reservations, eq(reservations.id, folios.reservationId))
        .where(
          and(
            eq(folioLineItems.organizationId, organizationId),
            gte(folioLineItems.date, startDate),
            lte(folioLineItems.date, endDate),
            eq(reservations.propertyId, propertyId),
          ),
        )
        .groupBy(folioLineItems.type);
    }

    return db
      .select({
        type: folioLineItems.type,
        total: sql<string>`SUM(${folioLineItems.amount})::numeric(10,2)`,
      })
      .from(folioLineItems)
      .where(
        and(
          eq(folioLineItems.organizationId, organizationId),
          gte(folioLineItems.date, startDate),
          lte(folioLineItems.date, endDate),
        ),
      )
      .groupBy(folioLineItems.type);
  },

  /**
   * Daily occupancy for a date range (for chart)
   */
  async getDailyOccupancy(
    organizationId: string,
    startDate: string,
    endDate: string,
    totalRooms: number,
    propertyId?: string,
  ) {
    const joinConditions = [
      eq(reservations.organizationId, organizationId),
      inArray(reservations.status, ['checked_in', 'checked_out']),
      lte(reservations.checkInDate, sql`d::date`),
      gte(reservations.checkOutDate, sql`d::date`),
    ];
    if (propertyId) joinConditions.push(eq(reservations.propertyId, propertyId));

    const rows = await db
      .select({
        date: sql<string>`d::date`,
        occupied: sql<number>`COUNT(DISTINCT ${reservations.id})`,
      })
      .from(
        sql`generate_series(${startDate}::date, ${endDate}::date, '1 day'::interval) AS d`,
      )
      .leftJoin(
        reservations,
        and(...joinConditions),
      )
      .groupBy(sql`d::date`)
      .orderBy(sql`d::date`);

    return rows.map((r) => ({
      date: String(r.date),
      occupied: Number(r.occupied),
      total: totalRooms,
      rate: totalRooms > 0 ? Math.round((Number(r.occupied) / totalRooms) * 1000) / 10 : 0,
    }));
  },

  /**
   * Daily revenue for a date range (for chart)
   */
  async getDailyRevenue(organizationId: string, startDate: string, endDate: string, propertyId?: string) {
    if (propertyId) {
      const rows = await db
        .select({
          date: sql<string>`d::date`,
          revenue: sql<string>`COALESCE(SUM(${folioLineItems.amount}), 0)::numeric(10,2)`,
        })
        .from(
          sql`generate_series(${startDate}::date, ${endDate}::date, '1 day'::interval) AS d`,
        )
        .leftJoin(
          folioLineItems,
          and(
            eq(folioLineItems.organizationId, organizationId),
            eq(folioLineItems.date, sql`d::date`),
          ),
        )
        .leftJoin(folios, eq(folios.id, folioLineItems.folioId))
        .leftJoin(reservations, eq(reservations.id, folios.reservationId))
        .where(
          sql`${reservations.propertyId} = ${propertyId} OR ${reservations.id} IS NULL`,
        )
        .groupBy(sql`d::date`)
        .orderBy(sql`d::date`);

      return rows.map((r) => ({
        date: String(r.date),
        revenue: parseFloat(r.revenue),
      }));
    }

    const rows = await db
      .select({
        date: sql<string>`d::date`,
        revenue: sql<string>`COALESCE(SUM(${folioLineItems.amount}), 0)::numeric(10,2)`,
      })
      .from(
        sql`generate_series(${startDate}::date, ${endDate}::date, '1 day'::interval) AS d`,
      )
      .leftJoin(
        folioLineItems,
        and(
          eq(folioLineItems.organizationId, organizationId),
          eq(folioLineItems.date, sql`d::date`),
        ),
      )
      .groupBy(sql`d::date`)
      .orderBy(sql`d::date`);

    return rows.map((r) => ({
      date: String(r.date),
      revenue: parseFloat(r.revenue),
    }));
  },

  /**
   * Reservation status breakdown (for donut/summary)
   */
  async getReservationStatusCounts(organizationId: string, propertyId?: string) {
    const conditions = [eq(reservations.organizationId, organizationId)];
    if (propertyId) conditions.push(eq(reservations.propertyId, propertyId));

    return db
      .select({
        status: reservations.status,
        count: count(),
      })
      .from(reservations)
      .where(and(...conditions))
      .groupBy(reservations.status);
  },

  /**
   * Revenue by booking source
   */
  async getRevenueBySource(organizationId: string, startDate: string, endDate: string, propertyId?: string) {
    const conditions = [
      eq(reservations.organizationId, organizationId),
      gte(reservations.checkInDate, startDate),
      lte(reservations.checkInDate, endDate),
      inArray(reservations.status, ['confirmed', 'checked_in', 'checked_out']),
    ];
    if (propertyId) conditions.push(eq(reservations.propertyId, propertyId));

    return db
      .select({
        source: reservations.source,
        total: sql<string>`COALESCE(SUM(${reservations.totalAmount}), 0)::numeric(10,2)`,
        count: count(),
      })
      .from(reservations)
      .where(and(...conditions))
      .groupBy(reservations.source);
  },

  /**
   * Top nationalities (for guest report)
   */
  async getTopNationalities(organizationId: string, limit: number = 10) {
    return db
      .select({
        nationality: guests.nationality,
        count: count(),
      })
      .from(guests)
      .where(
        and(
          eq(guests.organizationId, organizationId),
          sql`${guests.nationality} IS NOT NULL`,
        ),
      )
      .groupBy(guests.nationality)
      .orderBy(sql`count(*) DESC`)
      .limit(limit);
  },

  /**
   * Housekeeping tasks summary for today
   */
  async getHousekeepingSummary(organizationId: string, date: string, propertyId?: string) {
    const conditions = [
      eq(housekeepingTasks.organizationId, organizationId),
      eq(housekeepingTasks.scheduledDate, date),
    ];
    if (propertyId) conditions.push(eq(housekeepingTasks.propertyId, propertyId));

    const rows = await db
      .select({
        status: housekeepingTasks.status,
        count: count(),
      })
      .from(housekeepingTasks)
      .where(and(...conditions))
      .groupBy(housekeepingTasks.status);

    const map: Record<string, number> = {};
    for (const r of rows) {
      map[r.status] = r.count;
    }

    return {
      pending: map['pending'] ?? 0,
      inProgress: map['in_progress'] ?? 0,
      completed: map['completed'] ?? 0,
      skipped: map['skipped'] ?? 0,
      total: rows.reduce((sum, r) => sum + r.count, 0),
    };
  },

  /**
   * Outstanding folio balances
   */
  async getOutstandingBalance(organizationId: string, propertyId?: string) {
    if (propertyId) {
      const [result] = await db
        .select({
          totalBalance: sql<string>`COALESCE(SUM(${folios.balance}), 0)::numeric(10,2)`,
          count: count(),
        })
        .from(folios)
        .innerJoin(reservations, eq(reservations.id, folios.reservationId))
        .where(
          and(
            eq(folios.organizationId, organizationId),
            eq(folios.status, 'open'),
            sql`${folios.balance}::numeric > 0`,
            eq(reservations.propertyId, propertyId),
          ),
        );

      return {
        totalBalance: parseFloat(result?.totalBalance ?? '0'),
        count: result?.count ?? 0,
      };
    }

    const [result] = await db
      .select({
        totalBalance: sql<string>`COALESCE(SUM(${folios.balance}), 0)::numeric(10,2)`,
        count: count(),
      })
      .from(folios)
      .where(
        and(
          eq(folios.organizationId, organizationId),
          eq(folios.status, 'open'),
          sql`${folios.balance}::numeric > 0`,
        ),
      );

    return {
      totalBalance: parseFloat(result?.totalBalance ?? '0'),
      count: result?.count ?? 0,
    };
  },

  /**
   * Recent reservations (latest 5)
   */
  async getRecentReservations(organizationId: string, limit: number = 5, propertyId?: string) {
    const conditions = [eq(reservations.organizationId, organizationId)];
    if (propertyId) conditions.push(eq(reservations.propertyId, propertyId));

    return db
      .select({
        id: reservations.id,
        confirmationCode: reservations.confirmationCode,
        guestId: reservations.guestId,
        status: reservations.status,
        checkInDate: reservations.checkInDate,
        checkOutDate: reservations.checkOutDate,
        totalAmount: reservations.totalAmount,
        currency: reservations.currency,
      })
      .from(reservations)
      .where(and(...conditions))
      .orderBy(sql`${reservations.createdAt} DESC`)
      .limit(limit);
  },
};
