import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { guestRepo } from '@/server/repositories/guest.repo';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { propertyRepo } from '@/server/repositories/property.repo';
import { roomTypeRepo } from '@/server/repositories/room-type.repo';
import { GuestDetail } from '@/components/guests/guest-detail';

interface GuestPageProps {
  params: Promise<{ id: string }>;
}

export default async function GuestPage({ params }: GuestPageProps) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id } = await params;
  const orgId = session.user.organizationId;

  const guest = await guestRepo.findById(orgId, id);
  if (!guest) notFound();

  const [guestReservations, properties, roomTypes] = await Promise.all([
    reservationRepo.findByGuest(orgId, id),
    propertyRepo.findAll(orgId),
    roomTypeRepo.findAll(orgId),
  ]);

  return (
    <GuestDetail
      guest={{
        id: guest.id,
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone,
        documentType: guest.documentType,
        documentNumber: guest.documentNumber,
        nationality: guest.nationality,
        dateOfBirth: guest.dateOfBirth,
        address: guest.address as Record<string, string> | null,
        vipStatus: guest.vipStatus,
        notes: guest.notes,
        totalStays: guest.totalStays,
        totalRevenue: guest.totalRevenue,
        createdAt: guest.createdAt.toISOString(),
      }}
      reservations={guestReservations.map((r) => ({
        id: r.id,
        confirmationCode: r.confirmationCode,
        status: r.status,
        source: r.source,
        checkInDate: r.checkInDate,
        checkOutDate: r.checkOutDate,
        nights: r.nights,
        totalAmount: r.totalAmount,
        currency: r.currency,
        propertyName: properties.find((p) => p.id === r.propertyId)?.name ?? '',
        roomTypeName: roomTypes.find((rt) => rt.id === r.roomTypeId)?.name ?? '',
      }))}
    />
  );
}
