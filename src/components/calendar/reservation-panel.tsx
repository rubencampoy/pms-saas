'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { getReservationFolioSummary } from '@/server/actions/reservations';
import { changeReservationStatus } from '@/server/actions/reservations';
import { ReservationStatus, VALID_STATUS_TRANSITIONS } from '@/lib/constants/reservation';

interface Reservation {
  id: string;
  guestId: string;
  roomTypeId: string;
  unitId: string | null;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  confirmationCode: string;
  nights: number;
  adults: number;
  children: number;
  totalAmount: string;
  source: string;
  specialRequests: string | null;
  internalNotes: string | null;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  vipStatus: string;
}

interface FolioSummary {
  folioId: string;
  total: string;
  paidAmount: string;
  balance: string;
}

interface ReservationPanelProps {
  reservation: Reservation | null;
  guest: Guest | null;
  roomTypeName: string | null;
  unitName: string | null;
  onClose: () => void;
  onStatusChange: () => void;
}

type BadgeStyle = { bg: string; text: string; dot: string; border: string };

const DEFAULT_BADGE: BadgeStyle = {
  bg: 'bg-blue-100 dark:bg-blue-900/30',
  text: 'text-blue-800 dark:text-blue-300',
  dot: 'bg-blue-500',
  border: 'border-blue-200 dark:border-blue-800',
};

const STATUS_BADGE: Record<string, BadgeStyle> = {
  confirmed: DEFAULT_BADGE,
  checked_in: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-300',
    dot: 'bg-green-500',
    border: 'border-green-200 dark:border-green-800',
  },
  checked_out: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-800 dark:text-slate-300',
    dot: 'bg-slate-500',
    border: 'border-slate-200 dark:border-slate-700',
  },
  cancelled: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300',
    dot: 'bg-red-500',
    border: 'border-red-200 dark:border-red-800',
  },
  no_show: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-800',
  },
};

const INITIALS_BG: Record<string, string> = {
  confirmed: 'bg-primary',
  checked_in: 'bg-green-500',
  checked_out: 'bg-slate-400',
  cancelled: 'bg-red-500',
  no_show: 'bg-amber-500',
};

