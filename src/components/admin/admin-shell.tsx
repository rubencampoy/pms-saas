'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ChamelioLogo } from '@/components/shared/chamelio-logo';
import { logoutAction } from '@/server/actions/auth';

const NAV = [
  { label: 'Organizaciones', href: '/admin/organizations', icon: 'business' },
] as const;

export function AdminShell({
  userName,
  userEmail,
  children,
}: {
  userName: string;
  userEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await logoutAction();
      router.push('/login');
    });
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <header className="bg-[#0a1118] border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2">
              <ChamelioLogo className="h-7 w-7" />
              <span className="text-sm font-bold text-white">Chamelio PMS</span>
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider ml-1">
                Plataforma
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              {NAV.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      active ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="material-icons text-[18px]">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              title="Volver al PMS"
            >
              <span className="material-icons text-[16px]">arrow_back</span>
              PMS
            </Link>
            <div className="h-5 w-px bg-slate-700" />
            <div className="text-right">
              <p className="text-xs font-medium text-white">{userName}</p>
              <p className="text-[10px] text-slate-500">{userEmail}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isPending}
              className="text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
              title="Logout"
            >
              <span className="material-icons text-[20px]">logout</span>
            </button>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
