import { redirect } from 'next/navigation';
import { auth, signOut } from '@/lib/auth';
import { evaluateIpAccess } from '@/lib/security/ip-guard';

export const metadata = {
  title: 'Acceso restringido · HotelOS',
};

export default async function AccessDeniedPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const orgId = session.user.organizationId;

  // If access is actually fine (super admin, no org, or IP now allowed),
  // don't strand the user here.
  if (session.user.isSuperAdmin || !orgId) redirect('/');

  const access = await evaluateIpAccess(orgId);
  if (!access.restricted || access.allowed) redirect('/');

  async function logout() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-light dark:bg-background-dark p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a2632] p-8 shadow-sm text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <span className="material-icons text-3xl">gpp_bad</span>
        </div>

        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Acceso restringido por IP
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Tu organización solo permite el acceso al panel desde redes
          autorizadas. Tu dirección IP actual no está en la lista de IPs
          permitidas.
        </p>

        <div className="mt-5 rounded-lg bg-slate-50 dark:bg-slate-900/50 px-4 py-3 border border-slate-200 dark:border-slate-800">
          <p className="text-xs uppercase tracking-wider text-slate-400">
            Tu IP pública
          </p>
          <p className="mt-1 font-mono text-base font-semibold text-slate-900 dark:text-white">
            {access.clientIp ?? 'desconocida'}
          </p>
        </div>

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Facilita esta dirección a un administrador para que la añada en
          <span className="font-medium"> Configuración → Seguridad</span>.
        </p>

        <form action={logout} className="mt-6">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-icons text-lg">logout</span>
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}
