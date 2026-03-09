import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { propertyRepo } from '@/server/repositories/property.repo';
import { roomTypeRepo } from '@/server/repositories/room-type.repo';
import { ratePlanRepo } from '@/server/repositories/rate-plan.repo';
import { rateRepo } from '@/server/repositories/rate.repo';
import { seasonRepo } from '@/server/repositories/season.repo';
import { supplementRepo } from '@/server/repositories/supplement.repo';
import { format, addDays } from 'date-fns';
import { RatesClient } from '@/components/settings/rates-client';
import { getSelectedPropertyId } from '@/server/actions/property-switch';

interface RatesPageProps {
  searchParams: Promise<{ start?: string; planId?: string }>;
}

export default async function RatesPage({ searchParams }: RatesPageProps) {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;
  const params = await searchParams;

  const propertiesList = await propertyRepo.findAll(orgId);
  const selectedId = await getSelectedPropertyId();
  const isValidSelection = selectedId && propertiesList.some((p) => p.id === selectedId);
  const activePropertyId = isValidSelection ? selectedId : propertiesList[0]?.id ?? '';

  if (!activePropertyId) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        No properties found. Create a property in Settings first.
      </div>
    );
  }

  // Load 30-day rate window from search params or today
  const startParam = params.start;
  const startBase = startParam ? new Date(startParam) : new Date();
  const isValidDate = !isNaN(startBase.getTime());
  const startDate = format(isValidDate ? startBase : new Date(), 'yyyy-MM-dd');
  const endDate = format(addDays(isValidDate ? startBase : new Date(), 30), 'yyyy-MM-dd');

  const [roomTypesList, ratePlansList, ratesList, seasonsList, supplementsList] = await Promise.all([
    roomTypeRepo.findByProperty(orgId, activePropertyId),
    ratePlanRepo.findByProperty(orgId, activePropertyId),
    // Load rates for all rate plans — we'll filter client-side
    (async () => {
      const plans = await ratePlanRepo.findByProperty(orgId, activePropertyId);
      const allRates = await Promise.all(
        plans.map((p) => rateRepo.findByRatePlan(orgId, p.id, startDate, endDate)),
      );
      return allRates.flat();
    })(),
    seasonRepo.findByProperty(orgId, activePropertyId),
    supplementRepo.findByProperty(orgId, activePropertyId),
  ]);

  return (
    <RatesClient
      properties={propertiesList}
      defaultPropertyId={activePropertyId}
      roomTypes={roomTypesList}
      ratePlans={ratePlansList}
      rates={ratesList}
      seasons={seasonsList}
      supplements={supplementsList}
      startDate={startDate}
      endDate={endDate}
      initialPlanId={params.planId}
    />
  );
}
