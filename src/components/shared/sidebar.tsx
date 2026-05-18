'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useTransition, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { setLocale } from '@/server/actions/locale';
import { logoutAction } from '@/server/actions/auth';
import { HotelOSLogo } from '@/components/shared/hotel-os-logo';
import { switchProperty } from '@/server/actions/property-switch';
import { OrgSwitcher, type OrgMembership } from '@/components/shared/org-switcher';
import type { Locale } from '@/i18n/request';

interface Property {
  id: string;
  name: string;
  code: string;
}

interface SidebarProps {
  userName: string;
  userRole: string;
  properties: Property[];
  activePropertyId: string;
  memberships: OrgMembership[];
  activeOrganizationId: string;
  isSuperAdmin: boolean;
}

const NAV_ITEMS = [
  { labelKey: 'dashboard', icon: 'grid_view', href: '/' },
  { labelKey: 'frontDesk', icon: 'room_service', href: '/calendar' },
  { labelKey: 'bookings', icon: 'calendar_month', href: '/reservations' },
  { labelKey: 'housekeeping', icon: 'cleaning_services', href: '/housekeeping' },
  { labelKey: 'guests', icon: 'people', href: '/guests' },
  { labelKey: 'analytics', icon: 'leaderboard', href: '/reports' },
  { labelKey: 'settings', icon: 'settings', href: '/settings' },
] as const;

/** CSS class for nav icons — uses the Outlined variant loaded in layout.tsx */
const NAV_ICON_CLASS = 'material-icons-outlined';

const STORAGE_KEY = 'hotelos-sidebar-collapsed';

