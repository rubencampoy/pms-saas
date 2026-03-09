'use client';

import { DatePicker } from './date-picker';
import { GuestSelector } from './guest-selector';
import { useBookingStore } from '@/lib/hooks/use-booking-store';

interface SearchBarProps {
  translations: {
    checkIn: string;
    checkOut: string;
    guests: string;
    adults: string;
    children: string;
    search: string;
    searching: string;
    promoCode?: string;
    promoCodePlaceholder?: string;
  };
}

export function SearchBar({ translations: t }: SearchBarProps) {
  const { searchParams, setSearchParams, search, isSearching, settings } = useBookingStore();

  const handleSearch = () => {
    if (searchParams.checkIn && searchParams.checkOut) {
      void search();
    }
  };

  const canSearch = searchParams.checkIn && searchParams.checkOut && !isSearching;

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-800 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        {/* Date picker */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            {t.checkIn} / {t.checkOut}
          </label>
          <DatePicker
            checkIn={searchParams.checkIn}
            checkOut={searchParams.checkOut}
            onSelect={(checkIn, checkOut) => setSearchParams({ checkIn, checkOut })}
            labelCheckIn={t.checkIn}
            labelCheckOut={t.checkOut}
          />
        </div>

        {/* Guest selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            {t.guests}
          </label>
          {settings?.guestFilter !== 'none' && (
            <GuestSelector
              adults={searchParams.adults}
              childrenCount={searchParams.children}
              onAdultsChange={(v) => setSearchParams({ adults: v })}
              onChildrenChange={(v) => setSearchParams({ children: v })}
              guestFilter={settings?.guestFilter ?? 'full'}
              labelGuests={t.guests}
              labelAdults={t.adults}
              labelChildren={t.children}
            />
          )}
        </div>

        {/* Promo code */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            {t.promoCode ?? 'Promo Code'}
          </label>
          <div className="flex items-center gap-2 w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus-within:border-primary/50 transition-colors">
            <span className="material-icons text-slate-400 text-lg">sell</span>
            <input
              className="bg-transparent border-none p-0 text-sm font-medium focus:ring-0 w-full placeholder:text-slate-400 text-slate-700 dark:text-slate-200 outline-none"
              placeholder={t.promoCodePlaceholder ?? 'Enter code'}
              type="text"
            />
          </div>
        </div>

        {/* Search button */}
        <button
          type="button"
          onClick={handleSearch}
          disabled={!canSearch}
          className="bg-primary hover:bg-primary/90 text-white font-bold h-[46px] px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSearching ? (
            <>
              <span className="material-icons text-xl animate-spin">autorenew</span>
              {t.searching}
            </>
          ) : (
            <>
              <span className="material-icons text-xl">search</span>
              {t.search}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
