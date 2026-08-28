'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useTranslations } from 'next-intl';

interface GuestSelectorProps {
  adults: number;
  childrenCount: number;
  onAdultsChange: (v: number) => void;
  onChildrenChange: (v: number) => void;
  guestFilter: string;
  labelGuests: string;
  labelAdults: string;
  labelChildren: string;
}

export function GuestSelector({
  adults,
  childrenCount,
  onAdultsChange,
  onChildrenChange,
  guestFilter,
  labelGuests,
  labelAdults,
  labelChildren,
}: GuestSelectorProps) {
  const [open, setOpen] = useState(false);
  // El total lo cuenta el navegador, así que el plural no puede venir ya
  // resuelto en las props: hace falta el mensaje ICU aquí.
  const t = useTranslations('bookingEnginePublic');

  if (guestFilter === 'none') return null;

  const total = adults + childrenCount;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm hover:border-slate-400 dark:hover:border-slate-600 transition-colors min-w-[140px]"
        >
          <span className="material-icons text-slate-400 text-lg">people</span>
          <div className="text-left">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {labelGuests}
            </div>
            <div className="font-medium text-slate-900 dark:text-white">
              {t('guestCount', { count: total })}
            </div>
          </div>
          <span className="material-icons text-slate-400 text-sm ml-auto">expand_more</span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 bg-white dark:bg-[#1a2632] rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 w-60"
          sideOffset={8}
          align="start"
        >
          <div className="space-y-4">
            {/* Adults */}
            <CounterRow
              label={labelAdults}
              value={adults}
              min={1}
              max={20}
              onChange={onAdultsChange}
            />

            {/* Children */}
            {guestFilter !== 'none' && (
              <CounterRow
                label={labelChildren}
                value={childrenCount}
                min={0}
                max={20}
                onChange={onChildrenChange}
              />
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function CounterRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-icons text-sm">remove</span>
        </button>
        <span className="w-6 text-center text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
          {value}
        </span>
        <button
          type="button"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-icons text-sm">add</span>
        </button>
      </div>
    </div>
  );
}
