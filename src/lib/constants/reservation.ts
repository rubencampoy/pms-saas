export enum ReservationStatus {
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum ReservationSource {
  DIRECT = 'direct',
  BOOKING_COM = 'booking_com',
  EXPEDIA = 'expedia',
  AIRBNB = 'airbnb',
  PHONE = 'phone',
  WALKIN = 'walkin',
  WEBSITE = 'website',
}

export const VALID_STATUS_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  [ReservationStatus.CONFIRMED]: [
    ReservationStatus.CHECKED_IN,
    ReservationStatus.CANCELLED,
    ReservationStatus.NO_SHOW,
  ],
  [ReservationStatus.CHECKED_IN]: [
    ReservationStatus.CHECKED_OUT,
    ReservationStatus.CANCELLED,
  ],
  [ReservationStatus.CHECKED_OUT]: [],
  [ReservationStatus.CANCELLED]: [],
  [ReservationStatus.NO_SHOW]: [],
};
