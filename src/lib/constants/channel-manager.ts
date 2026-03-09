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

export const MAX_SYNC_DAYS = 365;
export const RETRY_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 1000;
