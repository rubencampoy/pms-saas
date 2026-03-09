import { db } from '@/server/db';
import { seasons } from '@/server/db/schema';
import { and, eq, asc, gte, lte, or } from 'drizzle-orm';

export const seasonRepo = {
  async findByProperty(organizationId: string, propertyId: string) {
    return db.query.seasons.findMany({
      where: and(
        eq(seasons.organizationId, organizationId),
        eq(seasons.propertyId, propertyId),
      ),
      orderBy: [asc(seasons.startDate)],
    });
  },

  async findById(organizationId: string, id: string) {
    return db.query.seasons.findFirst({
      where: and(
        eq(seasons.organizationId, organizationId),
        eq(seasons.id, id),
      ),
    });
  },

  async findOverlapping(
    organizationId: string,
    propertyId: string,
    startDate: string,
    endDate: string,
    excludeId?: string,
  ) {
    const conditions = [
      eq(seasons.organizationId, organizationId),
      eq(seasons.propertyId, propertyId),
      or(
        and(lte(seasons.startDate, endDate), gte(seasons.endDate, startDate)),
      ),
    ];

    const results = await db.query.seasons.findMany({
      where: and(...conditions),
    });

    if (excludeId) {
      return results.filter((s) => s.id !== excludeId);
    }
    return results;
  },

  async create(
    organizationId: string,
    data: {
      propertyId: string;
      name: string;
      startDate: string;
      endDate: string;
      color?: string;
    },
  ) {
    const [season] = await db
      .insert(seasons)
      .values({ organizationId, ...data })
      .returning();
    return season!;
  },

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      name: string;
      startDate: string;
      endDate: string;
      color: string;
    }>,
  ) {
    const [season] = await db
      .update(seasons)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(seasons.organizationId, organizationId),
          eq(seasons.id, id),
        ),
      )
      .returning();
    return season;
  },

  async delete(organizationId: string, id: string) {
    const [season] = await db
      .delete(seasons)
      .where(
        and(
          eq(seasons.organizationId, organizationId),
          eq(seasons.id, id),
        ),
      )
      .returning();
    return season;
  },
};
