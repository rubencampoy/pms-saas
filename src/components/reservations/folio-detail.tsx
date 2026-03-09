'use client';

import { useState, useTransition } from 'react';
import {
  addCharge,
  addPayment,
  removeCharge,
  removePayment,
  closeFolio,
  voidFolio,
} from '@/server/actions/folios';

// ── Types ──

interface FolioData {
  id: string;
  folioNumber: string;
  status: string;
  subtotal: string;
  taxTotal: string;
  total: string;
  paidAmount: string;
  balance: string;
  currency: string;
  notes: string | null;
  closedAt: string | null;
  createdAt: string;
}

interface LineItem {
  id: string;
  type: string;
  description: string;
  date: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  taxRate: string;
  taxAmount: string;
  createdAt: string;
}

interface Payment {
  id: string;
  method: string;
  amount: string;
  reference: string | null;
  notes: string | null;
  processedAt: string;
}

interface FolioDetailProps {
  reservationId: string;
  checkInDate: string;
  folio: FolioData;
  lineItems: LineItem[];
  payments: Payment[];
}

// ── Category badge config ──

interface CategoryConf {
  label: string;
  bg: string;
  text: string;
  border: string;
}

const CATEGORY_CONFIG: Record<string, CategoryConf> = {
  room_charge: {
    label: 'ROOM',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-100 dark:border-blue-800',
  },
  tax: {
    label: 'TAX',
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
  },
  restaurant: {
    label: 'F&B',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-100 dark:border-orange-800',
  },
  minibar: {
    label: 'F&B',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-100 dark:border-orange-800',
  },
  supplement: {
    label: 'EXTRA',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-100 dark:border-purple-800',
  },
  damage: {
    label: 'DAMAGE',
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-100 dark:border-red-800',
  },
  discount: {
    label: 'DISCOUNT',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-100 dark:border-emerald-800',
  },
  adjustment: {
    label: 'ADJ',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-100 dark:border-amber-800',
  },
};

const FALLBACK_CATEGORY: CategoryConf = {
  label: 'OTHER',
  bg: 'bg-slate-50 dark:bg-slate-800',
  text: 'text-slate-700 dark:text-slate-300',
  border: 'border-slate-200 dark:border-slate-700',
};

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: string }> = {
  cash: { label: 'Cash', icon: 'payments' },
  credit_card: { label: 'Credit Card', icon: 'credit_card' },
  debit_card: { label: 'Debit Card', icon: 'credit_card' },
  bank_transfer: { label: 'Bank Transfer', icon: 'account_balance' },
  online: { label: 'Online', icon: 'language' },
  other: { label: 'Other', icon: 'more_horiz' },
};

const FALLBACK_PAYMENT_METHOD = { label: 'Other', icon: 'more_horiz' };

// ── Helpers ──

function fmtCurrency(amount: string | number, currency: string = 'EUR'): string {
  const sym = currency === 'EUR' ? '\u20AC' : currency;
  return `${sym}${Number(amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} \u2022 ${timePart}`;
}

// ── Combined table entry type ──

type TableEntry =
  | { kind: 'charge'; data: LineItem }
  | { kind: 'payment'; data: Payment };

// ── Component ──

