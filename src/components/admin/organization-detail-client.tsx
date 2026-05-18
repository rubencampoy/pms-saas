'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateOrganizationLimitsAction,
  suspendOrganizationAction,
  reactivateOrganizationAction,
} from '@/server/actions/admin-organizations';
import { revokeInvitationAction } from '@/server/actions/invitations';
import { ORG_PLANS, type OrgPlan } from '@/lib/validators/admin';

interface Organization {
  id: string;
  name: string;
  plan: string;
  status: string;
  maxProperties: number;
  maxUnits: number;
  maxUsers: number;
  suspendedAt: string | null;
  suspendedReason: string | null;
}

interface Usage {
  properties: number;
  units: number;
  users: number;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
}

interface Props {
  organization: Organization;
  usage: Usage;
  pendingInvitations: PendingInvitation[];
}

export function OrganizationDetailClient({ organization, usage, pendingInvitations }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [plan, setPlan] = useState<OrgPlan>(organization.plan as OrgPlan);
  const [maxProperties, setMaxProperties] = useState(organization.maxProperties);
  const [maxUnits, setMaxUnits] = useState(organization.maxUnits);
  const [maxUsers, setMaxUsers] = useState(organization.maxUsers);
  const [error, setError] = useState<string | null>(null);
  const [showSuspend, setShowSuspend] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function copyInviteLink(token: string) {
    const url = `${baseUrl}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
    });
  }

  function handleRevokeInvite(id: string, email: string) {
    if (!confirm(`¿Revocar la invitación de ${email}? El link dejará de funcionar.`)) return;
    startTransition(async () => {
      const result = await revokeInvitationAction(id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleSaveLimits(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateOrganizationLimitsAction({
        organizationId: organization.id,
        plan,
        maxProperties,
        maxUnits,
        maxUsers,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function handleSuspend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await suspendOrganizationAction({
        organizationId: organization.id,
        reason: suspendReason.trim(),
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setShowSuspend(false);
      setSuspendReason('');
      router.refresh();
    });
  }

  function handleReactivate() {
    if (!confirm('¿Reactivar esta organización? Los usuarios podrán volver a entrar.')) return;
    startTransition(async () => {
      const result = await reactivateOrganizationAction(organization.id);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {organization.status === 'suspended' && (
        <section className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-200">
                Organización suspendida
              </h3>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                Suspendida el {organization.suspendedAt && new Date(organization.suspendedAt).toLocaleString()}.
                {organization.suspendedReason && (
                  <> Motivo: <em>{organization.suspendedReason}</em></>
                )}
              </p>
              <p className="mt-2 text-xs text-red-700 dark:text-red-300">
                Los miembros no pueden hacer login. Los datos quedan intactos.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReactivate}
              disabled={isPending}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              Reactivar
            </button>
          </div>
        </section>
      )}

      {/* Plan & limits */}
      <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Plan y límites</h2>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-primary hover:underline"
            >
              Editar
            </button>
          )}
        </div>

        {!editing ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Plan" value={organization.plan} capitalize />
            <UsageStat label="Propiedades" used={usage.properties} max={organization.maxProperties} />
            <UsageStat label="Habitaciones" used={usage.units} max={organization.maxUnits} />
            <UsageStat label="Usuarios" used={usage.users} max={organization.maxUsers} />
          </div>
        ) : (
          <form onSubmit={handleSaveLimits} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                id="plan"
                label="Plan"
                value={plan}
                onChange={(v) => setPlan(v as OrgPlan)}
                options={ORG_PLANS.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))}
              />
              <NumberField id="maxProperties" label="Máx. propiedades" value={maxProperties} onChange={setMaxProperties} />
              <NumberField id="maxUnits" label="Máx. habitaciones" value={maxUnits} onChange={setMaxUnits} />
              <NumberField id="maxUsers" label="Máx. usuarios" value={maxUsers} onChange={setMaxUsers} />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setPlan(organization.plan as OrgPlan);
                  setMaxProperties(organization.maxProperties);
                  setMaxUnits(organization.maxUnits);
                  setMaxUsers(organization.maxUsers);
                  setError(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
            Invitaciones pendientes
          </h2>
          <ul className="space-y-3">
            {pendingInvitations.map((inv) => (
              <li
                key={inv.id}
                className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0 last:pb-0"
              >
                <div>
                  <strong className="text-slate-900 dark:text-white">{inv.email}</strong>
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 capitalize">
                    {inv.role}
                  </span>
                  <span className="ml-2 text-slate-400">
                    caduca {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => copyInviteLink(inv.token)}
                    className="text-xs text-primary hover:underline"
                  >
                    {copiedToken === inv.token ? '✓ Copiado' : 'Copiar link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevokeInvite(inv.id, inv.email)}
                    disabled={isPending}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    Revocar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Danger zone */}
      {organization.status === 'active' && (
        <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-red-200 dark:border-red-900/50 p-6">
          <h2 className="text-base font-semibold text-red-700 dark:text-red-400 mb-2">Zona peligrosa</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Al suspender, los miembros no podrán hacer login. Los datos quedan intactos y puedes reactivar en cualquier momento.
          </p>

          {!showSuspend ? (
            <button
              type="button"
              onClick={() => setShowSuspend(true)}
              className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Suspender organización
            </button>
          ) : (
            <form onSubmit={handleSuspend} className="space-y-3">
              <div>
                <label htmlFor="suspendReason" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Motivo (visible internamente)
                </label>
                <input
                  id="suspendReason"
                  required
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  placeholder="Impago factura abril"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowSuspend(false);
                    setSuspendReason('');
                    setError(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending || !suspendReason.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? 'Suspendiendo…' : 'Confirmar suspensión'}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, capitalize }: { label: string; value: string | number; capitalize?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-sm font-semibold text-slate-900 dark:text-white ${capitalize ? 'capitalize' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function UsageStat({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const color =
    used >= max ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary';
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
        {used} <span className="text-slate-400 text-xs font-normal">de {max}</span>
      </p>
      <div className="mt-1.5 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
      />
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
