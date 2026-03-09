import { notFound } from 'next/navigation';
import { bookingEngineService } from '@/server/services/booking-engine.service';
import { BookingEngineClient } from '@/components/booking-engine/booking-engine-client';
import { getTranslations } from 'next-intl/server';

interface Props {
  params: Promise<{ slug: string; propertyCode: string }>;
}

export default async function PropertyBookingPage({ params }: Props) {
  const { slug, propertyCode } = await params;
  const t = await getTranslations('bookingEnginePublic');

  let resolved;
  try {
    resolved = await bookingEngineService.resolveProperty(slug, propertyCode);
  } catch {
    notFound();
  }

  const { organization, property } = resolved;
  if (!property) notFound();

  const [settings, addons] = await Promise.all([
    bookingEngineService.getSettings(organization.id, property.id),
    bookingEngineService.getAddons(organization.id, property.id),
  ]);

  const propertyInfo = {
    id: property.id,
    name: property.name,
    code: property.code,
    address: (property.address ?? {}) as Record<string, string>,
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
    timezone: property.timezone,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BookingEngineClient
        slug={slug}
        propertyCode={propertyCode}
        propertyInfo={propertyInfo}
        settings={settings}
        addons={addons}
        translations={{
          searchTitle: t('searchTitle'),
          checkIn: t('checkIn'),
          checkOut: t('checkOut'),
          guests: t('guests'),
          adults: t('adults'),
          children: t('children'),
          search: t('search'),
          searching: t('searching'),
          noResults: t('noResults'),
          noResultsDesc: t('noResultsDesc'),
          perNight: t('perNight'),
          totalStay: t('totalStay'),
          available: t('available'),
          unavailable: t('unavailable'),
          select: t('select'),
          selected: t('selected'),
          rooms: t('rooms'),
          addons: t('addonsTitle'),
          summary: t('summary'),
          nights: t('nights'),
          subtotal: t('subtotal'),
          total: t('total'),
          continue: t('continue'),
          selectDates: t('selectDates'),
          selectRoom: t('selectRoom'),
          perStay: t('perStay'),
          perPerson: t('perPerson'),
          freeCancellation: t('freeCancellation'),
          nonRefundable: t('nonRefundable'),
          maxOccupancy: t('maxOccupancy'),
          step1: t('step1Selection'),
          step2: t('step2Details'),
          step3: t('step3Confirmation'),
          availableAccommodations: t('availableAccommodations'),
          promoCode: t('promoCode'),
          promoCodePlaceholder: t('promoCodePlaceholder'),
          noPaymentRequired: t('noPaymentRequired'),
          needHelp: t('needHelp'),
          needHelpDesc: t('needHelpDesc'),
          chatWithUs: t('chatWithUs'),
        }}
      />
    </div>
  );
}