export function FolioDetail({
  checkInDate,
  folio,
  lineItems,
  payments,
}: FolioDetailProps) {
  const [isPending, startTransition] = useTransition();
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isOpen = folio.status === 'open';
  const balanceNum = parseFloat(folio.balance);
  const totalCharges = parseFloat(folio.total);

  // Filter charges by search query
  const filteredItems = searchQuery
    ? lineItems.filter((li) =>
        li.description.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : lineItems;

  // Build combined table entries sorted by date
  const tableEntries: TableEntry[] = [
    ...filteredItems.map((li) => ({ kind: 'charge' as const, data: li })),
    ...payments.map((p) => ({ kind: 'payment' as const, data: p })),
  ];
  tableEntries.sort((a, b) => {
    const dateA = a.kind === 'charge' ? a.data.date : a.data.processedAt.slice(0, 10);
    const dateB = b.kind === 'charge' ? b.data.date : b.data.processedAt.slice(0, 10);
    return dateA.localeCompare(dateB);
  });

  // ── Handlers ──

  function handleRemoveCharge(lineItemId: string) {
    if (!confirm('Remove this charge?')) return;
    startTransition(async () => {
      const result = await removeCharge(lineItemId, folio.id);
      if (!result.success) setError(result.error);
    });
  }

  function handleRemovePayment(paymentId: string) {
    if (!confirm('Remove this payment?')) return;
    startTransition(async () => {
      const result = await removePayment(paymentId, folio.id);
      if (!result.success) setError(result.error);
    });
  }

  function handleCloseFolio() {
    if (!confirm('Close this folio? This action cannot be undone.')) return;
    startTransition(async () => {
      const result = await closeFolio({ folioId: folio.id });
      if (!result.success) setError(result.error);
    });
  }

  function handleVoidFolio() {
    if (!confirm('Void this folio? This will mark it as cancelled.')) return;
    startTransition(async () => {
      const result = await voidFolio(folio.id);
      if (!result.success) setError(result.error);
    });
  }

  return (
    <div className="p-8">
      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <span className="material-icons-outlined text-lg">error</span>
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <span className="material-icons-outlined text-lg">close</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-12 gap-8 max-w-7xl mx-auto">
        {/* ══════════════════════════════════════
            LEFT COLUMN (8/12) — Charges Table
           ══════════════════════════════════════ */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          {/* ── Toolbar ── */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#1a2632] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="relative">
                <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary w-64 outline-none text-slate-800 dark:text-slate-200"
                  placeholder="Search charges..."
                />
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1" />
              <select className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-600 dark:text-slate-300 focus:ring-primary focus:border-primary outline-none">
                <option>All Folios</option>
                <option>Folio A (Main)</option>
              </select>
            </div>

            {isOpen && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="px-4 py-2 rounded-lg border border-primary text-primary hover:bg-primary/5 font-medium text-sm transition-colors flex items-center gap-2"
                >
                  <span className="material-icons-outlined text-lg">add_card</span>
                  Add Payment
                </button>
                <button
                  onClick={() => setShowAddCharge(true)}
                  className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-blue-600 font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
                >
                  <span className="material-icons-outlined text-lg">add</span>
                  Add Charge
                </button>
              </div>
            )}
          </div>

          {/* ── Main table card ── */}
          <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
            {/* Card header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#1a2632]">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white">
                Folio A: Main Account
              </h3>
              <button className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                <span className="material-icons-outlined text-base">download</span>
                Download PDF
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-slate-800 text-xs uppercase text-slate-500 dark:text-slate-400 font-semibold tracking-wider">
                    <th className="px-6 py-4 w-12 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                      />
                    </th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-right">Qty</th>
                    <th className="px-6 py-4 text-right">Unit Price</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4 w-10" />
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
                  {tableEntries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-12 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        <span className="material-icons-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2 block">
                          receipt_long
                        </span>
                        No charges or payments yet.
                      </td>
                    </tr>
                  ) : (
                    tableEntries.map((entry) => {
                      if (entry.kind === 'charge') {
                        const li = entry.data;
                        const cat = CATEGORY_CONFIG[li.type] ?? FALLBACK_CATEGORY;
                        return (
                          <tr
                            key={`charge-${li.id}`}
                            className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group"
                          >
                            <td className="px-6 py-4 text-center">
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary"
                              />
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                              {fmtDate(li.date)}
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                              {li.description}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2 py-1 rounded ${cat.bg} ${cat.text} text-xs font-semibold tracking-wide border ${cat.border}`}
                              >
                                {cat.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400 tabular-nums">
                              {li.quantity}
                            </td>
                            <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400 tabular-nums">
                              {fmtCurrency(li.unitPrice, folio.currency)}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white tabular-nums">
                              {fmtCurrency(li.amount, folio.currency)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {isOpen && (
                                <button
                                  onClick={() => handleRemoveCharge(li.id)}
                                  disabled={isPending}
                                  className="text-slate-400 hover:text-primary opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                                  title="Edit charge"
                                >
                                  <span className="material-icons-outlined text-base">
                                    edit
                                  </span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      }

                      // Payment row
                      const p = entry.data;
                      const methodConf =
                        PAYMENT_METHOD_LABELS[p.method] ?? FALLBACK_PAYMENT_METHOD;
                      return (
                        <tr
                          key={`payment-${p.id}`}
                          className="bg-green-50/30 dark:bg-green-900/10 hover:bg-green-50/50 dark:hover:bg-green-900/20 transition-colors group border-l-4 border-l-green-500"
                        >
                          <td className="px-6 py-4 text-center" />
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                            {fmtDate(p.processedAt.slice(0, 10))}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                            Payment - {methodConf.label}
                            {p.reference && (
                              <span className="text-slate-400 dark:text-slate-500 text-xs ml-2">
                                {p.reference}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-semibold tracking-wide border border-green-200 dark:border-green-800">
                              PAYMENT
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-slate-600 tabular-nums" />
                          <td className="px-6 py-4 text-right text-slate-600 tabular-nums" />
                          <td className="px-6 py-4 text-right font-bold text-green-700 dark:text-green-400 tabular-nums">
                            -{fmtCurrency(p.amount, folio.currency)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {isOpen && (
                              <button
                                onClick={() => handleRemovePayment(p.id)}
                                disabled={isPending}
                                className="text-slate-400 hover:text-primary opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                                title="Payment details"
                              >
                                <span className="material-icons-outlined text-base">
                                  info
                                </span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Showing {tableEntries.length} items</span>
              <div className="flex gap-2">
                <button className="cursor-pointer hover:text-primary transition-colors">
                  Previous
                </button>
                <span className="text-primary font-bold">1</span>
                <button className="cursor-pointer hover:text-primary transition-colors">
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
            RIGHT COLUMN (4/12) — Summary & History
           ══════════════════════════════════════ */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* ── Balance Summary ── */}
          <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-6 flex items-center gap-2">
              <span className="material-icons-outlined text-slate-400">
                account_balance_wallet
              </span>
              Balance Summary
            </h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  Total Charges
                </span>
                <span className="font-semibold text-slate-800 dark:text-white tabular-nums">
                  {fmtCurrency(folio.total, folio.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 dark:text-slate-400">
                  Total Payments
                </span>
                <span className="font-semibold text-green-600 dark:text-green-400 tabular-nums">
                  -{fmtCurrency(folio.paidAmount, folio.currency)}
                </span>
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-700 my-2" />
              <div className="flex justify-between items-center text-base">
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  Outstanding
                </span>
                <span
                  className={`font-bold tabular-nums text-lg ${
                    balanceNum > 0
                      ? 'text-slate-900 dark:text-white'
                      : balanceNum === 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {fmtCurrency(folio.balance, folio.currency)}
                </span>
              </div>
            </div>

            {/* Balance Due alert */}
            {balanceNum > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
                <span className="material-icons-outlined text-red-500 mt-0.5">
                  error_outline
                </span>
                <div>
                  <h4 className="text-sm font-bold text-red-800 dark:text-red-300 mb-1">
                    Balance Due
                  </h4>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    The guest has an outstanding balance of{' '}
                    {fmtCurrency(folio.balance, folio.currency)}. Please collect
                    payment before checkout.
                  </p>
                  {isOpen && (
                    <button
                      onClick={() => setShowAddPayment(true)}
                      className="mt-3 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded transition-colors shadow-sm"
                    >
                      Settle Balance
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Fully Paid alert */}
            {balanceNum === 0 && totalCharges > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
                <span className="material-icons-outlined text-green-500 mt-0.5">
                  check_circle
                </span>
                <div>
                  <h4 className="text-sm font-bold text-green-800 dark:text-green-300 mb-1">
                    Fully Paid
                  </h4>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    All charges have been settled.
                  </p>
                  {isOpen && (
                    <button
                      onClick={handleCloseFolio}
                      disabled={isPending}
                      className="mt-3 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded transition-colors shadow-sm disabled:opacity-50"
                    >
                      Close Folio
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Payments History ── */}
          <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base text-slate-800 dark:text-white">
                Payments History
              </h3>
              {payments.length > 3 && (
                <button className="text-xs font-medium text-primary hover:underline">
                  View All
                </button>
              )}
            </div>

            {payments.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                No payments recorded.
              </p>
            ) : (
              <div className="space-y-4">
                {payments.map((p) => {
                  const methodConf =
                    PAYMENT_METHOD_LABELS[p.method] ?? FALLBACK_PAYMENT_METHOD;
                  return (
                    <div key={p.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 dark:text-green-400 flex-shrink-0">
                        <span className="material-icons-outlined text-sm">
                          {methodConf.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                            {methodConf.label}
                            {p.reference ? ` ${p.reference}` : ''}
                          </p>
                          <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums ml-2 flex-shrink-0">
                            {fmtCurrency(p.amount, folio.currency)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {fmtDateTime(p.processedAt)}
                        </p>
                        {p.notes && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {p.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Billing Instructions ── */}
          {folio.notes && (
            <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800 p-5 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-100 dark:bg-blue-800 rounded-full opacity-50 blur-xl" />
              <h3 className="font-bold text-sm text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2 relative z-10">
                <span className="material-icons-outlined text-blue-500 text-base">
                  receipt_long
                </span>
                Billing Instructions
              </h3>
              <p className="text-sm text-blue-800/80 dark:text-blue-300/80 leading-relaxed mb-3 relative z-10">
                {folio.notes}
              </p>
              <div className="flex justify-end relative z-10">
                <button className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition-colors">
                  <span className="material-icons-outlined text-sm">edit</span>
                  Edit Note
                </button>
              </div>
            </div>
          )}

          {/* ── Folio Actions ── */}
          {isOpen && (
            <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
              <button
                onClick={handleVoidFolio}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 transition-colors"
              >
                <span className="material-icons-outlined text-base">block</span>
                Void Folio
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Dialogs ── */}
      {showAddCharge && (
        <AddChargeDialog
          folioId={folio.id}
          defaultDate={checkInDate}
          onClose={() => setShowAddCharge(false)}
        />
      )}
      {showAddPayment && (
        <AddPaymentDialog
          folioId={folio.id}
          balance={folio.balance}
          currency={folio.currency}
          onClose={() => setShowAddPayment(false)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// Add Charge Dialog
// ═══════════════════════════════════════

function AddChargeDialog({
  folioId,
  defaultDate,
  onClose,
}: {
  folioId: string;
  defaultDate: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await addCharge({
        folioId,
        type: form.get('type') as
          | 'room_charge'
          | 'supplement'
          | 'minibar'
          | 'restaurant'
          | 'damage'
          | 'tax'
          | 'discount'
          | 'adjustment',
        description: form.get('description') as string,
        date: form.get('date') as string,
        quantity: Number(form.get('quantity')),
        unitPrice: form.get('unitPrice') as string,
        taxRate: form.get('taxRate') as string,
      });

      if (result.success) {
        onClose();
      } else {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 w-full max-w-lg mx-4">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Add Charge
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-icons-outlined text-slate-400">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Type
            </label>
            <select
              name="type"
              required
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
            >
              <option value="room_charge">Room Charge</option>
              <option value="supplement">Supplement</option>
              <option value="minibar">Minibar</option>
              <option value="restaurant">Restaurant</option>
              <option value="damage">Damage</option>
              <option value="tax">Tax</option>
              <option value="discount">Discount</option>
              <option value="adjustment">Adjustment</option>
            </select>
            {fieldErrors.type && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.type[0]}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <input
              name="description"
              required
              maxLength={500}
              placeholder="e.g. Room night 15 Feb"
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
            />
            {fieldErrors.description && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.description[0]}
              </p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Date
            </label>
            <input
              name="date"
              type="date"
              required
              defaultValue={defaultDate}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
            />
            {fieldErrors.date && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.date[0]}</p>
            )}
          </div>

          {/* Qty + Unit Price + Tax Rate */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Qty
              </label>
              <input
                name="quantity"
                type="number"
                min={1}
                max={100}
                defaultValue={1}
                required
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none tabular-nums"
              />
              {fieldErrors.quantity && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.quantity[0]}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Unit Price
              </label>
              <input
                name="unitPrice"
                required
                placeholder="0.00"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none tabular-nums"
              />
              {fieldErrors.unitPrice && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.unitPrice[0]}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Tax Rate %
              </label>
              <input
                name="taxRate"
                defaultValue="10"
                required
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none tabular-nums"
              />
              {fieldErrors.taxRate && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.taxRate[0]}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50"
            >
              {isPending && (
                <span className="material-icons-outlined text-base animate-spin">
                  refresh
                </span>
              )}
              Add Charge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Add Payment Dialog
// ═══════════════════════════════════════

function AddPaymentDialog({
  folioId,
  balance,
  currency,
  onClose,
}: {
  folioId: string;
  balance: string;
  currency: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await addPayment({
        folioId,
        method: form.get('method') as
          | 'cash'
          | 'credit_card'
          | 'debit_card'
          | 'bank_transfer'
          | 'online'
          | 'other',
        amount: form.get('amount') as string,
        reference: (form.get('reference') as string) || undefined,
        notes: (form.get('notes') as string) || undefined,
      });

      if (result.success) {
        onClose();
      } else {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 w-full max-w-lg mx-4">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Add Payment
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Outstanding balance:{' '}
              <span className="font-semibold">
                {fmtCurrency(balance, currency)}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-icons-outlined text-slate-400">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Method */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Payment Method
            </label>
            <select
              name="method"
              required
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
            >
              <option value="cash">Cash</option>
              <option value="credit_card">Credit Card</option>
              <option value="debit_card">Debit Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </select>
            {fieldErrors.method && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.method[0]}
              </p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Amount ({currency})
            </label>
            <input
              name="amount"
              required
              defaultValue={parseFloat(balance) > 0 ? balance : ''}
              placeholder="0.00"
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none tabular-nums"
            />
            {fieldErrors.amount && (
              <p className="mt-1 text-xs text-red-500">
                {fieldErrors.amount[0]}
              </p>
            )}
          </div>

          {/* Reference */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Reference <span className="text-slate-400">(optional)</span>
            </label>
            <input
              name="reference"
              maxLength={100}
              placeholder="e.g. card ending 4242"
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Notes <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              name="notes"
              maxLength={500}
              rows={2}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none resize-none placeholder:text-slate-400"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {isPending && (
                <span className="material-icons-outlined text-base animate-spin">
                  refresh
                </span>
              )}
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
