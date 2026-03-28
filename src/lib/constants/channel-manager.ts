export enum SyncDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum SyncAction {
  PUSH_AVAILABILITY = 'push_availability',
  PUSH_RATES = 'push_rates',
  PUSH_RESTRICTIONS = 'push_restrictions',
  RECEIVE_RESERVATION = 'receive_reservation',
  VALIDATE_CREDENTIALS = 'validate_credentials',
  FETCH_ROOM_TYPES = 'fetch_room_types',
  FETCH_RATE_PLANS = 'fetch_rate_plans',
  FULL_SYNC = 'full_sync',
  AIRBNB_HOST_ACTIVATION = 'airbnb_host_activation',
  AIRBNB_HOST_STATUS = 'airbnb_host_status',
  AIRBNB_DISCOVER_LISTINGS = 'airbnb_discover_listings',
  AIRBNB_ACTIVATE_PROPERTY = 'airbnb_activate_property',
  AIRBNB_PUSH_CALENDAR = 'airbnb_push_calendar',
  AIRBNB_AVAILABILITY_CHECK = 'airbnb_availability_check',
  AIRBNB_NOTIFICATION = 'airbnb_notification',
}

export enum SyncStatus {
  SUCCESS = 'success',
  ERROR = 'error',
}

export enum ProviderName {
  ZODOMUS = 'zodomus',
}

export const PROVIDER_LABELS: Record<ProviderName, string> = {
  [ProviderName.ZODOMUS]: 'Zodomus',
};

export const AIRBNB_CHANNEL_ID = 3;
export const AIRBNB_PRICE_MODEL_ID = 4;

export enum AirbnbHostStatus {
  PENDING = 'pending',
  OAUTH_SENT = 'oauth_sent',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum AirbnbNotificationType {
  HOST = 1,
  LISTING = 2,
  AVAILABILITY_CHECK = 3,
  RESERVATION = 4,
  PAYOUT = 5,
  REVIEW = 6,
  MESSAGING = 7,
  SPECIAL_OFFER = 8,
}

export const MAX_SYNC_DAYS = 365;
export const RETRY_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 1000;
