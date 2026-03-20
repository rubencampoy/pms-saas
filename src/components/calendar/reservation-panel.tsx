'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { format, parseISO, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
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

const SOURCE_ICONS: Record<string, string> = {
  direct: 'language',
  booking_engine: 'public',
  phone: 'phone',
  email: 'email',
  walk_in: 'person',
  ota: 'travel_explore',
  channel_manager: 'sync',
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

  const checkIn = reservation ? parseISO(reservation.checkInDate) : new Date();
  const checkOut = reservation ? parseISO(reservation.checkOutDate) : new Date();
  const sourceIcon = reservation ? (SOURCE_ICONS[reservation.source] ?? 'help_outline') : 'help_outline';

  // Balance state
  const balance = folioSummary ? parseFloat(folioSummary.balance) : 0;
  const hasBalance = balance > 0;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[380px] z-50 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-[-8px_0_30px_-15px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {reservation && guest && (
          <div className="flex flex-col h-full">
            {/* Status accent bar */}
            <div className={`h-1 w-full flex-shrink-0 ${badge.dot}`} />

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Header */}
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-mono">
                    <span className="material-icons text-sm">confirmation_number</span>
                    {reservation.confirmationCode}
                  </div>
                  <button
                    onClick={onClose}
                    className="p-1 -mr-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-icons text-slate-400 dark:text-slate-500 text-xl">close</span>
                  </button>
                </div>

                {/* Guest profile */}
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 ${initialsBg} rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg shadow-black/10`}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate">
                        {guest.firstName} {guest.lastName}
                      </h3>
                      {guest.vipStatus && guest.vipStatus !== 'none' && (
                        <span className="inline-flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <span className="material-icons text-xs">star</span>
                          {guest.vipStatus.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text} border ${badge.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} mr-1.5`} />
                        {tStatus(reservation.status)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact info */}
                <div className="mt-4 flex flex-wrap gap-3">
                  {guest.email && (
                    <a
                      href={`mailto:${guest.email}`}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-primary transition-colors bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2.5 py-1.5"
                    >
                      <span className="material-icons text-sm">email</span>
                      <span className="truncate max-w-[160px]">{guest.email}</span>
                    </a>
                  )}
                  {guest.phone && (
                    <a
                      href={`tel:${guest.phone}`}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-primary transition-colors bg-slate-50 dark:bg-slate-800/50 rounded-lg px-2.5 py-1.5"
                    >
                      <span className="material-icons text-sm">phone</span>
                      <span>{guest.phone}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Stay card */}
              <div className="px-6 pb-4">
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    {/* Check-in */}
                    <div className="flex-1 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-1">
                        {t('checkIn')}
                      </p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {format(checkIn, 'd MMM', { locale: es })}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                        {format(checkIn, 'EEEE', { locale: es })}
                      </p>
                      {isToday(checkIn) && (
                        <span className="inline-flex mt-1 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                          HOY
                        </span>
                      )}
                    </div>

                    {/* Divider with nights */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
                        {reservation.nights}N
                      </div>
                      <div className="flex items-center text-slate-300 dark:text-slate-600">
                        <div className="w-5 h-px bg-current" />
                        <span className="material-icons text-xs">arrow_forward</span>
                      </div>
                    </div>

                    {/* Check-out */}
                    <div className="flex-1 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-1">
                        {t('checkOut')}
                      </p>
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {format(checkOut, 'd MMM', { locale: es })}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                        {format(checkOut, 'EEEE', { locale: es })}
                      </p>
                      {isToday(checkOut) && (
                        <span className="inline-flex mt-1 text-[10px] font-semibold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                          HOY
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Details grid */}
              <div className="px-6 pb-4">
                <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                  {t('details')}
                </h4>
                <div className="space-y-2.5">
                  <DetailRow
                    icon="bedroom_parent"
                    label={t('roomType')}
                    value={roomTypeName ?? '—'}
                  />
                  {unitName ? (
                    <DetailRow icon="door_front" label={t('unit')} value={unitName} />
                  ) : (
                    reservation.status !== 'cancelled' && reservation.status !== 'checked_out' && (
                      <DetailRow
                        icon="warning"
                        label={t('unit')}
                        value={t('unassigned')}
                        warn
                      />
                    )
                  )}
                  <DetailRow
                    icon="group"
                    label={t('guests')}
                    value={`${reservation.adults} ${t('adults', { count: reservation.adults })}${reservation.children > 0 ? ` · ${reservation.children} ${t('children', { count: reservation.children })}` : ''}`}
                  />
                  <DetailRow
                    icon={sourceIcon}
                    label={t('source')}
                    value={tSource(reservation.source)}
                  />
                </div>
              </div>

              {/* Folio summary */}
              <div className="px-6 pb-4">
                <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                  {t('folioSummary')}
                </h4>
                {folioLoading ? (
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 space-y-3">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-2/3" />
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-1/2" />
                  </div>
                ) : folioSummary ? (
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">{t('total')}</span>
                        <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                          {parseFloat(folioSummary.total).toFixed(2)} €
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">{t('paid')}</span>
                        <span className="font-semibold text-green-600 dark:text-green-400 tabular-nums">
                          {parseFloat(folioSummary.paidAmount).toFixed(2)} €
                        </span>
                      </div>
                      <div className="border-t border-slate-200/60 dark:border-slate-700/60 pt-2 mt-2">
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {t('balance')}
                          </span>
                          <span className={`text-base font-bold tabular-nums ${
                            hasBalance
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}>
                            {parseFloat(folioSummary.balance).toFixed(2)} €
                          </span>
                        </div>
                      </div>
                    </div>

                    <Link
                      href={`/reservations/${reservation.id}/folio`}
                      className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 text-xs font-semibold text-primary hover:bg-primary/5 rounded-lg transition-colors border border-primary/20"
                    >
                      <span className="material-icons text-sm">receipt_long</span>
                      {t('viewFolio')}
                    </Link>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 text-center">
                    <span className="material-icons text-2xl text-slate-300 dark:text-slate-600">receipt_long</span>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{t('noFolio')}</p>
                  </div>
                )}
              </div>

              {/* Notes section */}
              {(reservation.specialRequests || reservation.internalNotes) && (
                <div className="px-6 pb-4 space-y-3">
                  {reservation.specialRequests && (
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <span className="material-icons text-xs">info</span>
                        {t('specialRequests')}
                      </h4>
                      <div className="text-sm text-slate-700 dark:text-slate-300 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-100 dark:border-amber-800/30 leading-relaxed">
                        {reservation.specialRequests}
                      </div>
                    </div>
                  )}
                  {reservation.internalNotes && (
                    <div>
                      <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <span className="material-icons text-xs">sticky_note_2</span>
                        {t('internalNotes')}
                      </h4>
                      <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-100 dark:border-slate-800 leading-relaxed">
                        {reservation.internalNotes}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick link to full reservation */}
              <div className="px-6 pb-4">
                <Link
                  href={`/reservations/${reservation.id}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
                >
                  <span className="material-icons text-lg">open_in_new</span>
                  {t('viewFullReservation')}
                </Link>
              </div>
            </div>

            {/* Sticky action buttons */}
            {(canCheckIn || canCheckOut) && (
              <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                {canCheckIn && (
                  <button
                    onClick={() => handleStatusChange(ReservationStatus.CHECKED_IN)}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-600/20 disabled:opacity-50"
                  >
                    <span className="material-icons text-lg">login</span>
                    {isPending ? t('processing') : t('doCheckIn')}
                  </button>
                )}
                {canCheckOut && (
                  <button
                    onClick={() => handleStatusChange(ReservationStatus.CHECKED_OUT)}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-slate-600 rounded-xl hover:bg-slate-700 transition-colors shadow-lg shadow-slate-600/20 disabled:opacity-50"
                  >
                    <span className="material-icons text-lg">logout</span>
                    {isPending ? t('processing') : t('doCheckOut')}
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

function DetailRow({
  icon,
  label,
  value,
  warn,
}: {
  icon: string;
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        warn
          ? 'bg-amber-50 dark:bg-amber-900/20'
          : 'bg-slate-100 dark:bg-slate-800'
      }`}>
        <span className={`material-icons text-base ${
          warn
            ? 'text-amber-500'
            : 'text-slate-400 dark:text-slate-500'
        }`}>
          {icon}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">
          {label}
        </p>
        <p className={`text-sm font-medium truncate ${
          warn
            ? 'text-amber-600 dark:text-amber-400 italic'
            : 'text-slate-900 dark:text-white'
        }`}>
          {value}
        </p>
      </div>
    </div>
  );
}
