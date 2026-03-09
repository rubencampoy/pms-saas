import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { propertyRepo } from '@/server/repositories/property.repo';
import { roomTypeRepo } from '@/server/repositories/room-type.repo';
import { unitRepo } from '@/server/repositories/unit.repo';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { guestRepo } from '@/server/repositories/guest.repo';
import { ratePlanRepo } from '@/server/repositories/rate-plan.repo';
import { rateRepo } from '@/server/repositories/rate.repo';
import { format, addDays, parseISO, isValid } from 'date-fns';
import { CalendarClient } from '@/components/calendar/calendar-client';
import { getSelectedPropertyId } from '@/server/actions/property-switch';

interface CalendarPageProps {
  searchParams: Promise<{ start?: string }>;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;

  // Get the active property from cookie (or fallback to first property)
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

  // Parse center date from search params, fallback to today
  // We load a wide window: 7 days before center + 83 days after = 90 days total
  const params = await searchParams;
  const today = new Date();
  let centerDate = today;

  if (params.start) {
    const parsed = parseISO(params.start);
    if (isValid(parsed)) {
      centerDate = parsed;
    }
  }

  const DAYS_BEFORE = 90;
  const DAYS_AFTER = 90;
  const startDate = format(addDays(centerDate, -DAYS_BEFORE), 'yyyy-MM-dd');
  const endDate = format(addDays(centerDate, DAYS_AFTER), 'yyyy-MM-dd');

  const [roomTypesList, unitsList, reservationsList, guestsList, ratePlansList] = await Promise.all([
    roomTypeRepo.findByProperty(orgId, activePropertyId),
    unitRepo.findByProperty(orgId, activePropertyId),
    reservationRepo.findByDateRange(orgId, activePropertyId, startDate, endDate),
    guestRepo.findAll(orgId, { limit: 10000 }),
    ratePlanRepo.findByProperty(orgId, activePropertyId),
  ]);

  // Load rates for all rate plans in the date range — pick the lowest-priority (default) plan's rates
  // If multiple plans exist, we show the first (highest priority) plan's rates in the calendar
  const defaultPlan = ratePlansList[0];
  let ratesList: { roomTypeId: string; date: string; amount: string }[] = [];

  if (defaultPlan) {
    const rawRates = await rateRepo.findByRatePlan(orgId, defaultPlan.id, startDate, endDate);
    ratesList = rawRates.map((r) => ({
      roomTypeId: r.roomTypeId,
      date: r.date,
      amount: r.amount,
    }));
  }

  return (
    <CalendarClient
      properties={propertiesList}
      defaultPropertyId={activePropertyId}
      roomTypes={roomTypesList}
      units={unitsList}
      reservations={reservationsList}
      guests={guestsList}
      rates={ratesList}
      initialStartDate={startDate}
      initialEndDate={endDate}
    />
  );
}
