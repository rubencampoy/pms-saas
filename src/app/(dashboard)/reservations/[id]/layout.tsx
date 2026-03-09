import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { guestRepo } from '@/server/repositories/guest.repo';
import { roomTypeRepo } from '@/server/repositories/room-type.repo';
import { unitRepo } from '@/server/repositories/unit.repo';
import { ReservationHeader } from '@/components/reservations/reservation-header';

interface ReservationLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ReservationLayout({
  children,
  params,
}: ReservationLayoutProps) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id } = await params;
  const orgId = session.user.organizationId;

  const reservation = await reservationRepo.findById(orgId, id);
  if (!reservation) notFound();

  const [guest, roomType] = await Promise.all([
    guestRepo.findById(orgId, reservation.guestId),
    roomTypeRepo.findById(orgId, reservation.roomTypeId),
  ]);
  if (!guest || !roomType) notFound();

  const unit = reservation.unitId
    ? await unitRepo.findById(orgId, reservation.unitId)
    : null;

  return (
    <>
      <ReservationHeader
        reservation={{
          id: reservation.id,
          confirmationCode: reservation.confirmationCode,
          status: reservation.status,
        }}
        guest={{
          firstName: guest.firstName,
          lastName: guest.lastName,
        }}
        roomType={{ name: roomType.name }}
        unit={unit ? { name: unit.name } : null}
        nights={reservation.nights}
        checkInDate={reservation.checkInDate}
        checkOutDate={reservation.checkOutDate}
      />
      {children}
    </>
  );
}
