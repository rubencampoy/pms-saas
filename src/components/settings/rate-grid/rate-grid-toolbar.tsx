'use client';

import { format, parseISO } from 'date-fns';
import { DisplayOptionsMenu } from './display-options-menu';
import type { RateGridState } from './use-rate-grid-state';

interface RatePlan {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface RateGridToolbarProps {
  ratePlans: RatePlan[];
  selectedPlanId: string;
  onPlanChange: (id: string) => void;
  state: RateGridState;
  onBulkEdit: () => void;
}

export function RateGridToolbar({
  ratePlans,
  selectedPlanId,
  onPlanChange,
  state,
  onBulkEdit,
}: RateGridToolbarProps) {
  const activePlans = ratePlans.filter((p) => p.isActive);
  const currentMonth = format(parseISO(state.startDate), 'MMMM yyyy');

  return (
    <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
      {/* Left: Plan selector + Display options */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="relative">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 ml-1">
            Rate Plan
          </label>
          <select
            value={selectedPlanId}
            onChange={(e) => onPlanChange(e.target.value)}
            className="w-full md:w-56 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-transparent py-2 pl-3 pr-10 appearance-none cursor-pointer"
          >
            {activePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          <div className="absolute right-3 bottom-2.5 pointer-events-none text-slate-500">
            <span className="material-icons-round text-[20px]">expand_more</span>
          </div>
        </div>
        <div className="self-end">
          <DisplayOptionsMenu
            options={state.displayOptions}
            onChange={state.setDisplayOptions}
          />
        </div>
      </div>

      {/* Center: Date navigation */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        <button
          onClick={state.goToPrevMonth}
          className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary transition-all shadow-sm"
        >
          <span className="material-icons-round text-[20px]">chevron_left</span>
        </button>
        <span className="px-4 text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[140px] text-center">
          {currentMonth}
        </span>
        <button
          onClick={state.goToNextMonth}
          className="p-1.5 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary transition-all shadow-sm"
        >
          <span className="material-icons-round text-[20px]">chevron_right</span>
        </button>
        <button
          onClick={state.goToToday}
          className="ml-2 px-3 py-1.5 rounded-md text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
        >
          Today
        </button>
      </div>

      {/* Right: Legend + Bulk edit */}
      <div className="flex items-center gap-4">
        <div className="hidden lg:flex items-center gap-3 text-xs font-medium text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> High
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Mid
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Low
          </div>
        </div>
        <button
          onClick={onBulkEdit}
          disabled={!selectedPlanId}
          className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <span className="material-icons-round text-[18px]">edit_note</span>
          Bulk Edit
        </button>
      </div>
    </div>
  );
}
