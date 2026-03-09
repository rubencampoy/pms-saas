import { SyncDirection, SyncAction, SyncStatus, RETRY_ATTEMPTS, RETRY_BASE_DELAY_MS } from '@/lib/constants/channel-manager';
import type {
  ChannelManagerProvider,
  CMConfig,
  ValidationResult,
  AvailabilityUpdate,
  RateUpdate,
  RestrictionUpdate,
  SyncResult,
  IncomingReservation,
  ExternalRoomType,
  ExternalRatePlan,
  LogCallback,
  ContentItem,
  ProvisionResult,
} from '@/lib/channel-manager/types';

// ── Zodomus API response types ──

interface ZodomusStatus {
  return_code: number;
  return_message: string;
  channel_log_id?: string;
  channel_other_messages?: string;
  timestamp?: string;
}

interface ZodomusRate {
  id: string;
  name: string;
  active?: string;
  max_persons?: number;
  policy?: string;
  policy_id?: number;
}

interface ZodomusRoom {
  id: number;
  name: string;
  rates?: ZodomusRate[];
}

interface ZodomusRoomRatesResponse {
  status: ZodomusStatus;
  rooms?: ZodomusRoom[];
}

interface ZodomusAccountResponse {
  status: ZodomusStatus;
  account?: {
    name?: string;
    email?: string;
    api_status?: string;
    reservation_type?: string;
  };
}

interface ZodomusChannel {
  id: number;
  channel: string;
}

interface ZodomusChannelResponse {
  status: ZodomusStatus;
  channels?: ZodomusChannel[];
}

// ── Helpers ──

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = RETRY_ATTEMPTS,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    if (attempt < retries - 1) {
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
    }
  }

  throw lastError ?? new Error('Request failed after retries');
}

/**
 * Build HTTP Basic Auth headers for Zodomus API.
 * Zodomus uses standard HTTP Basic Authentication with API User + API Password.
 */
function buildHeaders(config: CMConfig, contentType?: string): Record<string, string> {
  const credentials = Buffer.from(`${config.apiUser}:${config.apiPassword}`).toString('base64');
  const headers: Record<string, string> = {
    Authorization: `Basic ${credentials}`,
    Accept: 'application/json',
  };

  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  return headers;
}

/**
 * Build the base URL, stripping any trailing slash.
 */
function baseUrl(config: CMConfig): string {
  return config.endpointUrl.replace(/\/+$/, '');
}

/**
 * Fetch the list of active channels from Zodomus.
 * Each channel represents an OTA (Booking, Expedia, Airbnb, etc.)
 */
async function fetchChannels(config: CMConfig): Promise<ZodomusChannel[]> {
  const response = await fetchWithRetry(
    `${baseUrl(config)}/channels`,
    {
      method: 'GET',
      headers: buildHeaders(config),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch channels: HTTP ${response.status}`);
  }

  const data = (await response.json()) as ZodomusChannelResponse;
  return data.channels ?? [];
}

/**
 * Fetch room-rates for a specific channel.
 * Returns rooms with their nested rate plans.
 */
async function fetchRoomRatesForChannel(
  config: CMConfig,
  channelId: number,
): Promise<ZodomusRoomRatesResponse> {
  const response = await fetchWithRetry(
    `${baseUrl(config)}/room-rates?channel_id=${channelId}&property_id=${encodeURIComponent(config.hotelId)}`,
    {
      method: 'GET',
      headers: buildHeaders(config),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch room-rates for channel ${channelId}: HTTP ${response.status}`);
  }

  return (await response.json()) as ZodomusRoomRatesResponse;
}

/**
 * Build a lookup of which room IDs exist on which channels.
 * This avoids pushing to channels that don't have a given room.
 */
async function buildChannelRoomMap(
  config: CMConfig,
  channels: ZodomusChannel[],
): Promise<Map<string, number[]>> {
  const roomToChannels = new Map<string, number[]>();

  for (const channel of channels) {
    try {
      const data = await fetchRoomRatesForChannel(config, channel.id);
      for (const room of data.rooms ?? []) {
        const roomId = String(room.id);
        const existing = roomToChannels.get(roomId) ?? [];
        existing.push(channel.id);
        roomToChannels.set(roomId, existing);
      }
    } catch {
      // Channel may not have this property configured — skip
      continue;
    }
  }

  return roomToChannels;
}

