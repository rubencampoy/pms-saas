'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { VALID_STATUS_TRANSITIONS, ReservationStatus } from '@/lib/constants/reservation';

interface ContextMenuProps {
  x: number;
  y: number;
  reservationId: string;
  reservationStatus: string;
  hasUnit: boolean;
  onViewDetails: () => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onCancel: () => void;
  onNoShow: () => void;
  onUnassign: (reservationId: string) => void;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  reservationId,
  reservationStatus,
  hasUnit,
  onViewDetails,
  onCheckIn,
  onCheckOut,
  onCancel,
  onNoShow,
  onUnassign,
  onClose,
}: ContextMenuProps) {
  const t = useTranslations('contextMenu');
  const menuRef = useRef<HTMLDivElement>(null);

  // Viewport clamp
  const clampedX = Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 220 : x);
  const clampedY = Math.min(y, typeof window !== 'undefined' ? window.innerHeight - 300 : y);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', onClose, true);
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', onClose, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [handleClickOutside, onClose]);

  const transitions = VALID_STATUS_TRANSITIONS[reservationStatus as ReservationStatus] ?? [];
  const canCheckIn = transitions.includes(ReservationStatus.CHECKED_IN);
  const canCheckOut = transitions.includes(ReservationStatus.CHECKED_OUT);
  const canCancel = transitions.includes(ReservationStatus.CANCELLED);
  const canNoShow = transitions.includes(ReservationStatus.NO_SHOW);
  const canUnassign = hasUnit && (reservationStatus === 'confirmed' || reservationStatus === 'checked_in');

  const hasActions = canCheckIn || canCheckOut || canCancel || canNoShow;

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-white dark:bg-[#1a2632] rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 min-w-[200px]"
      style={{ left: clampedX, top: clampedY }}
    >
      {/* View Details */}
      <button
        onClick={onViewDetails}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <span className="material-icons text-lg text-slate-500 dark:text-slate-400">
          visibility
        </span>
        {t('viewDetails')}
      </button>

      {/* Divider */}
      {hasActions && (
        <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
      )}

      {/* Check In */}
      {canCheckIn && (
        <button
          onClick={onCheckIn}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
        >
          <span className="material-icons text-lg">login</span>
          {t('checkIn')}
        </button>
      )}

      {/* Check Out */}
      {canCheckOut && (
        <button
          onClick={onCheckOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-icons text-lg text-slate-500 dark:text-slate-400">logout</span>
          {t('checkOut')}
        </button>
      )}

      {/* No Show */}
      {canNoShow && (
        <button
          onClick={onNoShow}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
        >
          <span className="material-icons text-lg">person_off</span>
          {t('noShow')}
        </button>
      )}

      {/* Cancel */}
      {canCancel && (
        <button
          onClick={onCancel}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <span className="material-icons text-lg">cancel</span>
          {t('cancel')}
        </button>
      )}

      {/* Divider before unassign */}
      {canUnassign && (
        <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
      )}

      {/* Unassign */}
      {canUnassign && (
        <button
          onClick={() => onUnassign(reservationId)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-icons text-lg text-slate-500 dark:text-slate-400">
            remove_circle_outline
          </span>
          {t('unassign')}
        </button>
      )}
    </div>
  );
}
