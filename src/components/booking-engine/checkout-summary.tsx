'use client';

import { useBookingStore } from '@/lib/hooks/use-booking-store';

interface CheckoutSummaryProps {
  translations: {
    yourStay: string;
    checkIn: string;
    checkOut: string;
    nights: string;
    addons: string;
    total: string;
    backToSearch: string;
    perNight: string;
    perStay: string;
    perPerson: string;
    paymentInfo: string;
    paymentNotice: string;
    cancellationPolicy?: string;
    cancellationPolicyDesc?: string;
  };
  backHref: string;
}

export function CheckoutSummary({ translations: t, backHref }: CheckoutSummaryProps) {
  const { summary, searchParams } = useBookingStore();

  if (!summary) return null;

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

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

  return (
    <div className="space-y-6">
      {/* Room info card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="p-6">
          {/* Room items */}
          {summary.items.map((item, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {item.quantity > 1 ? `${item.quantity}x ` : ''}
                {item.roomTypeName}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{item.ratePlanName}</p>
            </div>
          ))}

          <div className="space-y-4 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            {/* Dates */}
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {t.checkIn}
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {searchParams.checkIn}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {t.checkOut}
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {searchParams.checkOut}
                </p>
              </div>
            </div>

            {/* Guests + Nights */}
            <div className="flex justify-between text-sm py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="material-icons text-sm text-slate-400">group</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {searchParams.adults + searchParams.children} Guests
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-icons text-sm text-slate-400">nightlight</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {summary.nights} {t.nights}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Price summary card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h4 className="font-bold text-sm uppercase tracking-wider mb-4 text-slate-400">
          Price Summary
        </h4>
        <div className="space-y-3">
          {/* Room items */}
          {summary.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                {summary.nights} {t.nights} &times; {formatCurrency(item.total / summary.nights / item.quantity, summary.currency)}
              </span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(item.total, summary.currency)}
              </span>
            </div>
          ))}

          {/* Addons */}
          {summary.addons.map((addon, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                {addon.name}
                <span className="text-xs text-slate-400 ml-1">({addonTypeLabel(addon.addonType)})</span>
              </span>
              <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(addon.total, summary.currency)}
              </span>
            </div>
          ))}

          {/* Total */}
          <div className="pt-4 mt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-end">
              <span className="text-lg font-bold text-slate-900 dark:text-white">{t.total}</span>
              <span className="text-3xl font-extrabold text-primary tabular-nums">
                {formatCurrency(summary.total, summary.currency)}
              </span>
            </div>
            <p className="text-[10px] text-right text-slate-400 mt-1 uppercase">
              Inclusive of all taxes
            </p>
          </div>
        </div>
      </div>

      {/* Cancellation policy */}
      <div className="p-4 rounded-xl bg-blue-50 dark:bg-primary/10 border border-blue-100 dark:border-primary/20">
        <div className="flex gap-3">
          <span className="material-icons text-primary">info</span>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">
              {t.cancellationPolicy ?? t.paymentInfo}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.cancellationPolicyDesc ?? t.paymentNotice}
            </p>
          </div>
        </div>
      </div>

      {/* Back link */}
      <a
        href={backHref}
        className="flex items-center gap-1 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
      >
        <span className="material-icons text-lg">arrow_back</span>
        {t.backToSearch}
      </a>
    </div>
  );
}
