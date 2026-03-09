'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingStore } from '@/lib/hooks/use-booking-store';
import { StepIndicator } from './step-indicator';
import { CheckoutGuestForm } from './checkout-guest-form';
import { CheckoutSummary } from './checkout-summary';
import type { BookingEngineSettings } from '@/types/booking-engine';

interface CheckoutClientProps {
  slug: string;
  propertyCode: string;
  settings: BookingEngineSettings;
  translations: {
    checkout: string;
    guestDetails: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nationality: string;
    gender: string;
    genderMale: string;
    genderFemale: string;
    genderOther: string;
    genderPreferNot: string;
    documentType: string;
    documentNumber: string;
    passport: string;
    nationalId: string;
    drivingLicense: string;
    otherDocument: string;
    company: string;
    postalAddress: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    arrivalTime: string;
    specialRequests: string;
    specialRequestsPlaceholder: string;
    acceptTerms: string;
    termsRequired: string;
    confirmBooking: string;
    bookingFailed: string;
    noAvailabilityError: string;
    yourStay: string;
    checkIn: string;
    checkOut: string;
    nights: string;
    addons: string;
    total: string;
    backToSearch: string;
    perNight: string;
    perStay: string;
    perPerson: string;
    paymentInfo: string;
    paymentNotice: string;
    step1?: string;
    step2?: string;
    step3?: string;
    cancellationPolicy?: string;
    cancellationPolicyDesc?: string;
  };
}

export function CheckoutClient({
  slug,
  propertyCode,
  settings,
  translations: t,
}: CheckoutClientProps) {
  const router = useRouter();
  const { selectedItems, summary } = useBookingStore();

  // Guard: redirect back if no selections
  useEffect(() => {
    if (selectedItems.size === 0) {
      router.replace(`/book/${slug}/${propertyCode}`);
    }
  }, [selectedItems.size, router, slug, propertyCode]);

  if (selectedItems.size === 0 || !summary) {
    return null;
  }

  const backHref = `/book/${slug}/${propertyCode}`;

  return (
    <div>
      {/* Step indicator */}
      <StepIndicator
        currentStep={2}
        translations={{
          step1: t.step1 ?? 'Selection',
          step2: t.step2 ?? 'Details',
          step3: t.step3 ?? 'Confirmation',
        }}
      />

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: guest form */}
        <div className="lg:w-2/3">
          <CheckoutGuestForm
            settings={settings}
            slug={slug}
            propertyCode={propertyCode}
            translations={{
              guestDetails: t.guestDetails,
              firstName: t.firstName,
              lastName: t.lastName,
              email: t.email,
              phone: t.phone,
              nationality: t.nationality,
              gender: t.gender,
              genderMale: t.genderMale,
              genderFemale: t.genderFemale,
              genderOther: t.genderOther,
              genderPreferNot: t.genderPreferNot,
              documentType: t.documentType,
              documentNumber: t.documentNumber,
              passport: t.passport,
              nationalId: t.nationalId,
              drivingLicense: t.drivingLicense,
              otherDocument: t.otherDocument,
              company: t.company,
              postalAddress: t.postalAddress,
              street: t.street,
              city: t.city,
              state: t.state,
              postalCode: t.postalCode,
              country: t.country,
              arrivalTime: t.arrivalTime,
              specialRequests: t.specialRequests,
              specialRequestsPlaceholder: t.specialRequestsPlaceholder,
              acceptTerms: t.acceptTerms,
              termsRequired: t.termsRequired,
              confirmBooking: t.confirmBooking,
              bookingFailed: t.bookingFailed,
              noAvailabilityError: t.noAvailabilityError,
            }}
          />
        </div>

        {/* Right: summary sidebar */}
        <aside className="lg:w-1/3">
          <div className="sticky top-24 space-y-6">
            <CheckoutSummary
              backHref={backHref}
              translations={{
                yourStay: t.yourStay,
                checkIn: t.checkIn,
                checkOut: t.checkOut,
                nights: t.nights,
                addons: t.addons,
                total: t.total,
                backToSearch: t.backToSearch,
                perNight: t.perNight,
                perStay: t.perStay,
                perPerson: t.perPerson,
                paymentInfo: t.paymentInfo,
                paymentNotice: t.paymentNotice,
                cancellationPolicy: t.cancellationPolicy,
                cancellationPolicyDesc: t.cancellationPolicyDesc,
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
