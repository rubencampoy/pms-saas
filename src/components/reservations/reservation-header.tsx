'use client';

import { useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { changeReservationStatus } from '@/server/actions/reservations';

// ── Types ──

interface ReservationHeaderProps {
  reservation: {
    id: string;
    confirmationCode: string;
    status: string;
  };
  guest: {
    firstName: string;
    lastName: string;
  };
  roomType: {
    name: string;
  };
  unit: { name: string } | null;
  nights: number;
  checkInDate: string;
  checkOutDate: string;
}

// ── Config ──

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

const VALID_TRANSITIONS: Record<string, string[]> = {
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: [],
  no_show: [],
};

// ── Helpers ──

function fmtDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Component ──

export function ReservationHeader({
  reservation,
  guest,
  roomType,
  unit,
  nights,
  checkInDate,
  checkOutDate,
}: ReservationHeaderProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const statusConf = STATUS_CONFIG[reservation.status];
  const transitions = VALID_TRANSITIONS[reservation.status] ?? [];

  const basePath = `/reservations/${reservation.id}`;
  const tabs = [
    { label: 'Overview', href: basePath },
    { label: 'Guest Details', href: `${basePath}/guest` },
    { label: 'Folio & Invoice', href: `${basePath}/folio` },
    { label: 'Housekeeping', href: `${basePath}/housekeeping`, disabled: true },
    { label: 'Notes & Logs', href: `${basePath}/notes`, disabled: true },
  ];

  function isActiveTab(href: string): boolean {
    if (href === basePath) return pathname === basePath;
    return pathname.startsWith(href);
  }

  function handleStatusChange(newStatus: string) {
    const labels: Record<string, string> = {
      checked_in: 'check in',
      checked_out: 'check out',
      cancelled: 'cancel',
      no_show: 'mark as no-show for',
    };
    if (!confirm(`Are you sure you want to ${labels[newStatus] ?? newStatus} this reservation?`)) return;

    startTransition(async () => {
      const result = await changeReservationStatus({
        id: reservation.id,
        status: newStatus as 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show',
      });
      if (!result.success) setError(result.error);
    });
  }

  const roomLabel = unit ? `Room ${unit.name} (${roomType.name})` : roomType.name;

  return (
    <header className="sticky top-0 z-10 h-auto bg-white dark:bg-[#1a2632] border-b border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0">
      {/* Error banner */}
      {error && (
        <div className="px-8 pt-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <span className="material-icons-outlined text-lg">error</span>
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <span className="material-icons-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Top row */}
      <div className="h-20 px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {reservation.confirmationCode}
              </h1>
              {statusConf && (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConf.bg} ${statusConf.text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot} mr-1.5`} />
                  {statusConf.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mt-1">
              <span className="flex items-center gap-1">
                <span className="material-icons-outlined text-base">person</span>
                {guest.firstName} {guest.lastName}
              </span>
              <span className="h-1 w-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
              <span className="flex items-center gap-1">
                <span className="material-icons-outlined text-base">bedroom_parent</span>
                {roomLabel}
              </span>
              <span className="h-1 w-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
              <span className="flex items-center gap-1">
                <span className="material-icons-outlined text-base">date_range</span>
                {fmtDateShort(checkInDate)} - {fmtDateShort(checkOutDate)} ({nights} Night{nights !== 1 ? 's' : ''})
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {transitions.includes('checked_in') && (
            <button
              onClick={() => handleStatusChange('checked_in')}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/30 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-icons-outlined text-[18px]">login</span>
              Check In
            </button>
          )}
          {transitions.includes('checked_out') && (
            <button
              onClick={() => handleStatusChange('checked_out')}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/30 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <span className="material-icons-outlined text-[18px]">logout</span>
              Check Out
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors bg-white dark:bg-transparent"
            title="Print"
          >
            <span className="material-icons-outlined">print</span>
          </button>
          <button
            className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors bg-white dark:bg-transparent"
            title="Send Email"
          >
            <span className="material-icons-outlined">email</span>
          </button>
          <button
            className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 transition-colors bg-white dark:bg-transparent"
            title="More actions"
          >
            <span className="material-icons-outlined">more_vert</span>
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="px-8 flex items-center gap-8 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#1a2632]">
        {tabs.map((tab) => {
          const active = isActiveTab(tab.href);
          if (tab.disabled) {
            return (
              <span
                key={tab.href}
                className="py-3 text-sm font-medium text-slate-400 dark:text-slate-600 border-b-2 border-transparent cursor-not-allowed"
              >
                {tab.label}
              </span>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`py-3 text-sm border-b-2 transition-colors ${
                active
                  ? 'font-bold text-primary border-primary'
                  : 'font-medium text-slate-500 dark:text-slate-400 hover:text-primary border-transparent hover:border-primary/50'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
