import { notFound } from 'next/navigation';
import { bookingEngineService } from '@/server/services/booking-engine.service';
import { resolvePropertyCached } from '@/server/services/booking-engine-cache';
import { CheckoutClient } from '@/components/booking-engine/checkout-client';
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ slug: string; propertyCode: string }>;
}

export default async function CheckoutPage({ params }: Props) {
  const { slug, propertyCode } = await params;
  const t = await getTranslations('bookingEnginePublic');

  let resolved;
  try {
    resolved = await resolvePropertyCached(slug, propertyCode);
  } catch {
    notFound();
  }

  const { organization, property } = resolved;
  if (!property) notFound();

  const settings = await bookingEngineService.getSettings(organization.id, property.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <CheckoutClient
        slug={slug}
        propertyCode={propertyCode}
        settings={settings}
        translations={{
          checkout: t('checkout'),
          guestDetails: t('guestDetails'),
          firstName: t('firstName'),
          lastName: t('lastName'),
          email: t('email'),
          phone: t('phone'),
          nationality: t('nationality'),
          gender: t('gender'),
          genderMale: t('genderMale'),
          genderFemale: t('genderFemale'),
          genderOther: t('genderOther'),
          genderPreferNot: t('genderPreferNot'),
          documentType: t('documentType'),
          documentNumber: t('documentNumber'),
          passport: t('passport'),
          nationalId: t('nationalId'),
          drivingLicense: t('drivingLicense'),
          otherDocument: t('otherDocument'),
          company: t('company'),
          postalAddress: t('postalAddress'),
          street: t('street'),
          city: t('city'),
          state: t('state'),
          postalCode: t('postalCode'),
          country: t('country'),
          arrivalTime: t('arrivalTime'),
          specialRequests: t('specialRequests'),
          specialRequestsPlaceholder: t('specialRequestsPlaceholder'),
          acceptTerms: t('acceptTerms'),
          termsRequired: t('termsRequired'),
          confirmBooking: t('confirmBooking'),
          bookingFailed: t('bookingFailed'),
          noAvailabilityError: t('noAvailabilityError'),
          yourStay: t('yourStay'),
          checkIn: t('checkIn'),
          checkOut: t('checkOut'),
          nights: t('nights'),
          addons: t('addonsTitle'),
          total: t('total'),
          backToSearch: t('backToSearch'),
          perNight: t('perNight'),
          perStay: t('perStay'),
          perPerson: t('perPerson'),
          paymentInfo: t('paymentInfo'),
          paymentNotice: t('paymentNotice'),
          step1: t('step1Selection'),
          step2: t('step2Details'),
          step3: t('step3Confirmation'),
          cancellationPolicy: t('cancellationPolicy'),
          cancellationPolicyDesc: t('cancellationPolicyDesc'),
        }}
      />
    </div>
  );
}
