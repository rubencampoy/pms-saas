import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { format, subDays } from 'date-fns';
import { dashboardRepo } from '@/server/repositories/dashboard.repo';
import { propertyRepo } from '@/server/repositories/property.repo';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { getSelectedPropertyId } from '@/server/actions/property-switch';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;
  const today = format(new Date(), 'yyyy-MM-dd');
  const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  // Resolve active property
  const propertiesList = await propertyRepo.findAll(orgId);
  const selectedId = await getSelectedPropertyId();
  const isValidSelection = selectedId && propertiesList.some((p) => p.id === selectedId);
  const propertyId = isValidSelection ? selectedId : propertiesList[0]?.id;

  // Batch 1: KPIs + movements + today's detail
  const [kpis, movements, hkSummary, outstanding, todayArrivals, todayDepartures, roomGrid] =
    await Promise.all([
      dashboardRepo.getOccupancyKpis(orgId, today, propertyId),
      dashboardRepo.getMovements(orgId, today, propertyId),
      dashboardRepo.getHousekeepingSummary(orgId, today, propertyId),
      dashboardRepo.getOutstandingBalance(orgId, propertyId),
      dashboardRepo.getTodayArrivals(orgId, today, propertyId),
      dashboardRepo.getTodayDepartures(orgId, today, propertyId),
      dashboardRepo.getRoomStatusGrid(orgId, today, propertyId),
    ]);

  // Batch 2: charts
  const [dailyOccupancy, dailyRevenue, revenueByType, revenueBySource] = await Promise.all([
    dashboardRepo.getDailyOccupancy(orgId, thirtyDaysAgo, today, kpis.totalRooms || 1, propertyId),
    dashboardRepo.getDailyRevenue(orgId, sevenDaysAgo, today, propertyId),
    dashboardRepo.getRevenueByType(orgId, thirtyDaysAgo, today, propertyId),
    dashboardRepo.getRevenueBySource(orgId, thirtyDaysAgo, today, propertyId),
  ]);

  const totalRevenue30d = revenueByType.reduce((s, r) => s + parseFloat(r.total), 0);

  return (
    <DashboardClient
      userName={session.user.name ?? 'User'}
      kpis={kpis}
      movements={movements}
      hkSummary={hkSummary}
      outstanding={outstanding}
      todayArrivals={todayArrivals.map((a) => ({
        id: a.id,
        confirmationCode: a.confirmationCode,
        status: a.status,
        nights: a.nights,
        adults: a.adults,
        children: a.children,
        totalAmount: a.totalAmount,
        guestName: `${a.guestFirstName} ${a.guestLastName}`,
        guestInitials: `${a.guestFirstName[0] ?? ''}${a.guestLastName[0] ?? ''}`.toUpperCase(),
        unitName: a.unitName,
        roomTypeName: a.roomTypeName,
        roomTypeCode: a.roomTypeCode,
      }))}
      todayDepartures={todayDepartures.map((d) => ({
        id: d.id,
        confirmationCode: d.confirmationCode,
        status: d.status,
        nights: d.nights,
        adults: d.adults,
        children: d.children,
        totalAmount: d.totalAmount,
        guestName: `${d.guestFirstName} ${d.guestLastName}`,
        guestInitials: `${d.guestFirstName[0] ?? ''}${d.guestLastName[0] ?? ''}`.toUpperCase(),
        unitName: d.unitName,
        roomTypeName: d.roomTypeName,
        roomTypeCode: d.roomTypeCode,
      }))}
      roomGrid={roomGrid}
      dailyOccupancy={dailyOccupancy}
      dailyRevenue={dailyRevenue}
      totalRevenue30d={totalRevenue30d}
      revenueBySource={revenueBySource.map((r) => ({
        source: r.source,
        total: parseFloat(r.total),
        count: r.count,
      }))}
    />
  );
}
