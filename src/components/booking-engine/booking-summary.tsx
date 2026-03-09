'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBookingStore } from '@/lib/hooks/use-booking-store';

interface BookingSummaryProps {
  translations: {
    summary: string;
    nights: string;
    subtotal: string;
    total: string;
    continue: string;
    selectDates: string;
    selectRoom: string;
    addons: string;
    perNight: string;
    perStay: string;
    perPerson: string;
    checkIn: string;
    checkOut: string;
    noPaymentRequired?: string;
    needHelp?: string;
    needHelpDesc?: string;
    chatWithUs?: string;
    occupancy?: string;
    taxesAndFees?: string;
  };
}

export function BookingSummary({ translations: t }: BookingSummaryProps) {
  const { summary, searchParams, hasSearched, selectedItems, slug, propertyCode } = useBookingStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  const handleContinue = () => {
    router.push(`/book/${slug}/${propertyCode}/checkout`);
  };

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const hasSelection = selectedItems.size > 0;

  const emptyState = (icon: string, message: string) => (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:w-96 shrink-0">
        <div className="sticky top-24 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-slate-900 dark:text-white font-extrabold text-lg">
                {t.summary}
              </h3>
            </div>
            <div className="p-6 text-center py-12">
              <span className="material-icons text-4xl text-slate-300 dark:text-slate-600 mb-3">
                {icon}
              </span>
              <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // Not searched yet: show prompt
  if (!hasSearched) {
    return emptyState('date_range', t.selectDates);
  }

  // Searched but nothing selected
  if (!hasSelection || !summary) {
    return emptyState('bedroom_parent', t.selectRoom);
  }

  const addonTypeLabel = (type: string) => {
    switch (type) {
      case 'per_night':
        return t.perNight;
      case 'per_person':
        return t.perPerson;
      default:
        return t.perStay;
    }
  };

  const summaryContent = (
    <>
      {/* Dates */}
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-slate-400">
            <span className="material-icons block">calendar_month</span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">
              {t.checkIn} / {t.checkOut}
            </p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {searchParams.checkIn} — {searchParams.checkOut}
            </p>
            <p className="text-xs text-slate-500 font-medium">
              {summary.nights} {t.nights}
            </p>
          </div>
        </div>

        {/* Occupancy */}
        <div className="flex items-start gap-4">
          <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded-lg text-slate-400">
            <span className="material-icons block">group</span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-0.5">
              {t.occupancy ?? 'Occupancy'}
            </p>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {searchParams.adults} {searchParams.adults === 1 ? 'Adult' : 'Adults'}
              {searchParams.children > 0 && `, ${searchParams.children} ${searchParams.children === 1 ? 'Child' : 'Children'}`}
            </p>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
        {summary.items.map((item, i) => (
          <div key={i} className="flex justify-between items-center mb-3">
            <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              {item.quantity}x {item.roomTypeName}
            </span>
            <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
              {formatCurrency(item.total, summary.currency)}
            </span>
          </div>
        ))}

        {/* Addons */}
        {summary.addons.length > 0 &&
          summary.addons.map((addon, i) => (
            <div key={i} className="flex justify-between items-center mb-3">
              <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                {addon.name}
                <span className="text-xs text-slate-400 ml-1">({addonTypeLabel(addon.addonType)})</span>
              </span>
              <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                {formatCurrency(addon.total, summary.currency)}
              </span>
            </div>
          ))}

        {/* Taxes placeholder */}
        <div className="flex justify-between items-center text-slate-500 text-xs mb-4">
          <span>{t.taxesAndFees ?? 'Taxes & Fees'}</span>
          <span>—</span>
        </div>

        {/* Total */}
        <div className="flex justify-between items-center pt-4 border-t border-dashed border-slate-200 dark:border-slate-700">
          <span className="text-lg font-extrabold text-slate-900 dark:text-white">{t.total}</span>
          <span className="text-2xl font-black text-primary tabular-nums">
            {formatCurrency(summary.total, summary.currency)}
          </span>
        </div>
      </div>

      {/* Continue button */}
      <button
        type="button"
        disabled={!hasSelection}
        onClick={handleContinue}
        className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary/30 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t.continue}
        <span className="material-icons group-hover:translate-x-1 transition-transform">
          arrow_forward
        </span>
      </button>
      <p className="text-[11px] text-center text-slate-400 font-medium">
        {t.noPaymentRequired ?? 'No payment required now'}
      </p>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:w-96 shrink-0">
        <div className="sticky top-24 space-y-6">
          {/* Main summary card */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-800 overflow-hidden">
            <div className="bg-white dark:bg-slate-900 p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-slate-900 dark:text-white font-extrabold text-lg flex items-center gap-2">
                {t.summary}
              </h3>
            </div>
            <div className="p-6 space-y-6">{summaryContent}</div>
          </div>

          {/* Need help card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h4 className="text-slate-900 dark:text-white font-bold mb-2 flex items-center gap-2 text-sm">
              <span className="material-icons text-primary">support_agent</span>
              {t.needHelp ?? 'Need help?'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
              {t.needHelpDesc ?? 'Our booking specialists are available 24/7 to assist you.'}
            </p>
            <a
              className="inline-flex items-center gap-1 text-primary text-xs font-bold hover:underline"
              href="#"
            >
              {t.chatWithUs ?? 'Chat with us now'}
            </a>
          </div>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-30"
            onClick={() => setMobileOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setMobileOpen(false)}
            role="button"
            tabIndex={0}
          />
        )}
        <div
          className={`relative z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.15)] transition-all ${
            mobileOpen ? 'rounded-t-2xl max-h-[80vh] overflow-y-auto p-5' : 'p-4'
          }`}
        >
          {mobileOpen ? (
            <>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute top-3 right-3 p-1"
              >
                <span className="material-icons text-slate-400">close</span>
              </button>
              <h3 className="text-slate-900 dark:text-white font-extrabold text-lg mb-4">
                {t.summary}
              </h3>
              <div className="space-y-6">{summaryContent}</div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="text-left"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">{t.total}</div>
                <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(summary.total, summary.currency)}
                </div>
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-primary rounded-xl shadow-lg shadow-primary/30"
              >
                {t.continue}
                <span className="material-icons text-lg">arrow_forward</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
