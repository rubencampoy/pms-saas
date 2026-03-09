import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { propertyRepo } from '@/server/repositories/property.repo';
import { roomTypeRepo } from '@/server/repositories/room-type.repo';
import { unitRepo } from '@/server/repositories/unit.repo';
import { RoomTypesClient } from '@/components/settings/room-types-client';

export default async function RoomTypesPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;

  const [propertiesList, allRoomTypes, allUnits] = await Promise.all([
    propertyRepo.findAll(orgId),
    roomTypeRepo.findAll(orgId),
    unitRepo.findAll(orgId),
  ]);

  return (
    <RoomTypesClient
      properties={propertiesList}
      roomTypes={allRoomTypes}
      units={allUnits}
    />
  );
}
