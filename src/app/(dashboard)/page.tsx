import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { format, subDays } from 'date-fns';
import { dashboardRepo } from '@/server/repositories/dashboard.repo';
import { guestRepo } from '@/server/repositories/guest.repo';
import { propertyRepo } from '@/server/repositories/property.repo';
import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { getSelectedPropertyId } from '@/server/actions/property-switch';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;
  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  // Resolve active property
  const propertiesList = await propertyRepo.findAll(orgId);
  const selectedId = await getSelectedPropertyId();
  const isValidSelection = selectedId && propertiesList.some((p) => p.id === selectedId);
  const propertyId = isValidSelection ? selectedId : propertiesList[0]?.id;

  // First batch: get KPIs (need totalRooms for occupancy chart)
  const [kpis, movements, hkSummary, outstanding] = await Promise.all([
    dashboardRepo.getOccupancyKpis(orgId, today, propertyId),
    dashboardRepo.getMovements(orgId, today, propertyId),
    dashboardRepo.getHousekeepingSummary(orgId, today, propertyId),
    dashboardRepo.getOutstandingBalance(orgId, propertyId),
  ]);

  // Second batch: charts + tables (uses totalRooms from kpis)
  const [
    revenueByType,
    revenueBySource,
    dailyOccupancy,
    dailyRevenue,
    recentReservations,
    topNationalities,
  ] = await Promise.all([
    dashboardRepo.getRevenueByType(orgId, thirtyDaysAgo, today, propertyId),
    dashboardRepo.getRevenueBySource(orgId, thirtyDaysAgo, today, propertyId),
    dashboardRepo.getDailyOccupancy(orgId, thirtyDaysAgo, today, kpis.totalRooms || 1, propertyId),
    dashboardRepo.getDailyRevenue(orgId, thirtyDaysAgo, today, propertyId),
    dashboardRepo.getRecentReservations(orgId, 5, propertyId),
    dashboardRepo.getTopNationalities(orgId, 8),
  ]);

  // Resolve guest names for recent reservations
  const guestIds = [...new Set(recentReservations.map((r) => r.guestId))];
  const guestsData = await Promise.all(
    guestIds.map((id) => guestRepo.findById(orgId, id)),
  );
  const guestMap: Record<string, { firstName: string; lastName: string }> = {};
  for (const g of guestsData) {
    if (g) guestMap[g.id] = { firstName: g.firstName, lastName: g.lastName };
  }

  return (
    <DashboardClient
      userName={session.user.name ?? 'User'}
      kpis={kpis}
      movements={movements}
      hkSummary={hkSummary}
      outstanding={outstanding}
      revenueByType={revenueByType.map((r) => ({
        type: r.type,
        total: parseFloat(r.total),
      }))}
      revenueBySource={revenueBySource.map((r) => ({
        source: r.source,
        total: parseFloat(r.total),
        count: r.count,
      }))}
      dailyOccupancy={dailyOccupancy}
      dailyRevenue={dailyRevenue}
      recentReservations={recentReservations.map((r) => ({
        ...r,
        guestName: guestMap[r.guestId]
          ? `${guestMap[r.guestId]!.firstName} ${guestMap[r.guestId]!.lastName}`
          : 'Unknown',
      }))}
      topNationalities={topNationalities.map((r) => ({
        nationality: r.nationality ?? 'Unknown',
        count: r.count,
      }))}
    />
  );
}
