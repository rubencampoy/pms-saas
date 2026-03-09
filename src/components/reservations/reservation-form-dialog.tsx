'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { createReservation, checkAvailability, calculateStayPrice } from '@/server/actions/reservations';
import { differenceInDays } from 'date-fns';
import { GuestCombobox } from './guest-combobox';

interface Property {
  id: string;
  name: string;
  code: string;
}

interface RoomType {
  id: string;
  propertyId: string;
  name: string;
  code: string;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

export interface ReservationFormDefaults {
  propertyId?: string;
  roomTypeId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  unitId?: string;
}

interface ReservationFormDialogProps {
  properties: Property[];
  roomTypes: RoomType[];
  guests: Guest[];
  defaultValues?: ReservationFormDefaults;
  onClose: () => void;
}

export function ReservationFormDialog({
  properties,
  roomTypes,
  guests,
  defaultValues,
  onClose,
}: ReservationFormDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<{
    totalUnits: number;
    availableUnits: number;
  } | null>(null);
  const [priceInfo, setPriceInfo] = useState<{
    ratePlanName: string;
    autoCalculated: boolean;
    minStay: number;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const [propertyId, setPropertyId] = useState(defaultValues?.propertyId ?? properties[0]?.id ?? '');
  const [roomTypeId, setRoomTypeId] = useState(defaultValues?.roomTypeId ?? '');
  const [guestId, setGuestId] = useState('');
  const [source, setSource] = useState<string>('direct');
  const [checkInDate, setCheckInDate] = useState(defaultValues?.checkInDate ?? '');
  const [checkOutDate, setCheckOutDate] = useState(defaultValues?.checkOutDate ?? '');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [totalAmount, setTotalAmount] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  const filteredRoomTypes = roomTypes.filter((rt) => rt.propertyId === propertyId);

  const nights =
    checkInDate && checkOutDate
      ? differenceInDays(new Date(checkOutDate), new Date(checkInDate))
      : 0;

  async function fetchPrice(pId: string, rtId: string, ciDate: string, coDate: string) {
    const n = differenceInDays(new Date(coDate), new Date(ciDate));
    if (!rtId || !ciDate || !coDate || n <= 0) return;

    setIsCalculating(true);
    const priceResult = await calculateStayPrice({
      propertyId: pId,
      roomTypeId: rtId,
      checkInDate: ciDate,
      checkOutDate: coDate,
    });
    setIsCalculating(false);

    if (priceResult.success) {
      setTotalAmount(priceResult.data.totalAmount);
      setPriceInfo({
        ratePlanName: priceResult.data.ratePlanName,
        autoCalculated: true,
        minStay: priceResult.data.minStay,
      });
    }
  }

  // Auto-calculate price on mount when defaults are provided (e.g. from calendar)
  const didAutoCalc = useRef(false);
  useEffect(() => {
    if (didAutoCalc.current) return;
    if (propertyId && roomTypeId && checkInDate && checkOutDate && nights > 0) {
      didAutoCalc.current = true;
      fetchPrice(propertyId, roomTypeId, checkInDate, checkOutDate);
    }
  }, [propertyId, roomTypeId, checkInDate, checkOutDate, nights]);

  async function handleCheckAvailability() {
    if (!roomTypeId || !checkInDate || !checkOutDate || nights <= 0) return;

    const [availResult] = await Promise.all([
      checkAvailability({ roomTypeId, checkInDate, checkOutDate }),
      !priceInfo ? fetchPrice(propertyId, roomTypeId, checkInDate, checkOutDate) : Promise.resolve(),
    ]);

    if (availResult.success) {
      setAvailability(availResult.data);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createReservation({
        propertyId,
        roomTypeId,
        guestId,
        unitId: defaultValues?.unitId || undefined,
        source: source as 'direct' | 'booking_com' | 'expedia' | 'airbnb' | 'phone' | 'walkin' | 'website',
        checkInDate,
        checkOutDate,
        adults,
        children,
        totalAmount,
        specialRequests: specialRequests || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-[#1a2632] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Booking</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              <span className="material-icons text-lg">error_outline</span>
              {error}
            </div>
          )}

          {/* Property & Room Type */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Property *
              </label>
              <select
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  setRoomTypeId('');
                  setAvailability(null);
                  setPriceInfo(null);
                  setTotalAmount('');
                }}
                required
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none appearance-none"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Room Type *
              </label>
              <select
                value={roomTypeId}
                onChange={(e) => {
                  const newRoomTypeId = e.target.value;
                  setRoomTypeId(newRoomTypeId);
                  setAvailability(null);
                  setPriceInfo(null);
                  setTotalAmount('');
                  if (newRoomTypeId && checkInDate && checkOutDate) {
                    fetchPrice(propertyId, newRoomTypeId, checkInDate, checkOutDate);
                  }
                }}
                required
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none appearance-none"
              >
                <option value="">Select room type</option>
                {filteredRoomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name} ({rt.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Guest */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Guest *
            </label>
            <GuestCombobox
              guests={guests}
              value={guestId}
              onChange={setGuestId}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Check-in *
              </label>
              <input
                type="date"
                value={checkInDate}
                onChange={(e) => {
                  const newCheckIn = e.target.value;
                  setCheckInDate(newCheckIn);
                  setAvailability(null);
                  setPriceInfo(null);
                  setTotalAmount('');
                  if (roomTypeId && newCheckIn && checkOutDate) {
                    fetchPrice(propertyId, roomTypeId, newCheckIn, checkOutDate);
                  }
                }}
                required
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Check-out *
              </label>
              <input
                type="date"
                value={checkOutDate}
                onChange={(e) => {
                  const newCheckOut = e.target.value;
                  setCheckOutDate(newCheckOut);
                  setAvailability(null);
                  setPriceInfo(null);
                  setTotalAmount('');
                  if (roomTypeId && checkInDate && newCheckOut) {
                    fetchPrice(propertyId, roomTypeId, checkInDate, newCheckOut);
                  }
                }}
                required
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
              />
            </div>
          </div>

          {/* Nights & Availability */}
          {nights > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {nights} night{nights !== 1 ? 's' : ''}
                  {priceInfo && priceInfo.minStay > 1 && (
                    <span className="text-[10px] text-slate-400 ml-1.5">
                      (min. {priceInfo.minStay})
                    </span>
                  )}
                </span>
                {availability ? (
                  <span
                    className={`text-sm font-medium ${
                      availability.availableUnits > 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {availability.availableUnits} of {availability.totalUnits} available
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleCheckAvailability}
                    disabled={!roomTypeId}
                    className="text-xs font-medium text-primary hover:text-primary/80 disabled:text-slate-400"
                  >
                    Check Availability
                  </button>
                )}
              </div>
              {priceInfo && priceInfo.minStay > 1 && nights < priceInfo.minStay && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  <span className="material-icons text-sm flex-shrink-0">warning</span>
                  <span>
                    Minimum stay is {priceInfo.minStay} night{priceInfo.minStay !== 1 ? 's' : ''} for these dates.
                    You are booking {nights}. You can still proceed if needed.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Guests & Source */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Adults *
              </label>
              <input
                type="number"
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                min={1}
                max={20}
                required
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Children
              </label>
              <input
                type="number"
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
                min={0}
                max={20}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Source *
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none appearance-none"
              >
                <option value="direct">Direct</option>
                <option value="booking_com">Booking.com</option>
                <option value="expedia">Expedia</option>
                <option value="airbnb">Airbnb</option>
                <option value="phone">Phone</option>
                <option value="walkin">Walk-in</option>
                <option value="website">Website</option>
              </select>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Total Amount (EUR) *
              </label>
              {isCalculating && (
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <span className="material-icons animate-spin text-xs">progress_activity</span>
                  Calculating...
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                &euro;
              </span>
              <input
                value={totalAmount}
                onChange={(e) => {
                  setTotalAmount(e.target.value);
                  if (priceInfo) setPriceInfo({ ...priceInfo, autoCalculated: false });
                }}
                required
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400 tabular-nums"
              />
            </div>
            {priceInfo?.autoCalculated && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <span className="material-icons text-[10px]">auto_awesome</span>
                Auto-calculated from rate plan &ldquo;{priceInfo.ratePlanName}&rdquo;
              </p>
            )}
          </div>

          {/* Special Requests */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Special Requests
            </label>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={2}
              placeholder="Guest notes or special requirements..."
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <span className="material-icons animate-spin text-lg">progress_activity</span>
                  Creating...
                </>
              ) : (
                <>
                  <span className="material-icons text-lg">book_online</span>
                  Create Booking
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
