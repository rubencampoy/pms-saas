import { db } from '@/server/db';
import { housekeepingTasks, units } from '@/server/db/schema';
import { and, eq, asc, desc, inArray, sql } from 'drizzle-orm';

export const housekeepingTaskRepo = {
  async findByProperty(
    organizationId: string,
    propertyId: string,
    options?: {
      scheduledDate?: string;
      status?: string[];
      type?: string[];
    },
  ) {
    const conditions = [
      eq(housekeepingTasks.organizationId, organizationId),
      eq(housekeepingTasks.propertyId, propertyId),
    ];

    if (options?.scheduledDate) {
      conditions.push(eq(housekeepingTasks.scheduledDate, options.scheduledDate));
    }
    if (options?.status && options.status.length > 0) {
      conditions.push(inArray(housekeepingTasks.status, options.status));
    }
    if (options?.type && options.type.length > 0) {
      conditions.push(inArray(housekeepingTasks.type, options.type));
    }

    return db
      .select()
      .from(housekeepingTasks)
      .where(and(...conditions))
      .orderBy(
        asc(sql`CASE ${housekeepingTasks.priority}
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END`),
        asc(housekeepingTasks.createdAt),
      );
  },

  async findById(organizationId: string, id: string) {
    return db.query.housekeepingTasks.findFirst({
      where: and(
        eq(housekeepingTasks.organizationId, organizationId),
        eq(housekeepingTasks.id, id),
      ),
    });
  },

  async findByUnit(
    organizationId: string,
    unitId: string,
    options?: { status?: string[] },
  ) {
    const conditions = [
      eq(housekeepingTasks.organizationId, organizationId),
      eq(housekeepingTasks.unitId, unitId),
    ];

    if (options?.status && options.status.length > 0) {
      conditions.push(inArray(housekeepingTasks.status, options.status));
    }

    return db
      .select()
      .from(housekeepingTasks)
      .where(and(...conditions))
      .orderBy(desc(housekeepingTasks.scheduledDate));
  },

  async create(
    organizationId: string,
    data: {
      propertyId: string;
      unitId: string;
      type: string;
      status?: string;
      priority?: string;
      assignedTo?: string;
      scheduledDate: string;
      notes?: string;
    },
  ) {
    const [task] = await db
      .insert(housekeepingTasks)
      .values({ organizationId, ...data })
      .returning();
    return task!;
  },

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      status: string;
      priority: string;
      assignedTo: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
      notes: string;
    }>,
  ) {
    const [task] = await db
      .update(housekeepingTasks)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(housekeepingTasks.organizationId, organizationId),
          eq(housekeepingTasks.id, id),
        ),
      )
      .returning();
    return task;
  },

  async delete(organizationId: string, id: string) {
    const [task] = await db
      .delete(housekeepingTasks)
      .where(
        and(
          eq(housekeepingTasks.organizationId, organizationId),
          eq(housekeepingTasks.id, id),
        ),
      )
      .returning();
    return task;
  },

  async countByStatus(organizationId: string, propertyId: string, scheduledDate?: string) {
    const conditions = [
      eq(housekeepingTasks.organizationId, organizationId),
      eq(housekeepingTasks.propertyId, propertyId),
    ];
    if (scheduledDate) {
      conditions.push(eq(housekeepingTasks.scheduledDate, scheduledDate));
    }

    const result = await db
      .select({
        status: housekeepingTasks.status,
        count: sql<number>`count(*)::int`,
      })
      .from(housekeepingTasks)
      .where(and(...conditions))
      .groupBy(housekeepingTasks.status);

    return result;
  },

  /** Count units by housekeeping status for a property */
  async countUnitsByHkStatus(organizationId: string, propertyId: string) {
    const result = await db
      .select({
        status: units.housekeepingStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(units)
      .where(
        and(
          eq(units.organizationId, organizationId),
          eq(units.propertyId, propertyId),
          eq(units.isActive, true),
        ),
      )
      .groupBy(units.housekeepingStatus);

    return result;
  },
};
