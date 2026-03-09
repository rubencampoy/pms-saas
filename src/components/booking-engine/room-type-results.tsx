'use client';

import { useBookingStore } from '@/lib/hooks/use-booking-store';
import { RoomTypeCard } from './room-type-card';

interface RoomTypeResultsProps {
  translations: {
    noResults: string;
    noResultsDesc: string;
    rooms: string;
    perNight: string;
    totalStay: string;
    available: string;
    unavailable: string;
    select: string;
    selected: string;
    freeCancellation: string;
    nonRefundable: string;
    maxOccupancy: string;
    availableAccommodations?: string;
  };
}

export function RoomTypeResults({ translations: t }: RoomTypeResultsProps) {
  const { results, isSearching, hasSearched, settings } = useBookingStore();

  // Loading skeletons
  if (isSearching) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-800 overflow-hidden animate-pulse"
          >
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-80 h-64 bg-slate-200 dark:bg-slate-700" />
              <div className="flex-1 p-6 space-y-3">
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-48" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-72" />
                <div className="flex gap-4">
                  <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded-md" />
                  <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded-md" />
                  <div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded-md" />
                </div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-32 mt-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (hasSearched && results.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-800 p-12 text-center">
        <span className="material-icons text-5xl text-slate-300 dark:text-slate-600 mb-4">
          event_busy
        </span>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t.noResults}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.noResultsDesc}</p>
      </div>
    );
  }

  if (!hasSearched) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
        {t.availableAccommodations ?? 'Available Accommodations'}
      </h2>
      {results.map((result) => (
        <RoomTypeCard
          key={result.roomTypeId}
          result={result}
          translations={{
            perNight: t.perNight,
            totalStay: t.totalStay,
            available: t.available,
            unavailable: t.unavailable,
            select: t.select,
            selected: t.selected,
            rooms: t.rooms,
            freeCancellation: t.freeCancellation,
            nonRefundable: t.nonRefundable,
            maxOccupancy: t.maxOccupancy,
          }}
          priceFormat={settings?.priceFormat ?? 'lowest_night'}
        />
      ))}
    </div>
  );
}
