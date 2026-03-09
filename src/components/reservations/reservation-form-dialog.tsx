'use client';

import { useState, useTransition, useEffect, useRef, useCallback } from 'react';
import { createReservation, checkAvailability, calculateStayPrice } from '@/server/actions/reservations';
import { createGuest } from '@/server/actions/guests';
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

type GuestMode = 'new' | 'search';

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
    nightlyRates: { date: string; amount: string }[];
    autoCalculated: boolean;
    minStay: number;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Stay details
  const [propertyId, setPropertyId] = useState(defaultValues?.propertyId ?? properties[0]?.id ?? '');
  const [roomTypeId, setRoomTypeId] = useState(defaultValues?.roomTypeId ?? '');
  const [checkInDate, setCheckInDate] = useState(defaultValues?.checkInDate ?? '');
  const [checkOutDate, setCheckOutDate] = useState(defaultValues?.checkOutDate ?? '');

  // Guest
  const [guestMode, setGuestMode] = useState<GuestMode>('new');
  const [guestId, setGuestId] = useState('');
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Booking details
  const [source, setSource] = useState<string>('direct');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [totalAmount, setTotalAmount] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');

  const filteredRoomTypes = roomTypes.filter((rt) => rt.propertyId === propertyId);

  const nights =
    checkInDate && checkOutDate
      ? differenceInDays(new Date(checkOutDate), new Date(checkInDate))
      : 0;

  const fetchPrice = useCallback(
    async (pId: string, rtId: string, ciDate: string, coDate: string) => {
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
          nightlyRates: priceResult.data.nightlyRates,
          autoCalculated: true,
          minStay: priceResult.data.minStay,
        });
      }
    },
    [],
  );

  // Auto-calculate price on mount when defaults are provided
  const didAutoCalc = useRef(false);
  useEffect(() => {
    if (didAutoCalc.current) return;
    if (propertyId && roomTypeId && checkInDate && checkOutDate && nights > 0) {
      didAutoCalc.current = true;
      fetchPrice(propertyId, roomTypeId, checkInDate, checkOutDate);
    }
  }, [propertyId, roomTypeId, checkInDate, checkOutDate, nights, fetchPrice]);

  // Auto check availability when dates + room type are set
  useEffect(() => {
    if (!roomTypeId || !checkInDate || !checkOutDate || nights <= 0) {
      setAvailability(null);
      return;
    }
    let cancelled = false;
    checkAvailability({ roomTypeId, checkInDate, checkOutDate }).then((result) => {
      if (cancelled) return;
      if (result.success) setAvailability(result.data);
    });
    return () => { cancelled = true; };
  }, [roomTypeId, checkInDate, checkOutDate, nights]);

  // Compute summary values
  const avgNightlyRate =
    priceInfo && priceInfo.nightlyRates.length > 0
      ? (
          priceInfo.nightlyRates.reduce((sum, r) => sum + parseFloat(r.amount), 0) /
          priceInfo.nightlyRates.length
        ).toFixed(2)
      : null;

  const roomTotal =
    priceInfo && priceInfo.nightlyRates.length > 0
      ? priceInfo.nightlyRates.reduce((sum, r) => sum + parseFloat(r.amount), 0).toFixed(2)
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      let resolvedGuestId = guestId;

      // Create guest first if in "new guest" mode
      if (guestMode === 'new') {
        if (!newFirstName.trim() || !newLastName.trim()) {
          setError('Guest first name and last name are required');
          return;
        }
        const guestResult = await createGuest({
          firstName: newFirstName.trim(),
          lastName: newLastName.trim(),
          email: newEmail.trim() || undefined,
          phone: newPhone.trim() || undefined,
          vipStatus: 'none',
        });
        if (!guestResult.success) {
          setError(guestResult.error);
          return;
        }
        resolvedGuestId = guestResult.data.id;
      }

      if (!resolvedGuestId) {
        setError('Please select or create a guest');
        return;
      }

      const result = await createReservation({
        propertyId,
        roomTypeId,
        guestId: resolvedGuestId,
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

  const inputClasses =
    'w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all';

  const labelClasses = 'block text-xs font-medium text-slate-900 dark:text-white mb-1.5';

  const selectClasses =
    'w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none transition-all';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-[720px] bg-white dark:bg-[#1a2632] rounded-xl shadow-2xl z-50 flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">New Reservation</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors rounded-full p-1 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="material-icons text-xl">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Error Banner */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
                <span className="material-icons text-lg">error_outline</span>
                {error}
              </div>
            )}

            {/* ─── STAY DETAILS ─── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
                <span className="material-icons text-base">calendar_today</span> Stay Details
              </h3>
              <div className="grid grid-cols-12 gap-4">
                {/* Check-in */}
                <div className="col-span-12 sm:col-span-4">
                  <label className={labelClasses}>Check-in</label>
                  <input
                    type="date"
                    value={checkInDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCheckInDate(val);
                      setAvailability(null);
                      setPriceInfo(null);
                      setTotalAmount('');
                      if (roomTypeId && val && checkOutDate) {
                        fetchPrice(propertyId, roomTypeId, val, checkOutDate);
                      }
                    }}
                    required
                    className={inputClasses}
                  />
                </div>

                {/* Check-out */}
                <div className="col-span-12 sm:col-span-4">
                  <label className={labelClasses}>Check-out</label>
                  <input
                    type="date"
                    value={checkOutDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCheckOutDate(val);
                      setAvailability(null);
                      setPriceInfo(null);
                      setTotalAmount('');
                      if (roomTypeId && checkInDate && val) {
                        fetchPrice(propertyId, roomTypeId, checkInDate, val);
                      }
                    }}
                    required
                    className={inputClasses}
                  />
                </div>

                {/* Nights Badge */}
                <div className="col-span-12 sm:col-span-4 flex items-end pb-2">
                  {nights > 0 && (
                    <span className="text-sm text-primary font-medium bg-primary/10 px-3 py-1 rounded-full">
                      {nights} Night{nights !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Property (show only if multiple) */}
                {properties.length > 1 && (
                  <div className="col-span-12">
                    <label className={labelClasses}>Property</label>
                    <div className="relative">
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
                        className={selectClasses}
                      >
                        {properties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <span className="material-icons absolute right-3 top-2.5 text-slate-400 pointer-events-none text-lg">
                        expand_more
                      </span>
                    </div>
                  </div>
                )}

                {/* Room Type */}
                <div className="col-span-12">
                  <label className={labelClasses}>Room Type</label>
                  <div className="relative">
                    <select
                      value={roomTypeId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRoomTypeId(val);
                        setAvailability(null);
                        setPriceInfo(null);
                        setTotalAmount('');
                        if (val && checkInDate && checkOutDate) {
                          fetchPrice(propertyId, val, checkInDate, checkOutDate);
                        }
                      }}
                      required
                      className={selectClasses}
                    >
                      <option value="">Select room type</option>
                      {filteredRoomTypes.map((rt) => (
                        <option key={rt.id} value={rt.id}>
                          {rt.name} ({rt.code})
                        </option>
                      ))}
                    </select>
                    <span className="material-icons absolute right-3 top-2.5 text-slate-400 pointer-events-none text-lg">
                      expand_more
                    </span>
                  </div>
                  {/* Availability indicator */}
                  {availability && (
                    <p
                      className={`text-xs mt-1.5 flex items-center gap-1 ${
                        availability.availableUnits > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          availability.availableUnits > 0 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      {availability.availableUnits} room{availability.availableUnits !== 1 ? 's' : ''}{' '}
                      available for these dates
                    </p>
                  )}
                  {/* Min stay warning */}
                  {priceInfo && priceInfo.minStay > 1 && nights > 0 && nights < priceInfo.minStay && (
                    <div className="flex items-center gap-2 mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      <span className="material-icons text-sm flex-shrink-0">warning</span>
                      Minimum stay is {priceInfo.minStay} night{priceInfo.minStay !== 1 ? 's' : ''}. You
                      are booking {nights}.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <hr className="border-slate-200 dark:border-slate-700" />

            {/* ─── GUEST ─── */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span className="material-icons text-base">person</span> Guest
                </h3>
                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setGuestMode('new')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      guestMode === 'new'
                        ? 'bg-white dark:bg-[#1a2632] text-primary shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    New Guest
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuestMode('search')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      guestMode === 'search'
                        ? 'bg-white dark:bg-[#1a2632] text-primary shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    Search Existing
                  </button>
                </div>
              </div>

              {guestMode === 'new' ? (
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-12 sm:col-span-6">
                    <label className={labelClasses}>First Name</label>
                    <input
                      type="text"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      placeholder="e.g. Jonathan"
                      className={inputClasses}
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-6">
                    <label className={labelClasses}>Last Name</label>
                    <input
                      type="text"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      placeholder="e.g. Doe"
                      className={inputClasses}
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-6">
                    <label className={labelClasses}>Email Address</label>
                    <div className="relative">
                      <span className="material-icons absolute left-3 top-2.5 text-slate-400 text-lg">
                        mail
                      </span>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="jonathan@example.com"
                        className={`${inputClasses} pl-9`}
                      />
                    </div>
                  </div>
                  <div className="col-span-12 sm:col-span-6">
                    <label className={labelClasses}>Phone Number</label>
                    <div className="relative">
                      <span className="material-icons absolute left-3 top-2.5 text-slate-400 text-lg">
                        phone
                      </span>
                      <input
                        type="tel"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className={`${inputClasses} pl-9`}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <GuestCombobox guests={guests} value={guestId} onChange={setGuestId} />
              )}
            </section>

            <hr className="border-slate-200 dark:border-slate-700" />

            {/* ─── BOOKING DETAILS + SUMMARY ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Booking Config */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span className="material-icons text-base">settings</span> Booking Details
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  {/* Source */}
                  <div>
                    <label className={labelClasses}>Source</label>
                    <div className="relative">
                      <select
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        required
                        className={selectClasses}
                      >
                        <option value="direct">Direct / Phone</option>
                        <option value="walkin">Walk-in</option>
                        <option value="booking_com">OTA (Booking.com)</option>
                        <option value="expedia">OTA (Expedia)</option>
                        <option value="airbnb">Airbnb</option>
                        <option value="website">Website</option>
                      </select>
                      <span className="material-icons absolute right-2 top-2 text-slate-400 pointer-events-none text-lg">
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Rate Plan (informational) */}
                  <div>
                    <label className={labelClasses}>Rate Plan</label>
                    <div className="relative">
                      <div className={`${inputClasses} flex items-center text-slate-500 dark:text-slate-400`}>
                        {isCalculating ? (
                          <span className="flex items-center gap-1.5 text-xs">
                            <span className="material-icons animate-spin text-xs">progress_activity</span>
                            Calculating...
                          </span>
                        ) : priceInfo ? (
                          priceInfo.ratePlanName
                        ) : (
                          <span className="text-slate-400">Auto-detect</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Adults & Children Steppers */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Adults */}
                  <div>
                    <label className={labelClasses}>Adults</label>
                    <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => setAdults((v) => Math.max(1, v - 1))}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
                      >
                        <span className="material-icons text-sm">remove</span>
                      </button>
                      <span className="flex-1 text-center text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                        {adults}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAdults((v) => Math.min(20, v + 1))}
                        className="w-7 h-7 flex items-center justify-center rounded-md bg-white dark:bg-slate-700 shadow-sm text-primary transition-colors border border-slate-200 dark:border-slate-600"
                      >
                        <span className="material-icons text-sm">add</span>
                      </button>
                    </div>
                  </div>

                  {/* Children */}
                  <div>
                    <label className={labelClasses}>Children</label>
                    <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => setChildren((v) => Math.max(0, v - 1))}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
                      >
                        <span className="material-icons text-sm">remove</span>
                      </button>
                      <span className="flex-1 text-center text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                        {children}
                      </span>
                      <button
                        type="button"
                        onClick={() => setChildren((v) => Math.min(20, v + 1))}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
                      >
                        <span className="material-icons text-sm">add</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className={labelClasses}>Notes / Special Requests</label>
                  <textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="Allergies, early check-in, etc..."
                    rows={3}
                    className={`${inputClasses} resize-none`}
                  />
                </div>
              </div>

              {/* Right: Price Summary */}
              <div className="flex flex-col h-full">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 mb-4">
                  <span className="material-icons text-base">receipt_long</span> Summary
                </h3>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex-1 flex flex-col justify-between">
                  {/* Line items */}
                  <div className="space-y-3">
                    {avgNightlyRate && nights > 0 ? (
                      <>
                        <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                          <span>
                            ${avgNightlyRate} x {nights} Night{nights !== 1 ? 's' : ''}
                          </span>
                          <span className="font-medium text-slate-900 dark:text-white tabular-nums">
                            ${roomTotal}
                          </span>
                        </div>
                      </>
                    ) : isCalculating ? (
                      <div className="flex items-center justify-center py-4 text-sm text-slate-400">
                        <span className="material-icons animate-spin text-lg mr-2">progress_activity</span>
                        Calculating rates...
                      </div>
                    ) : (
                      <div className="flex items-center justify-center py-4 text-sm text-slate-400">
                        Select dates and room type to see pricing
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  {totalAmount && (
                    <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            Total Amount
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                              ${totalAmount}
                            </span>
                          </div>
                        </div>
                        {priceInfo?.autoCalculated && (
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded flex items-center gap-1">
                            <span className="material-icons text-[10px]">auto_awesome</span>
                            Auto-calculated
                          </span>
                        )}
                      </div>
                      {/* Editable total override */}
                      <div className="mt-3">
                        <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Override total
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">
                            $
                          </span>
                          <input
                            value={totalAmount}
                            onChange={(e) => {
                              setTotalAmount(e.target.value);
                              if (priceInfo) setPriceInfo({ ...priceInfo, autoCalculated: false });
                            }}
                            required
                            placeholder="0.00"
                            className="w-full pl-6 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all tabular-nums"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#1a2632] rounded-b-xl flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <span className="material-icons animate-spin text-sm">progress_activity</span>
                  Creating...
                </>
              ) : (
                <>
                  <span className="material-icons text-sm">check</span>
                  Create Reservation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
