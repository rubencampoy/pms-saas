'use client';

import { useState, useCallback } from 'react';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';
import { RoomTypeFilter } from './room-type-filter';

interface RoomTypeFilterItem {
  id: string;
  name: string;
  unitCount: number;
}

interface CalendarToolbarProps {
  currentDate: Date;
  pendingCount: number;
  onTogglePendingPanel: () => void;
  onNewBooking: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onScrollToDate: (date: Date) => void;
  roomTypeFilterItems: RoomTypeFilterItem[];
  hiddenRoomTypeIds: Set<string>;
  collapsedRoomTypeIds: Set<string>;
  onToggleRoomTypeHidden: (id: string) => void;
  onToggleRoomTypeCollapsed: (id: string) => void;
  onShowAllRoomTypes: () => void;
  onCollapseAllRoomTypes: () => void;
  onExpandAllRoomTypes: () => void;
}

export function CalendarToolbar({
  currentDate,
  pendingCount,
  onTogglePendingPanel,
  onNewBooking,
  searchQuery,
  onSearchChange,
  onScrollToDate,
  roomTypeFilterItems,
  hiddenRoomTypeIds,
  collapsedRoomTypeIds,
  onToggleRoomTypeHidden,
  onToggleRoomTypeCollapsed,
  onShowAllRoomTypes,
  onCollapseAllRoomTypes,
  onExpandAllRoomTypes,
}: CalendarToolbarProps) {
  const t = useTranslations('calendarToolbar');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(currentDate);

  const handlePrev = useCallback(() => {
    const prevMonth = subMonths(startOfMonth(displayMonth), 1);
    setDisplayMonth(prevMonth);
    onScrollToDate(prevMonth);
  }, [displayMonth, onScrollToDate]);

  const handleNext = useCallback(() => {
    const nextMonth = addMonths(startOfMonth(displayMonth), 1);
    setDisplayMonth(nextMonth);
    onScrollToDate(nextMonth);
  }, [displayMonth, onScrollToDate]);

  const handleToday = useCallback(() => {
    const today = new Date();
    setDisplayMonth(today);
    onScrollToDate(today);
  }, [onScrollToDate]);

  return (
    <div className="flex-shrink-0 sticky top-0 z-30 bg-white dark:bg-[#1a2632]">
      {/* Single compact row */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-700 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white whitespace-nowrap">
            {t('title')}
          </h1>

          {/* View toggle */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 ml-1">
            <button className="px-2 py-0.5 text-[10px] font-medium bg-white dark:bg-slate-600 text-primary shadow-sm rounded whitespace-nowrap">
              {t('timeline')}
            </button>
            <button className="px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 whitespace-nowrap">
              {t('list')}
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

          {/* Month navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              className="p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-slate-500"
              title={t('previousMonth')}
            >
              <span className="material-icons text-[18px]">chevron_left</span>
            </button>
            <div className="px-2 font-bold text-xs text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <span className="material-icons text-[16px] text-primary">calendar_month</span>
              {format(displayMonth, 'MMMM yyyy')}
            </div>
            <button
              onClick={handleNext}
              className="p-1 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-slate-500"
              title={t('nextMonth')}
            >
              <span className="material-icons text-[18px]">chevron_right</span>
            </button>
            <button
              onClick={handleToday}
              className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-medium text-slate-600 dark:text-slate-300 ml-1 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {t('today')}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend badges — compact */}
          <div className="hidden md:flex items-center gap-2 mr-2">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {t('checkedIn')}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded border border-primary/10">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              {t('confirmed')}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              {t('maintenance')}
            </div>
          </div>

          {/* Room type filter */}
          <RoomTypeFilter
            roomTypes={roomTypeFilterItems}
            hiddenIds={hiddenRoomTypeIds}
            collapsedIds={collapsedRoomTypeIds}
            onToggleHidden={onToggleRoomTypeHidden}
            onToggleCollapsed={onToggleRoomTypeCollapsed}
            onShowAll={onShowAllRoomTypes}
            onCollapseAll={onCollapseAllRoomTypes}
            onExpandAll={onExpandAllRoomTypes}
          />

          {/* Search */}
          <div className="relative">
            {isSearchOpen ? (
              <div className="flex items-center">
                <span className="material-icons absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="pl-8 pr-7 py-1.5 w-48 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs focus:ring-1 focus:ring-primary/50 text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setIsSearchOpen(false);
                    onSearchChange('');
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <span className="material-icons text-[14px]">close</span>
                </button>
              </div>
            ) : (
              <div className="relative">
                <span className="material-icons absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                <input
                  type="text"
                  readOnly
                  onClick={() => setIsSearchOpen(true)}
                  placeholder={t('searchPlaceholder')}
                  className="pl-8 pr-3 py-1.5 w-48 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-700 dark:text-slate-200 placeholder-slate-400 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* New Booking */}
          <button
            onClick={onNewBooking}
            className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <span className="material-icons text-[16px]">add</span>
            {t('newBooking')}
          </button>

          {/* Notifications */}
          <button
            onClick={onTogglePendingPanel}
            className="p-1.5 text-slate-400 hover:text-primary transition-colors relative"
          >
            <span className="material-icons text-[20px]">notifications</span>
            {pendingCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white dark:border-[#1a2632]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
