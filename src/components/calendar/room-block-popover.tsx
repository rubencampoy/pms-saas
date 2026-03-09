'use client';

import { useEffect, useRef, useCallback } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useTranslations } from 'next-intl';

interface RoomBlockPopoverProps {
  x: number;
  y: number;
  block: {
    id: string;
    unitId: string;
    type: string;
    startDate: string;
    endDate: string;
    reason: string | null;
  };
  unitName: string;
  onReleaseDates: () => void;
  onEdit: () => void;
  onClose: () => void;
}

export function RoomBlockPopover({
  x,
  y,
  block,
  unitName,
  onReleaseDates,
  onEdit,
  onClose,
}: RoomBlockPopoverProps) {
  const t = useTranslations('roomBlockPopover');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Viewport clamp
  const clampedX = Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 240 : x);
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

  const start = parseISO(block.startDate);
  const end = parseISO(block.endDate);
  const nights = differenceInDays(end, start);
  const isMaintenance = block.type === 'maintenance';

  return (
    <div
      ref={popoverRef}
      className="fixed z-[90] bg-white dark:bg-[#1a2632] rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 w-64 overflow-hidden"
      style={{ left: clampedX, top: clampedY }}
    >
      {/* Header — colored based on type */}
      <div className={`px-4 py-3 ${
        isMaintenance
          ? 'bg-amber-50 dark:bg-amber-900/20'
          : 'bg-red-50 dark:bg-red-900/20'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`material-icons text-lg ${
            isMaintenance ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {isMaintenance ? 'build' : 'block'}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className={`text-sm font-bold ${
              isMaintenance ? 'text-amber-800 dark:text-amber-200' : 'text-red-800 dark:text-red-200'
            }`}>
              {isMaintenance ? t('maintenance') : t('blocked')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {unitName}
            </p>
          </div>
        </div>
      </div>

      {/* Dates & info */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-slate-400 dark:text-slate-500">{t('from')}</span>
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {format(start, 'MMM d, yyyy')}
            </p>
          </div>
          <div>
            <span className="text-slate-400 dark:text-slate-500">{t('to')}</span>
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {format(end, 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          {nights} {nights === 1 ? t('day') : t('days')}
        </p>
        {block.reason && (
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1.5">
            {block.reason}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="p-2 flex flex-col gap-0.5">
        <button
          onClick={onEdit}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <span className="material-icons text-lg text-primary">edit</span>
          {t('edit')}
        </button>
        <button
          onClick={onReleaseDates}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <span className="material-icons text-lg">event_available</span>
          {t('releaseDates')}
        </button>
      </div>
    </div>
  );
}
