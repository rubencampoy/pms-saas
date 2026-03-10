'use client';

import { useState, useTransition, useCallback } from 'react';
import { searchGuests, deleteGuest } from '@/server/actions/guests';
import { GuestFormDialog } from '@/components/guests/guest-form-dialog';

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  vipStatus: string;
  notes: string | null;
  totalStays: number;
  totalRevenue: string;
  address: unknown;
  createdAt: Date;
}

interface GuestsClientProps {
  guests: Guest[];
}

const VIP_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  platinum: {
    bg: 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
    text: 'text-purple-800 dark:text-purple-300',
    label: 'Platinum',
  },
  gold: {
    bg: 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-300',
    label: 'Gold',
  },
  silver: {
    bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    text: 'text-slate-800 dark:text-slate-300',
    label: 'Silver',
  },
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: 'Passport',
  national_id: 'National ID',
  driving_license: 'Driving License',
  other: 'Other',
};

export function GuestsClient({ guests: initialGuests }: GuestsClientProps) {
  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [searchQuery, setSearchQuery] = useState('');
  const [vipFilter, setVipFilter] = useState<string>('all');
  const [dialog, setDialog] = useState<{ open: boolean; editData?: Guest }>({ open: false });
  const [isPending, startTransition] = useTransition();

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      startTransition(async () => {
        const results = await searchGuests(query);
        setGuests(results as Guest[]);
      });
    },
    [],
  );

  function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this guest? This action cannot be undone.')) return;
    startTransition(async () => {
      const result = await deleteGuest(id);
      if (result.success) {
        setGuests((prev) => prev.filter((g) => g.id !== id));
      }
    });
  }

  const filteredGuests =
    vipFilter === 'all'
      ? guests
      : guests.filter((g) => g.vipStatus === vipFilter);

  const vipCounts = {
    all: guests.length,
    platinum: guests.filter((g) => g.vipStatus === 'platinum').length,
    gold: guests.filter((g) => g.vipStatus === 'gold').length,
    silver: guests.filter((g) => g.vipStatus === 'silver').length,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Guests</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {guests.length} guest{guests.length !== 1 ? 's' : ''} in your database
          </p>
        </div>
        <button
          onClick={() => setDialog({ open: true })}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
        >
          <span className="material-icons text-lg">person_add</span>
          New Guest
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#1a2632] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
            <span className="material-icons">people</span>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Guests</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{guests.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1a2632] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
            <span className="material-icons">star</span>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">VIP Guests</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {guests.filter((g) => g.vipStatus !== 'none').length}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1a2632] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
            <span className="material-icons">trending_up</span>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Total Revenue</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {guests.reduce((sum, g) => sum + Number(g.totalRevenue), 0).toLocaleString('es-ES', { minimumFractionDigits: 0 })} &euro;
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1a2632] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">
            <span className="material-icons">repeat</span>
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Avg. Stays</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
              {guests.length > 0
                ? (guests.reduce((sum, g) => sum + g.totalStays, 0) / guests.length).toFixed(1)
                : '0'}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-white/5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 w-full sm:max-w-sm">
              <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name, email, document..."
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>

            {/* VIP filter */}
            <div className="flex items-center gap-1">
              {(['all', 'gold', 'silver', 'platinum'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setVipFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    vipFilter === status
                      ? 'bg-primary/10 text-primary'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  <span className="ml-1 text-slate-400">
                    {vipCounts[status]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-white/5">
            <tr>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Guest
              </th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Contact
              </th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Document
              </th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Nationality
              </th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                Stays
              </th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                Revenue
              </th>
              <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredGuests.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  <span className="material-icons text-4xl text-slate-300 dark:text-slate-600 mb-2 block">
                    person_search
                  </span>
                  {searchQuery
                    ? `No guests found matching "${searchQuery}"`
                    : 'No guests yet. Create one to get started.'}
                </td>
              </tr>
            ) : (
              filteredGuests.map((guest) => (
                <GuestRow
                  key={guest.id}
                  guest={guest}
                  isPending={isPending}
                  onEdit={() => setDialog({ open: true, editData: guest })}
                  onDelete={() => handleDelete(guest.id)}
                />
              ))
            )}
          </tbody>
        </table>

        {/* Footer count */}
        {filteredGuests.length > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-white/5">
            <p className="text-xs text-slate-500">
              Showing {filteredGuests.length} of {guests.length} guests
            </p>
          </div>
        )}
      </div>

      {/* Guest Form Dialog */}
      {dialog.open && (
        <GuestFormDialog
          editData={dialog.editData}
          onClose={() => setDialog({ open: false })}
        />
      )}
    </div>
  );
}

/* ─── Guest Row ─── */

interface GuestRowProps {
  guest: Guest;
  isPending: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function GuestRow({ guest, isPending, onEdit, onDelete }: GuestRowProps) {
  const initials = `${guest.firstName.charAt(0)}${guest.lastName.charAt(0)}`.toUpperCase();
  const vipConfig = VIP_BADGE[guest.vipStatus];

  const avatarColors = [
    'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  ];
  const colorIdx = guest.firstName.charCodeAt(0) % avatarColors.length;

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      {/* Guest name + avatar */}
      <td className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${avatarColors[colorIdx]}`}
          >
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <a href={`/guests/${guest.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-primary transition-colors">
                {guest.firstName} {guest.lastName}
              </a>
              {vipConfig && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${vipConfig.bg} ${vipConfig.text}`}
                >
                  <span className="material-icons text-[10px] mr-0.5">star</span>
                  {vipConfig.label}
                </span>
              )}
            </div>
            {guest.dateOfBirth && (
              <span className="text-xs text-slate-500">
                Born {guest.dateOfBirth}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Contact */}
      <td className="p-4">
        <div className="space-y-0.5">
          {guest.email && (
            <div className="text-sm text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
              {guest.email}
            </div>
          )}
          {guest.phone && (
            <div className="text-xs text-slate-500">{guest.phone}</div>
          )}
        </div>
      </td>

      {/* Document */}
      <td className="p-4">
        {guest.documentType && guest.documentNumber ? (
          <div className="space-y-0.5">
            <div className="text-xs text-slate-500">
              {DOCUMENT_TYPE_LABELS[guest.documentType] ?? guest.documentType}
            </div>
            <div className="text-sm font-mono text-slate-700 dark:text-slate-300">
              {guest.documentNumber}
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>

      {/* Nationality */}
      <td className="p-4">
        {guest.nationality ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
            <span className="text-base">{countryCodeToFlag(guest.nationality)}</span>
            {guest.nationality}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </td>

      {/* Stays */}
      <td className="p-4 text-right">
        <span className="text-sm font-medium text-slate-900 dark:text-white tabular-nums">
          {guest.totalStays}
        </span>
      </td>

      {/* Revenue */}
      <td className="p-4 text-right">
        <span className="text-sm font-medium text-slate-900 dark:text-white tabular-nums">
          {Number(guest.totalRevenue).toLocaleString('es-ES', { minimumFractionDigits: 2 })} &euro;
        </span>
      </td>

      {/* Actions */}
      <td className="p-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            title="Edit guest"
            className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
          >
            <span className="material-icons text-lg">edit</span>
          </button>
          <button
            onClick={onDelete}
            disabled={isPending}
            title="Delete guest"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            <span className="material-icons text-lg">delete_outline</span>
          </button>
        </div>
      </td>
    </tr>
  );
}

/** Convert ISO 3166-1 alpha-2 country code to emoji flag */
function countryCodeToFlag(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join('');
}
