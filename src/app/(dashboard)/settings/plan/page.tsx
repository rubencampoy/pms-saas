import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { organizationRepo } from '@/server/repositories/organization.repo';
import { propertyRepo } from '@/server/repositories/property.repo';

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  starter: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  professional: 'bg-primary/10 text-primary',
  enterprise: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
};

export default async function PlanSettingsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const orgId = session.user.organizationId;
  const [org, usage, propertiesList] = await Promise.all([
    organizationRepo.findById(orgId),
    organizationRepo.getUsage(orgId),
    propertyRepo.findWithStatsByOrg(orgId),
  ]);

  if (!org) redirect('/');

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Plan y uso</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Estado de tu cuenta y consumo por propiedad. Para ampliar contacta con HotelOS.
        </p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <UsageCard label="Propiedades" icon="apartment" used={usage.properties} max={org.maxProperties} />
        <UsageCard
          label="Usuarios"
          icon="group"
          used={usage.users}
          max={org.maxUsers}
          help="Incluye miembros activos + invitaciones pendientes."
        />
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
          Propiedades y planes
        </h2>
        {propertiesList.length === 0 ? (
          <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 text-center text-sm text-slate-500">
            Aún no tienes propiedades. Contacta con HotelOS para añadir tu primera propiedad.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {propertiesList.map((p) => {
              const pct = p.maxUnits > 0 ? Math.min(100, Math.round((p.unitCount / p.maxUnits) * 100)) : 0;
              const atLimit = p.unitCount >= p.maxUnits;
              const nearLimit = !atLimit && pct >= 80;
              const barColor = atLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-primary';

              return (
                <div
                  key={p.id}
                  className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.name}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{p.code}</p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_BADGE[p.plan] ?? PLAN_BADGE.free}`}>
                      {PLAN_LABELS[p.plan] ?? p.plan}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-slate-900 dark:text-white">{p.unitCount}</span>
                    <span className="text-xs text-slate-400">de {p.maxUnits} habitaciones</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  {atLimit && (
                    <p className="text-xs text-red-700 dark:text-red-400">
                      Esta propiedad ha alcanzado el límite. Contacta para ampliar.
                    </p>
                  )}
                  {nearLimit && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Cerca del límite.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
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

  return (
    <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 space-y-3">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <span className="material-icons text-[20px]">{icon}</span>
        <span className="text-xs uppercase tracking-wider font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-slate-900 dark:text-white">{used}</span>
        <span className="text-sm text-slate-400">de {max}</span>
      </div>
      <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {atLimit && (
        <p className="text-xs text-red-700 dark:text-red-400 font-medium">
          Has alcanzado el límite. Contacta para ampliar.
        </p>
      )}
      {help && !atLimit && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{help}</p>
      )}
    </div>
  );
}
