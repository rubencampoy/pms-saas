'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { requireRole } from '@/lib/auth/rbac';
import { decrypt } from '@/lib/utils/encryption';
import {
  initiateHostActivationSchema,
  checkHostStatusSchema,
  discoverListingsSchema,
  activateListingSchema,
  triggerAirbnbSyncSchema,
  airbnbAvailabilityRulesSchema,
  airbnbPricingSettingsSchema,
} from '@/lib/validators/airbnb';
import { integrationRepo, roomTypeMappingRepo } from '@/server/repositories/integration.repo';
import { airbnbHostRepo } from '@/server/repositories/airbnb-host.repo';
import { airbnbListingRepo } from '@/server/repositories/airbnb-listing.repo';
import { channelManagerSyncService } from '@/server/services/channel-manager-sync.service';
import {
  airbnbActivateHost,
  airbnbGetHostStatus,
  airbnbGetListings,
  airbnbActivateProperty,
  airbnbSetPricingModel,
  airbnbSetAvailabilityRules as pushAvailabilityRules,
  airbnbSetPricingSettings as pushPricingSettings,
  buildAirbnbOAuthUrl,
} from '@/lib/channel-manager/providers/zodomus';
import { AirbnbHostStatus as AirbnbHostStatusEnum } from '@/lib/constants/channel-manager';
import type { ActionResult } from '@/types/actions';
import type { CMConfig, AirbnbListing, AirbnbHostStatusResult } from '@/lib/channel-manager/types';

const SETTINGS_PATH = '/settings/channels';

function parseConfig(encrypted: string): CMConfig {
  return JSON.parse(decrypt(encrypted)) as CMConfig;
}

// ── 1. Initiate Airbnb Host Activation ──

