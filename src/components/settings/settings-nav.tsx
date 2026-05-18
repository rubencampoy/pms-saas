'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const SETTINGS_NAV = [
  { label: 'Room Types', href: '/settings/room-types', icon: 'bed', tKey: 'roomTypes' },
  { label: 'Rates', href: '/settings/rates', icon: 'paid', tKey: 'rates' },
  { label: 'Properties', href: '/settings/properties', icon: 'apartment', tKey: 'properties' },
  { label: 'Booking Engine', href: '/settings/booking-engine', icon: 'language', tKey: 'bookingEngine' },
  { label: 'Channels', href: '/settings/channels', icon: 'sync', tKey: 'channels' },
  { label: 'Team', href: '/settings/team', icon: 'group', tKey: 'team' },
  { label: 'Plan', href: '/settings/plan', icon: 'workspace_premium', tKey: 'plan' },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  const t = useTranslations('settings');

  return (
    <div className="flex items-center gap-1 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
      {SETTINGS_NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              active
                ? 'text-primary border-primary'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-transparent hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <span className={`material-icons text-lg ${active ? 'text-primary' : ''}`}>
              {item.icon}
            </span>
            {t(item.tKey)}
          </Link>
        );
      })}
    </div>
  );
}
