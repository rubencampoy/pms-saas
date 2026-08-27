import type { SearchResult } from '@/types/booking-engine';

/**
 * The public shape of an availability result.
 *
 * The booking engine works in floats internally, which leaks artifacts like
 * `335.28000000000003` into its output. Everywhere else in this API money is a
 * fixed-2-decimal **string**, mirroring the `numeric` columns, so amounts are
 * normalised here rather than handing consumers two different money formats.
 *
 * The rounding is presentational only — it does not change what the booking
 * engine charges.
 */
export interface NightlyRateDto {
  date: string;
  amount: string;
}

export interface RatePlanOptionDto {
  ratePlanId: string;
  name: string;
  cancellationPolicy: string;
  cancellationHours: number;
  nightlyRates: NightlyRateDto[];
  totalAmount: string;
  currency: string;
}

export interface AvailabilityDto {
  roomTypeId: string;
  name: string;
  code: string;
  description: string | null;
  images: string[];
  amenities: string[];
  baseOccupancy: number;
  maxOccupancy: number;
  availableUnits: number;
  lowestPrice: string;
  currency: string;
  ratePlans: RatePlanOptionDto[];
}

export function toAvailabilityDto(result: SearchResult): AvailabilityDto {
  return {
    roomTypeId: result.roomTypeId,
    name: result.name,
    code: result.code,
    description: result.description,
    images: result.images,
    amenities: result.amenities,
    baseOccupancy: result.baseOccupancy,
    maxOccupancy: result.maxOccupancy,
    availableUnits: result.availableUnits,
    lowestPrice: money(result.lowestPrice),
    currency: result.currency,
    ratePlans: result.ratePlans.map((plan) => ({
      ratePlanId: plan.ratePlanId,
      name: plan.name,
      cancellationPolicy: plan.cancellationPolicy,
      cancellationHours: plan.cancellationHours,
      nightlyRates: plan.nightlyRates.map((rate) => ({
        date: rate.date,
        amount: money(rate.amount),
      })),
      totalAmount: money(plan.totalAmount),
      currency: plan.currency,
    })),
  };
}

function money(value: number): string {
  return value.toFixed(2);
}
