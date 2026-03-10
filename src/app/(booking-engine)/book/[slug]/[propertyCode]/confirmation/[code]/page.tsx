import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { bookingEngineService } from '@/server/services/booking-engine.service';
import { reservationRepo } from '@/server/repositories/reservation.repo';
import { guestRepo } from '@/server/repositories/guest.repo';
import { folioRepo } from '@/server/repositories/folio.repo';
import { bookingEngineRepo } from '@/server/repositories/booking-engine.repo';
import { StepIndicator } from '@/components/booking-engine/step-indicator';

interface Props {
  params: Promise<{ slug: string; propertyCode: string; code: string }>;
}

export default async function ConfirmationPage({ params }: Props) {
  const { slug, propertyCode, code } = await params;
  const t = await getTranslations('bookingEnginePublic');

  let resolved;
  try {
    resolved = await bookingEngineService.resolveProperty(slug, propertyCode);
  } catch {
    notFound();
  }

  const { organization, property } = resolved;
  if (!property) notFound();

  // Load settings for redirect check
  const settings = await bookingEngineService.getSettings(organization.id, property.id);
  if (settings.redirectConfirmation && settings.redirectUrl) {
    redirect(settings.redirectUrl);
  }

  // Find reservation by confirmation code
  const reservation = await reservationRepo.findByConfirmationCode(organization.id, code);
  if (!reservation) notFound();

  // Load guest and room type data
  const guest = await guestRepo.findById(organization.id, reservation.guestId);
  if (!guest) notFound();

  const roomTypes = await bookingEngineRepo.findActiveRoomTypes(organization.id, property.id);
  const roomType = roomTypes.find((rt) => rt.id === reservation.roomTypeId);

  // Load folio for total amount
  const folio = await folioRepo.findByReservation(organization.id, reservation.id);

  // Find sibling reservations (same guest + dates + property, different confirmation code)
  const allReservations = await reservationRepo.findByDateRange(
    organization.id,
    property.id,
    reservation.checkInDate,
    reservation.checkOutDate,
  );
  const siblingReservations = allReservations.filter(
    (r) =>
      r.guestId === reservation.guestId &&
      r.checkInDate === reservation.checkInDate &&
      r.checkOutDate === reservation.checkOutDate &&
      r.confirmationCode !== reservation.confirmationCode,
  );

  const formatCurrency = (amount: string | number, currency: string = 'EUR') => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Step indicator */}
      <StepIndicator
        currentStep={3}
        translations={{
          step1: t('step1Selection'),
          step2: t('step2Details'),
          step3: t('step3Confirmation'),
        }}
      />

      {/* Success header */}
      <div className="flex flex-col items-center text-center mb-12">
        <div className="size-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-6">
          <span className="material-icons text-green-500 text-5xl font-bold">check_circle</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
          {t('bookingConfirmed')}
        </h1>
        {settings.autoConfirmEmail && (
          <p className="text-slate-600 dark:text-slate-400 max-w-md">
            {t('confirmationEmailSent', { email: guest.email ?? '' })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Confirmation code card */}
          <div className="bg-white dark:bg-slate-900 border-2 border-primary rounded-xl p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                {t('confirmationCode')}
              </p>
              <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                {reservation.confirmationCode}
              </h3>
              {siblingReservations.length > 0 && (
                <div className="mt-2 space-y-1">
                  {siblingReservations.map((sr) => (
                    <div key={sr.id} className="text-lg font-mono text-primary/70 tracking-widest">
                      {sr.confirmationCode}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-bold text-sm text-slate-700 dark:text-slate-300 transition-colors">
                <span className="material-icons text-sm">content_copy</span>
                {t('copyCode')}
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white hover:bg-primary/90 rounded-lg font-bold text-sm transition-colors shadow-sm shadow-primary/30">
                <span className="material-icons text-sm">download</span>
                {t('savePdf')}
              </button>
            </div>
          </div>

          {/* Stay Summary card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-bold text-lg text-slate-900 dark:text-white">
                {t('staySummary')}
              </h4>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                {/* Dates */}
                <div className="flex items-start gap-4">
                  <span className="material-icons text-slate-400">calendar_month</span>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {t('checkIn')} / {t('checkOut')}
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {reservation.checkInDate} — {reservation.checkOutDate}
                    </p>
                    <p className="text-sm text-slate-500 italic">
                      {reservation.nights} {t('nights')}
                    </p>
                  </div>
                </div>

                {/* Room Type */}
                <div className="flex items-start gap-4">
                  <span className="material-icons text-slate-400">hotel</span>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {t('rooms')}
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {siblingReservations.length > 0
                        ? `${siblingReservations.length + 1}x `
                        : ''}
                      {roomType?.name ?? 'Room'}
                    </p>
                    <p className="text-sm text-slate-500">
                      {guest.firstName} {guest.lastName}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Total Paid */}
                <div className="flex items-start gap-4">
                  <span className="material-icons text-slate-400">payments</span>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {t('total')}
                    </p>
                    <p className="text-2xl font-black text-primary">
                      {folio
                        ? formatCurrency(folio.total, folio.currency)
                        : formatCurrency(reservation.totalAmount, reservation.currency)}
                    </p>
                  </div>
                </div>

                {/* Cancellation Policy */}
                <div className="flex items-start gap-4">
                  <span className="material-icons text-slate-400">info</span>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {t('cancellationPolicy')}
                    </p>
                    <p className="text-sm text-slate-500">
                      {t('cancellationPolicyDesc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Check-in instructions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-8">
              <h4 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">
                {t('checkInInstructions')}
              </h4>
              <ul className="space-y-4">
                <li className="flex gap-3">
                  <span className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    1
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('checkInInstruction1')}
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    2
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('checkInInstruction2')}
                  </p>
                </li>
                <li className="flex gap-3">
                  <span className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    3
                  </span>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('checkInInstruction3')}
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right column (1/3) - Sidebar */}
        <div className="space-y-6">
          {/* Need help? dark card */}
          <div className="bg-slate-900 text-white rounded-xl p-6 shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h4 className="font-bold text-xl mb-2">{t('needHelp')}</h4>
              <p className="text-slate-300 text-sm mb-6 leading-relaxed">
                {t('needHelpDesc')}
              </p>
              <div className="space-y-3">
                <button className="w-full flex items-center justify-between px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors group">
                  <span className="text-sm font-semibold">{t('contactSupport')}</span>
                  <span className="material-icons text-sm group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </button>
                <button className="w-full flex items-center justify-between px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors group">
                  <span className="text-sm font-semibold">{t('visitHelpCenter')}</span>
                  <span className="material-icons text-sm group-hover:translate-x-1 transition-transform">
                    arrow_forward
                  </span>
                </button>
              </div>
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/30 blur-3xl rounded-full" />
          </div>

          {/* What's Next? card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h5 className="font-bold mb-4 text-slate-900 dark:text-white">{t('whatsNext')}</h5>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="material-icons text-primary text-sm mt-1">mail</span>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t('checkEmailQr')}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-icons text-primary text-sm mt-1">download_for_offline</span>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t('getApp')}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 flex flex-col gap-3">
            <Link
              href={`/book/${slug}/${propertyCode}`}
              className="w-full py-4 bg-primary text-white rounded-xl font-extrabold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              <span className="material-icons">home</span>
              {t('backToHome')}
            </Link>
            <Link
              href={`/book/${slug}/${propertyCode}`}
              className="w-full py-4 bg-transparent border-2 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-icons">print</span>
              {t('printReceipt')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
