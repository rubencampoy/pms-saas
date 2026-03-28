import { db } from '@/server/db';
import { airbnbListings } from '@/server/db/schema';
import { and, eq } from 'drizzle-orm';

export const airbnbListingRepo = {
  async findByHost(organizationId: string, airbnbHostId: string) {
    return db
      .select()
      .from(airbnbListings)
      .where(
        and(
          eq(airbnbListings.organizationId, organizationId),
          eq(airbnbListings.airbnbHostId, airbnbHostId),
        ),
      );
  },

  async findByIntegration(organizationId: string, integrationId: string) {
    return db
      .select()
      .from(airbnbListings)
      .where(
        and(
          eq(airbnbListings.organizationId, organizationId),
          eq(airbnbListings.integrationId, integrationId),
        ),
      );
  },

  async findActivatedByProperty(organizationId: string, propertyId: string) {
    return db
      .select()
      .from(airbnbListings)
      .where(
        and(
          eq(airbnbListings.organizationId, organizationId),
          eq(airbnbListings.propertyId, propertyId),
          eq(airbnbListings.isActivated, true),
        ),
      );
  },

  async findByListingId(organizationId: string, airbnbListingId: string) {
    return db.query.airbnbListings.findFirst({
      where: and(
        eq(airbnbListings.organizationId, organizationId),
        eq(airbnbListings.airbnbListingId, airbnbListingId),
      ),
    });
  },

  async findById(organizationId: string, id: string) {
    return db.query.airbnbListings.findFirst({
      where: and(
        eq(airbnbListings.organizationId, organizationId),
        eq(airbnbListings.id, id),
      ),
    });
  },

  async upsertFromDiscovery(
    organizationId: string,
    airbnbHostId: string,
    integrationId: string,
    listings: Array<{
      airbnbListingId: string;
      listingName: string;
      propertyType?: string;
    }>,
  ) {
    const results = [];
    for (const listing of listings) {
      const existing = await db.query.airbnbListings.findFirst({
        where: and(
          eq(airbnbListings.organizationId, organizationId),
          eq(airbnbListings.airbnbListingId, listing.airbnbListingId),
        ),
      });

      if (existing) {
        const [updated] = await db
          .update(airbnbListings)
          .set({
            listingName: listing.listingName,
            propertyType: listing.propertyType,
            updatedAt: new Date(),
          })
          .where(eq(airbnbListings.id, existing.id))
          .returning();
        results.push(updated!);
      } else {
        const [created] = await db
          .insert(airbnbListings)
          .values({
            organizationId,
            airbnbHostId,
            integrationId,
            airbnbListingId: listing.airbnbListingId,
            listingName: listing.listingName,
            propertyType: listing.propertyType,
          })
          .returning();
        results.push(created!);
      }
    }
    return results;
  },

  async activateListing(
    organizationId: string,
    id: string,
    data: {
      airbnbRoomId: string;
      airbnbRateId: string;
      roomTypeId: string;
      propertyId: string;
      isMultiUnit?: boolean;
    },
  ) {
    const [updated] = await db
      .update(airbnbListings)
      .set({
        ...data,
        isActivated: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(airbnbListings.organizationId, organizationId),
          eq(airbnbListings.id, id),
        ),
      )
      .returning();
    return updated;
  },
};
