'use client';

import { useState, useTransition } from 'react';
import { createReservation, checkAvailability } from '@/server/actions/reservations';
import { differenceInDays } from 'date-fns';

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

  async function handleCheckAvailability() {
    if (!roomTypeId || !checkInDate || !checkOutDate || nights <= 0) return;

    const result = await checkAvailability({
      roomTypeId,
      checkInDate,
      checkOutDate,
    });

    if (result.success) {
      setAvailability(result.data);
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
                  setRoomTypeId(e.target.value);
                  setAvailability(null);
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
            <select
              value={guestId}
              onChange={(e) => setGuestId(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none appearance-none"
            >
              <option value="">Select guest</option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.firstName} {g.lastName}
                  {g.email ? ` (${g.email})` : ''}
                </option>
              ))}
            </select>
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
                  setCheckInDate(e.target.value);
                  setAvailability(null);
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
                  setCheckOutDate(e.target.value);
                  setAvailability(null);
                }}
                required
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
              />
            </div>
          </div>

          {/* Nights & Availability */}
          {nights > 0 && (
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-lg">
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {nights} night{nights !== 1 ? 's' : ''}
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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Total Amount (EUR) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
                &euro;
              </span>
              <input
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                required
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400 tabular-nums"
              />
            </div>
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
