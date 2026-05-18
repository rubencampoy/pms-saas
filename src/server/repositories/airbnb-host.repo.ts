import { db } from '@/server/db';
import { airbnbHosts } from '@/server/db/schema';
import { and, eq } from 'drizzle-orm';

export const airbnbHostRepo = {
  async findByIntegration(organizationId: string, integrationId: string) {
    return db.query.airbnbHosts.findFirst({
      where: and(
        eq(airbnbHosts.organizationId, organizationId),
        eq(airbnbHosts.integrationId, integrationId),
      ),
    });
  },

  async findById(organizationId: string, id: string) {
    return db.query.airbnbHosts.findFirst({
      where: and(
        eq(airbnbHosts.organizationId, organizationId),
        eq(airbnbHosts.id, id),
      ),
    });
  },

  async findByOrganization(organizationId: string) {
    return db
      .select()
      .from(airbnbHosts)
      .where(eq(airbnbHosts.organizationId, organizationId));
  },

  async create(
    organizationId: string,
    data: {
      integrationId: string;
      airbnbToken: string;
      airbnbClientId: string;
      hostStatus?: string;
    },
  ) {
    const [host] = await db
      .insert(airbnbHosts)
      .values({ organizationId, ...data })
      .returning();
    return host!;
  },

  async updateStatus(
    organizationId: string,
    id: string,
    hostStatus: string,
    hostStatusCode?: string,
  ) {
    const values: Record<string, unknown> = {
      hostStatus,
      updatedAt: new Date(),
    };
    if (hostStatusCode !== undefined) {
      values.hostStatusCode = hostStatusCode;
    }
    if (hostStatus === 'active') {
      values.oauthCompletedAt = new Date();
    }

    const [updated] = await db
      .update(airbnbHosts)
      .set(values)
      .where(
        and(
          eq(airbnbHosts.organizationId, organizationId),
          eq(airbnbHosts.id, id),
        ),
      )
      .returning();
    return updated;
  },
};
