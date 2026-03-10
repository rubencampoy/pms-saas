'use client';

import { useState } from 'react';
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
} from 'recharts';

// ── Types ──

interface KPIs {
  totalRooms: number;
  occupiedRooms: number;
  occupancyRate: number;
  roomRevenue: number;
  adr: number;
  revpar: number;
}

interface Movements {
  arrivals: number;
  departures: number;
  inHouse: number;
}

interface HKSummary {
  pending: number;
  inProgress: number;
  completed: number;
  skipped: number;
  total: number;
}

interface Outstanding {
  totalBalance: number;
  count: number;
}

interface RevenueByType {
  type: string;
  total: number;
}

interface RevenueBySource {
  source: string;
  total: number;
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

interface RecentReservation {
  id: string;
  confirmationCode: string;
  guestId: string;
  guestName: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: string;
  currency: string;
}

interface TopNationality {
  nationality: string;
  count: number;
}

interface DashboardClientProps {
  userName: string;
  kpis: KPIs;
  movements: Movements;
  hkSummary: HKSummary;
  outstanding: Outstanding;
  revenueByType: RevenueByType[];
  revenueBySource: RevenueBySource[];
  dailyOccupancy: DailyOccupancy[];
  dailyRevenue: DailyRevenue[];
  recentReservations: RecentReservation[];
  topNationalities: TopNationality[];
}

// ── Config ──

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  confirmed: {
    label: 'Confirmed',
    dot: 'bg-blue-500',
    bg: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-300',
  },
  checked_in: {
    label: 'Checked In',
    dot: 'bg-green-500',
    bg: 'bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    text: 'text-green-800 dark:text-green-300',
  },
  checked_out: {
    label: 'Checked Out',
    dot: 'bg-slate-500',
    bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    text: 'text-slate-800 dark:text-slate-300',
  },
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-red-500',
    bg: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-300',
  },
  no_show: {
    label: 'No Show',
    dot: 'bg-amber-500',
    bg: 'bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-300',
  },
};

const FALLBACK_STATUS = {
  label: 'Unknown',
  dot: 'bg-slate-400',
  bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
  text: 'text-slate-600 dark:text-slate-400',
};

function getStatusConf(status: string) {
  return STATUS_CONFIG[status] ?? FALLBACK_STATUS;
}

