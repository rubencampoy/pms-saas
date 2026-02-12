import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="flex h-screen">
      {/* Sidebar placeholder — will be built in Phase 4 */}
      <aside className="hidden lg:flex lg:w-64 flex-col bg-[#0a1118] border-r border-slate-800">
        <div className="flex items-center gap-3 h-16 px-6 border-b border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-sm">
            H
          </div>
          <span className="text-lg font-bold text-white">HotelOS</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <a
            href="/"
            className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-primary/10 text-primary"
          >
            <span className="material-icons text-[20px]">dashboard</span>
            Dashboard
          </a>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-slate-700 ring-2 ring-slate-600 flex items-center justify-center text-white text-xs font-bold">
              {session.user.name?.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{session.user.name}</p>
              <p className="text-xs text-slate-500 truncate">{session.user.role}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
        {children}
      </main>
    </div>
  );
}
