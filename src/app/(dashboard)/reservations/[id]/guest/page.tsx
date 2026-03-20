import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { guestRepo } from '@/server/repositories/guest.repo';
import { GuestDetailsCard } from '@/components/reservations/guest-details-card';

interface GuestPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReservationGuestPage({ params }: GuestPageProps) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id } = await params;
  const orgId = session.user.organizationId;

  const reservation = await reservationRepo.findById(orgId, id);
  if (!reservation) notFound();

  const guest = await guestRepo.findById(orgId, reservation.guestId);
  if (!guest) notFound();

  const canEdit =
    reservation.status === 'confirmed' || reservation.status === 'checked_in';

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        <GuestDetailsCard
          guest={{
            id: guest.id,
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email,
            phone: guest.phone,
            vipStatus: guest.vipStatus,
            nationality: guest.nationality,
            documentType: guest.documentType,
            documentNumber: guest.documentNumber,
            dateOfBirth: guest.dateOfBirth,
            address: guest.address as Record<string, string> | null,
            notes: guest.notes,
            totalStays: guest.totalStays,
            totalRevenue: guest.totalRevenue,
          }}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
