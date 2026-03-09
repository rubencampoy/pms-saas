'use client';

import { useState, useTransition } from 'react';
import { changeReservationStatus } from '@/server/actions/reservations';
import { ReservationFormDialog } from '@/components/reservations/reservation-form-dialog';

interface Reservation {
  id: string;
  propertyId: string;
  confirmationCode: string;
  guestId: string;
  roomTypeId: string;
  unitId: string | null;
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
}

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
  vipStatus: string;
}

interface BookingsClientProps {
  reservations: Reservation[];
  properties: Property[];
  roomTypes: RoomType[];
  guests: Guest[];
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  confirmed: {
    bg: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-300',
    dot: 'bg-blue-500',
    label: 'Confirmed',
  },
  checked_in: {
    bg: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    text: 'text-green-800 dark:text-green-300',
    dot: 'bg-green-500',
    label: 'Checked In',
  },
  checked_out: {
    bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    text: 'text-slate-800 dark:text-slate-300',
    dot: 'bg-slate-500',
    label: 'Checked Out',
  },
  cancelled: {
    bg: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-300',
    dot: 'bg-red-500',
    label: 'Cancelled',
  },
  no_show: {
    bg: 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-300',
    dot: 'bg-amber-500',
    label: 'No Show',
  },
};

const SOURCE_LABELS: Record<string, string> = {
  direct: 'Direct',
  booking_com: 'Booking.com',
  expedia: 'Expedia',
  airbnb: 'Airbnb',
  phone: 'Phone',
  walkin: 'Walk-in',
  website: 'Website',
};

