'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ── Types ──

interface RevenueByType {
  type: string;
  total: number;
}

interface RevenueBySource {
  source: string;
  total: number;
  count: number;
}

interface StatusCount {
  status: string;
  count: number;
}

interface DailyOccupancy {
  date: string;
  occupied: number;
  total: number;
  rate: number;
}

interface DailyRevenue {
  date: string;
  revenue: number;
}

interface TopNationality {
  nationality: string;
  count: number;
}

interface ReportsClientProps {
  dateFrom: string;
  dateTo: string;
  revenueByType: RevenueByType[];
  revenueBySource: RevenueBySource[];
  statusCounts: StatusCount[];
  dailyOccupancy: DailyOccupancy[];
  dailyRevenue: DailyRevenue[];
  topNationalities: TopNationality[];
}

// ── Config ──

const CHARGE_TYPE_LABELS: Record<string, string> = {
  room_charge: 'Room Charges',
  supplement: 'Supplements',
  minibar: 'Minibar',
  restaurant: 'Restaurant',
  damage: 'Damage',
  tax: 'Tax',
  discount: 'Discounts',
  adjustment: 'Adjustments',
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

const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  checked_in: 'Checked In',
  checked_out: 'Checked Out',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

const PIE_COLORS = ['#137fec', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

type TabKey = 'occupancy' | 'revenue' | 'sources' | 'guests';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'occupancy', label: 'Occupancy', icon: 'hotel' },
  { key: 'revenue', label: 'Revenue', icon: 'paid' },
  { key: 'sources', label: 'Channels', icon: 'source' },
  { key: 'guests', label: 'Guests', icon: 'people' },
];

// ── Component ──

