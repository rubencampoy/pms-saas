import { db } from '@/server/db';
import {
  integrations,
  roomTypeMappings,
  ratePlanMappings,
  channelManagerLogs,
} from '@/server/db/schema';
import { and, eq, desc, sql } from 'drizzle-orm';

export const integrationRepo = {
  async findByProperty(organizationId: string, propertyId: string) {
    return db.query.integrations.findFirst({
      where: and(
        eq(integrations.organizationId, organizationId),
        eq(integrations.propertyId, propertyId),
      ),
    });
  },

  async findById(organizationId: string, integrationId: string) {
    return db.query.integrations.findFirst({
      where: and(
        eq(integrations.organizationId, organizationId),
        eq(integrations.id, integrationId),
      ),
    });
  },

  async findByWebhookToken(webhookToken: string) {
    return db.query.integrations.findFirst({
      where: eq(integrations.webhookToken, webhookToken),
    });
  },

  async findAllActive(organizationId: string) {
    return db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.organizationId, organizationId),
          eq(integrations.isActive, true),
        ),
      );
  },

  async findActiveByProperty(organizationId: string, propertyId: string) {
    return db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.organizationId, organizationId),
          eq(integrations.propertyId, propertyId),
          eq(integrations.isActive, true),
        ),
      );
  },

  async create(
    organizationId: string,
    data: {
      propertyId: string;
      provider: string;
      credentials: string;
      webhookToken: string;
    },
  ) {
    const [integration] = await db
      .insert(integrations)
      .values({ organizationId, ...data })
      .returning();
    return integration!;
  },

  async update(
    organizationId: string,
    integrationId: string,
    data: Partial<{
      credentials: string;
      isActive: boolean;
      lastSyncAt: Date;
      lastSyncStatus: string;
    }>,
  ) {
    const [integration] = await db
      .update(integrations)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(integrations.organizationId, organizationId),
          eq(integrations.id, integrationId),
        ),
      )
      .returning();
    return integration;
  },

  async updateLastSync(
    organizationId: string,
    integrationId: string,
    status: string,
  ) {
    return this.update(organizationId, integrationId, {
      lastSyncAt: new Date(),
      lastSyncStatus: status,
    });
  },
};

export const roomTypeMappingRepo = {
  async findByIntegration(organizationId: string, integrationId: string) {
    return db
      .select()
      .from(roomTypeMappings)
      .where(
        and(
          eq(roomTypeMappings.organizationId, organizationId),
          eq(roomTypeMappings.integrationId, integrationId),
        ),
      );
  },

  async upsertBatch(
    organizationId: string,
    integrationId: string,
    mappings: {
      roomTypeId: string;
      externalRoomTypeId: string;
      externalRoomTypeName: string;
    }[],
  ) {
    if (mappings.length === 0) return [];

    // Delete existing mappings for this integration
    await db
      .delete(roomTypeMappings)
      .where(
        and(
          eq(roomTypeMappings.organizationId, organizationId),
          eq(roomTypeMappings.integrationId, integrationId),
        ),
      );

    // Insert new mappings
    const values = mappings.map((m) => ({
      organizationId,
      integrationId,
      ...m,
    }));

    return db.insert(roomTypeMappings).values(values).returning();
  },

  async deleteByIntegration(organizationId: string, integrationId: string) {
    return db
      .delete(roomTypeMappings)
      .where(
        and(
          eq(roomTypeMappings.organizationId, organizationId),
          eq(roomTypeMappings.integrationId, integrationId),
        ),
      );
  },
};

export const ratePlanMappingRepo = {
  async findByIntegration(organizationId: string, integrationId: string) {
    return db
      .select()
      .from(ratePlanMappings)
      .where(
        and(
          eq(ratePlanMappings.organizationId, organizationId),
          eq(ratePlanMappings.integrationId, integrationId),
        ),
      );
  },

  async upsertBatch(
    organizationId: string,
    integrationId: string,
    mappings: {
      ratePlanId: string;
      externalRatePlanId: string;
      externalRatePlanName: string;
    }[],
  ) {
    if (mappings.length === 0) return [];

    await db
      .delete(ratePlanMappings)
      .where(
        and(
          eq(ratePlanMappings.organizationId, organizationId),
          eq(ratePlanMappings.integrationId, integrationId),
        ),
      );

    const values = mappings.map((m) => ({
      organizationId,
      integrationId,
      ...m,
    }));

    return db.insert(ratePlanMappings).values(values).returning();
  },

  async deleteByIntegration(organizationId: string, integrationId: string) {
    return db
      .delete(ratePlanMappings)
      .where(
        and(
          eq(ratePlanMappings.organizationId, organizationId),
          eq(ratePlanMappings.integrationId, integrationId),
        ),
      );
  },
};

export const channelManagerLogRepo = {
  async create(
    organizationId: string,
    entry: {
      integrationId: string;
      direction: string;
      action: string;
      status: string;
      request?: string;
      response?: string;
      errorMessage?: string;
      durationMs?: number;
    },
  ) {
    const [log] = await db
      .insert(channelManagerLogs)
      .values({ organizationId, ...entry })
      .returning();
    return log!;
  },

  async findByIntegration(
    organizationId: string,
    integrationId: string,
    options?: {
      limit?: number;
      offset?: number;
      direction?: string;
      status?: string;
    },
  ) {
    const conditions = [
      eq(channelManagerLogs.organizationId, organizationId),
      eq(channelManagerLogs.integrationId, integrationId),
    ];

    if (options?.direction) {
      conditions.push(eq(channelManagerLogs.direction, options.direction));
    }
    if (options?.status) {
      conditions.push(eq(channelManagerLogs.status, options.status));
    }

    return db
      .select()
      .from(channelManagerLogs)
      .where(and(...conditions))
      .orderBy(desc(channelManagerLogs.createdAt))
      .limit(options?.limit ?? 20)
      .offset(options?.offset ?? 0);
  },

  async count(
    organizationId: string,
    integrationId: string,
    options?: { direction?: string; status?: string },
  ) {
    const conditions = [
      eq(channelManagerLogs.organizationId, organizationId),
      eq(channelManagerLogs.integrationId, integrationId),
    ];

    if (options?.direction) {
      conditions.push(eq(channelManagerLogs.direction, options.direction));
    }
    if (options?.status) {
      conditions.push(eq(channelManagerLogs.status, options.status));
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(channelManagerLogs)
      .where(and(...conditions));
    return result?.count ?? 0;
  },
};
