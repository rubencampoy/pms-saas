import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { organizationRepo } from '@/server/repositories/organization.repo';

export default async function PlanSettingsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;
  const [org, usage] = await Promise.all([
    organizationRepo.findById(orgId),
    organizationRepo.getUsage(orgId),
  ]);

  if (!org) redirect('/');

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Plan y uso</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Estado de tu suscripción y consumo actual.
        </p>
      </div>

      <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Tu plan</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
            {org.plan}
          </span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Para ampliar tus límites o cambiar de plan, contacta con HotelOS.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UsageCard
          label="Propiedades"
          icon="apartment"
          used={usage.properties}
          max={org.maxProperties}
        />
        <UsageCard
          label="Habitaciones"
          icon="bed"
          used={usage.units}
          max={org.maxUnits}
        />
        <UsageCard
          label="Usuarios"
          icon="group"
          used={usage.users}
          max={org.maxUsers}
          help="Incluye miembros activos + invitaciones pendientes."
        />
      </section>
    </div>
  );
}

function UsageCard({
  label,
  icon,
  used,
  max,
  help,
}: {
  label: string;
  icon: string;
  used: number;
  max: number;
  help?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const atLimit = used >= max;
  const nearLimit = !atLimit && pct >= 80;
  const barColor = atLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-primary';
  const textColor = atLimit
    ? 'text-red-700 dark:text-red-400'
    : nearLimit
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-slate-900 dark:text-white';

  return (
    <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 space-y-3">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <span className="material-icons text-[20px]">{icon}</span>
        <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold ${textColor}`}>{used}</span>
        <span className="text-sm text-slate-400">de {max}</span>
      </div>
      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {atLimit && (
        <p className="text-xs text-red-700 dark:text-red-400 font-medium">
          Has alcanzado el límite. Contacta para ampliar.
        </p>
      )}
      {nearLimit && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Te estás acercando al límite.
        </p>
      )}
      {help && !atLimit && !nearLimit && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{help}</p>
      )}
    </div>
  );
}
