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
 * Extended channel room info: which rooms exist on which channels,
 * which rates each room has per channel, and room details for rooms-activation.
 */
interface ChannelRoomInfo {
  roomToChannels: Map<string, number[]>;
  /** channelId → roomId → set of rateIds */
  channelRoomRates: Map<number, Map<string, Set<string>>>;
  /** roomId → { name, rateIds } for rooms-activation payload */
  roomDetails: Map<string, { name: string; rateIds: string[] }>;
}

/**
 * Build a lookup of which room IDs exist on which channels,
 * plus which rate IDs belong to which rooms on each channel.
 */
async function buildChannelRoomInfo(
  config: CMConfig,
  channels: ZodomusChannel[],
): Promise<ChannelRoomInfo> {
  const roomToChannels = new Map<string, number[]>();
  const channelRoomRates = new Map<number, Map<string, Set<string>>>();
  const roomDetails = new Map<string, { name: string; rateIds: string[] }>();

  for (const channel of channels) {
    try {
      const data = await fetchRoomRatesForChannel(config, channel.id);
      const rooms = data.rooms ?? [];
      console.log(`[Zodomus] buildChannelRoomInfo: channel ${channel.id} (${channel.channel}) → ${rooms.length} rooms`);

      const roomRates = new Map<string, Set<string>>();

      for (const room of rooms) {
        const roomId = String(room.id);
        const rateIds = (room.rates ?? []).map((r) => String(r.id));

        // roomToChannels
        const existing = roomToChannels.get(roomId) ?? [];
        existing.push(channel.id);
        roomToChannels.set(roomId, existing);

        // channelRoomRates
        roomRates.set(roomId, new Set(rateIds));

        // roomDetails (keep first occurrence)
        if (!roomDetails.has(roomId)) {
          roomDetails.set(roomId, { name: room.name, rateIds });
        }
      }

      channelRoomRates.set(channel.id, roomRates);
    } catch (err) {
      console.warn(`[Zodomus] buildChannelRoomInfo: channel ${channel.id} (${channel.channel}) FAILED:`, err instanceof Error ? err.message : err);
      continue;
    }
  }

  console.log(`[Zodomus] buildChannelRoomInfo: final map has ${roomToChannels.size} rooms →`, Object.fromEntries(roomToChannels));
  return { roomToChannels, channelRoomRates, roomDetails };
}

/** Max concurrent HTTP requests to Zodomus */
const CONCURRENCY = 5;

/**
 * Run async tasks with limited concurrency.
 * Returns results in the same order as the input.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      results[idx] = await tasks[idx]!();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Group consecutive availability updates by (roomId, availability) into date ranges.
 * For example, if room 101 has 2 available from Mar 1-5 and 1 available from Mar 6-8,
 * this produces two batches: {dateFrom: Mar 1, dateTo: Mar 6, avail: 2} and
 * {dateFrom: Mar 6, dateTo: Mar 9, avail: 1}.
 */
interface AvailBatch {
  externalRoomTypeId: string;
  dateFrom: string;
  dateTo: string;
  available: number;
}

function batchAvailabilityUpdates(updates: AvailabilityUpdate[]): AvailBatch[] {
  // Sort by room, then date
  const sorted = [...updates].sort((a, b) => {
    if (a.externalRoomTypeId !== b.externalRoomTypeId) {
      return a.externalRoomTypeId.localeCompare(b.externalRoomTypeId);
    }
    return a.date.localeCompare(b.date);
  });

  const batches: AvailBatch[] = [];
  let current: AvailBatch | null = null;

  for (const update of sorted) {
    if (
      current &&
      current.externalRoomTypeId === update.externalRoomTypeId &&
      current.available === update.available &&
      // Check consecutive: dateTo of current batch == update.date
      current.dateTo === update.date
    ) {
      // Extend the range
      current.dateTo = nextDay(update.date);
    } else {
      // Start a new batch
      if (current) batches.push(current);
      current = {
        externalRoomTypeId: update.externalRoomTypeId,
        dateFrom: update.date,
        dateTo: nextDay(update.date),
        available: update.available,
      };
    }
  }

  if (current) batches.push(current);
  return batches;
}

