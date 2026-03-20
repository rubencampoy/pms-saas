'use client';

import { useState, useRef, useEffect, useCallback, useTransition } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useTranslations } from 'next-intl';
import { bulkSetRates } from '@/server/actions/rates';
import { toast } from '@/lib/hooks/use-toast';

interface RateOverridePopoverProps {
  x: number;
  y: number;
  roomTypeId: string;
  roomTypeName: string;
  ratePlanId: string;
  allRatePlanIds: string[];
  startDate: string;
  endDate: string; // exclusive (day after last selected)
  currentPrice: string | null;
  currentMinStay: number | null;
  priceRange: { min: string; max: string } | null;
  minStayRange: { min: number; max: number } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function RateOverridePopover({
  x,
  y,
  roomTypeId,
  roomTypeName,
  ratePlanId,
  allRatePlanIds,
  startDate,
  endDate,
  currentPrice,
  currentMinStay,
  priceRange,
  minStayRange,
  onClose,
  onSaved,
}: RateOverridePopoverProps) {
  const t = useTranslations('rateOverride');
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  const [price, setPrice] = useState(currentPrice ?? '');
  const [minStay, setMinStay] = useState(
    currentMinStay !== null
      ? String(currentMinStay)
      : minStayRange !== null
        ? String(minStayRange.max)
        : '1',
  );
  const [applyMinStayToAll, setApplyMinStayToAll] = useState(allRatePlanIds.length > 1);
  const hasMultipleRatePlans = allRatePlanIds.length > 1;

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const numDays = differenceInDays(end, start);

  // Viewport clamping (same pattern as CellActionPopover)
  const clampedX = Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 300 : x);
  const clampedY = Math.min(y, typeof window !== 'undefined' ? window.innerHeight - 320 : y);

  // Click outside
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

  const handleSave = () => {
    const fields: ('amount' | 'minStay')[] = [];
    if (price !== '') fields.push('amount');
    if (minStay !== '' && Number(minStay) >= 1) fields.push('minStay');

    if (fields.length === 0) {
      onClose();
      return;
    }

    startTransition(async () => {
      try {
        // bulkSetRatesSchema expects inclusive endDate (last day to update)
        // Our endDate is exclusive, so subtract one day
        const inclusiveEnd = format(
          addDaysLocal(parseISO(startDate), numDays - 1),
          'yyyy-MM-dd',
        );

        const wantsMinStayAll = applyMinStayToAll && fields.includes('minStay');

        // If applying minStay to all rate plans, we need separate calls:
        // - One for the default rate plan with all fields (price + minStay)
        // - Additional calls for other rate plans with only minStay
        const ratePlanIdsForMinStay = wantsMinStayAll
          ? allRatePlanIds.filter((id) => id !== ratePlanId)
          : [];

        // Main call for the selected rate plan (price + minStay)
        const result = await bulkSetRates({
          ratePlanId,
          roomTypeIds: [roomTypeId],
          startDate,
          endDate: inclusiveEnd,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          currency: 'EUR',
          fields,
          ...(fields.includes('amount') ? { amount: price.replace(',', '.') } : {}),
          ...(fields.includes('minStay') ? { minStay: Number(minStay) } : {}),
        });

        if (!result.success) {
          toast({
            variant: 'error',
            title: t('saveError'),
            description: result.error,
          });
          return;
        }

        // Apply minStay to other rate plans in parallel
        let totalCount = result.data?.count ?? 0;

        if (ratePlanIdsForMinStay.length > 0) {
          const otherResults = await Promise.allSettled(
            ratePlanIdsForMinStay.map((rpId) =>
              bulkSetRates({
                ratePlanId: rpId,
                roomTypeIds: [roomTypeId],
                startDate,
                endDate: inclusiveEnd,
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                currency: 'EUR',
                fields: ['minStay'],
                minStay: Number(minStay),
              }),
            ),
          );

          for (const settled of otherResults) {
            if (settled.status === 'fulfilled' && settled.value.success) {
              totalCount += settled.value.data?.count ?? 0;
            }
          }
        }

        toast({
          variant: 'success',
          title: t('saveSuccess'),
          description: t('saveSuccessDesc', { count: String(totalCount) }),
        });
        onSaved();
        onClose();
      } catch (err) {
        console.error('RateOverridePopover save error:', err);
        toast({
          variant: 'error',
          title: t('saveError'),
          description: err instanceof Error ? err.message : String(err),
        });
      }
    });
  };

  return (
    <div
      ref={popoverRef}
      className="fixed z-[90] bg-white dark:bg-[#1a2632] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-[280px] overflow-hidden"
      style={{ left: clampedX, top: clampedY }}
    >
      {/* Header with date range and room type */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="material-icons text-primary text-lg">edit_calendar</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {t('title')}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {format(start, 'MMM d')} &mdash; {format(end, 'MMM d, yyyy')}
          <span className="ml-1 text-slate-400">
            ({numDays} {numDays === 1 ? t('night') : t('nights')})
          </span>
        </p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
          {roomTypeName}
        </p>
      </div>

      {/* Form fields */}
      <div className="px-4 py-3 space-y-3">
        {/* Price per night */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            {t('pricePerNight')}
          </label>
          {priceRange && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-1">
              €{parseFloat(priceRange.min).toFixed(0)} &mdash; €{parseFloat(priceRange.max).toFixed(0)}
            </p>
          )}
          <div className="relative">
            <input
              type="number"
              min="0"
              step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={
                currentPrice
                  ? currentPrice
                  : priceRange
                    ? `${parseFloat(priceRange.min).toFixed(0)} - ${parseFloat(priceRange.max).toFixed(0)}`
                    : '0'
              }
              className="w-full pl-3 pr-8 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              autoFocus
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              &euro;
            </span>
          </div>
        </div>

        {/* Minimum nights — stepper UI */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            {t('minNights')}
          </label>
          {minStayRange && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-1 text-center">
              {t('currentRange', { min: String(minStayRange.min), max: String(minStayRange.max) })}
            </p>
          )}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setMinStay((prev) => String(Math.max(1, Number(prev) - 1)))}
              disabled={Number(minStay) <= 1}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="material-icons text-lg">remove</span>
            </button>
            <span className="text-2xl font-bold text-slate-900 dark:text-white min-w-[2ch] text-center tabular-nums">
              {minStay || '1'}
            </span>
            <button
              type="button"
              onClick={() => setMinStay((prev) => String(Math.min(30, Number(prev) + 1)))}
              disabled={Number(minStay) >= 30}
              className="w-9 h-9 flex items-center justify-center rounded-full border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="material-icons text-lg">add</span>
            </button>
          </div>
          {/* Apply to all rate plans checkbox */}
          {hasMultipleRatePlans && (
            <label className="flex items-center gap-2 mt-2 cursor-pointer group/check">
              <input
                type="checkbox"
                checked={applyMinStayToAll}
                onChange={(e) => setApplyMinStayToAll(e.target.checked)}
                className="accent-primary w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 group-hover/check:text-slate-700 dark:group-hover/check:text-slate-300 transition-colors">
                {t('applyToAllRatePlans')}
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          {t('cancel')}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || (price === '' && minStay === '')}
          className="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
        >
          {isPending && (
            <span className="material-icons text-xs animate-spin">refresh</span>
          )}
          {t('save')}
        </button>
      </div>
    </div>
  );
}

// Local helper to avoid importing from date-fns again (already in scope but need for clarity)
function addDaysLocal(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
