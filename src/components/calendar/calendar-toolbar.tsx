'use client';

import { useState, useCallback } from 'react';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import { useTranslations } from 'next-intl';

interface CalendarToolbarProps {
  currentDate: Date;
  pendingCount: number;
  onTogglePendingPanel: () => void;
  onNewBooking: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onScrollToDate: (date: Date) => void;
}

export function CalendarToolbar({
  currentDate,
  pendingCount,
  onTogglePendingPanel,
  onNewBooking,
  searchQuery,
  onSearchChange,
  onScrollToDate,
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
      {/* Row 1: Title, view toggle, search, new booking */}
      <div className="h-16 border-b border-slate-200 dark:border-slate-700 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {t('title')}
          </h1>
          <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-2" />
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button className="px-3 py-1 text-xs font-medium bg-white dark:bg-slate-600 text-primary shadow-sm rounded-md">
              {t('timeline')}
            </button>
            <button className="px-3 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
              {t('list')}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            {isSearchOpen ? (
              <div className="flex items-center">
                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  className="pl-10 pr-8 py-2 w-64 bg-slate-50 dark:bg-slate-900 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/50 text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none"
                  autoFocus
                />
                <button
                  onClick={() => {
                    setIsSearchOpen(false);
                    onSearchChange('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <span className="material-icons text-lg">close</span>
                </button>
              </div>
            ) : (
              <div className="relative">
                <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
                <input
                  type="text"
                  readOnly
                  onClick={() => setIsSearchOpen(true)}
                  placeholder={t('searchPlaceholder')}
                  className="pl-10 pr-4 py-2 w-64 bg-slate-50 dark:bg-slate-900 border-none rounded-lg text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Pending badge */}
          {pendingCount > 0 && (
            <button
              onClick={onTogglePendingPanel}
              className="p-2 text-slate-400 hover:text-primary transition-colors relative"
            >
              <span className="material-icons">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-[#1a2632]" />
            </button>
          )}

          {/* New Booking */}
          <button
            onClick={onNewBooking}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"
          >
            <span className="material-icons text-[18px]">add</span>
            {t('newBooking')}
          </button>
        </div>
      </div>

      {/* Row 2: Month navigation, today, legend, filter */}
      <div className="px-6 py-3 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          {/* Month navigator */}
          <div className="flex items-center bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-1 shadow-sm">
            <button
              onClick={handlePrev}
              className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-slate-500"
              title={t('previousMonth')}
            >
              <span className="material-icons text-[20px]">chevron_left</span>
            </button>
            <div className="px-4 font-medium text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <span className="material-icons text-[18px] text-primary">calendar_month</span>
              {format(displayMonth, 'MMMM yyyy')}
            </div>
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 rounded text-slate-500"
              title={t('nextMonth')}
            >
              <span className="material-icons text-[20px]">chevron_right</span>
            </button>
          </div>

          {/* Today button */}
          <button
            onClick={handleToday}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
          >
            {t('today')}
          </button>

        </div>

        {/* Right: Legend + filter */}
        <div className="flex items-center gap-3">
          {/* Legend badges — pill style with dot + border per Stitch */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md text-xs font-medium border border-green-200 dark:border-green-800/30">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              {t('checkedIn')}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-xs font-medium border border-primary/20">
              <div className="w-2 h-2 rounded-full bg-primary" />
              {t('confirmed')}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md text-xs font-medium border border-slate-200 dark:border-slate-700">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              {t('maintenance')}
            </div>
          </div>

          <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-2 hidden md:block" />

          {/* Filter button */}
          <button className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm transition-colors">
            <span className="material-icons text-[20px]">filter_list</span>
          </button>

          {/* Pending count */}
          {pendingCount > 0 && (
            <button
              onClick={onTogglePendingPanel}
              className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors border border-amber-200 dark:border-amber-800/30"
            >
              <span className="material-icons text-sm">warning</span>
              {t('pendingCount', { count: pendingCount })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
