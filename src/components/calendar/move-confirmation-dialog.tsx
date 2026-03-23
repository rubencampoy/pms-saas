'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import type { MoveRequest } from './use-calendar-dnd';

const eurFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

/** Sum nightly rates from the client-side rateMap for a stay */
export function calculateStayPrice(
  rateMap: Map<string, string>,
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
): number {
  const nights = differenceInDays(parseISO(checkOut), parseISO(checkIn));
  let total = 0;
  for (let i = 0; i < nights; i++) {
    const date = format(addDays(parseISO(checkIn), i), 'yyyy-MM-dd');
    const rate = rateMap.get(`${roomTypeId}:${date}`);
    if (rate) {
      total += parseFloat(rate);
    }
  }
  return total;
}

interface MoveConfirmationDialogProps {
  moveRequest: MoveRequest;
  sourceRoomTypeName: string;
  sourceUnitName: string;
  targetRoomTypeName: string;
  targetUnitName: string;
  originalPrice: number;
  newPrice: number;
  currentTotalAmount: number;
  onConfirmWithPrice: () => void;
  onConfirmOverwrite: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function formatDateRange(checkIn: string, checkOut: string): string {
  const from = format(parseISO(checkIn), 'dd/MM/yyyy');
  const to = format(parseISO(checkOut), 'dd/MM/yyyy');
  return `${from} - ${to}`;
}

export function MoveConfirmationDialog({
  moveRequest,
  sourceRoomTypeName,
  sourceUnitName,
  targetRoomTypeName,
  targetUnitName,
  originalPrice,
  newPrice,
  currentTotalAmount,
  onConfirmWithPrice,
  onConfirmOverwrite,
  onCancel,
  isSubmitting,
}: MoveConfirmationDialogProps) {
  const t = useTranslations('moveConfirmation');
  const backdropRef = useRef<HTMLDivElement>(null);

  const priceDiff = newPrice - originalPrice;
  const newTotal = currentTotalAmount + priceDiff;

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel, isSubmitting]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === backdropRef.current && !isSubmitting) onCancel();
    },
    [onCancel, isSubmitting],
  );

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4 overflow-hidden">
        {/* Alert Header */}
        <div className="px-6 py-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/40">
          <span className="material-icons text-xl text-red-600 dark:text-red-400">warning</span>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('title')}
          </h2>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="ml-auto text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
          >
            <span className="material-icons text-xl">close</span>
          </button>
        </div>

        {/* Comparison Table */}
        <div className="px-6 py-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800">
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('roomType')}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('room')}
                </th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('dates')}
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('price')}
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Original */}
              <tr className="border-b border-slate-100 dark:border-slate-700">
                <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200 font-medium">
                  {sourceRoomTypeName}
                </td>
                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                  {sourceUnitName}
                </td>
                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                  {formatDateRange(moveRequest.origCheckIn, moveRequest.origCheckOut)}
                </td>
                <td className="px-3 py-2.5 text-right text-slate-700 dark:text-slate-200 font-medium">
                  {eurFormatter.format(currentTotalAmount)}
                </td>
              </tr>
              {/* New */}
              <tr>
                <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200 font-medium">
                  {targetRoomTypeName}
                </td>
                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                  {targetUnitName}
                </td>
                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">
                  {formatDateRange(moveRequest.newCheckIn, moveRequest.newCheckOut)}
                </td>
                <td className={`px-3 py-2.5 text-right font-medium ${
                  priceDiff > 0
                    ? 'text-red-600 dark:text-red-400'
                    : priceDiff < 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-slate-600 dark:text-slate-300'
                }`}>
                  {priceDiff > 0 ? '+ ' : priceDiff < 0 ? '- ' : ''}{eurFormatter.format(Math.abs(priceDiff))}
                </td>
              </tr>
            </tbody>
          </table>

          {/* New Total */}
          <div className="mt-4 flex items-baseline justify-end gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('newTotal')}</span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {eurFormatter.format(newTotal)}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2 justify-center">
          <button
            onClick={onConfirmWithPrice}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
          >
            <span className="material-icons text-lg">arrow_upward</span>
            {t('confirmHigherCharge')}
          </button>
          <button
            onClick={onConfirmOverwrite}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
          >
            <span className="material-icons text-lg">check</span>
            {t('overwrite')}
          </button>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
          >
            <span className="material-icons text-lg">close</span>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
