'use client';

import { useEffect, useRef, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { useTranslations } from 'next-intl';

interface CellActionPopoverProps {
  x: number;
  y: number;
  startDate: string;
  endDate: string;
  onNewReservation: () => void;
  onMaintenance: () => void;
  onBlockDates: () => void;
  onClose: () => void;
}

export function CellActionPopover({
  x,
  y,
  startDate,
  endDate,
  onNewReservation,
  onMaintenance,
  onBlockDates,
  onClose,
}: CellActionPopoverProps) {
  const t = useTranslations('cellAction');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Viewport clamp
  const clampedX = Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 220 : x);
  const clampedY = Math.min(y, typeof window !== 'undefined' ? window.innerHeight - 200 : y);

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

  const start = parseISO(startDate);
  const end = parseISO(endDate);

  return (
    <div
      ref={popoverRef}
      className="fixed z-[90] bg-white dark:bg-[#1a2632] rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 min-w-[200px]"
      style={{ left: clampedX, top: clampedY }}
    >
      {/* Date context */}
      <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
        {format(start, 'MMM d')} &mdash; {format(end, 'MMM d, yyyy')}
      </div>

      {/* New Reservation */}
      <button
        onClick={onNewReservation}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <span className="material-icons text-lg text-primary">add_circle</span>
        {t('newReservation')}
      </button>

      {/* Maintenance */}
      <button
        onClick={onMaintenance}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <span className="material-icons text-lg text-amber-500">build</span>
        {t('maintenance')}
      </button>

      {/* Block Dates */}
      <button
        onClick={onBlockDates}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
      >
        <span className="material-icons text-lg text-red-500">block</span>
        {t('dateBlocked')}
      </button>
    </div>
  );
}
