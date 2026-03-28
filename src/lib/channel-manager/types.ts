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
  /** Number of physical units/rooms for this room type */
  units?: number;
}

export interface ProvisionResult {
  success: boolean;
  roomsCreated: number;
  ratesCreated: number;
  errorMessage?: string;
  /** Raw API responses for debugging — shown in UI expandable section */
  details?: string;
  /** Room-to-rate mappings discovered during provisioning.
   *  Key = externalRoomTypeId, Value = array of externalRatePlanIds belonging to that room. */
  roomRateMappings?: Record<string, string[]>;
}

// ── Airbnb-Specific Types ──

export interface AirbnbHostActivationResult {
  token: string;
  clientId: string;
}

export interface AirbnbHostStatusResult {
  statusCode: string;
  statusMessage: string;
}

export interface AirbnbHostInfo {
  email: string;
  firstName: string;
  id: number;
  lastName: string;
  pictureUrl?: string;
  idStr: string;
}

export interface AirbnbListing {
  id: string;
  name: string;
  propertyTypeGroup?: string;
  propertyTypeCategory?: string;
  roomTypeCategory?: string;
  bedrooms?: number;
  bathrooms?: number;
  beds?: number;
  personCapacity?: number;
  hasAvailability?: boolean;
  synchronizationCategory?: string;
  listingApprovalStatus?: {
    statusCategory: string;
    notes?: string;
  };
  idStr?: string;
}

export interface AirbnbCalendarOperation {
  dates: string[]; // ["YYYY-MM-DD:YYYY-MM-DD"]
  dailyPrice?: number;
  availability?: 'available' | 'unavailable' | 'default';
  minNights?: number;
  maxNights?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  availableCount?: number;
  notes?: string;
}

export interface AirbnbCalendarDay {
  date: string;
  availability: string;
  availabilityType?: string;
  dailyPrice: number;
  minNights: number;
  maxNights: number;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  notes?: string;
}

export interface AirbnbAvailabilityRules {
  defaultMinNights?: number;
  defaultMaxNights?: number;
  bookingLeadTime?: { hours: number; allowRequestToBook: number };
  maxDaysNotice?: { days: number };
  turnoverDays?: number;
  dayOfWeekCheckIn?: Array<{ dayOfWeek: number }>;
  dayOfWeekCheckOut?: Array<{ dayOfWeek: number }>;
  dayOfWeekMinNights?: Array<{ dayOfWeek: number; minNights: number }>;
  seasonalMinNights?: { startDate: string; endDate: string; minNights: number };
}

export interface AirbnbPricingSettings {
  listingCurrency: string;
  defaultDailyPrice: number;
  weekendPrice?: number;
  guestsIncluded?: number;
  pricePerExtraPerson?: number;
}

export interface AirbnbWebhookReservation {
  type: 'reservation';
  webhookKey: string;
  token?: string;
  channelId: number;
  propertyId: string;
  reservationId: string;
  reservationstatus: string;
}

export interface AirbnbWebhookNotification {
  type: 'notification';
  webhookKey: string;
  channelId: number;
  propertyId?: string;
  notificationType: number;
  notificationSubtype: number;
  notificationTypeId: string;
}

export interface AirbnbWebhookAvailabilityCheck {
  type: 'availability_check';
  webhookKey: string;
  channelId: number;
  propertyId: string;
  notificationType: 3;
  startDate: string;
  nights: number;
}

export type AirbnbWebhookPayload =
  | AirbnbWebhookReservation
  | AirbnbWebhookNotification
  | AirbnbWebhookAvailabilityCheck;

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
