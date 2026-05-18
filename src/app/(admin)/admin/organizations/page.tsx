import Link from 'next/link';
import { organizationRepo } from '@/server/repositories/organization.repo';

export default async function AdminOrganizationsPage() {
  const orgs = await organizationRepo.findAllWithStats();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Organizaciones</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {orgs.length} {orgs.length === 1 ? 'organización' : 'organizaciones'} en la plataforma
          </p>
        </div>
        <Link
          href="/admin/organizations/new"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
        >
          <span className="material-icons text-lg">add</span>
          Nueva organización
        </Link>
      </div>

      <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Organización
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Estado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Propiedades
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Miembros
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Pendientes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Creada
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {orgs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                  Aún no hay organizaciones. Crea la primera.
                </td>
              </tr>
            )}
            {orgs.map((org) => (
              <tr key={org.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-6 py-3">
                  <Link href={`/admin/organizations/${org.id}`} className="block group">
                    <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-primary">
                      {org.name}
                    </p>
                    <p className="text-xs text-slate-500">{org.slug}</p>
                  </Link>
                </td>
                <td className="px-6 py-3 text-sm">
                  <StatusBadge status={org.status} />
                </td>
                <td className="px-6 py-3 text-sm text-slate-700 dark:text-slate-300">
                  {org.propertyCount} <span className="text-slate-400 text-xs">de {org.maxProperties}</span>
                </td>
                <td className="px-6 py-3 text-sm text-slate-700 dark:text-slate-300">
                  {org.memberCount} <span className="text-slate-400 text-xs">de {org.maxUsers}</span>
                </td>
                <td className="px-6 py-3 text-sm text-slate-700 dark:text-slate-300">
                  {org.pendingInviteCount > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {org.pendingInviteCount}
                    </span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="px-6 py-3 text-sm text-slate-500">
                  {new Date(org.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
        <span className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400" />
        Suspendida
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
      Activa
    </span>
  );
}