export function Sidebar({
  userName,
  userRole,
  properties,
  activePropertyId,
  memberships,
  activeOrganizationId,
  isSuperAdmin,
}: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [propertyDropdownOpen, setPropertyDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('nav');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const activeProperty = properties.find((p) => p.id === activePropertyId) ?? properties[0];
  const hasMultipleProperties = properties.length > 1;

  // Load collapsed state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      router.push('/login');
    });
  }

  function handlePropertySwitch(propertyId: string) {
    setPropertyDropdownOpen(false);
    if (propertyId === activePropertyId) return;
    startTransition(async () => {
      await switchProperty(propertyId);
    });
  }

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setPropertyDropdownOpen(false);
      }
    }
    if (propertyDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [propertyDropdownOpen]);

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  function handleLocaleSwitch() {
    const next: Locale = locale === 'es' ? 'en' : 'es';
    startTransition(() => {
      setLocale(next);
    });
  }

  /* ── Property switcher dropdown ─────────────── */
  const propertySwitcher = (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => {
          if (hasMultipleProperties) setPropertyDropdownOpen((prev) => !prev);
        }}
        className={`w-full flex items-center gap-2 px-5 py-2.5 transition-colors ${
          hasMultipleProperties
            ? 'hover:bg-slate-800/50 cursor-pointer'
            : 'cursor-default'
        }`}
      >
        <span className="material-icons text-[18px] text-slate-500">apartment</span>
        <span className="flex-1 min-w-0 text-left text-[13px] font-medium text-slate-300 truncate">
          {activeProperty?.name ?? 'Select property'}
        </span>
        {hasMultipleProperties && (
          <span className={`material-icons text-[18px] text-slate-500 transition-transform ${propertyDropdownOpen ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        )}
      </button>

      {/* Dropdown */}
      {propertyDropdownOpen && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg bg-slate-800 border border-slate-700 shadow-xl overflow-hidden">
          {properties.map((property) => (
            <button
              key={property.id}
              onClick={() => handlePropertySwitch(property.id)}
              disabled={isPending}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                property.id === activePropertyId
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <div className={`flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold flex-shrink-0 ${
                property.id === activePropertyId
                  ? 'bg-primary text-white'
                  : 'bg-slate-600 text-slate-300'
              }`}>
                {property.code?.charAt(0).toUpperCase() ?? 'P'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{property.name}</p>
                <p className="text-[11px] text-slate-500 uppercase tracking-wider">{property.code}</p>
              </div>
              {property.id === activePropertyId && (
                <span className="material-icons text-[16px] text-primary">check</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  /* ── Full sidebar content (mobile + desktop expanded) ── */
  const fullNavContent = (
    <>
      {/* Logo + property switcher */}
      <div className="border-b border-slate-800">
        <div className="flex items-center justify-between h-16 px-5">
          <div className="flex items-center gap-3">
            <HotelOSLogo className="h-8 w-8" />
            <span className="text-lg font-bold text-white">HotelOS</span>
          </div>
          {/* Close button (mobile only) */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Org switcher (above property switcher) */}
        <OrgSwitcher memberships={memberships} activeOrganizationId={activeOrganizationId} />

        {/* Property switcher */}
        {propertySwitcher}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span
                className={`${NAV_ICON_CLASS} text-[20px] ${
                  active
                    ? 'text-primary'
                    : 'text-slate-500 group-hover:text-white'
                }`}
              >
                {item.icon}
              </span>
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-slate-800">
        {/* Platform admin link (super admins only) */}
        {isSuperAdmin && (
          <Link
            href="/admin"
            className="w-full flex items-center gap-3 px-6 py-3 text-xs text-amber-400 hover:bg-slate-800 hover:text-amber-300 transition-colors"
          >
            <span className="material-icons text-[18px]">admin_panel_settings</span>
            <span>Plataforma</span>
          </Link>
        )}

        {/* Language switcher */}
        <button
          onClick={handleLocaleSwitch}
          disabled={isPending}
          className="w-full flex items-center gap-3 px-6 py-3 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors disabled:opacity-50"
        >
          <span className="material-icons text-[18px]">translate</span>
          <span>{locale === 'es' ? 'English' : 'Español'}</span>
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={isPending}
          className="w-full flex items-center gap-3 px-6 py-3 text-xs text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          <span className="material-icons text-[18px]">logout</span>
          <span>Logout</span>
        </button>

        {/* User section */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-700 ring-2 ring-slate-600 flex items-center justify-center text-white text-xs font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{userRole.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile header bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-[#0a1118] border-b border-slate-800 flex items-center justify-between px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <span className="material-icons">menu</span>
        </button>
        <div className="flex items-center gap-2">
          <HotelOSLogo className="h-7 w-7" />
          <span className="text-sm font-bold text-white truncate max-w-[200px]">
            {activeProperty?.name ?? 'HotelOS'}
          </span>
        </div>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-72 flex flex-col bg-[#0a1118] border-r border-slate-800 transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {fullNavContent}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-[#0a1118] border-r border-slate-800 transition-all duration-300 ease-in-out ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {collapsed ? (
          <>
            {/* Collapsed: logo / expand button */}
            <div className="flex items-center justify-center h-16 border-b border-slate-800">
              <button
                onClick={toggleCollapsed}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-800 transition-colors"
                title="Expand sidebar"
              >
                <HotelOSLogo className="h-8 w-8" />
              </button>
            </div>

            {/* Collapsed nav */}
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={t(item.labelKey)}
                    className={`group flex items-center justify-center rounded-lg py-2.5 transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span
                      className={`${NAV_ICON_CLASS} text-[20px] ${
                        active
                          ? 'text-primary'
                          : 'text-slate-500 group-hover:text-white'
                      }`}
                    >
                      {item.icon}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* Collapsed bottom */}
            <div className="border-t border-slate-800">
              {isSuperAdmin && (
                <Link
                  href="/admin"
                  title="Plataforma"
                  className="w-full flex justify-center py-3 text-amber-400 hover:bg-slate-800 hover:text-amber-300 transition-colors"
                >
                  <span className="material-icons text-[18px]">admin_panel_settings</span>
                </Link>
              )}
              <button
                onClick={handleLocaleSwitch}
                disabled={isPending}
                title={locale === 'es' ? 'English' : 'Español'}
                className="w-full flex justify-center py-3 text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors disabled:opacity-50"
              >
                <span className="material-icons text-[18px]">translate</span>
              </button>
              <button
                onClick={handleLogout}
                disabled={isPending}
                title="Logout"
                className="w-full flex justify-center py-3 text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <span className="material-icons text-[18px]">logout</span>
              </button>
              <div className="p-3 border-t border-slate-800 flex justify-center">
                <div className="h-9 w-9 rounded-full bg-slate-700 ring-2 ring-slate-600 flex items-center justify-center text-white text-xs font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Expanded header: logo + property switcher */}
            <div className="border-b border-slate-800">
              <div className="flex items-center justify-between h-16 px-5">
                <div className="flex items-center gap-3">
                  <HotelOSLogo className="h-8 w-8" />
                  <span className="text-lg font-bold text-white">HotelOS</span>
                </div>
                <button
                  onClick={toggleCollapsed}
                  className="p-1 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition-colors"
                  title="Collapse sidebar"
                >
                  <span className="material-icons text-[18px]">chevron_left</span>
                </button>
              </div>

              {/* Property switcher */}
              {propertySwitcher}
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span
                      className={`${NAV_ICON_CLASS} text-[20px] ${
                        active
                          ? 'text-primary'
                          : 'text-slate-500 group-hover:text-white'
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="truncate">{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Bottom section */}
            <div className="border-t border-slate-800">
              {isSuperAdmin && (
                <Link
                  href="/admin"
                  className="w-full flex items-center gap-3 px-6 py-3 text-xs text-amber-400 hover:bg-slate-800 hover:text-amber-300 transition-colors"
                >
                  <span className="material-icons text-[18px]">admin_panel_settings</span>
                  <span>Plataforma</span>
                </Link>
              )}
              <button
                onClick={handleLocaleSwitch}
                disabled={isPending}
                className="w-full flex items-center gap-3 px-6 py-3 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors disabled:opacity-50"
              >
                <span className="material-icons text-[18px]">translate</span>
                <span>{locale === 'es' ? 'English' : 'Español'}</span>
              </button>
              <button
                onClick={handleLogout}
                disabled={isPending}
                className="w-full flex items-center gap-3 px-6 py-3 text-xs text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                <span className="material-icons text-[18px]">logout</span>
                <span>Logout</span>
              </button>
              <div className="p-4 border-t border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-slate-700 ring-2 ring-slate-600 flex items-center justify-center text-white text-xs font-bold">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{userName}</p>
                    <p className="text-xs text-slate-500 truncate capitalize">{userRole.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
