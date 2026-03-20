'use client';

import { useState, useTransition } from 'react';
import { updateReservationNotes, updateReservation } from '@/server/actions/reservations';
import { GuestDetailsCard } from './guest-details-card';
import type { GuestCardData } from './guest-details-card';

// ── Types ──

interface ReservationData {
  id: string;
  confirmationCode: string;
  status: string;
  source: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adults: number;
  children: number;
  totalAmount: string;
  currency: string;
  specialRequests: string | null;
  internalNotes: string | null;
  createdAt: string;
}

interface GuestData extends GuestCardData {}

interface RoomTypeData {
  id: string;
  name: string;
  code: string;
}

interface PropertyData {
  id: string;
  name: string;
  code: string;
  checkInTime: string;
  checkOutTime: string;
}

interface UnitData {
  id: string;
  name: string;
  floor: string | null;
}

interface FolioLineItem {
  type: string;
  description: string;
  date: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  taxAmount: string;
}

interface FolioSummary {
  id: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  paidAmount: string;
  balance: string;
  currency: string;
  lineItems: FolioLineItem[];
}

interface ReservationDetailProps {
  reservation: ReservationData;
  guest: GuestData;
  roomType: RoomTypeData;
  property: PropertyData;
  unit: UnitData | null;
  folioSummary: FolioSummary | null;
}

// ── Config ──

const SOURCE_LABELS: Record<string, string> = {
  direct: 'Direct',
  booking_com: 'Booking.com',
  expedia: 'Expedia',
  airbnb: 'Airbnb',
  phone: 'Phone',
  walkin: 'Walk-in',
  website: 'Website',
};

// ── Helpers ──

function fmtDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h!, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

function fmtCurrency(amount: string, currency: string = 'EUR'): string {
  const sym = currency === 'EUR' ? '\u20AC' : currency;
  return `${Number(amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${sym}`;
}

// ── Component ──

