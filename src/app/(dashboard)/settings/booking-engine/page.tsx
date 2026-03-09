import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { propertyRepo } from '@/server/repositories/property.repo';
import { bookingEngineSettingsRepo } from '@/server/repositories/booking-engine-settings.repo';
import { BookingEngineClient } from '@/components/settings/booking-engine/booking-engine-client';

export default async function BookingEnginePage() {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;
  const properties = await propertyRepo.findAll(orgId);

  // Load settings for all properties in parallel
  const allSettings = await Promise.all(
    properties.map(async (p) => {
      const settings = await bookingEngineSettingsRepo.findByProperty(orgId, p.id);
      return { propertyId: p.id, settings };
    }),
  );

  const settingsMap: Record<string, typeof allSettings[number]['settings']> = {};
  for (const { propertyId, settings } of allSettings) {
    settingsMap[propertyId] = settings;
  }

  return (
    <BookingEngineClient
      properties={properties.map((p) => ({ id: p.id, name: p.name, code: p.code }))}
      savedSettings={settingsMap}
    />
  );
}
