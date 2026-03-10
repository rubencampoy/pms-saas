'use client';

import { useState } from 'react';
import type { SearchResult } from '@/types/booking-engine';
import { useBookingStore } from '@/lib/hooks/use-booking-store';

interface RoomTypeCardProps {
  result: SearchResult;
  translations: {
    perNight: string;
    totalStay: string;
    available: string;
    unavailable: string;
    select: string;
    selected: string;
    rooms: string;
    freeCancellation: string;
    nonRefundable: string;
    maxOccupancy: string;
  };
  priceFormat: string;
}

const AMENITY_ICONS: Record<string, string> = {
  wifi: 'wifi',
  'air-conditioning': 'ac_unit',
  ac: 'ac_unit',
  tv: 'tv',
  minibar: 'kitchen',
  safe: 'lock',
  balcony: 'balcony',
  'sea-view': 'water',
  parking: 'local_parking',
  breakfast: 'restaurant',
  pool: 'pool',
  gym: 'fitness_center',
  spa: 'spa',
  shower: 'shower',
  bathroom: 'bathroom',
  'smart-tv': 'tv',
};

export function RoomTypeCard({ result, translations: t, priceFormat }: RoomTypeCardProps) {
  const { selectedItems, selectRoom } = useBookingStore();
  const [imageIndex, setImageIndex] = useState(0);

  const selection = selectedItems.get(result.roomTypeId);
  const selectedQty = selection?.quantity ?? 0;
  const selectedRatePlanId = selection?.ratePlanId ?? result.ratePlans[0]?.ratePlanId ?? '';
  const isUnavailable = result.availableUnits <= 0;
  const isSelected = selectedQty > 0;

  const selectedPlan = result.ratePlans.find((rp) => rp.ratePlanId === selectedRatePlanId) ?? result.ratePlans[0];
  const displayPrice =
    selectedPlan
      ? priceFormat === 'total_stay'
        ? selectedPlan.totalAmount
        : Math.min(...selectedPlan.nightlyRates.map((nr) => nr.amount))
      : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: result.currency || 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatPriceWhole = (amount: number) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: result.currency || 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.floor(amount));
  };

  const formatPriceDecimals = (amount: number) => {
    const decimals = (amount % 1).toFixed(2).substring(1);
    return decimals;
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-xl overflow-hidden flex flex-col md:flex-row hover:shadow-lg transition-all duration-300 group ${
        isSelected
          ? 'shadow-sm ring-2 ring-primary/5 border border-primary/20'
          : 'shadow-sm border border-slate-200/60 dark:border-slate-800'
      } ${isUnavailable ? 'opacity-60' : ''}`}
    >
      {/* Image section */}
      <div className="md:w-80 h-64 md:h-auto overflow-hidden relative flex-shrink-0">
        {result.images.length > 0 ? (
          <>
            <div
              className="w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{ backgroundImage: `url('${result.images[imageIndex]}')` }}
            />
            {result.images.length > 1 && (
              <>
                {/* Arrow navigation */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageIndex((prev) => (prev === 0 ? result.images.length - 1 : prev - 1));
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60 transition-all backdrop-blur-sm"
                >
                  <span className="material-icons text-lg">chevron_left</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageIndex((prev) => (prev === result.images.length - 1 ? 0 : prev + 1));
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60 transition-all backdrop-blur-sm"
                >
                  <span className="material-icons text-lg">chevron_right</span>
                </button>

                {/* Dots */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {result.images.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setImageIndex(i)}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === imageIndex ? 'bg-white' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <span className="material-icons text-4xl text-slate-300 dark:text-slate-600">
              bedroom_parent
            </span>
          </div>
        )}
        {/* Room type tag overlay */}
        <div className="absolute top-3 left-3">
          <span className="bg-white/90 backdrop-blur-sm text-slate-800 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-sm">
            {result.name}
          </span>
        </div>
      </div>

      {/* Content section */}
      <div className="flex-1 p-6 flex flex-col justify-between relative">
        {/* Selected badge (top-right, desktop only) */}
        {isSelected && (
          <div className="absolute top-0 right-0 p-6 pointer-events-none">
            <span className="hidden md:inline-flex items-center gap-1 text-primary text-xs font-bold bg-primary/5 px-2 py-1 rounded-md border border-primary/10">
              <span className="material-icons text-sm">check_circle</span>
              {t.selected}
            </span>
          </div>
        )}

        <div>
          {/* Title + availability */}
          <div className="flex justify-between items-start mb-2 pr-20">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
              {result.name}
            </h3>
            {!isUnavailable && result.availableUnits <= 3 && (
              <span className="bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded flex-shrink-0">
                {result.availableUnits} {t.available}
              </span>
            )}
            {isUnavailable && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
                {t.unavailable}
              </span>
            )}
          </div>

          {/* Description */}
          {result.description && (
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 leading-relaxed line-clamp-2">
              {result.description}
            </p>
          )}

          {/* Amenities */}
          {result.amenities.length > 0 && (
            <div className="flex flex-wrap gap-4 mb-6">
              {result.amenities.map((amenity) => (
                <div
                  key={amenity}
                  className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md"
                >
                  <span className="material-icons text-base">
                    {AMENITY_ICONS[amenity.toLowerCase()] ?? 'check_circle'}
                  </span>
                  <span className="text-xs font-medium">{amenity}</span>
                </div>
              ))}
            </div>
          )}

          {/* Rate plan selection (if multiple) */}
          {result.ratePlans.length > 1 && !isUnavailable && (
            <div className="space-y-2 mb-4">
              {result.ratePlans.map((rp) => (
                <label
                  key={rp.ratePlanId}
                  className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedRatePlanId === rp.ratePlanId
                      ? 'border-primary bg-primary/5'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`rate-${result.roomTypeId}`}
                      checked={selectedRatePlanId === rp.ratePlanId}
                      onChange={() => {
                        if (selectedQty > 0) {
                          selectRoom(result.roomTypeId, rp.ratePlanId, selectedQty);
                        }
                      }}
                      className="accent-primary"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {rp.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {rp.cancellationPolicy === 'free'
                          ? t.freeCancellation
                          : t.nonRefundable}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(
                      priceFormat === 'total_stay'
                        ? rp.totalAmount
                        : Math.min(...rp.nightlyRates.map((nr) => nr.amount)),
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Price + action section */}
        {!isUnavailable && (
          <div className="flex items-end justify-between border-t border-slate-100 dark:border-slate-800 pt-4 mt-auto">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">
                {priceFormat === 'total_stay' ? t.totalStay : t.perNight}
              </p>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {formatPriceWhole(displayPrice)}
                </p>
                <p className="text-sm text-slate-500 font-medium tabular-nums">
                  {formatPriceDecimals(displayPrice)}
                </p>
              </div>
            </div>

            {selectedQty === 0 ? (
              <button
                type="button"
                onClick={() => selectRoom(result.roomTypeId, selectedRatePlanId, 1)}
                className="bg-white dark:bg-transparent border-2 border-slate-200 dark:border-slate-700 hover:border-primary hover:text-primary text-slate-700 dark:text-white px-6 py-2.5 rounded-xl font-bold transition-all text-sm"
              >
                {t.select}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    selectRoom(result.roomTypeId, selectedRatePlanId, selectedQty - 1)
                  }
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary transition-colors"
                >
                  <span className="material-icons text-sm">remove</span>
                </button>
                <span className="w-6 text-center text-sm font-bold text-primary tabular-nums">
                  {selectedQty}
                </span>
                <button
                  type="button"
                  disabled={selectedQty >= result.availableUnits}
                  onClick={() =>
                    selectRoom(result.roomTypeId, selectedRatePlanId, selectedQty + 1)
                  }
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="material-icons text-sm">add</span>
                </button>
                <button
                  type="button"
                  className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold transition-opacity flex items-center gap-2 shadow-lg shadow-primary/20 text-sm ml-2"
                >
                  <span className="material-icons text-lg">check</span>
                  {t.selected}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
