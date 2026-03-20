'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { format, parseISO, differenceInDays, isToday, isTomorrow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTranslations } from 'next-intl';

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

interface ReservationPopoverProps {
  x: number;
  y: number;
  reservation: Reservation;
  guest: Guest | null;
  roomTypeName?: string;
  unitName?: string;
  onViewDetails: () => void;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
  onUnassign?: () => void;
  onClose: () => void;
}

type BadgeStyle = { bg: string; text: string; dot: string; icon: string };

const STATUS_BADGE: Record<string, BadgeStyle> = {
  confirmed: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
    icon: 'event_available',
  },
  checked_in: {
    bg: 'bg-green-50 dark:bg-green-900/30',
    text: 'text-green-700 dark:text-green-300',
    dot: 'bg-green-500',
    icon: 'login',
  },
  checked_out: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
    icon: 'logout',
  },
  cancelled: {
    bg: 'bg-red-50 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500',
    icon: 'cancel',
  },
  no_show: {
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    icon: 'person_off',
  },
};

const DEFAULT_BADGE: BadgeStyle = STATUS_BADGE.confirmed!;

const INITIALS_COLORS: Record<string, string> = {
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

export function ReservationPopover({
  x,
  y,
  reservation,
  guest,
  roomTypeName,
  unitName,
  onViewDetails,
  onCheckIn,
  onCheckOut,
  onUnassign,
  onClose,
}: ReservationPopoverProps) {
  const t = useTranslations('reservationPopover');
  const tStatus = useTranslations('status');
  const tSource = useTranslations('source');
  const popoverRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Calculate position with viewport clamping
  const popoverWidth = 340;
  const popoverHeight = 360;
  const clampedX = Math.min(x, typeof window !== 'undefined' ? window.innerWidth - popoverWidth - 16 : x);
  const clampedY = Math.min(y, typeof window !== 'undefined' ? window.innerHeight - popoverHeight - 16 : y);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    document.addEventListener('scroll', onClose, true);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', onClose, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [handleClickOutside, onClose]);

  const guestName = guest ? `${guest.firstName} ${guest.lastName}` : t('unknownGuest');
  const initials = guest
    ? `${guest.firstName.charAt(0)}${guest.lastName.charAt(0)}`.toUpperCase()
    : '??';
  const checkIn = parseISO(reservation.checkInDate);
  const checkOut = parseISO(reservation.checkOutDate);
  const badge = STATUS_BADGE[reservation.status] ?? DEFAULT_BADGE;
  const initialsBg = INITIALS_COLORS[reservation.status] ?? 'bg-primary';
  const sourceIcon = SOURCE_ICONS[reservation.source] ?? 'help_outline';

  // Date context hints
  const checkInToday = isToday(checkIn);
  const checkInTomorrow = isTomorrow(checkIn);
  const checkOutToday = isToday(checkOut);
  const isStayInProgress = reservation.status === 'checked_in';
  const nightsRemaining = isStayInProgress ? differenceInDays(checkOut, new Date()) : 0;

  return (
    <div
      ref={popoverRef}
      className={`fixed z-[90] w-[340px] overflow-hidden rounded-2xl bg-white dark:bg-[#1a2632] shadow-2xl shadow-black/10 dark:shadow-black/30 border border-slate-200/80 dark:border-slate-700/60 transition-all duration-200 ${
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      style={{ left: clampedX, top: clampedY, transformOrigin: 'top left' }}
    >
      {/* Top accent bar */}
      <div className={`h-1 w-full ${badge.dot}`} />

      {/* Header: Guest + Status */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className={`w-11 h-11 ${initialsBg} rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm`}>
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {guestName}
              </h3>
              {guest?.vipStatus && guest.vipStatus !== 'none' && (
                <span className="text-amber-500 text-xs font-bold flex items-center gap-0.5">
                  <span className="material-icons text-sm">star</span>
                  {guest.vipStatus.toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.bg} ${badge.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot} mr-1`} />
                {tStatus(reservation.status)}
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                {reservation.confirmationCode}
              </span>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1 -mr-1 -mt-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-icons text-slate-400 text-lg">close</span>
          </button>
        </div>
      </div>

      {/* Stay Info */}
      <div className="px-5 pb-3">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">
          <div className="flex items-center gap-3">
            {/* Check-in */}
            <div className="flex-1 text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-0.5">
                {t('checkIn')}
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {format(checkIn, 'd MMM', { locale: es })}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {format(checkIn, 'EEEE', { locale: es })}
              </p>
            </div>

            {/* Arrow with nights */}
            <div className="flex flex-col items-center gap-0.5 px-2">
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {reservation.nights} {reservation.nights === 1 ? t('night') : t('nights')}
              </span>
              <div className="flex items-center gap-1 text-slate-300 dark:text-slate-600">
                <div className="w-6 h-px bg-current" />
                <span className="material-icons text-xs">chevron_right</span>
              </div>
            </div>

            {/* Check-out */}
            <div className="flex-1 text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold mb-0.5">
                {t('checkOut')}
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {format(checkOut, 'd MMM', { locale: es })}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {format(checkOut, 'EEEE', { locale: es })}
              </p>
            </div>
          </div>

          {/* Contextual hint */}
          {(checkInToday || checkInTomorrow || checkOutToday || (isStayInProgress && nightsRemaining > 0)) && (
            <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
              <p className="text-[11px] text-center font-medium">
                {checkInToday && (
                  <span className="text-primary">
                    <span className="material-icons text-xs align-middle mr-0.5">today</span>
                    {t('arrivesToday')}
                  </span>
                )}
                {checkInTomorrow && !checkInToday && (
                  <span className="text-blue-600 dark:text-blue-400">
                    <span className="material-icons text-xs align-middle mr-0.5">event</span>
                    {t('arrivesTomorrow')}
                  </span>
                )}
                {checkOutToday && (
                  <span className="text-amber-600 dark:text-amber-400">
                    <span className="material-icons text-xs align-middle mr-0.5">event</span>
                    {t('departsToday')}
                  </span>
                )}
                {isStayInProgress && nightsRemaining > 0 && !checkOutToday && (
                  <span className="text-green-600 dark:text-green-400">
                    <span className="material-icons text-xs align-middle mr-0.5">hotel</span>
                    {nightsRemaining} {nightsRemaining === 1 ? t('nightRemaining') : t('nightsRemaining')}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Details row */}
      <div className="px-5 pb-3">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {/* Room info */}
          <div className="flex items-center gap-1">
            <span className="material-icons text-sm text-slate-400">bedroom_parent</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {roomTypeName ?? '—'}
            </span>
            {unitName && (
              <span className="text-slate-400">· {unitName}</span>
            )}
          </div>

          <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />

          {/* Guests */}
          <div className="flex items-center gap-1">
            <span className="material-icons text-sm text-slate-400">group</span>
            <span>{reservation.adults}A{reservation.children > 0 ? ` ${reservation.children}C` : ''}</span>
          </div>

          <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />

          {/* Source */}
          <div className="flex items-center gap-1">
            <span className="material-icons text-sm text-slate-400">{sourceIcon}</span>
            <span>{tSource(reservation.source)}</span>
          </div>
        </div>
      </div>

      {/* Price */}
      <div className="px-5 pb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 dark:text-slate-500">{t('totalAmount')}</span>
          <span className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
            {Number(reservation.totalAmount).toFixed(2)} €
          </span>
        </div>
      </div>

      {/* Special requests hint */}
      {reservation.specialRequests && (
        <div className="px-5 pb-3">
          <div className="flex items-start gap-1.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
            <span className="material-icons text-sm text-amber-500 mt-0.5">info</span>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 line-clamp-2 leading-relaxed">
              {reservation.specialRequests}
            </p>
          </div>
        </div>
      )}

      {/* Unassigned warning */}
      {!reservation.unitId && reservation.status !== 'cancelled' && reservation.status !== 'checked_out' && (
        <div className="px-5 pb-3">
          <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
            <span className="material-icons text-sm text-red-500">warning</span>
            <p className="text-[11px] text-red-700 dark:text-red-300 font-medium">{t('unassigned')}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-slate-100 dark:border-slate-800 p-2 flex gap-1">
        <button
          onClick={onViewDetails}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded-lg transition-colors"
        >
          <span className="material-icons text-base">visibility</span>
          {t('viewDetails')}
        </button>

        {onCheckIn && (
          <button
            onClick={onCheckIn}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm"
          >
            <span className="material-icons text-base">login</span>
            {t('checkIn')}
          </button>
        )}

        {onCheckOut && (
          <button
            onClick={onCheckOut}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-600 hover:bg-slate-700 rounded-lg transition-colors shadow-sm"
          >
            <span className="material-icons text-base">logout</span>
            {t('checkOut')}
          </button>
        )}

        {onUnassign && (
          <button
            onClick={onUnassign}
            className="flex items-center justify-center p-2 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title={t('unassign')}
          >
            <span className="material-icons text-base">remove_circle_outline</span>
          </button>
        )}
      </div>
    </div>
  );
}
