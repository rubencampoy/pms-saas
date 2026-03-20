import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { guestRepo } from '@/server/repositories/guest.repo';
import { roomTypeRepo } from '@/server/repositories/room-type.repo';
import { propertyRepo } from '@/server/repositories/property.repo';
import { unitRepo } from '@/server/repositories/unit.repo';
import { folioRepo, folioLineItemRepo } from '@/server/repositories/folio.repo';
import { ReservationDetail } from '@/components/reservations/reservation-detail';

interface ReservationPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReservationPage({ params }: ReservationPageProps) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id } = await params;
  const orgId = session.user.organizationId;

  const reservation = await reservationRepo.findById(orgId, id);
  if (!reservation) notFound();

  const [guest, roomType, property] = await Promise.all([
    guestRepo.findById(orgId, reservation.guestId),
    roomTypeRepo.findById(orgId, reservation.roomTypeId),
    propertyRepo.findById(orgId, reservation.propertyId),
  ]);

  if (!guest || !roomType || !property) notFound();

  const unit = reservation.unitId
    ? await unitRepo.findById(orgId, reservation.unitId)
    : null;

  // Fetch folio + line items for rate breakdown
  const folio = await folioRepo.findByReservation(orgId, reservation.id);
  let folioSummary = null;

  if (folio) {
    const lineItems = await folioLineItemRepo.findByFolio(orgId, folio.id);
    folioSummary = {
      id: folio.id,
      subtotal: folio.subtotal,
      taxTotal: folio.taxTotal,
      total: folio.total,
      paidAmount: folio.paidAmount,
      balance: folio.balance,
      currency: folio.currency,
      lineItems: lineItems.map((li) => ({
        type: li.type,
        description: li.description,
        date: li.date,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: li.amount,
        taxAmount: li.taxAmount,
      })),
    };
  }

  return (
    <ReservationDetail
      reservation={{
        id: reservation.id,
        confirmationCode: reservation.confirmationCode,
        status: reservation.status,
        source: reservation.source,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        nights: reservation.nights,
        adults: reservation.adults,
        children: reservation.children,
        totalAmount: reservation.totalAmount,
        currency: reservation.currency,
        specialRequests: reservation.specialRequests,
        internalNotes: reservation.internalNotes,
        createdAt: reservation.createdAt.toISOString(),
      }}
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
      roomType={{
        id: roomType.id,
        name: roomType.name,
        code: roomType.code,
      }}
      property={{
        id: property.id,
        name: property.name,
        code: property.code,
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
      }}
      unit={
        unit
          ? { id: unit.id, name: unit.name, floor: unit.floor }
          : null
      }
      folioSummary={folioSummary}
    />
  );
}
