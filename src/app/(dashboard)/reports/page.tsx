import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { format, subDays } from 'date-fns';
import { dashboardRepo } from '@/server/repositories/dashboard.repo';
import { propertyRepo } from '@/server/repositories/property.repo';
import { ReportsClient } from '@/components/reports/reports-client';
import { getSelectedPropertyId } from '@/server/actions/property-switch';

interface ReportsPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;
  const params = await searchParams;

  const today = format(new Date(), 'yyyy-MM-dd');
  const dateTo = params.to ?? today;
  const dateFrom = params.from ?? format(subDays(new Date(), 90), 'yyyy-MM-dd');

  // Resolve active property
  const propertiesList = await propertyRepo.findAll(orgId);
  const selectedId = await getSelectedPropertyId();
  const isValidSelection = selectedId && propertiesList.some((p) => p.id === selectedId);
  const propertyId = isValidSelection ? selectedId : propertiesList[0]?.id;

  const [kpis, revenueByType, revenueBySource, statusCounts, topNationalities] =
    await Promise.all([
      dashboardRepo.getOccupancyKpis(orgId, today, propertyId),
      dashboardRepo.getRevenueByType(orgId, dateFrom, dateTo, propertyId),
      dashboardRepo.getRevenueBySource(orgId, dateFrom, dateTo, propertyId),
      dashboardRepo.getReservationStatusCounts(orgId, propertyId),
      dashboardRepo.getTopNationalities(orgId, 15),
    ]);

  const [dailyOccupancy, dailyRevenue] = await Promise.all([
    dashboardRepo.getDailyOccupancy(orgId, dateFrom, dateTo, kpis.totalRooms || 1, propertyId),
    dashboardRepo.getDailyRevenue(orgId, dateFrom, dateTo, propertyId),
  ]);

  return (
    <ReportsClient
      dateFrom={dateFrom}
      dateTo={dateTo}
      revenueByType={revenueByType.map((r) => ({
        type: r.type,
        total: parseFloat(r.total),
      }))}
      revenueBySource={revenueBySource.map((r) => ({
        source: r.source,
        total: parseFloat(r.total),
        count: r.count,
      }))}
      statusCounts={statusCounts.map((r) => ({
        status: r.status,
        count: r.count,
      }))}
      dailyOccupancy={dailyOccupancy}
      dailyRevenue={dailyRevenue}
      topNationalities={topNationalities.map((r) => ({
        nationality: r.nationality ?? 'Unknown',
        count: r.count,
      }))}
    />
  );
}
