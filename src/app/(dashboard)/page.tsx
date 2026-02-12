import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Bienvenido, {session.user.name}. Rol: {session.user.role}.
      </p>
    </div>
  );
}
