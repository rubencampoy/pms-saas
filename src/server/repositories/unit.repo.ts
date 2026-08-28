import { db } from '@/server/db';
import { units } from '@/server/db/schema';
import { and, eq, asc, inArray, sql } from 'drizzle-orm';

export const unitRepo = {
  async findAll(organizationId: string) {
    return db.query.units.findMany({
      where: eq(units.organizationId, organizationId),
      orderBy: [asc(units.sortOrder), asc(units.name)],
    });
  },

  async findByProperty(organizationId: string, propertyId: string) {
    return db.query.units.findMany({
      where: and(
        eq(units.organizationId, organizationId),
        eq(units.propertyId, propertyId),
      ),
      orderBy: [asc(units.sortOrder), asc(units.name)],
    });
  },

  async findByRoomType(organizationId: string, roomTypeId: string) {
    return db.query.units.findMany({
      where: and(
        eq(units.organizationId, organizationId),
        eq(units.roomTypeId, roomTypeId),
      ),
      orderBy: [asc(units.sortOrder), asc(units.name)],
    });
  },

  async findById(organizationId: string, id: string) {
    return db.query.units.findFirst({
      where: and(
        eq(units.organizationId, organizationId),
        eq(units.id, id),
      ),
    });
  },

  /**
   * Batch sibling of `findById`, for expanding a page of reservations without
   * a query per row. Order is not guaranteed — callers index the result by id.
   */
  async findManyByIds(organizationId: string, ids: string[]) {
    if (ids.length === 0) return [];
    return db.query.units.findMany({
      where: and(
        eq(units.organizationId, organizationId),
        inArray(units.id, ids),
      ),
    });
  },

  async create(
    organizationId: string,
    data: {
      propertyId: string;
      roomTypeId: string;
      name: string;
      floor?: string;
      status?: string;
      housekeepingStatus?: string;
      sortOrder?: number;
      notes?: string;
    },
  ) {
    const [unit] = await db
      .insert(units)
      .values({
        organizationId,
        ...data,
      })
      .returning();
    return unit!;
  },

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      floor: string;
      status: string;
      housekeepingStatus: string;
      isActive: boolean;
      sortOrder: number;
      notes: string;
      roomTypeId: string;
    }>,
  ) {
    const [unit] = await db
      .update(units)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(units.organizationId, organizationId),
          eq(units.id, id),
        ),
      )
      .returning();
    return unit;
  },

  async countByRoomType(organizationId: string, roomTypeId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(units)
      .where(
        and(
          eq(units.organizationId, organizationId),
          eq(units.roomTypeId, roomTypeId),
          eq(units.isActive, true),
        ),
      );
    return result?.count ?? 0;
  },

  async delete(organizationId: string, id: string) {
    const [unit] = await db
      .delete(units)
      .where(
        and(
          eq(units.organizationId, organizationId),
          eq(units.id, id),
        ),
      )
      .returning();
    return unit;
  },
};
