import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { propertyRepo } from '@/server/repositories/property.repo';
import { roomTypeRepo } from '@/server/repositories/room-type.repo';
import { ratePlanRepo } from '@/server/repositories/rate-plan.repo';
import { integrationRepo, roomTypeMappingRepo, ratePlanMappingRepo } from '@/server/repositories/integration.repo';
import { airbnbHostRepo } from '@/server/repositories/airbnb-host.repo';
import { airbnbListingRepo } from '@/server/repositories/airbnb-listing.repo';
import { decrypt } from '@/lib/utils/encryption';
import { ChannelsClient } from '@/components/settings/channels-client';
import type { CMConfig } from '@/lib/channel-manager/types';

export default async function ChannelsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;

  const properties = await propertyRepo.findAll(orgId);

  // Load integration data for each property
  const propertyIntegrations = await Promise.all(
    properties.map(async (property) => {
      const integration = await integrationRepo.findByProperty(orgId, property.id);

      if (!integration) {
        return {
          property,
          integration: null,
          decryptedCredentials: null,
          roomTypeMappings: [],
          ratePlanMappings: [],
          localRoomTypes: await roomTypeRepo.findByProperty(orgId, property.id),
          localRatePlans: await ratePlanRepo.findByProperty(orgId, property.id),
        };
      }

      let decryptedCredentials: CMConfig | null = null;
      try {
        decryptedCredentials = JSON.parse(decrypt(integration.credentials)) as CMConfig;
      } catch {
        decryptedCredentials = null;
      }

      const [rtMappings, rpMappings, localRoomTypes, localRatePlans] = await Promise.all([
        roomTypeMappingRepo.findByIntegration(orgId, integration.id),
        ratePlanMappingRepo.findByIntegration(orgId, integration.id),
        roomTypeRepo.findByProperty(orgId, property.id),
        ratePlanRepo.findByProperty(orgId, property.id),
      ]);

      // Load Airbnb data if available
      const airbnbHost = await airbnbHostRepo.findByIntegration(orgId, integration.id);
      const airbnbListings = airbnbHost
        ? await airbnbListingRepo.findByHost(orgId, airbnbHost.id)
        : [];

      return {
        property,
        integration: {
          id: integration.id,
          provider: integration.provider,
          isActive: integration.isActive,
          lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
          lastSyncStatus: integration.lastSyncStatus,
          webhookToken: integration.webhookToken,
        },
        decryptedCredentials,
        roomTypeMappings: rtMappings,
        ratePlanMappings: rpMappings,
        localRoomTypes,
        localRatePlans,
        airbnbHost: airbnbHost
          ? {
              id: airbnbHost.id,
              hostStatus: airbnbHost.hostStatus,
              hostStatusCode: airbnbHost.hostStatusCode,
              oauthCompletedAt: airbnbHost.oauthCompletedAt?.toISOString() ?? null,
            }
          : null,
        airbnbListings: airbnbListings.map((l) => ({
          id: l.id,
          airbnbListingId: l.airbnbListingId,
          listingName: l.listingName,
          propertyType: l.propertyType,
          isActivated: l.isActivated,
          roomTypeId: l.roomTypeId,
          propertyId: l.propertyId,
        })),
      };
    }),
  );

  return <ChannelsClient propertyIntegrations={propertyIntegrations} />;
}
