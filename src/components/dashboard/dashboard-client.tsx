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
import { ClientOnly } from '@/components/ui/client-only';
import Link from 'next/link';

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

interface TodayMovement {
  id: string;
  confirmationCode: string;
  status: string;
  nights: number;
  adults: number;
  children: number;
  totalAmount: string;
  guestName: string;
  guestInitials: string;
  unitName: string | null;
  roomTypeName: string;
  roomTypeCode: string;
}

interface RoomGridItem {
  id: string;
  name: string;
  floor: string | null;
  status: string;
  housekeepingStatus: string;
  roomTypeName: string;
  roomTypeCode: string;
  isOccupied: boolean;
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

interface RevenueBySource {
  source: string;
  total: number;
  count: number;
}

interface DashboardClientProps {
  userName: string;
  kpis: KPIs;
  movements: Movements;
  hkSummary: HKSummary;
  outstanding: Outstanding;
  todayArrivals: TodayMovement[];
  todayDepartures: TodayMovement[];
  roomGrid: RoomGridItem[];
  dailyOccupancy: DailyOccupancy[];
  dailyRevenue: DailyRevenue[];
  totalRevenue30d: number;
  revenueBySource: RevenueBySource[];
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
  pending: {
    label: 'Pending',
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

const SOURCE_LABELS: Record<string, string> = {
  direct: 'Direct',
  booking_com: 'Booking.com',
  expedia: 'Expedia',
  airbnb: 'Airbnb',
  phone: 'Phone',
  walkin: 'Walk-in',
  website: 'Website',
};

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Component ──

export function DashboardClient({
  userName,
  kpis,
  movements,
  hkSummary,
  outstanding,
  todayArrivals,
  todayDepartures,
  roomGrid,
  dailyOccupancy,
  dailyRevenue,
  totalRevenue30d,
  revenueBySource,
}: DashboardClientProps) {
  const [movementTab, setMovementTab] = useState<'arrivals' | 'departures'>('arrivals');
  const [chartView, setChartView] = useState<'occupancy' | 'revenue'>('occupancy');

  function fmtCurrency(n: number) {
    return n.toLocaleString('es-ES', { minimumFractionDigits: 2 });
  }

  function fmtChartDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  const currentList = movementTab === 'arrivals' ? todayArrivals : todayDepartures;

  // Room grid stats
  const occupiedCount = roomGrid.filter((r) => r.isOccupied).length;
  const availableCount = roomGrid.filter((r) => !r.isOccupied && r.status === 'available').length;
  const dirtyCount = roomGrid.filter((r) => r.housekeepingStatus === 'dirty').length;
  const maintenanceCount = roomGrid.filter((r) => r.status === 'maintenance').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Welcome back, {userName}. Here&apos;s your property overview.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/reservations?action=new"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30"
          >
            <span className="material-icons text-lg">add</span>
            New Reservation
          </Link>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon="hotel"
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          iconText="text-blue-600 dark:text-blue-400"
          label="Occupancy"
          value={`${kpis.occupancyRate}%`}
          sub={`${kpis.occupiedRooms} of ${kpis.totalRooms} rooms`}
          trend={kpis.occupancyRate > 0 ? 'up' : undefined}
        />
        <KpiCard
          icon="paid"
          iconBg="bg-green-50 dark:bg-green-900/20"
          iconText="text-green-600 dark:text-green-400"
          label="Today's Revenue"
          value={`${fmtCurrency(kpis.roomRevenue)} \u20AC`}
          sub={`ADR ${fmtCurrency(kpis.adr)} \u20AC`}
          trend={kpis.roomRevenue > 0 ? 'up' : undefined}
        />
        <KpiCard
          icon="login"
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          iconText="text-amber-600 dark:text-amber-400"
          label="Check-ins Today"
          value={String(movements.arrivals)}
          sub={`${movements.inHouse} in house`}
        />
        <KpiCard
          icon="logout"
          iconBg="bg-purple-50 dark:bg-purple-900/20"
          iconText="text-purple-600 dark:text-purple-400"
          label="Check-outs Today"
          value={String(movements.departures)}
          sub={outstanding.count > 0 ? `${outstanding.count} open folios` : 'All settled'}
        />
      </div>

      {/* ── Main Content: 2/3 + 1/3 layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* LEFT: Arrivals/Departures table */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center justify-between px-5 pt-4 pb-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMovementTab('arrivals')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  movementTab === 'arrivals'
                    ? 'border-primary text-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="material-icons text-lg">login</span>
                  Arrivals ({todayArrivals.length})
                </span>
              </button>
              <button
                onClick={() => setMovementTab('departures')}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  movementTab === 'departures'
                    ? 'border-primary text-primary bg-primary/5 dark:bg-primary/10'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="material-icons text-lg">logout</span>
                  Departures ({todayDepartures.length})
                </span>
              </button>
            </div>
            <Link
              href="/reservations"
              className="text-xs text-primary font-medium hover:underline hidden sm:inline"
            >
              View all
            </Link>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-white/5">
                <tr>
                  <th className="p-3 pl-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Guest
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Nights
                  </th>
                  <th className="p-3 pr-5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {currentList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center">
                      <span className="material-icons text-4xl text-slate-300 dark:text-slate-600 mb-2 block">
                        {movementTab === 'arrivals' ? 'flight_land' : 'flight_takeoff'}
                      </span>
                      <p className="text-sm text-slate-400">
                        No {movementTab} for today
                      </p>
                    </td>
                  </tr>
                ) : (
                  currentList.map((item) => {
                    const conf = getStatusConf(item.status);
                    const isCheckable =
                      (movementTab === 'arrivals' && item.status === 'confirmed') ||
                      (movementTab === 'departures' && item.status === 'checked_in');

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="p-3 pl-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(item.guestName)}`}
                            >
                              {item.guestInitials}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/reservations/${item.id}`}
                                className="text-sm font-semibold text-slate-900 dark:text-white truncate block hover:text-primary transition-colors"
                              >
                                {item.guestName}
                              </Link>
                              <span className="text-xs text-slate-400">{item.confirmationCode}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-sm font-medium text-slate-900 dark:text-white">
                            {item.unitName ?? '—'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {item.roomTypeName}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${conf.bg} ${conf.text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${conf.dot} mr-1`} />
                            {conf.label}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-slate-600 dark:text-slate-400 tabular-nums">
                            {item.nights}
                          </span>
                        </td>
                        <td className="p-3 pr-5 text-right">
                          {isCheckable ? (
                            <Link
                              href={`/reservations/${item.id}`}
                              className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors font-medium"
                            >
                              {movementTab === 'arrivals' ? 'Check In' : 'Check Out'}
                            </Link>
                          ) : (
                            <Link
                              href={`/reservations/${item.id}`}
                              className="text-xs text-primary font-medium hover:underline"
                            >
                              View
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Room Status Grid */}
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-icons text-slate-400 text-xl">bedroom_parent</span>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Room Status</h2>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <RoomStat label="Occupied" value={occupiedCount} color="text-green-600 dark:text-green-400" />
            <RoomStat label="Available" value={availableCount} color="text-blue-600 dark:text-blue-400" />
            <RoomStat label="Dirty" value={dirtyCount} color="text-amber-600 dark:text-amber-400" />
            <RoomStat label="Maint." value={maintenanceCount} color="text-red-600 dark:text-red-400" />
          </div>

          {/* Visual grid */}
          <div className="grid grid-cols-5 gap-1.5 mb-4">
            {roomGrid.map((room) => {
              let bgClass = 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'; // available
              if (room.status === 'maintenance') {
                bgClass = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
              } else if (room.isOccupied) {
                bgClass = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
              } else if (room.housekeepingStatus === 'dirty') {
                bgClass = 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
              }

              return (
                <div
                  key={room.id}
                  className={`p-1.5 rounded-lg border text-center text-[10px] font-bold leading-tight ${bgClass}`}
                  title={`${room.name} - ${room.roomTypeName} (${room.isOccupied ? 'Occupied' : room.status === 'maintenance' ? 'Maintenance' : room.housekeepingStatus === 'dirty' ? 'Dirty' : 'Available'})`}
                >
                  {room.name}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[10px]">
            <LegendDot color="bg-green-500" label="Occupied" />
            <LegendDot color="bg-blue-500" label="Available" />
            <LegendDot color="bg-amber-500" label="Dirty" />
            <LegendDot color="bg-red-500" label="Maintenance" />
          </div>
        </div>
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* 30-day trend */}
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

          <div className="h-[260px]">
            <ClientOnly fallback={<div className="h-full w-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700" />}>
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
                      tickFormatter={(v: number) => `${v} \u20AC`}
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
                      formatter={(value: number | undefined) => [`${fmtCurrency(value ?? 0)} \u20AC`, 'Revenue']}
                      labelFormatter={(label) => fmtChartDate(String(label ?? ''))}
                    />
                    <Bar dataKey="revenue" fill="#137fec" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </ClientOnly>
          </div>
        </div>

        {/* Right column: HK + Sources */}
        <div className="space-y-6">
          {/* Housekeeping summary */}
          <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-icons text-slate-400 text-xl">cleaning_services</span>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Housekeeping
                </h2>
              </div>
              <Link href="/housekeeping" className="text-xs text-primary font-medium hover:underline">
                View board
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <HkStat label="Pending" value={hkSummary.pending} color="text-amber-600 dark:text-amber-400" />
              <HkStat label="In Progress" value={hkSummary.inProgress} color="text-blue-600 dark:text-blue-400" />
              <HkStat label="Completed" value={hkSummary.completed} color="text-green-600 dark:text-green-400" />
              <HkStat label="Total" value={hkSummary.total} color="text-slate-900 dark:text-white" />
            </div>
            {hkSummary.total > 0 && (
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
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
            <div className="flex items-center gap-2 mb-3">
              <span className="material-icons text-slate-400 text-xl">bar_chart</span>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Revenue by Source
              </h2>
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mb-3 tabular-nums">
              {fmtCurrency(totalRevenue30d)} {'\u20AC'}
            </div>
            <div className="space-y-2">
              {revenueBySource
                .sort((a, b) => b.total - a.total)
                .map((r) => (
                  <div
                    key={r.source}
                    className="flex items-center justify-between py-1"
                  >
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {SOURCE_LABELS[r.source] ?? r.source}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{r.count}</span>
                      <span className="text-xs font-medium text-slate-900 dark:text-white tabular-nums">
                        {fmtCurrency(r.total)} {'\u20AC'}
                      </span>
                    </div>
                  </div>
                ))}
              {revenueBySource.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">No data</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions (mobile) ── */}
      <div className="sm:hidden bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/reservations?action=new"
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <span className="material-icons text-lg">add</span>
            New Booking
          </Link>
          <Link
            href="/calendar"
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-icons text-lg">calendar_today</span>
            Calendar
          </Link>
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
  trend,
}: {
  icon: string;
  iconBg: string;
  iconText: string;
  label: string;
  value: string;
  sub: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="bg-white dark:bg-[#1a2632] p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${iconBg} ${iconText}`}>
        <span className="material-icons">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums truncate">
            {value}
          </p>
          {trend && (
            <span className={`material-icons text-sm ${trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
              {trend === 'up' ? 'trending_up' : 'trending_down'}
            </span>
          )}
        </div>
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

// ── Room Stat ──

function RoomStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="text-center">
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

// ── Legend Dot ──

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}