const CHARGE_TYPE_LABELS: Record<string, string> = {
  room_charge: 'Room',
  supplement: 'Supplement',
  minibar: 'Minibar',
  restaurant: 'Restaurant',
  damage: 'Damage',
  tax: 'Tax',
  discount: 'Discount',
  adjustment: 'Adjustment',
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

// ── Component ──

export function DashboardClient({
  userName,
  kpis,
  movements,
  hkSummary,
  outstanding,
  revenueByType,
  revenueBySource,
  dailyOccupancy,
  dailyRevenue,
  recentReservations,
  topNationalities,
}: DashboardClientProps) {
  const [chartView, setChartView] = useState<'occupancy' | 'revenue'>('occupancy');

  function fmtCurrency(n: number) {
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2 });
  }

  function fmtDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  function fmtChartDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  const totalRevenue = revenueByType.reduce((s, r) => s + r.total, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Welcome back, {userName}. Here&apos;s your property overview.
        </p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
        {/* Occupancy */}
        <KpiCard
          icon="hotel"
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          iconText="text-blue-600 dark:text-blue-400"
          label="Occupancy"
          value={`${kpis.occupancyRate}%`}
          sub={`${kpis.occupiedRooms} of ${kpis.totalRooms} rooms`}
        />

        {/* ADR */}
        <KpiCard
          icon="trending_up"
          iconBg="bg-green-50 dark:bg-green-900/20"
          iconText="text-green-600 dark:text-green-400"
          label="ADR"
          value={`${fmtCurrency(kpis.adr)} €`}
          sub="Avg daily rate"
        />

        {/* RevPAR */}
        <KpiCard
          icon="bar_chart"
          iconBg="bg-purple-50 dark:bg-purple-900/20"
          iconText="text-purple-600 dark:text-purple-400"
          label="RevPAR"
          value={`${fmtCurrency(kpis.revpar)} €`}
          sub="Rev per available room"
        />

        {/* Arrivals */}
        <KpiCard
          icon="login"
          iconBg="bg-emerald-50 dark:bg-emerald-900/20"
          iconText="text-emerald-600 dark:text-emerald-400"
          label="Arrivals"
          value={String(movements.arrivals)}
          sub={`${movements.inHouse} in house`}
        />

        {/* Departures */}
        <KpiCard
          icon="logout"
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          iconText="text-amber-600 dark:text-amber-400"
          label="Departures"
          value={String(movements.departures)}
          sub="Expected today"
        />

        {/* Outstanding */}
        <KpiCard
          icon="account_balance_wallet"
          iconBg="bg-red-50 dark:bg-red-900/20"
          iconText="text-red-600 dark:text-red-400"
          label="Outstanding"
          value={`${fmtCurrency(outstanding.totalBalance)} €`}
          sub={`${outstanding.count} open folio${outstanding.count !== 1 ? 's' : ''}`}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Main chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              30-Day Trend
            </h2>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setChartView('occupancy')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  chartView === 'occupancy'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                Occupancy
              </button>
              <button
                onClick={() => setChartView('revenue')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  chartView === 'revenue'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                }`}
              >
                Revenue
              </button>
            </div>
          </div>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'occupancy' ? (
                <AreaChart data={dailyOccupancy}>
                  <defs>
                    <linearGradient id="occGrad" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#occGrad)"
                  />
                </AreaChart>
              ) : (
                <BarChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtChartDate}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
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
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by type */}
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
            Revenue by Type
          </h2>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mb-4 tabular-nums">
            {fmtCurrency(totalRevenue)} €
          </div>
          <div className="space-y-3">
            {revenueByType
              .sort((a, b) => b.total - a.total)
              .map((r) => {
                const pct = totalRevenue > 0 ? (r.total / totalRevenue) * 100 : 0;
                return (
                  <div key={r.type}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-600 dark:text-slate-400">
                        {CHARGE_TYPE_LABELS[r.type] ?? r.type}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white tabular-nums">
                        {fmtCurrency(r.total)} €
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            {revenueByType.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">No revenue data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent bookings */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-icons text-slate-400 text-xl">book_online</span>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Recent Bookings
              </h2>
            </div>
            <a
              href="/reservations"
              className="text-xs text-primary font-medium hover:underline"
            >
              View all
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-white/5">
                <tr>
                  <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Guest
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Dates
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentReservations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-sm text-slate-400">
                      No reservations yet
                    </td>
                  </tr>
                ) : (
                  recentReservations.map((r) => {
                    const conf = getStatusConf(r.status);
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="p-3">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {r.confirmationCode}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-slate-700 dark:text-slate-300">
                          {r.guestName}
                        </td>
                        <td className="p-3 text-sm text-slate-600 dark:text-slate-400">
                          {fmtDate(r.checkInDate)} &rarr; {fmtDate(r.checkOutDate)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${conf.bg} ${conf.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${conf.dot} mr-1`} />
                            {conf.label}
                          </span>
                        </td>
                        <td className="p-3 text-sm font-medium text-slate-900 dark:text-white text-right tabular-nums">
                          {Number(r.totalAmount).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: HK + Sources + Nationalities */}
        <div className="space-y-6">
          {/* Housekeeping summary */}
          <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-icons text-slate-400 text-xl">cleaning_services</span>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Housekeeping Today
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <HkStat label="Pending" value={hkSummary.pending} color="text-amber-600 dark:text-amber-400" />
              <HkStat label="In Progress" value={hkSummary.inProgress} color="text-blue-600 dark:text-blue-400" />
              <HkStat label="Completed" value={hkSummary.completed} color="text-green-600 dark:text-green-400" />
              <HkStat label="Total" value={hkSummary.total} color="text-slate-900 dark:text-white" />
            </div>
            {hkSummary.total > 0 && (
              <div className="mt-3 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                {hkSummary.completed > 0 && (
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${(hkSummary.completed / hkSummary.total) * 100}%` }}
                  />
                )}
                {hkSummary.inProgress > 0 && (
                  <div
                    className="h-full bg-blue-500"
                    style={{ width: `${(hkSummary.inProgress / hkSummary.total) * 100}%` }}
                  />
                )}
                {hkSummary.pending > 0 && (
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${(hkSummary.pending / hkSummary.total) * 100}%` }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Revenue by source */}
          <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-icons text-slate-400 text-xl">source</span>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Bookings by Source
              </h2>
            </div>
            <div className="space-y-2">
              {revenueBySource
                .sort((a, b) => b.count - a.count)
                .map((r) => (
                  <div
                    key={r.source}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {SOURCE_LABELS[r.source] ?? r.source}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{r.count} bookings</span>
                      <span className="text-xs font-medium text-slate-900 dark:text-white tabular-nums">
                        {fmtCurrency(r.total)} €
                      </span>
                    </div>
                  </div>
                ))}
              {revenueBySource.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">No data</p>
              )}
            </div>
          </div>

          {/* Top nationalities */}
          {topNationalities.length > 0 && (
            <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-icons text-slate-400 text-xl">public</span>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Guest Nationalities
                </h2>
              </div>
              <div className="space-y-2">
                {topNationalities.map((n) => (
                  <div
                    key={n.nationality}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-xs text-slate-600 dark:text-slate-400 uppercase">
                      {n.nationality}
                    </span>
                    <span className="text-xs font-medium text-slate-900 dark:text-white tabular-nums">
                      {n.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── KPI Card ──

function KpiCard({
  icon,
  iconBg,
  iconText,
  label,
  value,
  sub,
}: {
  icon: string;
  iconBg: string;
  iconText: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white dark:bg-[#1a2632] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${iconBg} ${iconText}`}>
        <span className="material-icons">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums truncate">
          {value}
        </p>
        <p className="text-xs text-slate-400 truncate">{sub}</p>
      </div>
    </div>
  );
}

// ── HK Stat ──

function HkStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
