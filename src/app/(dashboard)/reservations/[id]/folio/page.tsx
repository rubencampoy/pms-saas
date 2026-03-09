import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { guestRepo } from '@/server/repositories/guest.repo';
import { folioRepo, folioLineItemRepo, paymentRepo } from '@/server/repositories/folio.repo';
import { FolioDetail } from '@/components/reservations/folio-detail';

interface FolioPageProps {
  params: Promise<{ id: string }>;
}

export default async function FolioPage({ params }: FolioPageProps) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id: reservationId } = await params;
  const orgId = session.user.organizationId;

  const reservation = await reservationRepo.findById(orgId, reservationId);
  if (!reservation) notFound();

  const guest = await guestRepo.findById(orgId, reservation.guestId);
  if (!guest) notFound();

  // Find or auto-create folio for checked-in reservations
  let folio = await folioRepo.findByReservation(orgId, reservationId);

  if (!folio && reservation.status === 'checked_in') {
    const folioNumber = await folioRepo.getNextFolioNumber(orgId);
    folio = await folioRepo.create(orgId, {
      reservationId,
      guestId: guest.id,
      folioNumber,
    });
  }

  if (!folio) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-12 text-center">
          <span className="material-icons-outlined text-5xl text-slate-300 dark:text-slate-600 mb-3 block">
            receipt_long
          </span>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            No Folio Available
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            A folio will be created when the guest checks in.
          </p>
        </div>
      </div>
    );
  }

  const [lineItems, payments] = await Promise.all([
    folioLineItemRepo.findByFolio(orgId, folio.id),
    paymentRepo.findByFolio(orgId, folio.id),
  ]);

  return (
    <FolioDetail
      reservationId={reservation.id}
      checkInDate={reservation.checkInDate}
      folio={{
        id: folio.id,
        folioNumber: folio.folioNumber,
        status: folio.status,
        subtotal: folio.subtotal,
        taxTotal: folio.taxTotal,
        total: folio.total,
        paidAmount: folio.paidAmount,
        balance: folio.balance,
        currency: folio.currency,
        notes: folio.notes,
        closedAt: folio.closedAt?.toISOString() ?? null,
        createdAt: folio.createdAt.toISOString(),
      }}
      lineItems={lineItems.map((li) => ({
        id: li.id,
        type: li.type,
        description: li.description,
        date: li.date,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: li.amount,
        taxRate: li.taxRate,
        taxAmount: li.taxAmount,
        createdAt: li.createdAt.toISOString(),
      }))}
      payments={payments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: p.amount,
        reference: p.reference,
        notes: p.notes,
        processedAt: p.processedAt.toISOString(),
      }))}
    />
  );
}
