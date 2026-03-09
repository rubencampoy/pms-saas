import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { propertyRepo } from '@/server/repositories/property.repo';
import { unitRepo } from '@/server/repositories/unit.repo';
import { roomTypeRepo } from '@/server/repositories/room-type.repo';
import { housekeepingTaskRepo } from '@/server/repositories/housekeeping-task.repo';
import { userRepo } from '@/server/repositories/user.repo';
import { format } from 'date-fns';
import { HousekeepingClient } from '@/components/housekeeping/housekeeping-client';
import { getSelectedPropertyId } from '@/server/actions/property-switch';

export default async function HousekeepingPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;

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

  const today = format(new Date(), 'yyyy-MM-dd');

  const [unitsList, roomTypesList, tasksList, staffList, hkStatusCounts] = await Promise.all([
    unitRepo.findByProperty(orgId, activePropertyId),
    roomTypeRepo.findByProperty(orgId, activePropertyId),
    housekeepingTaskRepo.findByProperty(orgId, activePropertyId, {
      scheduledDate: today,
    }),
    userRepo.findAll(orgId),
    housekeepingTaskRepo.countUnitsByHkStatus(orgId, activePropertyId),
  ]);

  return (
    <HousekeepingClient
      properties={propertiesList}
      defaultPropertyId={activePropertyId}
      units={unitsList}
      roomTypes={roomTypesList}
      tasks={tasksList}
      staff={staffList}
      hkStatusCounts={hkStatusCounts}
      currentDate={today}
    />
  );
}