export function BookingsClient({
  reservations,
  properties,
  roomTypes,
  guests,
}: BookingsClientProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  const guestMap = new Map(guests.map((g) => [g.id, g]));
  const roomTypeMap = new Map(roomTypes.map((rt) => [rt.id, rt]));
  const propertyMap = new Map(properties.map((p) => [p.id, p]));

  const filtered = reservations.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (propertyFilter !== 'all' && r.propertyId !== propertyFilter) return false;
    if (searchQuery) {
      const guest = guestMap.get(r.guestId);
      const q = searchQuery.toLowerCase();
      const matchesCode = r.confirmationCode.toLowerCase().includes(q);
      const matchesGuest =
        guest &&
        `${guest.firstName} ${guest.lastName}`.toLowerCase().includes(q);
      if (!matchesCode && !matchesGuest) return false;
    }
    return true;
  });

  const statusCounts = {
    all: reservations.length,
    confirmed: reservations.filter((r) => r.status === 'confirmed').length,
    checked_in: reservations.filter((r) => r.status === 'checked_in').length,
    checked_out: reservations.filter((r) => r.status === 'checked_out').length,
    cancelled: reservations.filter((r) => r.status === 'cancelled').length,
  };

  function handleStatusChange(id: string, newStatus: string) {
    const labels: Record<string, string> = {
      checked_in: 'check in',
      checked_out: 'check out',
      cancelled: 'cancel',
    };
    if (!confirm(`Are you sure you want to ${labels[newStatus] ?? newStatus} this reservation?`)) return;

    startTransition(async () => {
      await changeReservationStatus({ id, status: newStatus as 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show' });
    });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bookings</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {reservations.length} reservation{reservations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowDialog(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
        >
          <span className="material-icons text-lg">add</span>
          New Booking
        </button>
      </div>

      {/* Table container */}
      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-white/5">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full lg:max-w-sm">
              <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code or guest name..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>

            {/* Property filter */}
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 appearance-none cursor-pointer focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
            >
              <option value="all">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Status filter pills */}
            <div className="flex items-center gap-1">
              {(['all', 'confirmed', 'checked_in', 'checked_out', 'cancelled'] as const).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {status === 'all'
                      ? 'All'
                      : STATUS_CONFIG[status]?.label ?? status}
                    <span className="ml-1 text-slate-400">
                      {statusCounts[status] ?? 0}
                    </span>
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-white/5">
              <tr>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Booking
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Guest
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Room Type
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Dates
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                  Amount
                </th>
                <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    <span className="material-icons text-4xl text-slate-300 dark:text-slate-600 mb-2 block">
                      book_online
                    </span>
                    No reservations found.
                  </td>
                </tr>
              ) : (
                filtered.map((res) => {
                  const guest = guestMap.get(res.guestId);
                  const roomType = roomTypeMap.get(res.roomTypeId);
                  const property = propertyMap.get(res.propertyId);
                  const statusConf = STATUS_CONFIG[res.status];

                  return (
                    <tr
                      key={res.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      {/* Booking code */}
                      <td className="p-4">
                        <div>
                          <a
                            href={`/reservations/${res.id}`}
                            className="font-semibold text-slate-900 dark:text-white text-sm hover:text-primary transition-colors"
                          >
                            {res.confirmationCode}
                          </a>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400">
                              {SOURCE_LABELS[res.source] ?? res.source}
                            </span>
                            {property && (
                              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
                                {property.code}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Guest */}
                      <td className="p-4">
                        {guest ? (
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                              {guest.firstName.charAt(0)}
                              {guest.lastName.charAt(0)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-slate-900 dark:text-white">
                                {guest.firstName} {guest.lastName}
                              </div>
                              {guest.email && (
                                <div className="text-xs text-slate-500 truncate max-w-[150px]">
                                  {guest.email}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Unknown</span>
                        )}
                      </td>

                      {/* Room Type */}
                      <td className="p-4">
                        <div className="text-sm text-slate-700 dark:text-slate-300">
                          {roomType?.name ?? '—'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {res.adults} adult{res.adults !== 1 ? 's' : ''}
                          {res.children > 0 && `, ${res.children} child${res.children !== 1 ? 'ren' : ''}`}
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="p-4">
                        <div className="text-sm text-slate-700 dark:text-slate-300">
                          {formatDate(res.checkInDate)} &rarr; {formatDate(res.checkOutDate)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {res.nights} night{res.nights !== 1 ? 's' : ''}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        {statusConf && (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusConf.bg} ${statusConf.text}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${statusConf.dot} mr-1.5`}
                            ></span>
                            {statusConf.label}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="p-4 text-right">
                        <span className="text-sm font-medium text-slate-900 dark:text-white tabular-nums">
                          &euro;{Number(res.totalAmount).toLocaleString('es-ES', {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(res.status === 'checked_in' || res.status === 'checked_out') && (
                            <a
                              href={`/reservations/${res.id}/folio`}
                              title="View Folio"
                              className="p-1 rounded text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              <span className="material-icons text-base">receipt_long</span>
                            </a>
                          )}
                          {res.status === 'confirmed' && (
                            <button
                              onClick={() => handleStatusChange(res.id, 'checked_in')}
                              disabled={isPending}
                              title="Check In"
                              className="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90 disabled:opacity-50"
                            >
                              Check In
                            </button>
                          )}
                          {res.status === 'checked_in' && (
                            <button
                              onClick={() => handleStatusChange(res.id, 'checked_out')}
                              disabled={isPending}
                              title="Check Out"
                              className="text-xs bg-slate-600 text-white px-2 py-1 rounded hover:bg-slate-700 disabled:opacity-50"
                            >
                              Check Out
                            </button>
                          )}
                          {(res.status === 'confirmed' || res.status === 'checked_in') && (
                            <button
                              onClick={() => handleStatusChange(res.id, 'cancelled')}
                              disabled={isPending}
                              title="Cancel"
                              className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                            >
                              <span className="material-icons text-base">close</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-white/5">
            <p className="text-xs text-slate-500">
              Showing {filtered.length} of {reservations.length} reservations
            </p>
          </div>
        )}
      </div>

      {/* New Reservation Dialog */}
      {showDialog && (
        <ReservationFormDialog
          properties={properties}
          roomTypes={roomTypes}
          guests={guests}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
