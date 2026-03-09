'use client';

import { useState, useTransition } from 'react';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import type { DateRange } from 'react-day-picker';
import 'react-day-picker/style.css';
import { useRateGridState } from './use-rate-grid-state';
import { RateGridToolbar } from './rate-grid-toolbar';
import { RateGridTable } from './rate-grid-table';
import { UnsavedChangesBar } from './unsaved-changes-bar';
import { bulkSetRates } from '@/server/actions/rates';
import type { BulkRateField } from '@/lib/validators/rate';

interface RatePlan {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  description: string | null;
  cancellationPolicy: string;
  cancellationHours: number;
  isActive: boolean;
  priority: number;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
}

interface Rate {
  id: string;
  ratePlanId: string;
  roomTypeId: string;
  date: string;
  amount: string;
  currency: string;
  minStay: number;
  maxStay: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

interface Season {
  id: string;
  propertyId: string;
  name: string;
  startDate: string;
  endDate: string;
  color: string;
}

interface RateGridTabProps {
  ratePlans: RatePlan[];
  roomTypes: RoomType[];
  rates: Rate[];
  seasons: Season[];
  startDate: string;
  endDate: string;
  propertyId: string;
  initialPlanId?: string;
}

export function RateGridTab({
  ratePlans,
  roomTypes,
  rates,
  seasons,
  startDate,
  endDate,
  initialPlanId,
}: RateGridTabProps) {
  const activePlans = ratePlans.filter((p) => p.isActive);
  const [selectedPlanId, setSelectedPlanId] = useState(
    initialPlanId ?? activePlans[0]?.id ?? '',
  );
  const [showBulkForm, setShowBulkForm] = useState(false);

  const state = useRateGridState({
    rates,
    roomTypes,
    seasons,
    startDate,
    endDate,
    selectedPlanId,
  });

  if (activePlans.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-400 bg-white dark:bg-[#1a2632] rounded-xl border border-slate-200 dark:border-slate-800">
        <span className="material-icons text-4xl text-slate-300 dark:text-slate-600 mb-3 block">sell</span>
        Create a rate plan first to set rates.
      </div>
    );
  }

  return (
    <div>
      <RateGridToolbar
        ratePlans={ratePlans}
        selectedPlanId={selectedPlanId}
        onPlanChange={setSelectedPlanId}
        state={state}
        onBulkEdit={() => setShowBulkForm(true)}
      />

      <RateGridTable state={state} />

      <UnsavedChangesBar
        count={state.pendingCount}
        isSaving={state.isSaving}
        onSave={state.saveAllChanges}
        onDiscard={state.discardAllChanges}
      />

      <BulkSetRatesPanel
        isOpen={showBulkForm && !!selectedPlanId}
        ratePlanId={selectedPlanId}
        ratePlans={activePlans}
        roomTypes={[...roomTypes].sort((a, b) => a.sortOrder - b.sortOrder)}
        onClose={() => setShowBulkForm(false)}
      />
    </div>
  );
}

// ── Bulk Set Rates Slide-over Panel ──

const FIELD_OPTIONS: { key: BulkRateField; label: string; icon: string }[] = [
  { key: 'amount', label: 'Rate', icon: 'euro' },
  { key: 'minStay', label: 'Min Stay', icon: 'hotel' },
  { key: 'maxStay', label: 'Max Stay', icon: 'night_shelter' },
  { key: 'closedToArrival', label: 'CTA', icon: 'block' },
  { key: 'closedToDeparture', label: 'CTD', icon: 'logout' },
];

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

function BulkSetRatesPanel({
  isOpen,
  ratePlanId,
  ratePlans,
  roomTypes,
  onClose,
}: {
  isOpen: boolean;
  ratePlanId: string;
  ratePlans: RatePlan[];
  roomTypes: RoomType[];
  onClose: () => void;
}) {
  const [selectedRatePlanId, setSelectedRatePlanId] = useState(ratePlanId);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState('__all__');

  // Date range via DayPicker
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 30),
  });

  // Day-of-week filter (0=Sun..6=Sat), all selected by default
  const [daysOfWeek, setDaysOfWeek] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6]));

  // Field selection: Cloudbeds-style toggleable chips
  const [selectedFields, setSelectedFields] = useState<Set<BulkRateField>>(new Set(['amount']));

  // Field values
  const [amount, setAmount] = useState('');
  const [minStay, setMinStay] = useState(1);
  const [maxStay, setMaxStay] = useState<number | null>(null);
  const [closedToArrival, setClosedToArrival] = useState(false);
  const [closedToDeparture, setClosedToDeparture] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        if (next.size === 1) return prev;
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  }

  function toggleField(field: BulkRateField) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        if (next.size === 1) return prev;
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!dateRange?.from || !dateRange?.to) {
      setError('Select a date range');
      return;
    }

    const roomTypeIds =
      selectedRoomTypeId === '__all__'
        ? roomTypes.map((rt) => rt.id)
        : [selectedRoomTypeId];

    const fields = Array.from(selectedFields);

    startTransition(async () => {
      const result = await bulkSetRates({
        ratePlanId: selectedRatePlanId,
        roomTypeIds,
        startDate: format(dateRange.from!, 'yyyy-MM-dd'),
        endDate: format(dateRange.to!, 'yyyy-MM-dd'),
        daysOfWeek: Array.from(daysOfWeek),
        fields,
        currency: 'EUR',
        ...(selectedFields.has('amount') ? { amount } : {}),
        ...(selectedFields.has('minStay') ? { minStay } : {}),
        ...(selectedFields.has('maxStay') ? { maxStay } : {}),
        ...(selectedFields.has('closedToArrival') ? { closedToArrival } : {}),
        ...(selectedFields.has('closedToDeparture') ? { closedToDeparture } : {}),
      });
      if (result.success) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  const inputClass =
    'w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none';

  // Summary text for the selected range
  const rangeSummary = dateRange?.from
    ? dateRange.to
      ? `${format(dateRange.from, 'dd MMM yyyy', { locale: es })} — ${format(dateRange.to, 'dd MMM yyyy', { locale: es })}`
      : format(dateRange.from, 'dd MMM yyyy', { locale: es })
    : 'Select a date range';

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
          onClick={onClose}
        />
      )}

      {/* Slide-over panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[440px] z-50 bg-white dark:bg-[#1a2632] border-l border-slate-200 dark:border-slate-800 shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header — sticky top */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2632]">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Set Rates</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select dates, days, and fields to update
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-5 space-y-5 flex-1">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                <span className="material-icons text-base">error</span>
                {error}
              </div>
            )}

            {/* Rate Plan */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Rate Plan
              </label>
              <select
                value={selectedRatePlanId}
                onChange={(e) => setSelectedRatePlanId(e.target.value)}
                className={inputClass}
              >
                {ratePlans.map((rp) => (
                  <option key={rp.id} value={rp.id}>
                    {rp.name} ({rp.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Room Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Room Type
              </label>
              <select
                value={selectedRoomTypeId}
                onChange={(e) => setSelectedRoomTypeId(e.target.value)}
                className={inputClass}
              >
                <option value="__all__">All Room Types</option>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name} ({rt.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Calendar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Date Range
                </label>
                <span className="text-xs text-primary font-medium">{rangeSummary}</span>
              </div>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-900/30 flex justify-center bulk-calendar">
                <DayPicker
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={1}
                  locale={es}
                  showOutsideDays
                  disabled={{ before: new Date() }}
                />
              </div>
            </div>

            {/* Day of Week Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Days of the week
              </label>
              <div className="flex gap-2">
                {DAY_LABELS.map((label, idx) => {
                  const active = daysOfWeek.has(idx);
                  const isWeekend = idx === 0 || idx === 6;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all border ${
                        active
                          ? isWeekend
                            ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                            : 'bg-primary/10 dark:bg-primary/20 text-primary border-primary/30'
                          : 'bg-white dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Field Selector — Cloudbeds-style chips */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Fields to update
              </label>
              <div className="flex flex-wrap gap-2">
                {FIELD_OPTIONS.map(({ key, label, icon }) => {
                  const active = selectedFields.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleField(key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                        active
                          ? 'bg-primary/10 dark:bg-primary/20 text-primary border-primary/30 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 hover:text-slate-600 dark:hover:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      <span className="material-icons text-sm">{icon}</span>
                      {label}
                      {active && (
                        <span className="material-icons text-xs ml-0.5">check</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Field Inputs — only shown for selected fields */}
            <div className="space-y-4">
              {selectedFields.has('amount') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    <span className="inline-flex items-center gap-1">
                      <span className="material-icons text-sm text-primary">euro</span>
                      Rate (EUR)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="90.00"
                    className={`${inputClass} tabular-nums`}
                  />
                </div>
              )}

              {(selectedFields.has('minStay') || selectedFields.has('maxStay')) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedFields.has('minStay') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        <span className="inline-flex items-center gap-1">
                          <span className="material-icons text-sm text-primary">hotel</span>
                          Min Stay
                        </span>
                      </label>
                      <input
                        type="number"
                        value={minStay}
                        onChange={(e) => setMinStay(Number(e.target.value))}
                        min={1}
                        max={30}
                        className={inputClass}
                      />
                    </div>
                  )}
                  {selectedFields.has('maxStay') && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        <span className="inline-flex items-center gap-1">
                          <span className="material-icons text-sm text-primary">night_shelter</span>
                          Max Stay
                        </span>
                      </label>
                      <input
                        type="number"
                        value={maxStay ?? ''}
                        onChange={(e) =>
                          setMaxStay(e.target.value ? Number(e.target.value) : null)
                        }
                        min={1}
                        max={365}
                        placeholder="No limit"
                        className={inputClass}
                      />
                    </div>
                  )}
                </div>
              )}

              {(selectedFields.has('closedToArrival') || selectedFields.has('closedToDeparture')) && (
                <div className="flex items-center gap-6 py-1">
                  {selectedFields.has('closedToArrival') && (
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={closedToArrival}
                        onChange={(e) => setClosedToArrival(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/20"
                      />
                      <span className="material-icons text-sm text-slate-400">block</span>
                      Closed to Arrival
                    </label>
                  )}
                  {selectedFields.has('closedToDeparture') && (
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={closedToDeparture}
                        onChange={(e) => setClosedToDeparture(e.target.checked)}
                        className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/20"
                      />
                      <span className="material-icons text-sm text-slate-400">logout</span>
                      Closed to Departure
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer — sticky bottom */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2632] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !dateRange?.from || !dateRange?.to}
              className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <span className="material-icons text-sm animate-spin">progress_activity</span>
                  Applying...
                </>
              ) : (
                <>
                  <span className="material-icons text-sm">check</span>
                  Apply Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