export function ReservationPanel({
  reservation,
  guest,
  roomTypeName,
  unitName,
  onClose,
  onStatusChange,
}: ReservationPanelProps) {
  const t = useTranslations('calendarPanel');
  const tStatus = useTranslations('status');
  const tSource = useTranslations('source');
  const isOpen = reservation !== null && guest !== null;

  // Folio lazy-load state
  const [folioSummary, setFolioSummary] = useState<FolioSummary | null>(null);
  const [folioLoading, setFolioLoading] = useState(false);
  const [folioLoaded, setFolioLoaded] = useState<string | null>(null);

  // Action transition
  const [isPending, startTransition] = useTransition();

  // Fetch folio when reservation changes
  useEffect(() => {
    if (!reservation) {
      setFolioSummary(null);
      setFolioLoaded(null);
      return;
    }

    if (folioLoaded === reservation.id) return;

    setFolioLoading(true);
    setFolioSummary(null);

    getReservationFolioSummary(reservation.id).then((result) => {
      if (result.success) {
        setFolioSummary(result.data ?? null);
      }
      setFolioLoading(false);
      setFolioLoaded(reservation.id);
    });
  }, [reservation, folioLoaded]);

  const handleStatusChange = (newStatus: ReservationStatus) => {
    if (!reservation) return;
    startTransition(async () => {
      const result = await changeReservationStatus({
        id: reservation.id,
        status: newStatus,
      });
      if (result.success) {
        onStatusChange();
      }
    });
  };

  // Determine available actions
  const canCheckIn =
    reservation?.status === ReservationStatus.CONFIRMED &&
    VALID_STATUS_TRANSITIONS[ReservationStatus.CONFIRMED].includes(ReservationStatus.CHECKED_IN);

  const canCheckOut =
    reservation?.status === ReservationStatus.CHECKED_IN &&
    VALID_STATUS_TRANSITIONS[ReservationStatus.CHECKED_IN].includes(ReservationStatus.CHECKED_OUT);

  const badge = (reservation ? STATUS_BADGE[reservation.status] : undefined) ?? DEFAULT_BADGE;
  const initialsBg = (reservation ? INITIALS_BG[reservation.status] : undefined) ?? 'bg-primary';

  const initials = guest
    ? `${guest.firstName.charAt(0)}${guest.lastName.charAt(0)}`.toUpperCase()
    : '';

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 z-50 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {reservation && guest && (
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-start justify-between mb-4">
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="material-icons text-slate-500 dark:text-slate-400 text-xl">close</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 ${initialsBg} rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                  {initials}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                    {guest.firstName} {guest.lastName}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text} border ${badge.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} mr-1.5`} />
                      {tStatus(reservation.status)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                {reservation.confirmationCode}
              </div>

              {/* Guest contact info */}
              <div className="mt-3 flex flex-col gap-1">
                {guest.email && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="material-icons text-sm">email</span>
                    <span className="truncate">{guest.email}</span>
                  </div>
                )}
                {guest.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="material-icons text-sm">phone</span>
                    <span>{guest.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Details grid */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <DetailItem label={t('checkIn')} value={format(parseISO(reservation.checkInDate), 'dd MMM yyyy')} />
                <DetailItem label={t('checkOut')} value={format(parseISO(reservation.checkOutDate), 'dd MMM yyyy')} />
                <DetailItem label={t('nights')} value={String(reservation.nights)} />
                <DetailItem
                  label={t('roomType')}
                  value={`${roomTypeName ?? '—'}${unitName ? ` · ${unitName}` : ''}`}
                />
                <DetailItem
                  label={t('guests')}
                  value={`${t('adults', { count: reservation.adults })}${reservation.children > 0 ? `, ${t('children', { count: reservation.children })}` : ''}`}
                />
                <DetailItem label={t('source')} value={tSource(reservation.source)} />
                <DetailItem
                  label={t('total')}
                  value={`${parseFloat(reservation.totalAmount).toFixed(2)} €`}
                  highlight
                />
                {!reservation.unitId && (
                  <DetailItem label={t('unit')} value={t('unassigned')} warn />
                )}
              </div>
            </div>

            {/* Folio summary */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                {t('folioSummary')}
              </h4>
              {folioLoading ? (
                <div className="space-y-2">
                  <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-2/3" />
                </div>
              ) : folioSummary ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{t('total')}</span>
                    <span className="font-medium text-slate-900 dark:text-white">{parseFloat(folioSummary.total).toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{t('paid')}</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{parseFloat(folioSummary.paidAmount).toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{t('balance')}</span>
                    <span className={`font-bold ${parseFloat(folioSummary.balance) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
                      {parseFloat(folioSummary.balance).toFixed(2)} €
                    </span>
                  </div>
                  <Link
                    href={`/reservations/${reservation.id}/folio`}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1"
                  >
                    <span className="material-icons text-sm">receipt_long</span>
                    {t('viewFolio')}
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">{t('noFolio')}</p>
              )}
            </div>

            {/* Special requests / Internal notes */}
            {(reservation.specialRequests || reservation.internalNotes) && (
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-3">
                {reservation.specialRequests && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      {t('specialRequests')}
                    </h4>
                    <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      {reservation.specialRequests}
                    </div>
                  </div>
                )}
                {reservation.internalNotes && (
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      {t('internalNotes')}
                    </h4>
                    <div className="text-sm text-slate-700 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                      {reservation.internalNotes}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            {(canCheckIn || canCheckOut) && (
              <div className="p-6 mt-auto">
                {canCheckIn && (
                  <button
                    onClick={() => handleStatusChange(ReservationStatus.CHECKED_IN)}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <span className="material-icons text-lg">login</span>
                    {t('doCheckIn')}
                  </button>
                )}
                {canCheckOut && (
                  <button
                    onClick={() => handleStatusChange(ReservationStatus.CHECKED_OUT)}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-600 rounded-lg hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <span className="material-icons text-lg">logout</span>
                    {t('doCheckOut')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function DetailItem({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</dt>
      <dd className={`text-sm font-medium mt-0.5 ${
        highlight
          ? 'text-slate-900 dark:text-white font-bold'
          : warn
            ? 'text-amber-600 dark:text-amber-400 italic'
            : 'text-slate-700 dark:text-slate-300'
      }`}>
        {value}
      </dd>
    </div>
  );
}