/**
 * Group consecutive rate updates by (roomId, rateId, amount, currency) into date ranges.
 */
interface RateBatch {
  externalRoomTypeId: string;
  externalRatePlanId: string;
  dateFrom: string;
  dateTo: string;
  amount: string;
  currency: string;
}

function batchRateUpdates(updates: RateUpdate[]): RateBatch[] {
  const sorted = [...updates].sort((a, b) => {
    if (a.externalRoomTypeId !== b.externalRoomTypeId) return a.externalRoomTypeId.localeCompare(b.externalRoomTypeId);
    if (a.externalRatePlanId !== b.externalRatePlanId) return a.externalRatePlanId.localeCompare(b.externalRatePlanId);
    return a.date.localeCompare(b.date);
  });

  const batches: RateBatch[] = [];
  let current: RateBatch | null = null;

  for (const update of sorted) {
    const amountStr = String(update.amount);
    if (
      current &&
      current.externalRoomTypeId === update.externalRoomTypeId &&
      current.externalRatePlanId === update.externalRatePlanId &&
      current.amount === amountStr &&
      current.currency === update.currency &&
      current.dateTo === update.date
    ) {
      current.dateTo = nextDay(update.date);
    } else {
      if (current) batches.push(current);
      current = {
        externalRoomTypeId: update.externalRoomTypeId,
        externalRatePlanId: update.externalRatePlanId,
        dateFrom: update.date,
        dateTo: nextDay(update.date),
        amount: amountStr,
        currency: update.currency,
      };
    }
  }

  if (current) batches.push(current);
  return batches;
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

      const roomInfo = await buildChannelRoomInfo(config, channels);

      // ── Auto-update room quantities in Zodomus before pushing ──
      // Compute max availability we'll send per room, then call rooms-activation
      // to declare that quantity. This prevents "availability higher than declared" errors.
      const maxAvailPerRoom = new Map<string, number>();
      for (const update of updates) {
        const cur = maxAvailPerRoom.get(update.externalRoomTypeId) ?? 0;
        maxAvailPerRoom.set(update.externalRoomTypeId, Math.max(cur, update.available));
      }

      // Track channels where rooms-activation succeeded — only push availability to those
      const activatedChannels = new Set<number>();

      for (const channel of channels) {
        const roomRates = roomInfo.channelRoomRates.get(channel.id);
        if (!roomRates || roomRates.size === 0) continue;

        const roomsPayload: { roomId: string; roomName: string; quantity: number; status: number; rates: string[] }[] = [];
        for (const [roomId, rateIds] of roomRates) {
          const details = roomInfo.roomDetails.get(roomId);
          const maxAvail = maxAvailPerRoom.get(roomId) ?? 1;
          roomsPayload.push({
            roomId,
            roomName: details?.name ?? roomId,
            quantity: maxAvail,
            status: 1,
            rates: Array.from(rateIds),
          });
        }

        try {
          const activationRes = await fetchWithRetry(`${baseUrl(config)}/rooms-activation`, {
            method: 'POST',
            headers: buildHeaders(config, 'application/json'),
            body: JSON.stringify({
              channelId: channel.id,
              propertyId: config.hotelId,
              rooms: roomsPayload,
            }),
          });
          const activationText = await activationRes.text();
          const activationParsed = safeParseJson(activationText);

          if (isZodomusError(activationParsed)) {
            console.error(`[Zodomus] pushAvailability: rooms-activation REJECTED on channel ${channel.id}: ${activationText}`);
            // Do NOT add to activatedChannels — skip availability for this channel
          } else {
            activatedChannels.add(channel.id);
            console.log(`[Zodomus] pushAvailability: rooms-activation OK on channel ${channel.id}: ${roomsPayload.map(r => `${r.roomId}=${r.quantity}`).join(', ')}`);
          }
        } catch (err) {
          console.error(`[Zodomus] pushAvailability: rooms-activation FAILED on channel ${channel.id}:`, err instanceof Error ? err.message : err);
          // Do NOT add to activatedChannels — skip availability for this channel
        }
      }

      if (activatedChannels.size === 0) {
        console.warn(`[Zodomus] pushAvailability: rooms-activation failed on ALL channels — skipping availability push`);
      }

      // Batch consecutive dates with same availability into ranges
      const batches = batchAvailabilityUpdates(updates);
      console.log(`[Zodomus] pushAvailability: ${updates.length} updates batched into ${batches.length} date ranges`);

      let totalSent = 0;
      let errorCount = 0;
      let lastErrorMsg = '';
      let firstErrorLogged = false;

      // Group batches by channel and use /availability-multiple for fewer HTTP calls
      const tasks: (() => Promise<void>)[] = [];

      for (const channelId of activatedChannels) {
        // Collect all batches for rooms on this channel
        const channelBatches: AvailBatch[] = [];
        for (const batch of batches) {
          const channelIds = roomInfo.roomToChannels.get(batch.externalRoomTypeId) ?? [];
          if (channelIds.includes(channelId)) {
            channelBatches.push(batch);
          }
        }

        if (channelBatches.length === 0) continue;

        // Split into chunks to avoid oversized payloads (max ~50 items per request)
        const BATCH_CHUNK_SIZE = 50;
        for (let i = 0; i < channelBatches.length; i += BATCH_CHUNK_SIZE) {
          const chunk = channelBatches.slice(i, i + BATCH_CHUNK_SIZE);
          const body = {
            channelId: String(channelId),
            propertyId: config.hotelId,
            roomIds: chunk.map((b) => ({
              roomId: b.externalRoomTypeId,
              dateFrom: b.dateFrom,
              dateTo: b.dateTo,
              availability: b.available,
            })),
          };

          tasks.push(async () => {
            const response = await fetchWithRetry(
              `${baseUrl(config)}/availability-multiple`,
              {
                method: 'POST',
                headers: buildHeaders(config, 'application/json'),
                body: JSON.stringify(body),
              },
            );

            totalSent += chunk.length;
            const text = await response.text();
            const parsed = safeParseJson(text);
            if (isZodomusError(parsed)) {
              errorCount += chunk.length;
              lastErrorMsg = getZodomusErrorMessage(parsed);
              if (!firstErrorLogged) {
                console.error(`[Zodomus] pushAvailability FIRST ERROR: channel=${channelId} items=${chunk.length} → response=${text}`);
                firstErrorLogged = true;
              }
            }

            if (totalSent % 100 === 0) {
              console.log(`[Zodomus] pushAvailability: progress ${totalSent} sent, ${errorCount} errors`);
            }
          });
        }
      }

      if (tasks.length === 0 && activatedChannels.size > 0) {
        console.warn(`[Zodomus] pushAvailability: 0 requests to send! Room IDs in updates don't match any channel room map entry.`);
      } else {
        await runWithConcurrency(tasks, CONCURRENCY);
      }

      const durationMs = Date.now() - start;
      const status = errorCount > 0 ? SyncStatus.ERROR : SyncStatus.SUCCESS;
      console.log(`[Zodomus] pushAvailability: DONE in ${durationMs}ms — ${totalSent} sent, ${errorCount} errors, ${totalSent - errorCount} success`);

      await log?.({
        direction: SyncDirection.OUTBOUND,
        action: SyncAction.PUSH_AVAILABILITY,
        status,
        request: JSON.stringify({ updatesCount: updates.length, batchesCount: batches.length, channelsCount: channels.length }),
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

      const roomInfo = await buildChannelRoomInfo(config, channels);

      // Batch consecutive dates with same rate into ranges
      const batches = batchRateUpdates(updates);
      console.log(`[Zodomus] pushRates: ${updates.length} updates batched into ${batches.length} date ranges`);

      let totalSent = 0;
      let errorCount = 0;
      let skippedCount = 0;
      let lastErrorMsg = '';
      let firstErrorLogged = false;

      const tasks: (() => Promise<void>)[] = [];

      // Group valid batches by channel, then use /rates-multiple for fewer HTTP calls
      for (const channel of channels) {
        const channelId = channel.id;
        const validRatesMap = roomInfo.channelRoomRates.get(channelId);

        // Collect valid rate items for this channel
        const channelItems: { roomId: string; rateId: string; dateFrom: string; dateTo: string; currencyCode: string; prices: { price: string }; closed: string }[] = [];

        for (const batch of batches) {
          const channelIds = roomInfo.roomToChannels.get(batch.externalRoomTypeId) ?? [];
          if (!channelIds.includes(channelId)) continue;

          // Only send if this rate actually belongs to this room on this channel.
          const validRates = validRatesMap?.get(batch.externalRoomTypeId);
          if (validRates && !validRates.has(batch.externalRatePlanId)) {
            skippedCount++;
            continue;
          }

          channelItems.push({
            roomId: batch.externalRoomTypeId,
            rateId: batch.externalRatePlanId,
            dateFrom: batch.dateFrom,
            dateTo: batch.dateTo,
            currencyCode: batch.currency,
            prices: { price: batch.amount },
            closed: '0',
          });
        }

        if (channelItems.length === 0) continue;

        // Split into chunks to avoid oversized payloads (max ~50 items per request)
        const BATCH_CHUNK_SIZE = 50;
        for (let i = 0; i < channelItems.length; i += BATCH_CHUNK_SIZE) {
          const chunk = channelItems.slice(i, i + BATCH_CHUNK_SIZE);
          const body = {
            channelId: String(channelId),
            propertyId: config.hotelId,
            roomIds: chunk,
          };

          tasks.push(async () => {
            const response = await fetchWithRetry(
              `${baseUrl(config)}/rates-multiple`,
              {
                method: 'POST',
                headers: buildHeaders(config, 'application/json'),
                body: JSON.stringify(body),
              },
            );

            totalSent += chunk.length;
            const text = await response.text();
            const parsed = safeParseJson(text);
            if (isZodomusError(parsed)) {
              errorCount += chunk.length;
              lastErrorMsg = getZodomusErrorMessage(parsed);
              if (!firstErrorLogged) {
                console.error(`[Zodomus] pushRates FIRST ERROR: channel=${channelId} items=${chunk.length} → response=${text}`);
                firstErrorLogged = true;
              }
            }

            if (totalSent % 100 === 0) {
              console.log(`[Zodomus] pushRates: progress ${totalSent} sent, ${errorCount} errors`);
            }
          });
        }
      }

      if (skippedCount > 0) {
        console.log(`[Zodomus] pushRates: skipped ${skippedCount} invalid room-rate combinations`);
      }

      if (tasks.length === 0) {
        console.warn(`[Zodomus] pushRates: 0 requests to send! Room IDs in updates don't match any channel room map entry.`);
      } else {
        await runWithConcurrency(tasks, CONCURRENCY);
      }

      const durationMs = Date.now() - start;
      const status = errorCount > 0 ? SyncStatus.ERROR : SyncStatus.SUCCESS;
      console.log(`[Zodomus] pushRates: DONE in ${durationMs}ms — ${totalSent} sent, ${errorCount} errors, ${totalSent - errorCount} success, ${skippedCount} skipped`);

      await log?.({
        direction: SyncDirection.OUTBOUND,
        action: SyncAction.PUSH_RATES,
        status,
        request: JSON.stringify({ updatesCount: updates.length, batchesCount: batches.length, channelsCount: channels.length }),
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

      const roomInfo = await buildChannelRoomInfo(config, channels);

      let totalSent = 0;
      let errorCount = 0;
      let lastErrorMsg = '';

      for (const update of updates) {
        const channelIds = roomInfo.roomToChannels.get(update.externalRoomTypeId) ?? [];

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
    localRooms: ContentItem[],
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
      // Collect room→rate mappings across all channels (union of all rates per room)
      const roomRateMappings = new Map<string, Set<string>>();

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

            // Collect room→rate mappings (union across channels)
            const roomId = String(dr.id);
            const existing = roomRateMappings.get(roomId) ?? new Set<string>();
            for (const r of dr.rates ?? []) {
              existing.add(String(r.id));
            }
            roomRateMappings.set(roomId, existing);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.push(`[2] GET /room-rates: ERROR → ${msg}`);
        }

        // ── Step 3: Activate/map rooms with rates ──
        if (discoveredRooms.length > 0) {
          try {
            // Match discovered rooms to local rooms by name to get correct unit quantity.
            // Build a name→units lookup (case-insensitive) from local rooms.
            const nameToUnits = new Map<string, number>();
            for (const lr of localRooms) {
              if (lr.units !== undefined) {
                nameToUnits.set(lr.name.toLowerCase(), lr.units);
              }
            }
            // Default quantity = max units across all local rooms (safe fallback)
            const maxUnits = localRooms.reduce((max, lr) => Math.max(max, lr.units ?? 1), 1);

            const roomsPayload = discoveredRooms.map((room) => {
              const matched = nameToUnits.get(room.name.toLowerCase());
              return {
                roomId: String(room.id),
                roomName: room.name,
                quantity: matched ?? maxUnits,
                status: 1, // 1 = active
                rates: (room.rates ?? []).map((r) => String(r.id)),
              };
            });

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

      // Convert Set→Array for JSON serialization
      const roomRateMappingsObj: Record<string, string[]> = {};
      for (const [roomId, rateIds] of roomRateMappings) {
        roomRateMappingsObj[roomId] = Array.from(rateIds);
      }

      return {
        success: errors.length === 0 && totalRoomsDiscovered > 0,
        roomsCreated: totalRoomsDiscovered,
        ratesCreated: totalRatesDiscovered,
        errorMessage,
        details,
        roomRateMappings: roomRateMappingsObj,
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

// ── Airbnb-Specific Functions ──
// These are NOT on the ChannelManagerProvider interface — they are unique to
// the Airbnb channel (channelId=3) and operate through Zodomus as intermediary.

import { airbnbRateLimiter } from '@/lib/channel-manager/rate-limiter';
import { AIRBNB_CHANNEL_ID, AIRBNB_PRICE_MODEL_ID } from '@/lib/constants/channel-manager';
import type {
  AirbnbHostActivationResult,
  AirbnbHostStatusResult,
  AirbnbHostInfo,
  AirbnbListing,
  AirbnbCalendarOperation,
  AirbnbCalendarDay,
  AirbnbAvailabilityRules,
  AirbnbPricingSettings,
} from '@/lib/channel-manager/types';

async function airbnbPost<T>(config: CMConfig, endpoint: string, body: Record<string, unknown>): Promise<T> {
  await airbnbRateLimiter.throttle();
  const response = await fetchWithRetry(
    `${baseUrl(config)}/${endpoint}`,
    {
      method: 'POST',
      headers: buildHeaders(config, 'application/json'),
      body: JSON.stringify(body),
    },
  );
  const text = await response.text();
  const parsed = safeParseJson(text);
  if (isZodomusError(parsed)) {
    throw new Error(`Airbnb ${endpoint}: ${getZodomusErrorMessage(parsed)}`);
  }
  return parsed as T;
}

async function airbnbGet<T>(config: CMConfig, endpoint: string, params?: Record<string, unknown>): Promise<T> {
  await airbnbRateLimiter.throttle();
  // Zodomus docs show GET with JSON body, but fetch() forbids body on GET/HEAD.
  // Send params as query string instead — Zodomus accepts both forms.
  let url = `${baseUrl(config)}/${endpoint}`;
  if (params) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        qs.set(key, String(value));
      }
    }
    const qsStr = qs.toString();
    if (qsStr) url += `?${qsStr}`;
  }
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: buildHeaders(config),
  });
  const text = await response.text();
  const parsed = safeParseJson(text);
  if (isZodomusError(parsed)) {
    throw new Error(`Airbnb ${endpoint}: ${getZodomusErrorMessage(parsed)}`);
  }
  return parsed as T;
}

/** 1. Activate a new Airbnb host on Zodomus. Returns token + client_id for OAuth. */
export async function airbnbActivateHost(config: CMConfig): Promise<AirbnbHostActivationResult> {
  const data = await airbnbPost<{ token: number | string; client_id: string }>(
    config,
    'airbnb-host-activation',
    {},
  );
  return {
    token: String(data.token),
    clientId: data.client_id,
  };
}

/** 2. Check the status of an Airbnb host. */
export async function airbnbGetHostStatus(config: CMConfig, token: string): Promise<AirbnbHostStatusResult> {
  const data = await airbnbGet<{ host: { statusCode: string; statusMessage: string } }>(
    config,
    'airbnb-host-status',
    { token },
  );
  return data.host;
}

/** 3. Get the host profile information from Airbnb. */
export async function airbnbGetHostInfo(config: CMConfig, token: string): Promise<AirbnbHostInfo> {
  const data = await airbnbGet<{ response: { user: AirbnbHostInfo } }>(
    config,
    'airbnb-host-info',
    { token },
  );
  return data.response.user;
}

/** 4. Get all listings managed by the host. */
export async function airbnbGetListings(config: CMConfig, token: string): Promise<AirbnbListing[]> {
  const data = await airbnbGet<{ response: { listings: AirbnbListing[] } }>(
    config,
    'airbnb-listings',
    { token },
  );
  return data.response?.listings ?? [];
}

/** 5. Activate a property on Zodomus for Airbnb (channelId=3, priceModelId=4). */
export async function airbnbActivateProperty(
  config: CMConfig,
  listingId: string,
  token: string,
): Promise<{ roomId: string; rateId: string }> {
  await airbnbPost(config, 'property-activation', {
    channelId: AIRBNB_CHANNEL_ID,
    propertyId: listingId,
    priceModelId: AIRBNB_PRICE_MODEL_ID,
    token: Number(token),
  });
  return {
    roomId: `${listingId}01`,
    rateId: `${listingId}0001`,
  };
}

/** 6. Set the pricing/availability model to STANDARD for a listing. */
export async function airbnbSetPricingModel(config: CMConfig, listingId: string): Promise<void> {
  await airbnbPost(config, 'airbnb-pricing-availability', {
    channelId: AIRBNB_CHANNEL_ID,
    propertyId: listingId,
    pricingAvailabilityModelType: 'STANDARD',
    inModelTransition: 'false',
    clearIncompatibleSettings: 'false',
  });
}

/** 7. Push calendar updates (price + availability + restrictions in one call). */
export async function airbnbPushCalendar(
  config: CMConfig,
  listingId: string,
  operations: AirbnbCalendarOperation[],
  log?: LogCallback,
): Promise<SyncResult> {
  const startMs = Date.now();
  try {
    await airbnbPost(config, 'airbnb-calendar', {
      channelId: AIRBNB_CHANNEL_ID,
      propertyId: listingId,
      operations,
    });

    const result: SyncResult = {
      status: SyncStatus.SUCCESS,
      updatesProcessed: operations.length,
    };

    if (log) {
      await log({
        direction: SyncDirection.OUTBOUND,
        action: SyncAction.AIRBNB_PUSH_CALENDAR,
        status: SyncStatus.SUCCESS,
        request: JSON.stringify({ propertyId: listingId, operationCount: operations.length }),
        durationMs: Date.now() - startMs,
      });
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    if (log) {
      await log({
        direction: SyncDirection.OUTBOUND,
        action: SyncAction.AIRBNB_PUSH_CALENDAR,
        status: SyncStatus.ERROR,
        request: JSON.stringify({ propertyId: listingId, operationCount: operations.length }),
        errorMessage,
        durationMs: Date.now() - startMs,
      });
    }
    return { status: SyncStatus.ERROR, updatesProcessed: 0, errorMessage };
  }
}

/** 8. Read the Airbnb calendar for a date range. */
export async function airbnbGetCalendar(
  config: CMConfig,
  listingId: string,
  startDate: string,
  endDate: string,
): Promise<AirbnbCalendarDay[]> {
  const data = await airbnbGet<{ response: { calendar: { days: AirbnbCalendarDay[] } } }>(
    config,
    'airbnb-calendar',
    { propertyId: listingId, startDate, endDate },
  );
  return data.response?.calendar?.days ?? [];
}

/** 9. Set availability rules for a listing (min/max nights, lead time, check-in days, etc.). */
export async function airbnbSetAvailabilityRules(
  config: CMConfig,
  listingId: string,
  rules: AirbnbAvailabilityRules,
): Promise<void> {
  await airbnbPost(config, 'airbnb-availability-rules', {
    propertyId: listingId,
    pnaModel: 'STANDARD',
    ...rules,
  });
}

/** 10. Set pricing settings for a listing (default price, weekend price, fees, taxes). */
export async function airbnbSetPricingSettings(
  config: CMConfig,
  listingId: string,
  settings: AirbnbPricingSettings,
): Promise<void> {
  await airbnbPost(config, 'airbnb-pricing-settings', {
    propertyId: listingId,
    pnaModel: 'STANDARD',
    ...settings,
  });
}

/** 11. Accept a request-to-book reservation. */
export async function airbnbAcceptReservation(
  config: CMConfig,
  token: string,
  reservationId: string,
): Promise<void> {
  await airbnbPost(config, 'airbnb-reservations', {
    channelId: AIRBNB_CHANNEL_ID,
    token,
    reservationId,
    action: 'accept',
  });
}

/** 12. Decline a request-to-book reservation. */
export async function airbnbDeclineReservation(
  config: CMConfig,
  token: string,
  reservationId: string,
): Promise<void> {
  await airbnbPost(config, 'airbnb-reservations', {
    channelId: AIRBNB_CHANNEL_ID,
    token,
    reservationId,
    action: 'decline',
  });
}

/** 13. Get full details of a webhook notification by typeId. */
export async function airbnbGetWebhookNotification(
  config: CMConfig,
  typeId: string,
): Promise<Record<string, unknown>> {
  const data = await airbnbGet<{ notification: Record<string, unknown> }>(
    config,
    'airbnb-webhook-notifications',
    { typeId },
  );
  return data.notification;
}

/**
 * Build the OAuth2 authorization URL for an Airbnb host.
 * Test env uses Zodomus proxy; production redirects to Airbnb directly.
 */
export function buildAirbnbOAuthUrl(
  clientId: string,
  token: string,
  isProduction: boolean,
  includeMessaging = false,
): string {
  const scope = includeMessaging
    ? 'property_management,messages_read,messages_write'
    : 'property_management';

  if (isProduction) {
    return `https://www.airbnb.com/oauth2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent('https://api.zodomus.com/airbnb-webhook-redirect')}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(token)}`;
  }

  return `https://api.zodomus.com/airbnb-oauth2-tests?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent('https://api.zodomus.com/airbnb-webhook-redirect-test')}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(token)}`;
}
