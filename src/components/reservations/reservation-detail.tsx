'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { updateReservationNotes, updateReservation } from '@/server/actions/reservations';
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

const VIP_BADGE: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  gold: {
    label: 'VIP Gold',
    bg: 'bg-amber-400/20',
    text: 'text-amber-100',
    dot: 'bg-amber-400',
  },
  platinum: {
    label: 'VIP Platinum',
    bg: 'bg-purple-400/20',
    text: 'text-purple-100',
    dot: 'bg-purple-400',
  },
  diamond: {
    label: 'VIP Diamond',
    bg: 'bg-cyan-400/20',
    text: 'text-cyan-100',
    dot: 'bg-cyan-400',
  },
  silver: {
    label: 'VIP Silver',
    bg: 'bg-slate-400/20',
    text: 'text-slate-100',
    dot: 'bg-slate-400',
  },
};

// ── Helpers ──

function fmtDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
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
  const paidNum = folioSummary ? parseFloat(folioSummary.paidAmount) : 0;
  const totalDisplay = folioSummary
    ? fmtCurrency(folioSummary.total, folioSummary.currency)
    : fmtCurrency(reservation.totalAmount, reservation.currency);
  const curr = folioSummary?.currency ?? reservation.currency;
  const vipConf = VIP_BADGE[guest.vipStatus];

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

        {/* ── Unified Summary Strip ── */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="flex items-stretch">
            {/* Blue accent bar */}
            <div className="w-1.5 bg-gradient-to-b from-primary to-blue-400 flex-shrink-0" />
            <div className="flex-1 px-6 py-4 flex items-center justify-between gap-6 flex-wrap">
              {/* Dates & Stay */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">Check-in</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{fmtDateShort(reservation.checkInDate)}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">{fmtTime(property.checkInTime)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 px-3">
                    <div className="w-8 h-px bg-slate-300 dark:bg-slate-600" />
                    <span className="text-xs font-bold text-primary bg-primary/5 dark:bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {reservation.nights}N
                    </span>
                    <div className="w-8 h-px bg-slate-300 dark:bg-slate-600" />
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Check-out</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{fmtDateShort(reservation.checkOutDate)}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">{fmtTime(property.checkOutTime)}</div>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 hidden sm:block" />

              {/* Room badge */}
              <div className="flex items-center gap-2.5">
                {unit ? (
                  <div className="flex items-center gap-2.5 bg-primary/5 dark:bg-primary/10 px-3 py-1.5 rounded-lg">
                    <span className="material-icons-outlined text-primary text-[18px]">bedroom_parent</span>
                    <div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{unit.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5">{roomType.name}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg">
                    <span className="material-icons-outlined text-slate-400 text-[18px]">door_front</span>
                    <span className="text-xs text-slate-400 italic">Unassigned</span>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 hidden sm:block" />

              {/* Occupancy */}
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="material-icons-outlined text-[16px]">person</span>
                  {reservation.adults}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-icons-outlined text-[16px]">child_care</span>
                  {reservation.children}
                </span>
              </div>

              {/* Divider */}
              <div className="w-px h-10 bg-slate-200 dark:bg-slate-700 hidden sm:block" />

              {/* Financial */}
              <div className="flex items-center gap-5 ml-auto">
                <div className="text-right">
                  <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total</div>
                  <div className="text-base font-bold text-slate-900 dark:text-white tabular-nums">{totalDisplay}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Balance</div>
                  {balanceNum !== null ? (
                    <div className={`text-base font-bold tabular-nums ${balanceNum <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {balanceNum <= 0 ? 'Paid' : fmtCurrency(folioSummary!.balance, curr)}
                    </div>
                  ) : (
                    <div className="text-base font-bold text-slate-300 dark:text-slate-600">—</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">Source</div>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {SOURCE_LABELS[reservation.source] ?? reservation.source}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Grid (8/4) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ═══ Left column (8/12) ═══ */}
          <div className="lg:col-span-8 space-y-6">

            {/* ▸ Stay & Room Card (combined) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-icons-outlined text-primary text-[20px]">route</span>
                  Stay Details
                </h2>
                {canEdit && (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded-lg transition-colors"
                    title="Edit Reservation"
                  >
                    <span className="material-icons-outlined text-[14px]">edit</span>
                    Edit
                  </button>
                )}
              </div>
              <div className="p-6">
                {/* Timeline bar */}
                <div className="flex items-center gap-0">
                  {/* Check-in */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center border-2 border-primary flex-shrink-0">
                      <span className="material-icons-round text-primary text-[18px]">login</span>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-primary uppercase tracking-wider">Check-in</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{fmtDateLong(reservation.checkInDate)}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">From {fmtTime(property.checkInTime)}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex-1 mx-4">
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-blue-400 rounded-full" style={{ width: '100%' }} />
                    </div>
                    <div className="flex justify-center mt-1.5">
                      <span className="text-[10px] font-bold text-primary">
                        {reservation.nights} night{reservation.nights !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Check-out */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-slate-300 dark:border-slate-600 flex-shrink-0">
                      <span className="material-icons-round text-slate-500 dark:text-slate-400 text-[18px]">logout</span>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Check-out</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{fmtDateLong(reservation.checkOutDate)}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Before {fmtTime(property.checkOutTime)}</div>
                    </div>
                  </div>
                </div>

                {/* Room & Occupancy */}
                <div className="flex items-center gap-4 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 flex-wrap">
                  {/* Room */}
                  {unit ? (
                    <div className="flex items-center gap-3 bg-primary/5 dark:bg-primary/10 px-4 py-2.5 rounded-lg">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary font-bold text-base">
                        {unit.name}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{roomType.name}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {unit.floor ? `Floor ${unit.floor}` : ''}{unit.floor ? ' · ' : ''}{property.name}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 rounded-lg">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <span className="material-icons-outlined text-[20px]">door_front</span>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">{roomType.name}</div>
                        <div className="text-[11px] text-slate-400 italic">Not assigned</div>
                      </div>
                    </div>
                  )}

                  {/* Occupancy pills */}
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium text-slate-600 dark:text-slate-400">
                      <span className="material-icons-outlined text-[14px]">person</span>
                      {reservation.adults} Adult{reservation.adults !== 1 ? 's' : ''}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium text-slate-600 dark:text-slate-400">
                      <span className="material-icons-outlined text-[14px]">child_care</span>
                      {reservation.children} Child{reservation.children !== 1 ? 'ren' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ▸ Rate Breakdown Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-icons-outlined text-primary text-[20px]">receipt_long</span>
                  Rate Breakdown
                </h2>
                {folioSummary && balanceNum !== null && (
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      balanceNum <= 0
                        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20'
                    }`}
                  >
                    {balanceNum <= 0 ? 'Paid in Full' : `Balance: ${fmtCurrency(folioSummary.balance, curr)}`}
                  </span>
                )}
              </div>
              <div className="p-6">
                {folioSummary && folioSummary.lineItems.length > 0 ? (
                  <div>
                    {/* Line items with mini bar */}
                    <div className="space-y-0">
                      {folioSummary.lineItems.map((li, i) => {
                        const maxAmount = Math.max(...folioSummary.lineItems.map(l => parseFloat(l.amount)));
                        const barWidth = maxAmount > 0 ? (parseFloat(li.amount) / maxAmount) * 100 : 0;
                        return (
                          <div key={i} className="flex items-center gap-3 py-2.5 text-sm border-b border-slate-50 dark:border-slate-800/50 last:border-b-0">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                                <span className="text-slate-600 dark:text-slate-400 truncate">{li.description}</span>
                              </div>
                              {/* Mini bar */}
                              <div className="ml-3.5 mt-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden max-w-[200px]">
                                <div
                                  className="h-full bg-primary/30 rounded-full"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                            <span className="font-medium text-slate-900 dark:text-white tabular-nums flex-shrink-0">
                              {fmtCurrency(li.amount, curr)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Totals */}
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Subtotal</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                          {fmtCurrency(folioSummary.subtotal, curr)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 dark:text-slate-400">Tax</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                          {fmtCurrency(folioSummary.taxTotal, curr)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800">
                        <span className="font-bold text-base text-slate-900 dark:text-white">Total</span>
                        <span className="font-bold text-xl text-primary tabular-nums">
                          {fmtCurrency(folioSummary.total, curr)}
                        </span>
                      </div>
                      {paidNum > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">Paid</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                            -{fmtCurrency(folioSummary.paidAmount, curr)}
                          </span>
                        </div>
                      )}
                      {balanceNum !== null && balanceNum > 0 && (
                        <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                          <span className="font-semibold text-sm text-amber-700 dark:text-amber-400">Outstanding</span>
                          <span className="font-bold text-lg text-amber-600 dark:text-amber-400 tabular-nums">
                            {fmtCurrency(folioSummary.balance, curr)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 dark:text-slate-400">
                        Total Amount ({reservation.nights} night{reservation.nights !== 1 ? 's' : ''})
                      </span>
                      <span className="font-bold text-xl text-primary tabular-nums">
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

            {/* ▸ Notes & Requests Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900">
                <span className="material-icons-outlined text-primary text-[20px]">sticky_note_2</span>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Notes & Requests</h2>
              </div>
              <div className="p-5 space-y-4">
                {/* Special Requests */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    <span className="material-icons-outlined text-[13px]">campaign</span>
                    Guest Requests
                  </label>
                  {reservation.specialRequests ? (
                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-lg p-3 flex items-start gap-2">
                      <span className="material-icons-outlined text-amber-500 text-[16px] mt-0.5 flex-shrink-0">format_quote</span>
                      <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
                        {reservation.specialRequests}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 dark:text-slate-500 italic pl-1">
                      No special requests
                    </p>
                  )}
                </div>

                {/* Internal Notes */}
                <div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    <span className="material-icons-outlined text-[13px]">lock</span>
                    Internal Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      setNotesSaved(false);
                    }}
                    rows={2}
                    maxLength={2000}
                    placeholder="Add a note for the team..."
                    className="block w-full rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 bg-white text-sm p-3 focus:border-primary focus:ring-1 focus:ring-primary/20 shadow-sm placeholder:text-slate-400 resize-none outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
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

          {/* ═══ Right column (4/12) ═══ */}
          <div className="lg:col-span-4 space-y-6">

            {/* ▸ Guest Profile Card */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {/* Gradient header */}
              <div className="relative bg-gradient-to-br from-primary to-blue-600 p-5 pb-12">
                <div className="flex items-center justify-between">
                  {vipConf ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${vipConf.bg} ${vipConf.text} border border-white/10`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${vipConf.dot} mr-1`} />
                      {vipConf.label}
                    </span>
                  ) : (
                    <span />
                  )}
                  <Link
                    href={`/reservations/${reservation.id}/guest`}
                    className="text-white/70 hover:text-white transition-colors"
                    title="View full profile"
                  >
                    <span className="material-icons-outlined text-[18px]">open_in_new</span>
                  </Link>
                </div>
              </div>
              {/* Avatar overlapping */}
              <div className="relative -mt-8 px-5 mb-3">
                <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-900 shadow-lg flex items-center justify-center text-primary font-bold text-lg">
                  {getInitials(guest.firstName, guest.lastName)}
                </div>
              </div>
              <div className="px-5 pb-5">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {guest.firstName} {guest.lastName}
                </h3>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {guest.nationality && (
                    <span className="flex items-center gap-1">
                      <span className="material-icons-outlined text-[13px]">flag</span>
                      {guest.nationality}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span className="material-icons-outlined text-[13px]">hotel</span>
                    {guest.totalStays} stay{guest.totalStays !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Contact */}
                <div className="mt-3 space-y-1.5">
                  {guest.email && (
                    <a
                      href={`mailto:${guest.email}`}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="material-icons-outlined text-blue-600 dark:text-blue-400 text-[14px]">email</span>
                      </div>
                      <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors truncate">
                        {guest.email}
                      </span>
                    </a>
                  )}
                  {guest.phone && (
                    <a
                      href={`tel:${guest.phone}`}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <span className="material-icons-outlined text-green-600 dark:text-green-400 text-[14px]">phone</span>
                      </div>
                      <span className="text-xs text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">
                        {guest.phone}
                      </span>
                    </a>
                  )}
                </div>

                {/* Stats footer */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{guest.totalStays}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stays</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary tabular-nums">
                      {fmtCurrency(guest.totalRevenue, curr)}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Revenue</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ▸ Quick Actions (vertical list) */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900">
                <span className="material-icons-outlined text-primary text-[20px]">bolt</span>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Quick Actions</h2>
              </div>
              <div className="p-2">
                <button
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors group"
                  title="Change room assignment"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 group-hover:bg-primary/10 dark:group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                    <span className="material-icons-outlined text-blue-600 dark:text-blue-400 group-hover:text-primary text-[18px] transition-colors">swap_horiz</span>
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">Change Room</span>
                  <span className="material-icons-outlined text-slate-300 dark:text-slate-600 text-[16px] ml-auto">chevron_right</span>
                </button>
                <Link
                  href={`/reservations/${reservation.id}/folio`}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 group-hover:bg-primary/10 dark:group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                    <span className="material-icons-outlined text-green-600 dark:text-green-400 group-hover:text-primary text-[18px] transition-colors">add_circle</span>
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">Add Charge</span>
                  <span className="material-icons-outlined text-slate-300 dark:text-slate-600 text-[16px] ml-auto">chevron_right</span>
                </Link>
                <button
                  onClick={() => canEdit && setEditOpen(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors group disabled:opacity-50"
                  disabled={!canEdit}
                  title="Extend stay dates"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 group-hover:bg-primary/10 dark:group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                    <span className="material-icons-outlined text-purple-600 dark:text-purple-400 group-hover:text-primary text-[18px] transition-colors">update</span>
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">Extend Stay</span>
                  <span className="material-icons-outlined text-slate-300 dark:text-slate-600 text-[16px] ml-auto">chevron_right</span>
                </button>
                <Link
                  href={`/reservations/${reservation.id}/folio`}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 group-hover:bg-primary/10 dark:group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                    <span className="material-icons-outlined text-amber-600 dark:text-amber-400 group-hover:text-primary text-[18px] transition-colors">receipt_long</span>
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">View Folio</span>
                  <span className="material-icons-outlined text-slate-300 dark:text-slate-600 text-[16px] ml-auto">chevron_right</span>
                </Link>
              </div>
            </div>

            {/* ▸ Activity Timeline */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-icons-outlined text-primary text-[20px]">history</span>
                  Recent Activity
                </h2>
              </div>
              <div className="p-5">
                <div className="relative">
                  {/* Vertical connecting line */}
                  <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-200 dark:bg-slate-700" />

                  <div className="space-y-4 relative">
                    {/* Created */}
                    <div className="flex gap-3 relative">
                      <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 z-10 ring-2 ring-white dark:ring-slate-900">
                        <span className="material-icons-round text-blue-500 dark:text-blue-400 text-[14px]">add</span>
                      </div>
                      <div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Reservation <span className="font-semibold">created</span>
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {new Date(reservation.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' · via '}
                          {SOURCE_LABELS[reservation.source] ?? reservation.source}
                        </p>
                      </div>
                    </div>
                    {/* Payment */}
                    {folioSummary && paidNum > 0 && (
                      <div className="flex gap-3 relative">
                        <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0 z-10 ring-2 ring-white dark:ring-slate-900">
                          <span className="material-icons-round text-green-500 dark:text-green-400 text-[14px]">payments</span>
                        </div>
                        <div>
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            Payment of <span className="font-semibold">{fmtCurrency(folioSummary.paidAmount, curr)}</span> received
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            Folio #{folioSummary.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Room assigned */}
                    {unit && (
                      <div className="flex gap-3 relative">
                        <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0 z-10 ring-2 ring-white dark:ring-slate-900">
                          <span className="material-icons-round text-purple-500 dark:text-purple-400 text-[14px]">bedroom_parent</span>
                        </div>
                        <div>
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            Room <span className="font-semibold">{unit.name}</span> assigned
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {roomType.name}{unit.floor ? ` · Floor ${unit.floor}` : ''}
                          </p>
                        </div>
                      </div>
                    )}
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
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
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
              rows={3}
              maxLength={2000}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none resize-none"
              placeholder="High floor, extra pillows..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/30 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
