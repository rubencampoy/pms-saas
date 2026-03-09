import { db } from '@/server/db';
import { roomBlocks, reservations } from '@/server/db/schema';
import { and, eq, gt, gte, lt, lte, asc, not, inArray } from 'drizzle-orm';

export const roomBlockRepo = {
  async findByProperty(organizationId: string, propertyId: string) {
    return db.query.roomBlocks.findMany({
      where: and(
        eq(roomBlocks.organizationId, organizationId),
        eq(roomBlocks.propertyId, propertyId),
      ),
      orderBy: [asc(roomBlocks.startDate)],
    });
  },

  /** Find all blocks overlapping a date range for a given property */
  async findByPropertyAndDateRange(
    organizationId: string,
    propertyId: string,
    startDate: string,
    endDate: string,
  ) {
    return db.query.roomBlocks.findMany({
      where: and(
        eq(roomBlocks.organizationId, organizationId),
        eq(roomBlocks.propertyId, propertyId),
        // Overlap: block.startDate < endDate AND block.endDate > startDate
        lte(roomBlocks.startDate, endDate),
        gte(roomBlocks.endDate, startDate),
      ),
      orderBy: [asc(roomBlocks.startDate)],
    });
  },

  /** Find blocks for a specific unit that overlap a date range */
  async findOverlapping(
    organizationId: string,
    unitId: string,
    startDate: string,
    endDate: string,
    excludeId?: string,
  ) {
    const conditions = [
      eq(roomBlocks.organizationId, organizationId),
      eq(roomBlocks.unitId, unitId),
      lte(roomBlocks.startDate, endDate),
      gte(roomBlocks.endDate, startDate),
    ];

    if (excludeId) {
      // For update — exclude current block from overlap check
      // drizzle-orm doesn't have "ne" easily, so use or with gt/lt
      // Actually we can use sql`id != excludeId` or just filter in JS
    }

    const results = await db.query.roomBlocks.findMany({
      where: and(...conditions),
    });

    return excludeId ? results.filter((b) => b.id !== excludeId) : results;
  },

  /** Check if there are active reservations on this unit that overlap the date range */
  async findReservationOverlaps(
    organizationId: string,
    unitId: string,
    startDate: string,
    endDate: string,
  ) {
    // Cancelled / no_show reservations don't count
    const excludedStatuses = ['cancelled', 'no_show'];
    return db
      .select({ id: reservations.id, confirmationCode: reservations.confirmationCode })
      .from(reservations)
      .where(
        and(
          eq(reservations.organizationId, organizationId),
          eq(reservations.unitId, unitId),
          not(inArray(reservations.status, excludedStatuses)),
          // Overlap: reservation.checkInDate < block.endDate AND reservation.checkOutDate > block.startDate
          lt(reservations.checkInDate, endDate),
          gt(reservations.checkOutDate, startDate),
        ),
      );
  },

  async findById(organizationId: string, id: string) {
    return db.query.roomBlocks.findFirst({
      where: and(
        eq(roomBlocks.organizationId, organizationId),
        eq(roomBlocks.id, id),
      ),
    });
  },

  async create(
    organizationId: string,
    data: {
      propertyId: string;
      unitId: string;
      type: string;
      startDate: string;
      endDate: string;
      reason?: string;
      createdBy?: string;
    },
  ) {
    const [block] = await db
      .insert(roomBlocks)
      .values({
        organizationId,
        ...data,
      })
      .returning();
    return block!;
  },

  async update(
    organizationId: string,
    id: string,
    data: {
      type?: string;
      startDate?: string;
      endDate?: string;
      reason?: string | null;
    },
  ) {
    const [block] = await db
      .update(roomBlocks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(roomBlocks.organizationId, organizationId),
          eq(roomBlocks.id, id),
        ),
      )
      .returning();
    return block;
  },

  async delete(organizationId: string, id: string) {
    const [block] = await db
      .delete(roomBlocks)
      .where(
        and(
          eq(roomBlocks.organizationId, organizationId),
          eq(roomBlocks.id, id),
        ),
      )
      .returning();
    return block;
  },
};