// ── Provider implementation ──

export const zodomusProvider: ChannelManagerProvider = {
  /**
   * Validate credentials by calling GET /account.
   * This endpoint only requires valid Basic Auth — no channel/property needed.
   */
  async validateCredentials(config: CMConfig): Promise<ValidationResult> {
    try {
      const response = await fetchWithRetry(
        `${baseUrl(config)}/account`,
        {
          method: 'GET',
          headers: buildHeaders(config),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        return {
          valid: false,
          errorMessage: `Connection failed (${response.status}): ${body}`,
        };
      }

      const data = (await response.json()) as ZodomusAccountResponse;

      if (data.status?.return_code !== undefined && data.status.return_code !== 0) {
        return {
          valid: false,
          errorMessage: `Zodomus error: ${data.status.return_message}`,
        };
      }

      return {
        valid: true,
        hotelName: data.account?.name,
      };
    } catch (err) {
      return {
        valid: false,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  },

  /**
   * Push availability using POST /availability.
   * Discovers active channels, then pushes each update to every channel
   * that has the corresponding room configured.
   *
   * Zodomus expects: { channel_id, property_id, room_id, date_from, date_to, availability }
   */
  async pushAvailability(
    config: CMConfig,
    updates: AvailabilityUpdate[],
    log?: LogCallback,
  ): Promise<SyncResult> {
    const start = Date.now();

    try {
      const channels = await fetchChannels(config);
      if (channels.length === 0) {
        return { status: SyncStatus.SUCCESS, updatesProcessed: 0 };
      }

      // Discover which rooms exist on which channels
      const roomToChannels = await buildChannelRoomMap(config, channels);

      let totalSent = 0;
      let errorCount = 0;
      let lastErrorMsg = '';

      for (const update of updates) {
        const channelIds = roomToChannels.get(update.externalRoomTypeId) ?? [];

        for (const channelId of channelIds) {
          const body = {
            channel_id: channelId,
            property_id: config.hotelId,
            room_id: update.externalRoomTypeId,
            date_from: update.date,
            date_to: update.date,
            availability: update.available,
          };

          const response = await fetchWithRetry(
            `${baseUrl(config)}/availability`,
            {
              method: 'POST',
              headers: buildHeaders(config, 'application/json'),
              body: JSON.stringify(body),
            },
          );

          totalSent++;

          if (!response.ok) {
            errorCount++;
            const responseText = await response.text();
            lastErrorMsg = `HTTP ${response.status}: ${responseText}`;
          }
        }
      }

      const durationMs = Date.now() - start;
      const status = errorCount > 0 ? SyncStatus.ERROR : SyncStatus.SUCCESS;

      await log?.({
        direction: SyncDirection.OUTBOUND,
        action: SyncAction.PUSH_AVAILABILITY,
        status,
        request: JSON.stringify({ updatesCount: updates.length, channelsCount: channels.length }),
        errorMessage: errorCount > 0 ? `${errorCount}/${totalSent} failed: ${lastErrorMsg}` : undefined,
        durationMs,
      });

      return {
        status,
        updatesProcessed: totalSent - errorCount,
        errorMessage: errorCount > 0 ? `${errorCount}/${totalSent} failed: ${lastErrorMsg}` : undefined,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      await log?.({
        direction: SyncDirection.OUTBOUND,
        action: SyncAction.PUSH_AVAILABILITY,
        status: SyncStatus.ERROR,
        errorMessage,
        durationMs,
      });

      return { status: SyncStatus.ERROR, updatesProcessed: 0, errorMessage };
    }
  },

  /**
   * Push rates using POST /rates.
   * Discovers active channels, then pushes each rate update to every channel
   * that has the corresponding room configured.
   *
   * Zodomus expects: { channel_id, property_id, room_id, rate_id,
   *   date_from, date_to, currency_code, prices: { price } }
   */
  async pushRates(
    config: CMConfig,
    updates: RateUpdate[],
    log?: LogCallback,
  ): Promise<SyncResult> {
    const start = Date.now();

    try {
      const channels = await fetchChannels(config);
      if (channels.length === 0) {
        return { status: SyncStatus.SUCCESS, updatesProcessed: 0 };
      }

      const roomToChannels = await buildChannelRoomMap(config, channels);

      let totalSent = 0;
      let errorCount = 0;
      let lastErrorMsg = '';

      for (const update of updates) {
        const channelIds = roomToChannels.get(update.externalRoomTypeId) ?? [];

        for (const channelId of channelIds) {
          const body = {
            channel_id: channelId,
            property_id: config.hotelId,
            room_id: update.externalRoomTypeId,
            rate_id: update.externalRatePlanId,
            date_from: update.date,
            date_to: update.date,
            currency_code: update.currency,
            prices: {
              price: update.amount,
            },
          };

          const response = await fetchWithRetry(
            `${baseUrl(config)}/rates`,
            {
              method: 'POST',
              headers: buildHeaders(config, 'application/json'),
              body: JSON.stringify(body),
            },
          );

          totalSent++;

          if (!response.ok) {
            errorCount++;
            const responseText = await response.text();
            lastErrorMsg = `HTTP ${response.status}: ${responseText}`;
          }
        }
      }

      const durationMs = Date.now() - start;
      const status = errorCount > 0 ? SyncStatus.ERROR : SyncStatus.SUCCESS;

      await log?.({
        direction: SyncDirection.OUTBOUND,
        action: SyncAction.PUSH_RATES,
        status,
        request: JSON.stringify({ updatesCount: updates.length, channelsCount: channels.length }),
        errorMessage: errorCount > 0 ? `${errorCount}/${totalSent} failed: ${lastErrorMsg}` : undefined,
        durationMs,
      });

      return {
        status,
        updatesProcessed: totalSent - errorCount,
        errorMessage: errorCount > 0 ? `${errorCount}/${totalSent} failed: ${lastErrorMsg}` : undefined,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      await log?.({
        direction: SyncDirection.OUTBOUND,
        action: SyncAction.PUSH_RATES,
        status: SyncStatus.ERROR,
        errorMessage,
        durationMs,
      });

      return { status: SyncStatus.ERROR, updatesProcessed: 0, errorMessage };
    }
  },

  /**
   * Push restrictions using POST /rates.
   * Zodomus includes restrictions in the /rates endpoint via fields like
   * closed, minimum_stay, maximum_stay, closed_on_arrival, closed_on_departure.
   */
  async pushRestrictions(
    config: CMConfig,
    updates: RestrictionUpdate[],
    log?: LogCallback,
  ): Promise<SyncResult> {
    const start = Date.now();

    try {
      const channels = await fetchChannels(config);
      if (channels.length === 0) {
        return { status: SyncStatus.SUCCESS, updatesProcessed: 0 };
      }

      const roomToChannels = await buildChannelRoomMap(config, channels);

      let totalSent = 0;
      let errorCount = 0;
      let lastErrorMsg = '';

      for (const update of updates) {
        const channelIds = roomToChannels.get(update.externalRoomTypeId) ?? [];

        for (const channelId of channelIds) {
          const body: Record<string, unknown> = {
            channel_id: channelId,
            property_id: config.hotelId,
            room_id: update.externalRoomTypeId,
            rate_id: update.externalRatePlanId,
            date_from: update.date,
            date_to: update.date,
          };

          if (update.minStay !== undefined) body.minimum_stay = String(update.minStay);
          if (update.maxStay !== undefined) body.maximum_stay = String(update.maxStay);
          if (update.closedToArrival !== undefined) body.closed_on_arrival = update.closedToArrival ? '1' : '0';
          if (update.closedToDeparture !== undefined) body.closed_on_departure = update.closedToDeparture ? '1' : '0';
          if (update.stopSell !== undefined) body.closed = update.stopSell ? '1' : '0';

          const response = await fetchWithRetry(
            `${baseUrl(config)}/rates`,
            {
              method: 'POST',
              headers: buildHeaders(config, 'application/json'),
              body: JSON.stringify(body),
            },
          );

          totalSent++;

          if (!response.ok) {
            errorCount++;
            const responseText = await response.text();
            lastErrorMsg = `HTTP ${response.status}: ${responseText}`;
          }
        }
      }

      const durationMs = Date.now() - start;
      const status = errorCount > 0 ? SyncStatus.ERROR : SyncStatus.SUCCESS;

      await log?.({
        direction: SyncDirection.OUTBOUND,
        action: SyncAction.PUSH_RESTRICTIONS,
        status,
        request: JSON.stringify({ updatesCount: updates.length, channelsCount: channels.length }),
        errorMessage: errorCount > 0 ? `${errorCount}/${totalSent} failed: ${lastErrorMsg}` : undefined,
        durationMs,
      });

      return {
        status,
        updatesProcessed: totalSent - errorCount,
        errorMessage: errorCount > 0 ? `${errorCount}/${totalSent} failed: ${lastErrorMsg}` : undefined,
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      await log?.({
        direction: SyncDirection.OUTBOUND,
        action: SyncAction.PUSH_RESTRICTIONS,
        status: SyncStatus.ERROR,
        errorMessage,
        durationMs,
      });

      return { status: SyncStatus.ERROR, updatesProcessed: 0, errorMessage };
    }
  },

  parseWebhookPayload(
    _headers: Record<string, string>,
    body: unknown,
  ): IncomingReservation {
    const data = body as {
      reservationId: string;
      roomTypeId: string;
      ratePlanId: string;
      guest: { firstName: string; lastName: string; email: string; phone?: string };
      checkIn: string;
      checkOut: string;
      adults: number;
      children: number;
      totalAmount: string;
      currency: string;
      source: string;
      specialRequests?: string;
    };

    return {
      externalId: data.reservationId,
      externalRoomTypeId: data.roomTypeId,
      externalRatePlanId: data.ratePlanId,
      guestFirstName: data.guest.firstName,
      guestLastName: data.guest.lastName,
      guestEmail: data.guest.email,
      guestPhone: data.guest.phone,
      checkInDate: data.checkIn,
      checkOutDate: data.checkOut,
      adults: data.adults,
      children: data.children,
      totalAmount: data.totalAmount,
      currency: data.currency,
      source: data.source,
      specialRequests: data.specialRequests,
    };
  },

  /**
   * Fetch room types via GET /room-rates?channel_id=X&property_id=Y.
   * First discovers available channels, then fetches rooms for each.
   * Deduplicates rooms by ID across channels.
   */
  async fetchExternalRoomTypes(config: CMConfig): Promise<ExternalRoomType[]> {
    const channels = await fetchChannels(config);

    if (channels.length === 0) {
      return [];
    }

    const roomMap = new Map<string, ExternalRoomType>();

    for (const channel of channels) {
      try {
        const data = await fetchRoomRatesForChannel(config, channel.id);
        for (const room of data.rooms ?? []) {
          const roomId = String(room.id);
          if (!roomMap.has(roomId)) {
            roomMap.set(roomId, {
              id: roomId,
              name: room.name,
            });
          }
        }
      } catch {
        // Channel may not have this property — skip
        continue;
      }
    }

    return Array.from(roomMap.values());
  },

  /**
   * Fetch rate plans via GET /room-rates?channel_id=X&property_id=Y.
   * Rate plans are nested within rooms in the Zodomus API.
   * Deduplicates by room+rate combination across channels.
   */
  async fetchExternalRatePlans(config: CMConfig): Promise<ExternalRatePlan[]> {
    const channels = await fetchChannels(config);

    if (channels.length === 0) {
      return [];
    }

    const ratePlanMap = new Map<string, ExternalRatePlan>();

    for (const channel of channels) {
      try {
        const data = await fetchRoomRatesForChannel(config, channel.id);
        for (const room of data.rooms ?? []) {
          for (const rate of room.rates ?? []) {
            const key = `${room.id}-${rate.id}`;
            if (!ratePlanMap.has(key)) {
              ratePlanMap.set(key, {
                id: rate.id,
                name: rate.name,
                roomTypeId: String(room.id),
              });
            }
          }
        }
      } catch {
        // Skip channels that fail
        continue;
      }
    }

    return Array.from(ratePlanMap.values());
  },

  /**
   * Provision rooms and rates in Zodomus via the Content API.
   * Creates rooms (POST /room) and rates (POST /rate) for each active channel.
   * After provisioning, rooms and rates will appear in GET /room-rates for mapping.
   *
   * Zodomus Content API models:
   *   RoomRequest: { channel_id, status, name }
   *   RateRequest: { channel_id, status, name }
   *
   * Responses always include a `status.return_code` — 0 means success,
   * any other value means an error even if HTTP status is 200.
   */
  async provisionContent(
    config: CMConfig,
    rooms: ContentItem[],
    rates: ContentItem[],
  ): Promise<ProvisionResult> {
    try {
      const channels = await fetchChannels(config);

      if (channels.length === 0) {
        return {
          success: false,
          roomsCreated: 0,
          ratesCreated: 0,
          errorMessage: 'No active channels found in Zodomus. Please configure at least one channel in the Zodomus backoffice.',
        };
      }

      let roomsCreated = 0;
      let ratesCreated = 0;
      const errors: string[] = [];
      const responses: string[] = [];

      for (const channel of channels) {
        // Create rooms for this channel
        for (const room of rooms) {
          try {
            const requestBody = {
              channel_id: channel.id,
              status: 'New',
              name: room.name,
            };

            const response = await fetchWithRetry(
              `${baseUrl(config)}/room`,
              {
                method: 'POST',
                headers: buildHeaders(config, 'application/json'),
                body: JSON.stringify(requestBody),
              },
            );

            const responseText = await response.text();
            responses.push(`POST /room [${channel.channel}] "${room.name}": HTTP ${response.status} → ${responseText}`);

            if (!response.ok) {
              if (response.status !== 409) {
                errors.push(`Room "${room.name}" on ${channel.channel}: HTTP ${response.status} ${responseText}`);
              }
              continue;
            }

            // Check Zodomus status in response body
            try {
              const parsed = JSON.parse(responseText) as { status?: ZodomusStatus };
              if (parsed.status && parsed.status.return_code !== 0) {
                errors.push(`Room "${room.name}" on ${channel.channel}: ${parsed.status.return_message}`);
                continue;
              }
            } catch {
              // Response may not be JSON — treat HTTP 200 as success
            }

            roomsCreated++;
          } catch (err) {
            errors.push(`Room "${room.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }

        // Create rates for this channel
        for (const rate of rates) {
          try {
            const requestBody = {
              channel_id: channel.id,
              status: 'New',
              name: rate.name,
            };

            const response = await fetchWithRetry(
              `${baseUrl(config)}/rate`,
              {
                method: 'POST',
                headers: buildHeaders(config, 'application/json'),
                body: JSON.stringify(requestBody),
              },
            );

            const responseText = await response.text();
            responses.push(`POST /rate [${channel.channel}] "${rate.name}": HTTP ${response.status} → ${responseText}`);

            if (!response.ok) {
              if (response.status !== 409) {
                errors.push(`Rate "${rate.name}" on ${channel.channel}: HTTP ${response.status} ${responseText}`);
              }
              continue;
            }

            // Check Zodomus status in response body
            try {
              const parsed = JSON.parse(responseText) as { status?: ZodomusStatus };
              if (parsed.status && parsed.status.return_code !== 0) {
                errors.push(`Rate "${rate.name}" on ${channel.channel}: ${parsed.status.return_message}`);
                continue;
              }
            } catch {
              // Response may not be JSON — treat HTTP 200 as success
            }

            ratesCreated++;
          } catch (err) {
            errors.push(`Rate "${rate.name}": ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        }
      }

      // Log all raw responses for debugging
      console.log('[Zodomus] Provision responses:', responses.join('\n'));

      const errorMessage = errors.length > 0 ? errors.join('; ') : undefined;

      return {
        success: errors.length === 0 && (roomsCreated > 0 || ratesCreated > 0),
        roomsCreated,
        ratesCreated,
        errorMessage,
      };
    } catch (err) {
      return {
        success: false,
        roomsCreated: 0,
        ratesCreated: 0,
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  },
};
