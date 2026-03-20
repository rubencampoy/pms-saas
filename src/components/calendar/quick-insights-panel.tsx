'use client';

import { useMemo, useState } from 'react';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import { ClientOnly } from '@/components/ui/client-only';

interface Reservation {
  id: string;
  guestId: string;
  roomTypeId: string;
  unitId: string | null;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  confirmationCode: string;
  nights: number;
  adults: number;
  children: number;
  totalAmount: string;
  source: string;
  specialRequests: string | null;
  internalNotes: string | null;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  vipStatus: string;
}

interface Unit {
  id: string;
  roomTypeId: string;
  name: string;
  floor: string | null;
  housekeepingStatus: string;
}

interface QuickInsightsPanelProps {
  reservations: Reservation[];
  guestMap: Map<string, Guest>;
  units: Unit[];
}

export function QuickInsightsPanel({
  reservations,
  guestMap,
  units,
}: QuickInsightsPanelProps) {
  const t = useTranslations('calendarInsights');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Occupancy computation
  const { occupiedCount, totalUnits, occupancyPct } = useMemo(() => {
    const total = units.length;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const occupied = new Set<string>();

    for (const r of reservations) {
      if (r.status === 'checked_in' && r.unitId && r.checkInDate <= todayStr && r.checkOutDate > todayStr) {
        occupied.add(r.unitId);
      }
    }

    const count = occupied.size;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return { occupiedCount: count, totalUnits: total, occupancyPct: pct };
  }, [reservations, units]);

  // Arriving soon (today + tomorrow, confirmed)
  const arrivingSoon = useMemo(() => {
    return reservations
      .filter((r) => {
        if (r.status !== 'confirmed') return false;
        const checkIn = parseISO(r.checkInDate);
        return isToday(checkIn) || isTomorrow(checkIn);
      })
      .slice(0, 5);
  }, [reservations]);

  // RevPAR computation
  const revpar = useMemo(() => {
    if (units.length === 0) return 0;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let totalRevenue = 0;

    for (const r of reservations) {
      if (r.status === 'checked_in' && r.checkInDate <= todayStr && r.checkOutDate > todayStr && r.nights > 0) {
        totalRevenue += Number(r.totalAmount) / r.nights;
      }
    }

    return totalRevenue / units.length;
  }, [reservations, units]);

  // Donut chart data
  const donutData = useMemo(() => [
    { name: 'Occupied', value: occupiedCount },
    { name: 'Available', value: Math.max(0, totalUnits - occupiedCount) },
  ], [occupiedCount, totalUnits]);

  const DONUT_COLORS = ['#137fec', '#e2e8f0'];
  const DONUT_COLORS_DARK = ['#137fec', '#334155'];

  if (isCollapsed) {
    return (
      <div className="flex-shrink-0 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2632]">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          title={t('expand')}
        >
          <span className="material-icons text-xl">chevron_left</span>
        </button>
      </div>
    );
  }

  return (
    <div className="hidden lg:flex flex-col flex-shrink-0 w-72 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2632] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('title')}</h3>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <span className="material-icons text-lg">chevron_right</span>
        </button>
      </div>

      {/* Occupancy Donut */}
      <div className="px-4 py-3">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          {t('occupancy')}
        </p>
        <div className="relative flex items-center justify-center" style={{ height: 140 }}>
          <ClientOnly fallback={<div className="h-[140px] w-full animate-pulse rounded-full bg-slate-100 dark:bg-slate-700" />}>
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {donutData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={DONUT_COLORS[index]}
                      className="dark:hidden"
                    />
                  ))}
                </Pie>
                {/* Dark mode pie — separate render */}
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                  className="hidden dark:block"
                >
                  {donutData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={DONUT_COLORS_DARK[index]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </ClientOnly>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{occupancyPct}%</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {occupiedCount}/{totalUnits}
            </span>
          </div>
        </div>
      </div>

      {/* RevPAR */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
          {t('revpar')}
        </p>
        <p className="text-xl font-bold text-slate-900 dark:text-white">
          {revpar.toFixed(2)} &euro;
        </p>
        <p className="text-[10px] text-slate-400">{t('revparDesc')}</p>
      </div>

      {/* Arriving Soon */}
      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex-1">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
          {t('arrivingSoon')}
        </p>
        {arrivingSoon.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500">{t('noArrivals')}</p>
        ) : (
          <div className="space-y-2">
            {arrivingSoon.map((r) => {
              const guest = guestMap.get(r.guestId);
              const initials = guest
                ? `${guest.firstName.charAt(0)}${guest.lastName.charAt(0)}`
                : '??';
              const name = guest ? `${guest.firstName} ${guest.lastName}` : r.confirmationCode;
              const isVip = guest?.vipStatus === 'vip';
              const checkIn = parseISO(r.checkInDate);
              const isArrToday = isToday(checkIn);

              return (
                <div key={r.id} className="flex items-center gap-2.5">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-slate-900 dark:text-white truncate">
                        {name}
                      </span>
                      {isVip && (
                        <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1 rounded">
                          VIP
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {isArrToday ? t('today') : t('tomorrow')} &middot; {r.confirmationCode}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
