import { db } from '@/server/db';
import { guests } from '@/server/db/schema';
import { and, eq, or, ilike, asc, desc, sql } from 'drizzle-orm';

export const guestRepo = {
  async findAll(organizationId: string, options?: { limit?: number; offset?: number }) {
    return db.query.guests.findMany({
      where: eq(guests.organizationId, organizationId),
      orderBy: [asc(guests.lastName), asc(guests.firstName)],
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },

  async findById(organizationId: string, id: string) {
    return db.query.guests.findFirst({
      where: and(
        eq(guests.organizationId, organizationId),
        eq(guests.id, id),
      ),
    });
  },

  async search(organizationId: string, query: string) {
    const searchTerm = `%${query}%`;
    return db
      .select()
      .from(guests)
      .where(
        and(
          eq(guests.organizationId, organizationId),
          or(
            ilike(guests.firstName, searchTerm),
            ilike(guests.lastName, searchTerm),
            ilike(guests.email, searchTerm),
            ilike(guests.documentNumber, searchTerm),
            ilike(guests.phone, searchTerm),
            sql`concat(${guests.firstName}, ' ', ${guests.lastName}) ILIKE ${searchTerm}`,
          ),
        ),
      )
      .orderBy(asc(guests.lastName), asc(guests.firstName))
      .limit(50);
  },

  async findByVipStatus(organizationId: string, vipStatus: string) {
    return db.query.guests.findMany({
      where: and(
        eq(guests.organizationId, organizationId),
        eq(guests.vipStatus, vipStatus),
      ),
      orderBy: [desc(guests.totalRevenue)],
    });
  },

  async findDuplicates(
    organizationId: string,
    email?: string,
    documentType?: string,
    documentNumber?: string,
  ) {
    const conditions = [eq(guests.organizationId, organizationId)];

    const matchConditions = [];
    if (email) {
      matchConditions.push(eq(guests.email, email));
    }
    if (documentType && documentNumber) {
      matchConditions.push(
        and(
          eq(guests.documentType, documentType),
          eq(guests.documentNumber, documentNumber),
        )!,
      );
    }

    if (matchConditions.length === 0) return [];

    return db
      .select()
      .from(guests)
      .where(and(...conditions, or(...matchConditions)))
      .limit(5);
  },

  async count(organizationId: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(guests)
      .where(eq(guests.organizationId, organizationId));
    return result?.count ?? 0;
  },

  async create(
    organizationId: string,
    data: {
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      documentType?: string;
      documentNumber?: string;
      nationality?: string;
      dateOfBirth?: string;
      address?: Record<string, string>;
      vipStatus?: string;
      notes?: string;
    },
  ) {
    const [guest] = await db
      .insert(guests)
      .values({
        organizationId,
        ...data,
      })
      .returning();
    return guest!;
  },

  async update(
    organizationId: string,
    id: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      documentType: string;
      documentNumber: string;
      nationality: string;
      dateOfBirth: string;
      address: Record<string, string>;
      vipStatus: string;
      notes: string;
      totalStays: number;
      totalRevenue: string;
    }>,
  ) {
    const [guest] = await db
      .update(guests)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(guests.organizationId, organizationId),
          eq(guests.id, id),
        ),
      )
      .returning();
    return guest;
  },

  async delete(organizationId: string, id: string) {
    const [guest] = await db
      .delete(guests)
      .where(
        and(
          eq(guests.organizationId, organizationId),
          eq(guests.id, id),
        ),
      )
      .returning();
    return guest;
  },
};
