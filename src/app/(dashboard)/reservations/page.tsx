import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { propertyRepo } from '@/server/repositories/property.repo';
import { roomTypeRepo } from '@/server/repositories/room-type.repo';
import { guestRepo } from '@/server/repositories/guest.repo';
import { BookingsClient } from '@/components/reservations/bookings-client';

export default async function ReservationsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;

  const [reservationsList, propertiesList, roomTypesList, guestsList] = await Promise.all([
    reservationRepo.findAll(orgId, { limit: 10000 }),
    propertyRepo.findAll(orgId),
    roomTypeRepo.findAll(orgId),
    guestRepo.findAll(orgId, { limit: 10000 }),
  ]);

  return (
    <BookingsClient
      reservations={reservationsList}
      properties={propertiesList}
      roomTypes={roomTypesList}
      guests={guestsList}
    />
  );
}
