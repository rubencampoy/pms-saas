import { format, addDays } from 'date-fns';
import { SyncDirection, SyncAction, SyncStatus, MAX_SYNC_DAYS } from '@/lib/constants/channel-manager';
import { getProvider } from '@/lib/channel-manager/providers';
import { decrypt } from '@/lib/utils/encryption';
import {
  integrationRepo,
  roomTypeMappingRepo,
  ratePlanMappingRepo,
  channelManagerLogRepo,
} from '@/server/repositories/integration.repo';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { rateRepo } from '@/server/repositories/rate.repo';
import { guestRepo } from '@/server/repositories/guest.repo';
import { reservationService } from '@/server/services/reservation.service';
import type { CMConfig, AvailabilityUpdate, RateUpdate, IncomingReservation, LogCallback } from '@/lib/channel-manager/types';

function parseCredentials(encrypted: string): CMConfig {
  const json = decrypt(encrypted);
  return JSON.parse(json) as CMConfig;
}

function makeLogCallback(organizationId: string, integrationId: string): LogCallback {
  return async (entry) => {
    await channelManagerLogRepo.create(organizationId, {
      integrationId,
      ...entry,
    });
  };
}

export const channelManagerSyncService = {
  async syncAvailability(
    organizationId: string,
    propertyId: string,
    roomTypeId: string,
    dateFrom: string,
    dateTo: string,
  ) {
    const activeIntegrations = await integrationRepo.findActiveByProperty(
      organizationId,
      propertyId,
    );

    for (const integration of activeIntegrations) {
      const provider = getProvider(integration.provider);
      const config = parseCredentials(integration.credentials);
      const log = makeLogCallback(organizationId, integration.id);

      // Get mappings for this room type
      const rtMappings = await roomTypeMappingRepo.findByIntegration(
        organizationId,
        integration.id,
      );
      const mapping = rtMappings.find((m) => m.roomTypeId === roomTypeId);
      if (!mapping) continue;

      // Build availability updates per date
      const updates: AvailabilityUpdate[] = [];
      const from = new Date(dateFrom);
      const to = new Date(dateTo);

      for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        const nextDay = format(addDays(d, 1), 'yyyy-MM-dd');

        const availability = await reservationRepo.countAvailableUnits(
          organizationId,
          roomTypeId,
          dateStr,
          nextDay,
        );

        updates.push({
          externalRoomTypeId: mapping.externalRoomTypeId,
          date: dateStr,
          available: availability.availableUnits,
        });
      }

      const result = await provider.pushAvailability(config, updates, log);
      await integrationRepo.updateLastSync(
        organizationId,
        integration.id,
        result.status,
      );
    }
  },

  async syncRates(
    organizationId: string,
    propertyId: string,
    ratePlanId: string,
    dateFrom: string,
    dateTo: string,
  ) {
    const activeIntegrations = await integrationRepo.findActiveByProperty(
      organizationId,
      propertyId,
    );

    for (const integration of activeIntegrations) {
      const provider = getProvider(integration.provider);
      const config = parseCredentials(integration.credentials);
      const log = makeLogCallback(organizationId, integration.id);

      const rtMappings = await roomTypeMappingRepo.findByIntegration(
        organizationId,
        integration.id,
      );
      const rpMappings = await ratePlanMappingRepo.findByIntegration(
        organizationId,
        integration.id,
      );

      const rpMapping = rpMappings.find((m) => m.ratePlanId === ratePlanId);
      if (!rpMapping) continue;

      const updates: RateUpdate[] = [];

      if (!rpMapping.externalRoomTypeId) {
        console.warn(`[ChannelManager] syncRates: rate plan ${rpMapping.externalRatePlanId} has no externalRoomTypeId — skipping. Re-run Provision to fix.`);
        continue;
      }

      const rtMapping = rtMappings.find((m) => m.externalRoomTypeId === rpMapping.externalRoomTypeId);
      if (!rtMapping) continue;

      const dbRates = await rateRepo.findByRatePlanAndRoomType(
        organizationId,
        ratePlanId,
        rtMapping.roomTypeId,
        dateFrom,
        dateTo,
      );

      for (const rate of dbRates) {
        updates.push({
          externalRoomTypeId: rpMapping.externalRoomTypeId,
          externalRatePlanId: rpMapping.externalRatePlanId,
          date: rate.date,
          amount: rate.amount,
          currency: rate.currency,
        });
      }

      if (updates.length > 0) {
        const result = await provider.pushRates(config, updates, log);
        await integrationRepo.updateLastSync(
          organizationId,
          integration.id,
          result.status,
        );
      }
    }
  },

  async fullSync(organizationId: string, propertyId: string, integrationId?: string) {
    let integrations;
    if (integrationId) {
      // Direct sync for a specific integration (e.g. manual Full Sync button)
      const integration = await integrationRepo.findById(organizationId, integrationId);
      integrations = integration ? [integration] : [];
    } else {
      // Automatic sync — only active integrations
      integrations = await integrationRepo.findActiveByProperty(
        organizationId,
        propertyId,
      );
    }

    console.log(`[ChannelManager] fullSync: found ${integrations.length} integration(s) for property ${propertyId}`);

    const today = format(new Date(), 'yyyy-MM-dd');
    const endDate = format(addDays(new Date(), MAX_SYNC_DAYS), 'yyyy-MM-dd');

    for (const integration of integrations) {
      const provider = getProvider(integration.provider);
      const config = parseCredentials(integration.credentials);
      const log = makeLogCallback(organizationId, integration.id);

      const rtMappings = await roomTypeMappingRepo.findByIntegration(
        organizationId,
        integration.id,
      );
      const rpMappings = await ratePlanMappingRepo.findByIntegration(
        organizationId,
        integration.id,
      );

      console.log(`[ChannelManager] fullSync: ${rtMappings.length} room mappings, ${rpMappings.length} rate mappings`);
      console.log(`[ChannelManager] fullSync: syncing dates ${today} → ${endDate}`);

      // Push availability for all mapped room types (batch: 2 queries per room type instead of 730)
      const availUpdates: AvailabilityUpdate[] = [];

      for (const rtMapping of rtMappings) {
        const availMap = await reservationRepo.batchAvailability(
          organizationId,
          rtMapping.roomTypeId,
          today,
          endDate,
        );

        for (const [dateStr, available] of availMap) {
          availUpdates.push({
            externalRoomTypeId: rtMapping.externalRoomTypeId,
            date: dateStr,
            available,
          });
        }
      }

      let availStatus = SyncStatus.SUCCESS;
      console.log(`[ChannelManager] fullSync: ${availUpdates.length} availability updates to push`);
      if (availUpdates.length > 0) {
        // Log a sample of what we're sending
        console.log(`[ChannelManager] fullSync: sample avail update:`, JSON.stringify(availUpdates[0]));
        const availResult = await provider.pushAvailability(config, availUpdates, log);
        console.log(`[ChannelManager] fullSync: availability push result: ${availResult.status}, processed: ${availResult.updatesProcessed}`);
        if (availResult.errorMessage) {
          console.error(`[ChannelManager] fullSync: availability error: ${availResult.errorMessage}`);
        }
        availStatus = availResult.status;
      } else {
        console.log(`[ChannelManager] fullSync: no availability updates to push (no room mappings?)`);
      }

      // Push rates only for valid room-rate combinations.
      // Each rate plan mapping stores which external room type it belongs to.
      // Only push rates where the external room type matches.
      const rateUpdates: RateUpdate[] = [];

      // Build a lookup: externalRoomTypeId → local roomTypeId
      const extRoomToLocal = new Map<string, string>();
      for (const rtMapping of rtMappings) {
        extRoomToLocal.set(rtMapping.externalRoomTypeId, rtMapping.roomTypeId);
      }

      for (const rpMapping of rpMappings) {
        if (!rpMapping.externalRoomTypeId) {
          console.warn(`[ChannelManager] fullSync: rate plan ${rpMapping.externalRatePlanId} has no externalRoomTypeId — skipping. Re-run Provision to fix.`);
          continue;
        }

        const localRoomTypeId = extRoomToLocal.get(rpMapping.externalRoomTypeId);
        if (!localRoomTypeId) {
          console.warn(`[ChannelManager] fullSync: rate plan ${rpMapping.externalRatePlanId} → external room ${rpMapping.externalRoomTypeId} has no local room mapping, skipping`);
          continue;
        }

        const dbRates = await rateRepo.findByRatePlanAndRoomType(
          organizationId,
          rpMapping.ratePlanId,
          localRoomTypeId,
          today,
          endDate,
        );

        for (const rate of dbRates) {
          rateUpdates.push({
            externalRoomTypeId: rpMapping.externalRoomTypeId,
            externalRatePlanId: rpMapping.externalRatePlanId,
            date: rate.date,
            amount: rate.amount,
            currency: rate.currency,
          });
        }
      }

      console.log(`[ChannelManager] fullSync: ${rateUpdates.length} rate updates to push`);

      let rateStatus = SyncStatus.SUCCESS;
      if (rateUpdates.length > 0) {
        console.log(`[ChannelManager] fullSync: sample rate update:`, JSON.stringify(rateUpdates[0]));
        const rateResult = await provider.pushRates(config, rateUpdates, log);
        console.log(`[ChannelManager] fullSync: rates push result: ${rateResult.status}, processed: ${rateResult.updatesProcessed}`);
        if (rateResult.errorMessage) {
          console.error(`[ChannelManager] fullSync: rates error: ${rateResult.errorMessage}`);
        }
        rateStatus = rateResult.status;
      } else {
        console.log(`[ChannelManager] fullSync: no rate updates to push (no rates in DB for this date range)`);
      }

      // Use worst status between availability and rates
      const finalStatus = (availStatus === SyncStatus.ERROR || rateStatus === SyncStatus.ERROR)
        ? SyncStatus.ERROR
        : SyncStatus.SUCCESS;
      await integrationRepo.updateLastSync(
        organizationId,
        integration.id,
        finalStatus,
      );
    }
  },

  async handleIncomingReservation(
    organizationId: string,
    integrationId: string,
    payload: IncomingReservation,
  ) {
    const integration = await integrationRepo.findById(organizationId, integrationId);
    if (!integration) throw new Error('Integration not found');

    const log = makeLogCallback(organizationId, integrationId);

    // Resolve room type mapping
    const rtMappings = await roomTypeMappingRepo.findByIntegration(
      organizationId,
      integrationId,
    );
    const rtMapping = rtMappings.find(
      (m) => m.externalRoomTypeId === payload.externalRoomTypeId,
    );
    if (!rtMapping) {
      await log({
        direction: SyncDirection.INBOUND,
        action: SyncAction.RECEIVE_RESERVATION,
        status: SyncStatus.ERROR,
        request: JSON.stringify(payload),
        errorMessage: `No mapping for external room type ${payload.externalRoomTypeId}`,
      });
      throw new Error(`No mapping for external room type ${payload.externalRoomTypeId}`);
    }

    // Find or create guest
    const existingGuests = await guestRepo.findDuplicates(
      organizationId,
      payload.guestEmail,
    );

    let guestId: string;
    if (existingGuests.length > 0) {
      guestId = existingGuests[0]!.id;
    } else {
      const guest = await guestRepo.create(organizationId, {
        firstName: payload.guestFirstName,
        lastName: payload.guestLastName,
        email: payload.guestEmail,
        phone: payload.guestPhone,
      });
      guestId = guest.id;
    }

    // Create reservation via service
    const reservation = await reservationService.create(organizationId, {
      propertyId: integration.propertyId,
      guestId,
      roomTypeId: rtMapping.roomTypeId,
      source: payload.source,
      checkInDate: payload.checkInDate,
      checkOutDate: payload.checkOutDate,
      adults: payload.adults,
      children: payload.children,
      totalAmount: payload.totalAmount,
      currency: payload.currency,
      specialRequests: payload.specialRequests,
    });

    await log({
      direction: SyncDirection.INBOUND,
      action: SyncAction.RECEIVE_RESERVATION,
      status: SyncStatus.SUCCESS,
      request: JSON.stringify(payload),
      response: JSON.stringify({ reservationId: reservation.id }),
    });

    // Sync availability back after inbound reservation
    this.syncAvailability(
      organizationId,
      integration.propertyId,
      rtMapping.roomTypeId,
      payload.checkInDate,
      payload.checkOutDate,
    ).catch((err) =>
      console.error('[ChannelManager] Post-inbound availability sync failed:', err),
    );

    return reservation;
  },
};
