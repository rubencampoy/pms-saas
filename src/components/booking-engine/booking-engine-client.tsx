'use client';

import { useEffect } from 'react';
import { useBookingStore } from '@/lib/hooks/use-booking-store';
import { StepIndicator } from './step-indicator';
import { SearchBar } from './search-bar';
import { RoomTypeResults } from './room-type-results';
import { AddonsSelector } from './addons-selector';
import { BookingSummary } from './booking-summary';
import type { PropertyInfo, BookingEngineSettings, AddonOption } from '@/types/booking-engine';

interface BookingEngineClientProps {
  slug: string;
  propertyCode: string;
  propertyInfo: PropertyInfo;
  settings: BookingEngineSettings;
  addons: AddonOption[];
  translations: {
    searchTitle: string;
    checkIn: string;
    checkOut: string;
    guests: string;
    adults: string;
    children: string;
    search: string;
    searching: string;
    noResults: string;
    noResultsDesc: string;
    perNight: string;
    totalStay: string;
    available: string;
    unavailable: string;
    select: string;
    selected: string;
    rooms: string;
    addons: string;
    summary: string;
    nights: string;
    subtotal: string;
    total: string;
    continue: string;
    selectDates: string;
    selectRoom: string;
    perStay: string;
    perPerson: string;
    freeCancellation: string;
    nonRefundable: string;
    maxOccupancy: string;
    step1?: string;
    step2?: string;
    step3?: string;
    availableAccommodations?: string;
    promoCode?: string;
    promoCodePlaceholder?: string;
    noPaymentRequired?: string;
    needHelp?: string;
    needHelpDesc?: string;
    chatWithUs?: string;
  };
}

export function BookingEngineClient({
  slug,
  propertyCode,
  propertyInfo,
  settings,
  addons,
  translations: t,
}: BookingEngineClientProps) {
  const init = useBookingStore((s) => s.init);

  useEffect(() => {
    init({ slug, propertyCode, propertyInfo, settings, addons });
  }, [slug, propertyCode, propertyInfo, settings, addons, init]);

  return (
    <>
      {/* Step indicator */}
      <StepIndicator
        currentStep={1}
        translations={{
          step1: t.step1 ?? 'Selection',
          step2: t.step2 ?? 'Details',
          step3: t.step3 ?? 'Confirmation',
        }}
      />

      {/* Search bar */}
      <SearchBar
        translations={{
          checkIn: t.checkIn,
          checkOut: t.checkOut,
          guests: t.guests,
          adults: t.adults,
          children: t.children,
          search: t.search,
          searching: t.searching,
          promoCode: t.promoCode,
          promoCodePlaceholder: t.promoCodePlaceholder,
        }}
      />

      {/* Main content + sidebar */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left: results + addons */}
        <div className="flex-1 min-w-0 pb-24 lg:pb-0">
          <RoomTypeResults
            translations={{
              noResults: t.noResults,
              noResultsDesc: t.noResultsDesc,
              rooms: t.rooms,
              perNight: t.perNight,
              totalStay: t.totalStay,
              available: t.available,
              unavailable: t.unavailable,
              select: t.select,
              selected: t.selected,
              freeCancellation: t.freeCancellation,
              nonRefundable: t.nonRefundable,
              maxOccupancy: t.maxOccupancy,
              availableAccommodations: t.availableAccommodations,
            }}
          />

          <AddonsSelector
            translations={{
              addons: t.addons,
              perNight: t.perNight,
              perStay: t.perStay,
              perPerson: t.perPerson,
            }}
          />
        </div>

        {/* Right: booking summary */}
        <BookingSummary
          translations={{
            summary: t.summary,
            nights: t.nights,
            subtotal: t.subtotal,
            total: t.total,
            continue: t.continue,
            selectDates: t.selectDates,
            selectRoom: t.selectRoom,
            addons: t.addons,
            perNight: t.perNight,
            perStay: t.perStay,
            perPerson: t.perPerson,
            checkIn: t.checkIn,
            checkOut: t.checkOut,
            noPaymentRequired: t.noPaymentRequired,
            needHelp: t.needHelp,
            needHelpDesc: t.needHelpDesc,
            chatWithUs: t.chatWithUs,
          }}
        />
      </div>
    </>
  );
}
