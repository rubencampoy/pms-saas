import { db } from '@/server/db';
import { rates } from '@/server/db/schema';
import { and, eq, gte, lte, asc, sql } from 'drizzle-orm';

export const rateRepo = {
  async findByRatePlanAndRoomType(
    organizationId: string,
    ratePlanId: string,
    roomTypeId: string,
    startDate: string,
    endDate: string,
  ) {
    return db
      .select()
      .from(rates)
      .where(
        and(
          eq(rates.organizationId, organizationId),
          eq(rates.ratePlanId, ratePlanId),
          eq(rates.roomTypeId, roomTypeId),
          gte(rates.date, startDate),
          lte(rates.date, endDate),
        ),
      )
      .orderBy(asc(rates.date));
  },

  async findByRatePlan(
    organizationId: string,
    ratePlanId: string,
    startDate: string,
    endDate: string,
  ) {
    return db
      .select()
      .from(rates)
      .where(
        and(
          eq(rates.organizationId, organizationId),
          eq(rates.ratePlanId, ratePlanId),
          gte(rates.date, startDate),
          lte(rates.date, endDate),
        ),
      )
      .orderBy(asc(rates.date), asc(rates.roomTypeId));
  },

  async findById(organizationId: string, id: string) {
    return db.query.rates.findFirst({
      where: and(
        eq(rates.organizationId, organizationId),
        eq(rates.id, id),
      ),
    });
  },

  /** Upsert rates for a date range (bulk set) — selective field updates */
  async bulkUpsert(
    organizationId: string,
    data: {
      ratePlanId: string;
      roomTypeIds: string[];
      startDate: string;
      endDate: string;
      daysOfWeek?: number[];
      fields: ('amount' | 'minStay' | 'maxStay' | 'closedToArrival' | 'closedToDeparture')[];
      amount?: string;
      minStay?: number;
      maxStay?: number | null;
      closedToArrival?: boolean;
      closedToDeparture?: boolean;
    },
  ) {
    // Use UTC-based date parsing to avoid DST issues
    // (local setDate + toISOString can produce duplicate dates during DST transitions)
    const end = new Date(data.endDate + 'T00:00:00Z');
    const fieldsSet = new Set(data.fields);
    const allowedDays = new Set(data.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6]);
    const allRows: Array<{
      organizationId: string;
      ratePlanId: string;
      roomTypeId: string;
      date: string;
      amount: string;
      currency: string;
      minStay: number;
      maxStay: number | null;
      closedToArrival: boolean;
      closedToDeparture: boolean;
    }> = [];

    for (const roomTypeId of data.roomTypeIds) {
      const start = new Date(data.startDate + 'T00:00:00Z');
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        // Filter by day of week (0 = Sun, 6 = Sat) — use UTC to stay consistent
        if (!allowedDays.has(d.getUTCDay())) continue;
        const dateStr = d.toISOString().split('T')[0]!;
        allRows.push({
          organizationId,
          ratePlanId: data.ratePlanId,
          roomTypeId,
          date: dateStr,
          amount: data.amount ?? '0',
          currency: 'EUR',
          minStay: data.minStay ?? 1,
          maxStay: data.maxStay ?? null,
          closedToArrival: data.closedToArrival ?? false,
          closedToDeparture: data.closedToDeparture ?? false,
        });
      }
    }

    if (allRows.length === 0) return [];

    // Build SET clause: only update selected fields, keep existing for others
    const setClause: Record<string, unknown> = { updatedAt: new Date() };
    setClause.amount = fieldsSet.has('amount')
      ? sql`excluded.amount`
      : sql`"rates"."amount"`;
    setClause.minStay = fieldsSet.has('minStay')
      ? sql`excluded.min_stay`
      : sql`"rates"."min_stay"`;
    setClause.maxStay = fieldsSet.has('maxStay')
      ? sql`excluded.max_stay`
      : sql`"rates"."max_stay"`;
    setClause.closedToArrival = fieldsSet.has('closedToArrival')
      ? sql`excluded.closed_to_arrival`
      : sql`"rates"."closed_to_arrival"`;
    setClause.closedToDeparture = fieldsSet.has('closedToDeparture')
      ? sql`excluded.closed_to_departure`
      : sql`"rates"."closed_to_departure"`;

    // Batch in chunks of 500 to avoid parameter limits
    const CHUNK_SIZE = 500;
    const allResults = [];
    for (let i = 0; i < allRows.length; i += CHUNK_SIZE) {
      const chunk = allRows.slice(i, i + CHUNK_SIZE);
      const result = await db
        .insert(rates)
        .values(chunk)
        .onConflictDoUpdate({
          target: [rates.organizationId, rates.ratePlanId, rates.roomTypeId, rates.date],
          set: setClause,
        })
        .returning();
      allResults.push(...result);
    }

    return allResults;
  },

  /** Upsert individual cell changes using natural key (org + plan + room + date) */
  async batchUpsertCells(
    organizationId: string,
    changes: Array<{
      ratePlanId: string;
      roomTypeId: string;
      date: string;
      amount?: string;
      minStay?: number;
      maxStay?: number | null;
      closedToArrival?: boolean;
      closedToDeparture?: boolean;
    }>,
  ) {
    if (changes.length === 0) return [];

    const rows = changes.map((c) => ({
      organizationId,
      ratePlanId: c.ratePlanId,
      roomTypeId: c.roomTypeId,
      date: c.date,
      amount: c.amount ?? '0',
      currency: 'EUR' as const,
      minStay: c.minStay ?? 1,
      maxStay: c.maxStay ?? null,
      closedToArrival: c.closedToArrival ?? false,
      closedToDeparture: c.closedToDeparture ?? false,
    }));

    const result = await db
      .insert(rates)
      .values(rows)
      .onConflictDoUpdate({
        target: [rates.organizationId, rates.ratePlanId, rates.roomTypeId, rates.date],
        set: {
          amount: sql`excluded.amount`,
          minStay: sql`excluded.min_stay`,
          maxStay: sql`excluded.max_stay`,
          closedToArrival: sql`excluded.closed_to_arrival`,
          closedToDeparture: sql`excluded.closed_to_departure`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result;
  },

  async create(
    organizationId: string,
    data: {
      ratePlanId: string;
      roomTypeId: string;
      date: string;
      amount: string;
      currency?: string;
      minStay?: number;
      maxStay?: number | null;
      closedToArrival?: boolean;
      closedToDeparture?: boolean;
    },
  ) {
    const [rate] = await db
      .insert(rates)
      .values({ organizationId, ...data })
      .returning();
    return rate!;
  },

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      amount: string;
      currency: string;
      minStay: number;
      maxStay: number | null;
      closedToArrival: boolean;
      closedToDeparture: boolean;
    }>,
  ) {
    const [rate] = await db
      .update(rates)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(rates.organizationId, organizationId),
          eq(rates.id, id),
        ),
      )
      .returning();
    return rate;
  },

  async deleteByRange(
    organizationId: string,
    ratePlanId: string,
    roomTypeId: string,
    startDate: string,
    endDate: string,
  ) {
    return db
      .delete(rates)
      .where(
        and(
          eq(rates.organizationId, organizationId),
          eq(rates.ratePlanId, ratePlanId),
          eq(rates.roomTypeId, roomTypeId),
          gte(rates.date, startDate),
          lte(rates.date, endDate),
        ),
      )
      .returning();
  },
};