export function ReservationDetail({
  reservation,
  guest,
  roomType,
  property,
  unit,
  folioSummary,
}: ReservationDetailProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(reservation.internalNotes ?? '');
  const [notesSaved, setNotesSaved] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const canEdit = reservation.status === 'confirmed' || reservation.status === 'checked_in';

  const balanceNum = folioSummary ? parseFloat(folioSummary.balance) : null;

  function handleSaveNotes() {
    startTransition(async () => {
      const result = await updateReservationNotes({
        id: reservation.id,
        internalNotes: notes,
      });
      if (result.success) {
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Error banner ── */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <span className="material-icons-outlined text-lg">error</span>
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <span className="material-icons-outlined text-lg">close</span>
            </button>
          </div>
        )}

        {/* ── Content — 7/5 grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ── Left column (7/12) ── */}
          <div className="lg:col-span-7 space-y-6">
            {/* Stay Information Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-icons-outlined text-primary text-[20px]">bedroom_parent</span>
                  Stay Information
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {reservation.nights} Night{reservation.nights !== 1 ? 's' : ''}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {SOURCE_LABELS[reservation.source] ?? reservation.source}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => setEditOpen(true)}
                      className="p-1 text-slate-400 hover:text-primary transition-colors rounded"
                      title="Edit Reservation"
                    >
                      <span className="material-icons-outlined text-[18px]">edit</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="p-6">
                {/* Check-in / Check-out dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
                  <div className="relative pl-4 border-l-2 border-primary">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Check-in</label>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      {fmtDateLong(reservation.checkInDate)}
                    </div>
                    <div className="text-sm text-slate-500">{fmtTime(property.checkInTime)}</div>
                  </div>
                  <div className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Check-out</label>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      {fmtDateLong(reservation.checkOutDate)}
                    </div>
                    <div className="text-sm text-slate-500">{fmtTime(property.checkOutTime)}</div>
                  </div>
                </div>

                {/* Room + Occupancy */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">Room Assigned</label>
                    {unit ? (
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                          {unit.name}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">{roomType.name}</div>
                          <div className="text-xs text-slate-500">
                            {unit.floor ? `Floor ${unit.floor}` : property.name}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                          <span className="material-icons-outlined text-[20px]">door_front</span>
                        </div>
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">{roomType.name}</div>
                          <div className="text-xs text-slate-400 italic">Not assigned</div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-2">Occupancy</label>
                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="material-icons-outlined text-slate-400 text-[18px]">person</span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {reservation.adults} Adult{reservation.adults !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="w-px h-4 bg-slate-300 dark:bg-slate-600" />
                      <div className="flex items-center gap-2">
                        <span className="material-icons-outlined text-slate-400 text-[18px]">child_care</span>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {reservation.children} Child{reservation.children !== 1 ? 'ren' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rate Details Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-icons-outlined text-primary text-[20px]">sell</span>
                  Rate Details
                </h2>
                {folioSummary && balanceNum !== null && (
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      balanceNum <= 0
                        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
                    }`}
                  >
                    {balanceNum <= 0 ? 'Paid in Full' : `Balance: ${fmtCurrency(folioSummary.balance, folioSummary.currency)}`}
                  </span>
                )}
              </div>
              <div className="p-6">
                {folioSummary && folioSummary.lineItems.length > 0 ? (
                  <div className="space-y-3">
                    {folioSummary.lineItems.map((li, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 dark:text-slate-400">{li.description}</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {fmtCurrency(li.amount, folioSummary.currency)}
                        </span>
                      </div>
                    ))}
                    <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                      <span className="font-bold text-base text-slate-900 dark:text-white">Total</span>
                      <span className="font-bold text-xl text-primary">
                        {fmtCurrency(folioSummary.total, folioSummary.currency)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        Total Amount ({reservation.nights} night{reservation.nights !== 1 ? 's' : ''})
                      </span>
                      <span className="font-bold text-xl text-primary">
                        {fmtCurrency(reservation.totalAmount, reservation.currency)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Detailed breakdown available once a folio is created.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right column (5/12) ── */}
          <div className="lg:col-span-5 space-y-6">
            {/* Guest Profile Card */}
            <GuestDetailsCard guest={guest} canEdit={canEdit} />

            {/* Notes Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-icons-outlined text-primary text-[20px]">sticky_note_2</span>
                  Notes
                </h2>
              </div>
              <div className="p-6 space-y-6">
                {/* Special Requests */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                    <span className="material-icons-outlined text-[14px]">campaign</span>
                    Special Requests (Guest Facing)
                  </label>
                  {reservation.specialRequests ? (
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg p-3">
                      <p className="text-sm text-amber-900 dark:text-amber-100">
                        &ldquo;{reservation.specialRequests}&rdquo;
                      </p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-lg p-3">
                      <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                        No special requests
                      </p>
                    </div>
                  )}
                </div>

                {/* Internal Notes */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                    <span className="material-icons-outlined text-[14px]">lock</span>
                    Internal Notes (Staff Only)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setNotesSaved(false);
                    }}
                    rows={3}
                    maxLength={2000}
                    placeholder="Add a note..."
                    className="block w-full rounded-lg border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-sm focus:border-primary focus:ring-primary shadow-sm"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {notes.length}/2000
                    </span>
                    <div className="flex items-center gap-2">
                      {notesSaved && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <span className="material-icons-outlined text-sm">check_circle</span>
                          Saved
                        </span>
                      )}
                      <button
                        onClick={handleSaveNotes}
                        disabled={isPending}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/30 transition-colors disabled:opacity-50"
                      >
                        {isPending ? 'Saving...' : 'Save Notes'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Reservation Dialog */}
        {editOpen && (
          <ReservationEditDialog
            reservation={reservation}
            onClose={() => setEditOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Edit Dialog ─── */

const SOURCE_OPTIONS = [
  { value: 'direct', label: 'Direct' },
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'phone', label: 'Phone' },
  { value: 'walkin', label: 'Walk-in' },
  { value: 'website', label: 'Website' },
];

function ReservationEditDialog({
  reservation,
  onClose,
}: {
  reservation: ReservationData;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  const [checkInDate, setCheckInDate] = useState(reservation.checkInDate);
  const [checkOutDate, setCheckOutDate] = useState(reservation.checkOutDate);
  const [adults, setAdults] = useState(reservation.adults);
  const [children, setChildren] = useState(reservation.children);
  const [totalAmount, setTotalAmount] = useState(reservation.totalAmount);
  const [source, setSource] = useState(reservation.source);
  const [specialRequests, setSpecialRequests] = useState(reservation.specialRequests ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    startTransition(async () => {
      const result = await updateReservation({
        id: reservation.id,
        checkInDate,
        checkOutDate,
        adults,
        children,
        totalAmount,
        source: source as 'direct' | 'booking_com' | 'expedia' | 'airbnb' | 'phone' | 'walkin' | 'website',
        specialRequests,
      });

      if (!result.success) {
        setLocalError(result.error);
        return;
      }

      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-[#1a2632] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Edit Reservation
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {localError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              <span className="material-icons text-lg">error_outline</span>
              {localError}
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Check-in</label>
              <input
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Check-out</label>
              <input
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
              />
            </div>
          </div>

          {/* Occupancy */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Adults</label>
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Children</label>
              <input
                type="number"
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
                min={0}
                max={20}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none tabular-nums"
              />
            </div>
          </div>

          {/* Amount & Source */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Total Amount</label>
              <input
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                required
                pattern="^\d+(\.\d{1,2})?$"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none appearance-none cursor-pointer"
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Special Requests */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Special Requests</label>
            <textarea
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Guest requests..."
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
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-icons text-lg">save</span>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