export async function initiateAirbnbHostActivation(
  input: { integrationId: string },
): Promise<ActionResult<{ airbnbHostId: string; oauthUrl: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };
    requireRole(session.user.role, ['admin', 'manager']);

    const validated = initiateHostActivationSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Validation failed', fieldErrors: validated.error.flatten().fieldErrors };
    }

    const orgId = session.user.organizationId;
    const integration = await integrationRepo.findById(orgId, validated.data.integrationId);
    if (!integration) return { success: false, error: 'Integration not found' };

    // Check if host already exists for this integration
    const existing = await airbnbHostRepo.findByIntegration(orgId, integration.id);
    if (existing) {
      // Return existing OAuth URL
      console.log('[Airbnb] Host already exists, returning existing OAuth URL. Host status:', existing.hostStatus, 'clientId:', existing.airbnbClientId);
      const config = parseConfig(integration.credentials);
      const isProduction = !config.isTestMode;
      console.log('[Airbnb] isTestMode:', config.isTestMode, 'isProduction:', isProduction);
      const oauthUrl = buildAirbnbOAuthUrl(existing.airbnbClientId, existing.airbnbToken, isProduction);
      console.log('[Airbnb] OAuth URL:', oauthUrl);
      return { success: true, data: { airbnbHostId: existing.id, oauthUrl } };
    }

    const config = parseConfig(integration.credentials);
    console.log('[Airbnb] No existing host, calling airbnbActivateHost...');
    const result = await airbnbActivateHost(config);
    console.log('[Airbnb] airbnbActivateHost result:', JSON.stringify(result));

    const host = await airbnbHostRepo.create(orgId, {
      integrationId: integration.id,
      airbnbToken: result.token,
      airbnbClientId: result.clientId,
      hostStatus: AirbnbHostStatusEnum.OAUTH_SENT,
    });

    const isProduction = !config.isTestMode;
    const oauthUrl = buildAirbnbOAuthUrl(result.clientId, result.token, isProduction);

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: { airbnbHostId: host.id, oauthUrl } };
  } catch (error) {
    console.error('initiateAirbnbHostActivation failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

// ── 2. Check Airbnb Host Status ──

export async function checkAirbnbHostStatus(
  input: { airbnbHostId: string },
): Promise<ActionResult<AirbnbHostStatusResult>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };
    requireRole(session.user.role, ['admin', 'manager']);

    const validated = checkHostStatusSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Validation failed' };
    }

    const orgId = session.user.organizationId;
    const host = await airbnbHostRepo.findById(orgId, validated.data.airbnbHostId);
    if (!host) return { success: false, error: 'Airbnb host not found' };

    const integration = await integrationRepo.findById(orgId, host.integrationId);
    if (!integration) return { success: false, error: 'Integration not found' };

    const config = parseConfig(integration.credentials);
    console.log('[Airbnb] Checking host status for token:', host.airbnbToken);
    const status = await airbnbGetHostStatus(config, host.airbnbToken);
    console.log('[Airbnb] Host status response:', JSON.stringify(status));

    // Map Zodomus status codes: "5" = active
    const newStatus = status.statusCode === '5' ? AirbnbHostStatusEnum.ACTIVE : AirbnbHostStatusEnum.INACTIVE;
    console.log('[Airbnb] Mapped status:', newStatus, 'statusCode:', status.statusCode);
    await airbnbHostRepo.updateStatus(orgId, host.id, newStatus, status.statusCode);

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: status };
  } catch (error) {
    console.error('checkAirbnbHostStatus failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

// ── 3. Discover Airbnb Listings ──

export async function discoverAirbnbListings(
  input: { airbnbHostId: string },
): Promise<ActionResult<AirbnbListing[]>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };
    requireRole(session.user.role, ['admin', 'manager']);

    const validated = discoverListingsSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Validation failed' };
    }

    const orgId = session.user.organizationId;
    const host = await airbnbHostRepo.findById(orgId, validated.data.airbnbHostId);
    if (!host) return { success: false, error: 'Airbnb host not found' };

    const integration = await integrationRepo.findById(orgId, host.integrationId);
    if (!integration) return { success: false, error: 'Integration not found' };

    const config = parseConfig(integration.credentials);
    const listings = await airbnbGetListings(config, host.airbnbToken);

    // Upsert discovered listings into DB
    await airbnbListingRepo.upsertFromDiscovery(
      orgId,
      host.id,
      integration.id,
      listings.map((l) => ({
        airbnbListingId: l.idStr ?? String(l.id),
        listingName: l.name,
        propertyType: l.propertyTypeCategory,
      })),
    );

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: listings };
  } catch (error) {
    console.error('discoverAirbnbListings failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

// ── 4. Activate Airbnb Listing ──

export async function activateAirbnbListing(
  input: { airbnbListingDbId: string; roomTypeId: string; propertyId: string },
): Promise<ActionResult<{ roomId: string; rateId: string }>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };
    requireRole(session.user.role, ['admin', 'manager']);

    const validated = activateListingSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Validation failed', fieldErrors: validated.error.flatten().fieldErrors };
    }

    const orgId = session.user.organizationId;
    const listing = await airbnbListingRepo.findById(orgId, validated.data.airbnbListingDbId);
    if (!listing) return { success: false, error: 'Listing not found' };

    const host = await airbnbHostRepo.findById(orgId, listing.airbnbHostId);
    if (!host) return { success: false, error: 'Airbnb host not found' };

    const integration = await integrationRepo.findById(orgId, listing.integrationId);
    if (!integration) return { success: false, error: 'Integration not found' };

    const config = parseConfig(integration.credentials);

    // Activate property on Zodomus/Airbnb
    const { roomId, rateId } = await airbnbActivateProperty(
      config,
      listing.airbnbListingId,
      host.airbnbToken,
    );

    // Set pricing model to STANDARD
    await airbnbSetPricingModel(config, listing.airbnbListingId);

    // Update listing record
    await airbnbListingRepo.activateListing(orgId, listing.id, {
      airbnbRoomId: roomId,
      airbnbRateId: rateId,
      roomTypeId: validated.data.roomTypeId,
      propertyId: validated.data.propertyId,
    });

    // Create room type mapping (so fullSync can find this room)
    // Fetch existing mappings first and merge to avoid deleting other rooms
    const existingRtMappings = await roomTypeMappingRepo.findByIntegration(orgId, integration.id);
    const otherMappings = existingRtMappings
      .filter((m) => m.roomTypeId !== validated.data.roomTypeId)
      .map((m) => ({
        roomTypeId: m.roomTypeId,
        externalRoomTypeId: m.externalRoomTypeId,
        externalRoomTypeName: m.externalRoomTypeName,
      }));

    await roomTypeMappingRepo.upsertBatch(orgId, integration.id, [
      ...otherMappings,
      {
        roomTypeId: validated.data.roomTypeId,
        externalRoomTypeId: roomId,
        externalRoomTypeName: listing.listingName ?? listing.airbnbListingId,
      },
    ]);

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: { roomId, rateId } };
  } catch (error) {
    console.error('activateAirbnbListing failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

// ── 5. Trigger Airbnb Calendar Sync ──

export async function triggerAirbnbCalendarSync(
  input: { integrationId: string },
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };
    requireRole(session.user.role, ['admin', 'manager']);

    const validated = triggerAirbnbSyncSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Validation failed' };
    }

    const orgId = session.user.organizationId;
    const integration = await integrationRepo.findById(orgId, validated.data.integrationId);
    if (!integration) return { success: false, error: 'Integration not found' };

    await channelManagerSyncService.syncAirbnbCalendar(
      orgId,
      integration.propertyId,
      integration.id,
    );

    revalidatePath(SETTINGS_PATH);
    return { success: true, data: undefined };
  } catch (error) {
    console.error('triggerAirbnbCalendarSync failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

// ── 6. Save Airbnb Availability Rules ──

export async function saveAirbnbAvailabilityRules(
  input: {
    airbnbListingDbId: string;
    defaultMinNights?: number;
    defaultMaxNights?: number;
    bookingLeadTimeHours?: number;
    maxDaysNoticeDays?: number;
    turnoverDays?: number;
  },
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };
    requireRole(session.user.role, ['admin', 'manager']);

    const validated = airbnbAvailabilityRulesSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Validation failed', fieldErrors: validated.error.flatten().fieldErrors };
    }

    const orgId = session.user.organizationId;
    const listing = await airbnbListingRepo.findById(orgId, validated.data.airbnbListingDbId);
    if (!listing) return { success: false, error: 'Listing not found' };

    const integration = await integrationRepo.findById(orgId, listing.integrationId);
    if (!integration) return { success: false, error: 'Integration not found' };

    const config = parseConfig(integration.credentials);

    await pushAvailabilityRules(config, listing.airbnbListingId, {
      defaultMinNights: validated.data.defaultMinNights,
      defaultMaxNights: validated.data.defaultMaxNights,
      bookingLeadTime: validated.data.bookingLeadTimeHours
        ? { hours: validated.data.bookingLeadTimeHours, allowRequestToBook: 0 }
        : undefined,
      maxDaysNotice: validated.data.maxDaysNoticeDays
        ? { days: validated.data.maxDaysNoticeDays }
        : undefined,
      turnoverDays: validated.data.turnoverDays,
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error('saveAirbnbAvailabilityRules failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

// ── 7. Save Airbnb Pricing Settings ──

export async function saveAirbnbPricingSettings(
  input: {
    airbnbListingDbId: string;
    listingCurrency: string;
    defaultDailyPrice: number;
    weekendPrice?: number;
    guestsIncluded?: number;
    pricePerExtraPerson?: number;
  },
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user) return { success: false, error: 'Not authenticated' };
    requireRole(session.user.role, ['admin', 'manager']);

    const validated = airbnbPricingSettingsSchema.safeParse(input);
    if (!validated.success) {
      return { success: false, error: 'Validation failed', fieldErrors: validated.error.flatten().fieldErrors };
    }

    const orgId = session.user.organizationId;
    const listing = await airbnbListingRepo.findById(orgId, validated.data.airbnbListingDbId);
    if (!listing) return { success: false, error: 'Listing not found' };

    const integration = await integrationRepo.findById(orgId, listing.integrationId);
    if (!integration) return { success: false, error: 'Integration not found' };

    const config = parseConfig(integration.credentials);

    await pushPricingSettings(config, listing.airbnbListingId, {
      listingCurrency: validated.data.listingCurrency,
      defaultDailyPrice: validated.data.defaultDailyPrice,
      weekendPrice: validated.data.weekendPrice,
      guestsIncluded: validated.data.guestsIncluded,
      pricePerExtraPerson: validated.data.pricePerExtraPerson,
    });

    return { success: true, data: undefined };
  } catch (error) {
    console.error('saveAirbnbPricingSettings failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'An unexpected error occurred' };
  }
}

// ── Helper: Get Airbnb data for settings page ──

export async function getAirbnbDataForIntegration(integrationId: string) {
  const session = await auth();
  if (!session?.user) return null;

  const orgId = session.user.organizationId;
  const host = await airbnbHostRepo.findByIntegration(orgId, integrationId);
  const listings = host
    ? await airbnbListingRepo.findByHost(orgId, host.id)
    : [];

  return { host, listings };
}
