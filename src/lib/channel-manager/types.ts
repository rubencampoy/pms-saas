import { SyncStatus } from '@/lib/constants/channel-manager';

// ── Provider Configuration ──

export type ZodomusAccessType = 'api_call' | 'webhook';

export interface CMConfig {
  apiUser: string;
  apiPassword: string;
  ccPassword?: string;
  hotelId: string;
  endpointUrl: string;
  accessType: ZodomusAccessType;
  zodomusWebhookUrl?: string;
  zodomusWebhookKey?: string;
  airbnbWebhookUrl?: string;
  airbnbWebhookKey?: string;
  [key: string]: string | undefined;
}

// ── Outbound Updates ──

export interface AvailabilityUpdate {
  externalRoomTypeId: string;
  date: string; // YYYY-MM-DD
  available: number;
}

export interface RateUpdate {
  externalRoomTypeId: string;
  externalRatePlanId: string;
  date: string; // YYYY-MM-DD
  amount: string; // decimal string
  currency: string;
}

export interface RestrictionUpdate {
  externalRoomTypeId: string;
  externalRatePlanId: string;
  date: string; // YYYY-MM-DD
  minStay?: number;
  maxStay?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  stopSell?: boolean;
}

// ── Inbound Data ──

export interface IncomingReservation {
  externalId: string;
  externalRoomTypeId: string;
  externalRatePlanId: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone?: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  adults: number;
  children: number;
  totalAmount: string;
  currency: string;
  source: string;
  specialRequests?: string;
}

// ── External Entities ──

export interface ExternalRoomType {
  id: string;
  name: string;
}

export interface ExternalRatePlan {
  id: string;
  name: string;
  roomTypeId: string;
}

// ── Results ──

export interface SyncResult {
  status: SyncStatus;
  updatesProcessed: number;
  errorMessage?: string;
}

export interface ValidationResult {
  valid: boolean;
  errorMessage?: string;
  hotelName?: string;
}

// ── Log Callback ──

export interface LogCallback {
  (entry: {
    direction: string;
    action: string;
    status: string;
    request?: string;
    response?: string;
    errorMessage?: string;
    durationMs?: number;
  }): Promise<void>;
}

// ── Content Provisioning ──

export interface ContentItem {
  name: string;
  code: string;
}

export interface ProvisionResult {
  success: boolean;
  roomsCreated: number;
  ratesCreated: number;
  errorMessage?: string;
}

// ── Provider Interface ──

export interface ChannelManagerProvider {
  validateCredentials(config: CMConfig): Promise<ValidationResult>;
  pushAvailability(
    config: CMConfig,
    updates: AvailabilityUpdate[],
    log?: LogCallback,
  ): Promise<SyncResult>;
  pushRates(
    config: CMConfig,
    updates: RateUpdate[],
    log?: LogCallback,
  ): Promise<SyncResult>;
  pushRestrictions(
    config: CMConfig,
    updates: RestrictionUpdate[],
    log?: LogCallback,
  ): Promise<SyncResult>;
  parseWebhookPayload(
    headers: Record<string, string>,
    body: unknown,
  ): IncomingReservation;
  fetchExternalRoomTypes(config: CMConfig): Promise<ExternalRoomType[]>;
  fetchExternalRatePlans(config: CMConfig): Promise<ExternalRatePlan[]>;
  /**
   * Provision rooms and rates in the channel manager.
   * Creates the content on all active channels so it can then be mapped.
   * Optional — not all providers support content provisioning.
   */
  provisionContent?(
    config: CMConfig,
    rooms: ContentItem[],
    rates: ContentItem[],
  ): Promise<ProvisionResult>;
}
