'use client';

import { useEffect, useRef, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
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
  onViewDetails: () => void;
  onCheckIn?: () => void;
  onCheckOut?: () => void;
  onUnassign?: () => void;
  onClose: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-primary/10 text-primary',
  checked_in: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  checked_out: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  no_show: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
};

export function ReservationPopover({
  x,
  y,
  reservation,
  guest,
  onViewDetails,
  onCheckIn,
  onCheckOut,
  onUnassign,
  onClose,
}: ReservationPopoverProps) {
  const t = useTranslations('reservationPopover');
  const tStatus = useTranslations('status');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Viewport clamp
  const clampedX = Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 300 : x);
  const clampedY = Math.min(y, typeof window !== 'undefined' ? window.innerHeight - 280 : y);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    // Delay to avoid the originating click closing immediately
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
  const checkIn = parseISO(reservation.checkInDate);
  const checkOut = parseISO(reservation.checkOutDate);
  const statusColor = STATUS_COLORS[reservation.status] ?? STATUS_COLORS.confirmed;

  return (
    <div
      ref={popoverRef}
      className="fixed z-[90] bg-white dark:bg-[#1a2632] rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 w-72 overflow-hidden"
      style={{ left: clampedX, top: clampedY }}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {guestName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {reservation.confirmationCode}
            </p>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
            {tStatus(reservation.status)}
          </span>
        </div>

        {/* Dates & Price */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400 dark:text-slate-500">{t('checkIn')}</span>
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {format(checkIn, 'MMM d, yyyy')}
            </p>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500">{t('checkOut')}</span>
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {format(checkOut, 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-400 dark:text-slate-500">
            {reservation.nights} {t('nights')}
          </span>
          <span className="font-semibold text-slate-900 dark:text-white">
            &euro;{Number(reservation.totalAmount).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-slate-100 dark:border-slate-800 p-2 flex flex-wrap gap-1">
        <button
          onClick={onViewDetails}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded-lg transition-colors"
        >
          <span className="material-icons text-sm">visibility</span>
          {t('viewDetails')}
        </button>

        {onCheckIn && (
          <button
            onClick={onCheckIn}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
          >
            <span className="material-icons text-sm">login</span>
            {t('checkIn')}
          </button>
        )}

        {onCheckOut && (
          <button
            onClick={onCheckOut}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-icons text-sm">logout</span>
            {t('checkOut')}
          </button>
        )}

        {onUnassign && (
          <button
            onClick={onUnassign}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-icons text-sm">remove_circle_outline</span>
            {t('unassign')}
          </button>
        )}
      </div>
    </div>
  );
}
