import { format, addDays } from 'date-fns';
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
// NOTE: Zodomus API uses **camelCase** everywhere — POST body keys, response keys,
//       AND GET query params (channelId, propertyId, dateFrom, dateTo).
//       Values like propertyId, roomId, rateId are STRINGS (e.g. "321000").
//       channelId can be number or string — Zodomus accepts both.

interface ZodomusStatus {
  returnCode: number | string; // 200 or "200" = success, 400 = error
  returnMessage: string | Record<string, string[]>; // string or validation errors object
  channelLogId?: string;
  channelOtherMessages?: string;
  timestamp?: string;
}

interface ZodomusRate {
  id: string;
  name: string;
  active?: string;
  maxPersons?: string;
  policy?: string;
  policyId?: string;
}

interface ZodomusRoom {
  id: string; // e.g. "32100001"
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
    apiStatus?: string;
    reservationType?: string;
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

interface ZodomusPropertyCheckResponse {
  status: ZodomusStatus;
  mappedProducts?: Array<{
    roomId: string;
    rateId: string;
    myRoomId: string;
    myRateId: string;
  }>;
}

// ── Helpers ──

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Zodomus requires dateTo > dateFrom. For single-day updates,
 * compute the next day as dateTo.
 */
function nextDay(dateStr: string): string {
  return format(addDays(new Date(dateStr), 1), 'yyyy-MM-dd');
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
 * Safely parse JSON, returning null on failure.
 */
function safeParseJson(text: string): { status?: ZodomusStatus; [key: string]: unknown } | null {
  try {
    return JSON.parse(text) as { status?: ZodomusStatus; [key: string]: unknown };
  } catch {
    return null;
  }
}

/**
 * Check if a Zodomus response indicates an error.
 * Zodomus returns HTTP 200 even on errors — the real status is in the body.
 * returnCode 200 or "200" = success (also 0/"0" for legacy), anything else = error.
 */
function isZodomusError(parsed: { status?: ZodomusStatus } | null): boolean {
  if (!parsed?.status) return false;
  const code = String(parsed.status.returnCode);
  return code !== '0' && code !== '200';
}

/**
 * Extract a human-readable error message from a Zodomus response.
 */
function getZodomusErrorMessage(parsed: { status?: ZodomusStatus } | null): string {
  if (!parsed?.status) return 'Unknown error';
  const msg = parsed.status.returnMessage;
  if (typeof msg === 'string') return msg;
  // Validation errors: { fieldName: ["error1", "error2"] }
  const parts: string[] = [];
  for (const [field, errors] of Object.entries(msg)) {
    parts.push(`${field}: ${(errors as string[]).join(', ')}`);
  }
  return parts.join('; ');
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
 * GET params use camelCase: channelId, propertyId
 */
async function fetchRoomRatesForChannel(
  config: CMConfig,
  channelId: number,
): Promise<ZodomusRoomRatesResponse> {
  const url = `${baseUrl(config)}/room-rates?channelId=${channelId}&propertyId=${encodeURIComponent(config.hotelId)}`;
  const response = await fetchWithRetry(
    url,
    {
      method: 'GET',
      headers: buildHeaders(config),
    },
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Failed to fetch room-rates for channel ${channelId}: HTTP ${response.status} → ${text}`);
  }

  const data = safeParseJson(text) as ZodomusRoomRatesResponse | null;
  if (!data) {
    throw new Error(`Failed to parse room-rates response for channel ${channelId}: ${text.substring(0, 200)}`);
  }

  if (isZodomusError(data)) {
    console.warn(`[Zodomus] fetchRoomRatesForChannel(${channelId}): API error → ${getZodomusErrorMessage(data)}`);
  }

  return data;
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
      const rooms = data.rooms ?? [];
      console.log(`[Zodomus] buildChannelRoomMap: channel ${channel.id} (${channel.channel}) → ${rooms.length} rooms`);
      for (const room of rooms) {
        const roomId = String(room.id);
        const existing = roomToChannels.get(roomId) ?? [];
        existing.push(channel.id);
        roomToChannels.set(roomId, existing);
      }
    } catch (err) {
      // Channel may not have this property configured — skip
      console.warn(`[Zodomus] buildChannelRoomMap: channel ${channel.id} (${channel.channel}) FAILED:`, err instanceof Error ? err.message : err);
      continue;
    }
  }

  console.log(`[Zodomus] buildChannelRoomMap: final map has ${roomToChannels.size} rooms →`, Object.fromEntries(roomToChannels));
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

      if (isZodomusError(data)) {
        return {
          valid: false,
          errorMessage: `Zodomus error: ${getZodomusErrorMessage(data)}`,
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
   * Per Zodomus docs, all POST body values are STRINGS:
   *   { "channelId": "1", "propertyId": "321000", "roomId": "32100001",
   *     "dateFrom": "2019-12-01", "dateTo": "2019-12-31", "availability": 2 }
   */
  async pushAvailability(
    config: CMConfig,
    updates: AvailabilityUpdate[],
    log?: LogCallback,
  ): Promise<SyncResult> {
    const start = Date.now();

    try {
      const channels = await fetchChannels(config);
      console.log(`[Zodomus] pushAvailability: ${channels.length} channels found: ${channels.map(c => `${c.channel}(${c.id})`).join(', ')}`);

      if (channels.length === 0) {
        console.log(`[Zodomus] pushAvailability: no channels → skipping`);
        return { status: SyncStatus.SUCCESS, updatesProcessed: 0 };
      }

      // Discover which rooms exist on which channels
      const roomToChannels = await buildChannelRoomMap(config, channels);

      // Log which external room IDs we're trying to push vs what's in the map
      const uniqueRoomIds = new Set(updates.map(u => u.externalRoomTypeId));
      console.log(`[Zodomus] pushAvailability: updates reference ${uniqueRoomIds.size} unique room IDs: ${Array.from(uniqueRoomIds).join(', ')}`);
      for (const roomId of uniqueRoomIds) {
        const chIds = roomToChannels.get(roomId);
        console.log(`[Zodomus] pushAvailability: room ${roomId} → channels: ${chIds ? chIds.join(', ') : 'NOT FOUND IN MAP'}`);
      }

      let totalSent = 0;
      let errorCount = 0;
      let lastErrorMsg = '';
      let firstErrorLogged = false;

      for (const update of updates) {
        const channelIds = roomToChannels.get(update.externalRoomTypeId) ?? [];

        for (const channelId of channelIds) {
          const body = {
            channelId: String(channelId),
            propertyId: config.hotelId,
            roomId: update.externalRoomTypeId,
            dateFrom: update.date,
            dateTo: nextDay(update.date), // Zodomus requires dateTo > dateFrom
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

          const text = await response.text();
          const parsed = safeParseJson(text);
          if (isZodomusError(parsed)) {
            errorCount++;
            lastErrorMsg = getZodomusErrorMessage(parsed);
            // Log first few errors for debugging
            if (!firstErrorLogged) {
              console.error(`[Zodomus] pushAvailability FIRST ERROR: body=${JSON.stringify(body)} → response=${text}`);
              firstErrorLogged = true;
            }
          }

          // Log progress every 100 requests
          if (totalSent % 100 === 0) {
            console.log(`[Zodomus] pushAvailability: progress ${totalSent} sent, ${errorCount} errors`);
          }
        }
      }

      const durationMs = Date.now() - start;
      const status = errorCount > 0 ? SyncStatus.ERROR : SyncStatus.SUCCESS;
      console.log(`[Zodomus] pushAvailability: DONE in ${durationMs}ms — ${totalSent} sent, ${errorCount} errors, ${totalSent - errorCount} success`);

      if (totalSent === 0) {
        console.warn(`[Zodomus] pushAvailability: 0 requests sent! Room IDs in updates don't match any channel room map entry.`);
      }

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
      console.error(`[Zodomus] pushAvailability EXCEPTION:`, errorMessage);

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
   * Per Zodomus docs:
   *   { "channelId": "1", "propertyId": "321000", "roomId": "32100001",
   *     "dateFrom": "2019-12-01", "dateTo": "2019-12-31", "currencyCode": "EUR",
   *     "rateId": "321000991", "prices": { "price": "145" }, "closed": "0" }
   */
  async pushRates(
    config: CMConfig,
    updates: RateUpdate[],
    log?: LogCallback,
  ): Promise<SyncResult> {
    const start = Date.now();

    try {
      const channels = await fetchChannels(config);
      console.log(`[Zodomus] pushRates: ${channels.length} channels found`);

      if (channels.length === 0) {
        return { status: SyncStatus.SUCCESS, updatesProcessed: 0 };
      }

      const roomToChannels = await buildChannelRoomMap(config, channels);

      let totalSent = 0;
      let errorCount = 0;
      let lastErrorMsg = '';
      let firstErrorLogged = false;

      for (const update of updates) {
        const channelIds = roomToChannels.get(update.externalRoomTypeId) ?? [];

        for (const channelId of channelIds) {
          const body = {
            channelId: String(channelId),
            propertyId: config.hotelId,
            roomId: update.externalRoomTypeId,
            rateId: update.externalRatePlanId,
            dateFrom: update.date,
            dateTo: nextDay(update.date), // Zodomus requires dateTo > dateFrom
            currencyCode: update.currency,
            prices: {
              price: String(update.amount), // Zodomus expects price as string: "145"
            },
            closed: '0', // Required field per Zodomus docs: 0 = open, 1 = closed
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

          const text = await response.text();
          const parsed = safeParseJson(text);
          if (isZodomusError(parsed)) {
            errorCount++;
            lastErrorMsg = getZodomusErrorMessage(parsed);
            if (!firstErrorLogged) {
              console.error(`[Zodomus] pushRates FIRST ERROR: body=${JSON.stringify(body)} → response=${text}`);
              firstErrorLogged = true;
            }
          }

          if (totalSent % 100 === 0) {
            console.log(`[Zodomus] pushRates: progress ${totalSent} sent, ${errorCount} errors`);
          }
        }
      }

      const durationMs = Date.now() - start;
      const status = errorCount > 0 ? SyncStatus.ERROR : SyncStatus.SUCCESS;
      console.log(`[Zodomus] pushRates: DONE in ${durationMs}ms — ${totalSent} sent, ${errorCount} errors, ${totalSent - errorCount} success`);

      if (totalSent === 0) {
        console.warn(`[Zodomus] pushRates: 0 requests sent! Room IDs in updates don't match any channel room map entry.`);
      }

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
      console.error(`[Zodomus] pushRates EXCEPTION:`, errorMessage);

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
   * closed, minimumStay, maximumStay, closedOnArrival, closedOnDeparture.
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
            channelId: String(channelId),
            propertyId: config.hotelId,
            roomId: update.externalRoomTypeId,
            rateId: update.externalRatePlanId,
            dateFrom: update.date,
            dateTo: nextDay(update.date), // Zodomus requires dateTo > dateFrom
          };

          if (update.minStay !== undefined) body.minimumStay = String(update.minStay);
          if (update.maxStay !== undefined) body.maximumStay = String(update.maxStay);
          if (update.closedToArrival !== undefined) body.closedOnArrival = update.closedToArrival ? '1' : '0';
          if (update.closedToDeparture !== undefined) body.closedOnDeparture = update.closedToDeparture ? '1' : '0';
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

          const text = await response.text();
          const parsed = safeParseJson(text);
          if (isZodomusError(parsed)) {
            errorCount++;
            lastErrorMsg = getZodomusErrorMessage(parsed);
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
   * Fetch room types via GET /room-rates?channelId=X&propertyId=Y.
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
   * Fetch rate plans via GET /room-rates?channelId=X&propertyId=Y.
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
   * Provision rooms and rates in Zodomus — Standard Channel Manager workflow.
   *
   * Official Zodomus workflow (from their documentation):
   *   1. POST /property-activation — activate property on each channel
   *   2. GET /room-rates — discover rooms & rates Zodomus pre-created
   *   3. POST /rooms-activation — map/bind rooms + rates to property
   *   4. POST /property-check — verify property is active and mapped
   *
   * NOTE: In the standard CM workflow, rooms and rates are created by Zodomus
   * upon property activation — we do NOT call POST /room or POST /rate.
   * The ContentItem[] params are used for display purposes only; the actual
   * rooms/rates come from Zodomus.
   */
  async provisionContent(
    config: CMConfig,
    _rooms: ContentItem[],
    _rates: ContentItem[],
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

      // Only provision on active channels (Booking=1, Expedia=2, Airbnb=3)
      const activeChannelIds = new Set([1, 2, 3]);
      const supportedChannels = channels.filter((c) => activeChannelIds.has(c.id));

      if (supportedChannels.length === 0) {
        return {
          success: false,
          roomsCreated: 0,
          ratesCreated: 0,
          errorMessage: 'No supported channels found. Zodomus currently supports Booking.com (1), Expedia (2), and Airbnb (3).',
        };
      }

      let totalRoomsDiscovered = 0;
      let totalRatesDiscovered = 0;
      const errors: string[] = [];
      const log: string[] = [];

      for (const channel of supportedChannels) {
        log.push(`\n=== Channel: ${channel.channel} (id=${channel.id}) ===`);

        // ── Step 1: Activate property on this channel ──
        try {
          const activationBody = {
            channelId: channel.id,
            propertyId: config.hotelId,
            priceModelId: '2', // Per Zodomus docs: "2" for standard pricing
          };

          const res = await fetchWithRetry(
            `${baseUrl(config)}/property-activation`,
            {
              method: 'POST',
              headers: buildHeaders(config, 'application/json'),
              body: JSON.stringify(activationBody),
            },
          );

          const text = await res.text();
          log.push(`[1] POST /property-activation: HTTP ${res.status} → ${text}`);

          const parsed = safeParseJson(text);
          if (isZodomusError(parsed)) {
            const msg = getZodomusErrorMessage(parsed);
            // "awaiting approval" is OK — it means the activation was submitted
            if (!msg.toLowerCase().includes('awaiting')) {
              errors.push(`Property activation on ${channel.channel}: ${msg}`);
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.push(`[1] POST /property-activation: ERROR → ${msg}`);
          errors.push(`Property activation on ${channel.channel}: ${msg}`);
        }

        // ── Step 2: Discover rooms & rates ──
        let discoveredRooms: ZodomusRoom[] = [];
        try {
          const roomRatesData = await fetchRoomRatesForChannel(config, channel.id);
          discoveredRooms = roomRatesData.rooms ?? [];
          log.push(`[2] GET /room-rates: found ${discoveredRooms.length} rooms`);

          for (const dr of discoveredRooms) {
            const rateNames = (dr.rates ?? []).map((r) => `${r.name} (${r.id})`).join(', ');
            log.push(`    → Room "${dr.name}" (id=${dr.id}) rates=[${rateNames}]`);
            totalRoomsDiscovered++;
            totalRatesDiscovered += (dr.rates ?? []).length;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.push(`[2] GET /room-rates: ERROR → ${msg}`);
        }

        // ── Step 3: Activate/map rooms with rates ──
        if (discoveredRooms.length > 0) {
          try {
            const roomsPayload = discoveredRooms.map((room) => ({
              roomId: String(room.id),
              roomName: room.name,
              quantity: 1,
              status: 1, // 1 = active
              rates: (room.rates ?? []).map((r) => String(r.id)),
            }));

            const activationBody = {
              channelId: channel.id,
              propertyId: config.hotelId,
              rooms: roomsPayload,
            };

            const res = await fetchWithRetry(
              `${baseUrl(config)}/rooms-activation`,
              {
                method: 'POST',
                headers: buildHeaders(config, 'application/json'),
                body: JSON.stringify(activationBody),
              },
            );

            const text = await res.text();
            log.push(`[3] POST /rooms-activation: HTTP ${res.status} → ${text}`);

            const parsed = safeParseJson(text);
            if (isZodomusError(parsed)) {
              errors.push(`Rooms activation on ${channel.channel}: ${getZodomusErrorMessage(parsed)}`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.push(`[3] POST /rooms-activation: ERROR → ${msg}`);
            errors.push(`Rooms activation on ${channel.channel}: ${msg}`);
          }
        } else {
          log.push(`[3] POST /rooms-activation: SKIPPED — no rooms discovered`);
        }

        // ── Step 4: Verify property status ──
        try {
          const checkBody = {
            channelId: String(channel.id),
            propertyId: config.hotelId,
          };

          const res = await fetchWithRetry(
            `${baseUrl(config)}/property-check`,
            {
              method: 'POST',
              headers: buildHeaders(config, 'application/json'),
              body: JSON.stringify(checkBody),
            },
          );

          const text = await res.text();
          log.push(`[4] POST /property-check: HTTP ${res.status} → ${text}`);

          const parsed = safeParseJson(text) as ZodomusPropertyCheckResponse | null;
          if (parsed && !isZodomusError(parsed)) {
            const mapped = (parsed as ZodomusPropertyCheckResponse).mappedProducts ?? [];
            log.push(`    → ${mapped.length} mapped products`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.push(`[4] POST /property-check: ERROR → ${msg}`);
          // Non-fatal — just informational
        }
      }

      // Log all raw responses for debugging
      const details = log.join('\n');
      console.log('[Zodomus] Provision log:\n', details);

      const errorMessage = errors.length > 0 ? errors.join('; ') : undefined;

      return {
        success: errors.length === 0 && totalRoomsDiscovered > 0,
        roomsCreated: totalRoomsDiscovered,
        ratesCreated: totalRatesDiscovered,
        errorMessage,
        details,
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