function exportToCsv(filename: string, headers: string[], rows: string[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsClient({
  dateFrom,
  dateTo,
  revenueByType,
  revenueBySource,
  statusCounts,
  dailyOccupancy,
  dailyRevenue,
  topNationalities,
}: ReportsClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('occupancy');
  const [fromInput, setFromInput] = useState(dateFrom);
  const [toInput, setToInput] = useState(dateTo);

  function applyDateRange() {
    router.push(`/reports?from=${fromInput}&to=${toInput}`);
  }

  function handleExport() {
    if (tab === 'occupancy') {
      exportToCsv(
        `occupancy-${dateFrom}-${dateTo}.csv`,
        ['Date', 'Occupied', 'Total', 'Rate (%)'],
        dailyOccupancy.map((d) => [d.date, String(d.occupied), String(d.total), String(d.rate)]),
      );
    } else if (tab === 'revenue') {
      exportToCsv(
        `revenue-${dateFrom}-${dateTo}.csv`,
        ['Date', 'Revenue'],
        dailyRevenue.map((d) => [d.date, String(d.revenue)]),
      );
    } else if (tab === 'sources') {
      exportToCsv(
        `channels-${dateFrom}-${dateTo}.csv`,
        ['Channel', 'Bookings', 'Revenue'],
        revenueBySource.map((r) => [SOURCE_LABELS[r.source] ?? r.source, String(r.count), String(r.total)]),
      );
    } else if (tab === 'guests') {
      exportToCsv(
        `nationalities-${dateFrom}-${dateTo}.csv`,
        ['Nationality', 'Count'],
        topNationalities.map((n) => [n.nationality, String(n.count)]),
      );
    }
  }

  function fmtCurrency(n: number) {
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2 });
  }

  function fmtChartDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  const totalRevenue = revenueByType.reduce((s, r) => s + r.total, 0);
  const totalReservations = statusCounts.reduce((s, r) => s + r.count, 0);
  const totalGuests = topNationalities.reduce((s, r) => s + r.count, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {dateFrom} — {dateTo}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
          />
          <span className="text-slate-400 text-sm">—</span>
          <input
            type="date"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
          />
          <button
            onClick={applyDateRange}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
          >
            <span className="material-icons text-base">filter_list</span>
            Apply
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            title="Export CSV"
          >
            <span className="material-icons text-base">download</span>
            Export
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex items-center gap-1 mb-6 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.key
                ? 'bg-white dark:bg-[#1a2632] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-icons text-base">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Occupancy Tab ── */}
      {tab === 'occupancy' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Daily Occupancy Rate (90 days)
            </h2>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyOccupancy}>
                  <defs>
                    <linearGradient id="occGradReport" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#137fec" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#137fec" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtChartDate}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a2632',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#fff',
                    }}
                    formatter={(value: number | undefined) => [`${value ?? 0}%`, 'Occupancy']}
                    labelFormatter={(label) => fmtChartDate(String(label ?? ''))}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="#137fec"
                    strokeWidth={2}
                    fill="url(#occGradReport)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Reservation status breakdown */}
          <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Reservation Status Breakdown
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {statusCounts.map((s) => (
                <div key={s.status} className="text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {s.count}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {STATUS_LABELS[s.status] ?? s.status}
                  </p>
                  {totalReservations > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {Math.round((s.count / totalReservations) * 100)}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Revenue Tab ── */}
      {tab === 'revenue' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Daily Revenue (90 days)
            </h2>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtChartDate}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={(v: number) => `${v} €`}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1a2632',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#fff',
                    }}
                    formatter={(value: number | undefined) => [`${fmtCurrency(value ?? 0)} €`, 'Revenue']}
                    labelFormatter={(label) => fmtChartDate(String(label ?? ''))}
                  />
                  <Bar dataKey="revenue" fill="#137fec" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue by type table */}
          <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-white/5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Revenue by Charge Type
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-white/5">
                  <tr>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                      Revenue
                    </th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                      % of Total
                    </th>
                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/3">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {revenueByType
                    .sort((a, b) => b.total - a.total)
                    .map((r) => {
                      const pct = totalRevenue > 0 ? (r.total / totalRevenue) * 100 : 0;
                      return (
                        <tr key={r.type} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-4 text-sm font-medium text-slate-900 dark:text-white">
                            {CHARGE_TYPE_LABELS[r.type] ?? r.type}
                          </td>
                          <td className="p-4 text-sm font-medium text-slate-900 dark:text-white text-right tabular-nums">
                            {fmtCurrency(r.total)} €
                          </td>
                          <td className="p-4 text-sm text-slate-600 dark:text-slate-400 text-right tabular-nums">
                            {pct.toFixed(1)}%
                          </td>
                          <td className="p-4">
                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${Math.max(pct, 1)}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {revenueByType.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-sm text-slate-400">
                        No revenue data
                      </td>
                    </tr>
                  )}
                </tbody>
                {revenueByType.length > 0 && (
                  <tfoot className="border-t-2 border-slate-200 dark:border-slate-700">
                    <tr>
                      <td className="p-4 text-sm font-bold text-slate-900 dark:text-white">
                        Total
                      </td>
                      <td className="p-4 text-sm font-bold text-slate-900 dark:text-white text-right tabular-nums">
                        {fmtCurrency(totalRevenue)} €
                      </td>
                      <td className="p-4 text-sm text-slate-600 dark:text-slate-400 text-right">
                        100%
                      </td>
                      <td className="p-4" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Channels Tab ── */}
      {tab === 'sources' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie chart */}
            <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Bookings by Channel
              </h2>
              {revenueBySource.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueBySource.map((r) => ({
                          name: SOURCE_LABELS[r.source] ?? r.source,
                          value: r.count,
                        }))}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={60}
                        dataKey="value"
                        stroke="none"
                      >
                        {revenueBySource.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a2632',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#fff',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-12">No data</p>
              )}
            </div>

            {/* Source table */}
            <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-white/5">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Channel Performance
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-white/5">
                    <tr>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Channel
                      </th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                        Bookings
                      </th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {revenueBySource
                      .sort((a, b) => b.total - a.total)
                      .map((r, i) => (
                        <tr key={r.source} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                              />
                              <span className="text-sm font-medium text-slate-900 dark:text-white">
                                {SOURCE_LABELS[r.source] ?? r.source}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-slate-700 dark:text-slate-300 text-right tabular-nums">
                            {r.count}
                          </td>
                          <td className="p-4 text-sm font-medium text-slate-900 dark:text-white text-right tabular-nums">
                            {fmtCurrency(r.total)} €
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Guests Tab ── */}
      {tab === 'guests' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar chart */}
            <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Guests by Nationality
              </h2>
              {topNationalities.length > 0 ? (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topNationalities}
                      layout="vertical"
                      margin={{ left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="nationality"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        width={50}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1a2632',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#fff',
                        }}
                        formatter={(value: number | undefined) => [value ?? 0, 'Guests']}
                      />
                      <Bar dataKey="count" fill="#137fec" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-400 text-center py-12">No nationality data</p>
              )}
            </div>

            {/* Nationalities table */}
            <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-white/5">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Nationality Report
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {totalGuests} guests with registered nationality
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-white/5">
                    <tr>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Country
                      </th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                        Guests
                      </th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {topNationalities.map((n) => (
                      <tr key={n.nationality} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 text-sm font-medium text-slate-900 dark:text-white uppercase">
                          {n.nationality}
                        </td>
                        <td className="p-4 text-sm text-slate-700 dark:text-slate-300 text-right tabular-nums">
                          {n.count}
                        </td>
                        <td className="p-4 text-sm text-slate-500 text-right tabular-nums">
                          {totalGuests > 0 ? ((n.count / totalGuests) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
