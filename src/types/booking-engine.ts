export interface SearchResult {
  roomTypeId: string;
  name: string;
  code: string;
  description: string | null;
  images: string[];
  amenities: string[];
  baseOccupancy: number;
  maxOccupancy: number;
  availableUnits: number;
  ratePlans: RatePlanOption[];
  lowestPrice: number;
  currency: string;
}

export interface RatePlanOption {
  ratePlanId: string;
  name: string;
  cancellationPolicy: string;
  cancellationHours: number;
  nightlyRates: NightlyRate[];
  totalAmount: number;
  currency: string;
}

export interface NightlyRate {
  date: string;
  amount: number;
}

export interface AddonOption {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  addonType: string;
  icon: string | null;
}

export interface BookingSelection {
  roomTypeId: string;
  ratePlanId: string;
  quantity: number;
}

export interface BookingSummary {
  items: BookingSummaryItem[];
  addons: BookingSummaryAddon[];
  nights: number;
  subtotal: number;
  total: number;
  currency: string;
}

export interface BookingSummaryItem {
  roomTypeName: string;
  ratePlanName: string;
  quantity: number;
  nightlyTotal: number;
  total: number;
}

export interface BookingSummaryAddon {
  name: string;
  addonType: string;
  unitPrice: number;
  total: number;
}

export interface PropertyInfo {
  id: string;
  name: string;
  code: string;
  address: Record<string, string>;
  checkInTime: string;
  checkOutTime: string;
  timezone: string;
}

export interface BookingEngineSettings {
  availabilityView: string;
  priceFormat: string;
  specificRoom: boolean;
  addonsDisplay: string;
  guestFilter: string;
  defaultAdults: number;
  showUnavailable: boolean;
  autoAssign: boolean;
  language: string;

  // Guest info form fields
  fieldPostalAddress: boolean;
  fieldNationality: boolean;
  fieldGender: boolean;
  fieldIdDocument: boolean;
  fieldCompany: boolean;
  fieldPhone: boolean;
  fieldArrivalTime: boolean;
  fieldTermsAndConditions: boolean;

  // Marketing
  autoConfirmEmail: boolean;
  redirectConfirmation: boolean;
  redirectUrl: string;
}

export interface CheckoutGuestData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  nationality?: string;
  gender?: string;
  documentType?: string;
  documentNumber?: string;
  company?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  arrivalTime?: string;
  specialRequests?: string;
  acceptTerms?: boolean;
}

export interface CreateBookingInput {
  guest: CheckoutGuestData;
  items: BookingSelection[];
  addonIds: string[];
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
}

export interface BookingConfirmation {
  confirmationCodes: string[];
  guestName: string;
  email: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  propertyName: string;
  items: BookingConfirmationItem[];
  addons: BookingConfirmationAddon[];
  totalAmount: number;
  currency: string;
}

export interface BookingConfirmationItem {
  roomTypeName: string;
  ratePlanName: string;
  confirmationCode: string;
  nightlyTotal: number;
}

export interface BookingConfirmationAddon {
  name: string;
  total: number;
}
