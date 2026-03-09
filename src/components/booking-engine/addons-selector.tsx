'use client';

import { useBookingStore } from '@/lib/hooks/use-booking-store';

const DEFAULT_ADDON_ICONS: Record<string, string> = {
  breakfast: 'restaurant',
  parking: 'local_parking',
  'late_checkout': 'schedule',
  'early_checkin': 'login',
  towels: 'dry_cleaning',
  cleaning: 'cleaning_services',
  transfer: 'airport_shuttle',
  pet: 'pets',
  crib: 'crib',
};

interface AddonsSelectorProps {
  translations: {
    addons: string;
    perNight: string;
    perStay: string;
    perPerson: string;
  };
}

export function AddonsSelector({ translations: t }: AddonsSelectorProps) {
  const { addons, selectedAddons, toggleAddon, settings, hasSearched, selectedItems } =
    useBookingStore();

  // Only show if there are addons and settings say 'before'
  if (addons.length === 0 || settings?.addonsDisplay !== 'before') return null;
  if (!hasSearched || selectedItems.size === 0) return null;

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
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
    <div className="mt-6">
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
        {t.addons}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {addons.map((addon) => {
          const isSelected = selectedAddons.has(addon.id);
          const iconName = addon.icon ?? DEFAULT_ADDON_ICONS[addon.name.toLowerCase()] ?? 'add_circle';

          return (
            <button
              key={addon.id}
              type="button"
              onClick={() => toggleAddon(addon.id)}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                isSelected
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a2632] hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <div
                className={`p-2.5 rounded-lg ${
                  isSelected
                    ? 'bg-primary/10 text-primary'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                <span className="material-icons">{iconName}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  {addon.name}
                </div>
                {addon.description && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {addon.description}
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                  {formatCurrency(addon.price, addon.currency)}
                </div>
                <div className="text-[10px] text-slate-400">{addonTypeLabel(addon.addonType)}</div>
              </div>
              {/* Checkmark */}
              {isSelected && (
                <span className="material-icons text-primary text-lg">check_circle</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
