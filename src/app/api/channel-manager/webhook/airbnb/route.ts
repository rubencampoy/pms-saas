import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  classifyAirbnbWebhook,
  airbnbReservationWebhookSchema,
  airbnbNotificationWebhookSchema,
  airbnbAvailabilityCheckWebhookSchema,
} from '@/lib/validators/airbnb-webhook';
import { channelManagerLogRepo } from '@/server/repositories/integration.repo';
import { airbnbListingRepo } from '@/server/repositories/airbnb-listing.repo';
import { airbnbHostRepo } from '@/server/repositories/airbnb-host.repo';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { SyncDirection, SyncAction, SyncStatus, AirbnbNotificationType } from '@/lib/constants/channel-manager';
import { decrypt } from '@/lib/utils/encryption';
import type { CMConfig } from '@/lib/channel-manager/types';
import { airbnbGetWebhookNotification } from '@/lib/channel-manager/providers/zodomus';

export const maxDuration = 60;

/**
 * Lookup the integration by Airbnb webhookKey (sent in the body, not headers).
 * We check the `airbnbWebhookKey` stored in the encrypted credentials.
 */
async function findIntegrationByWebhookKey(webhookKey: string) {
  // Since webhookKey is inside encrypted credentials, we need to scan all active integrations.
  // This is acceptable because the number of integrations is small per tenant.
  // For optimization, we could add an indexed column later.
  const { db } = await import('@/server/db');
  const { integrations } = await import('@/server/db/schema');
  const { eq } = await import('drizzle-orm');

  const allIntegrations = await db
    .select()
    .from(integrations)
    .where(eq(integrations.isActive, true));

  for (const integration of allIntegrations) {
    try {
      const config = JSON.parse(decrypt(integration.credentials)) as CMConfig;
      if (config.airbnbWebhookKey === webhookKey) {
        return { integration, config };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const webhookKey = body.webhookKey as string | undefined;
  if (!webhookKey) {
    return NextResponse.json({ error: 'Missing webhookKey' }, { status: 401 });
  }

  const found = await findIntegrationByWebhookKey(webhookKey);
  if (!found) {
    return NextResponse.json({ error: 'Invalid webhookKey' }, { status: 401 });
  }

  const { integration, config } = found;
  const orgId = integration.organizationId;
  const payloadType = classifyAirbnbWebhook(body);

  // ── Type C: Availability Check (SYNCHRONOUS — must respond 200/400) ──
  if (payloadType === 'availability_check') {
    const parsed = airbnbAvailabilityCheckWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid availability check payload' }, { status: 400 });
    }

    try {
      const { propertyId: airbnbPropertyId, startDate, nights } = parsed.data;

      // Find the listing → room type mapping
      const listing = await airbnbListingRepo.findByListingId(orgId, airbnbPropertyId);
      if (!listing?.roomTypeId || !listing.propertyId) {
        // Cannot check — allow the reservation by default
        return NextResponse.json({ status: 'available' }, { status: 200 });
      }

      // Check availability for the date range
      const availMap = await reservationRepo.batchAvailability(
        orgId,
        listing.roomTypeId,
        startDate,
        // endDate = startDate + nights days
        new Date(new Date(startDate).getTime() + nights * 86400000)
          .toISOString()
          .split('T')[0]!,
      );

      // If any date has 0 availability, respond 400
      for (const [, available] of availMap) {
        if (available <= 0) {
          await channelManagerLogRepo.create(orgId, {
            integrationId: integration.id,
            direction: SyncDirection.INBOUND,
            action: SyncAction.AIRBNB_AVAILABILITY_CHECK,
            status: SyncStatus.SUCCESS,
            request: JSON.stringify(parsed.data),
            response: JSON.stringify({ result: 'unavailable' }),
          });
          return NextResponse.json({ status: 'unavailable' }, { status: 400 });
        }
      }

      await channelManagerLogRepo.create(orgId, {
        integrationId: integration.id,
        direction: SyncDirection.INBOUND,
        action: SyncAction.AIRBNB_AVAILABILITY_CHECK,
        status: SyncStatus.SUCCESS,
        request: JSON.stringify(parsed.data),
        response: JSON.stringify({ result: 'available' }),
      });

      return NextResponse.json({ status: 'available' }, { status: 200 });
    } catch (error) {
      console.error('[Webhook:Airbnb] Availability check error:', error);
      // On error, allow the reservation by default (safer than rejecting)
      return NextResponse.json({ status: 'available' }, { status: 200 });
    }
  }

  // ── Type A: Reservation (async processing) ──
  if (payloadType === 'reservation') {
    const parsed = airbnbReservationWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid reservation payload' }, { status: 400 });
    }

    after(async () => {
      try {
        // Fetch full reservation details via standard Zodomus reservation API
        // and process using existing handleIncomingReservation
        await channelManagerLogRepo.create(orgId, {
          integrationId: integration.id,
          direction: SyncDirection.INBOUND,
          action: SyncAction.RECEIVE_RESERVATION,
          status: SyncStatus.SUCCESS,
          request: JSON.stringify(parsed.data),
        });

        // TODO: Parse Airbnb reservation into IncomingReservation format
        // and call channelManagerSyncService.handleIncomingReservation()
        console.log(`[Webhook:Airbnb] Reservation received: ${parsed.data.reservationId} (${parsed.data.reservationstatus})`);
      } catch (err) {
        console.error('[Webhook:Airbnb] Failed to process reservation:', err);
        await channelManagerLogRepo.create(orgId, {
          integrationId: integration.id,
          direction: SyncDirection.INBOUND,
          action: SyncAction.RECEIVE_RESERVATION,
          status: SyncStatus.ERROR,
          request: JSON.stringify(parsed.data),
          errorMessage: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    });

    return NextResponse.json({ status: 'accepted' }, { status: 200 });
  }

  // ── Type B: Notification (async processing) ──
  const parsed = airbnbNotificationWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid notification payload' }, { status: 400 });
  }

  after(async () => {
    try {
      const { notificationType, notificationSubtype, notificationTypeId } = parsed.data;

      await channelManagerLogRepo.create(orgId, {
        integrationId: integration.id,
        direction: SyncDirection.INBOUND,
        action: SyncAction.AIRBNB_NOTIFICATION,
        status: SyncStatus.SUCCESS,
        request: JSON.stringify(parsed.data),
      });

      // Handle specific notification types
      switch (notificationType) {
        case AirbnbNotificationType.HOST: {
          // Host status change — update airbnb_hosts table
          const host = await airbnbHostRepo.findByIntegration(orgId, integration.id);
          if (host) {
            const statusMap: Record<number, string> = {
              1: 'inactive',
              2: 'active',
              3: 'suspended',
              4: 'suspended',
              5: 'suspended',
              6: 'active',
              7: 'active',
            };
            const newStatus = statusMap[notificationSubtype] ?? 'unknown';
            await airbnbHostRepo.updateStatus(orgId, host.id, newStatus, String(notificationSubtype));
          }
          break;
        }

        case AirbnbNotificationType.RESERVATION: {
          // Reservation notification — get details and process
          console.log(`[Webhook:Airbnb] Reservation notification: type=${notificationType}, subtype=${notificationSubtype}, typeId=${notificationTypeId}`);
          try {
            const detail = await airbnbGetWebhookNotification(config, String(notificationTypeId));
            console.log(`[Webhook:Airbnb] Notification detail:`, JSON.stringify(detail));
          } catch (err) {
            console.error('[Webhook:Airbnb] Failed to fetch notification detail:', err);
          }
          break;
        }

        default:
          console.log(`[Webhook:Airbnb] Notification type=${notificationType}, subtype=${notificationSubtype}`);
          break;
      }
    } catch (err) {
      console.error('[Webhook:Airbnb] Failed to process notification:', err);
      await channelManagerLogRepo.create(orgId, {
        integrationId: integration.id,
        direction: SyncDirection.INBOUND,
        action: SyncAction.AIRBNB_NOTIFICATION,
        status: SyncStatus.ERROR,
        request: JSON.stringify(parsed.data),
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  return NextResponse.json({ status: 'accepted' }, { status: 200 });
}
