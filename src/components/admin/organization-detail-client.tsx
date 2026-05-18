'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateOrganizationLimitsAction,
  suspendOrganizationAction,
  reactivateOrganizationAction,
  createPropertyAsAdminAction,
  updatePropertyLimitsAction,
} from '@/server/actions/admin-organizations';
import { revokeInvitationAction } from '@/server/actions/invitations';
import { ORG_PLANS, type OrgPlan } from '@/lib/validators/admin';

interface Organization {
  id: string;
  name: string;
  status: string;
  maxProperties: number;
  maxUsers: number;
  suspendedAt: string | null;
  suspendedReason: string | null;
}

interface Property {
  id: string;
  name: string;
  code: string;
  plan: string;
  maxUnits: number;
  unitCount: number;
}

interface Usage {
  properties: number;
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
  properties: Property[];
  pendingInvitations: PendingInvitation[];
}

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

export function OrganizationDetailClient({
  organization,
  usage,
  properties,
  pendingInvitations,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Org limits editing
  const [editingOrg, setEditingOrg] = useState(false);
  const [maxProperties, setMaxProperties] = useState(organization.maxProperties);
  const [maxUsers, setMaxUsers] = useState(organization.maxUsers);

  // Suspend flow
  const [showSuspend, setShowSuspend] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  // Invitation copy
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function handleSaveOrgLimits(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateOrganizationLimitsAction({
        organizationId: organization.id,
        maxProperties,
        maxUsers,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditingOrg(false);
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

  function copyInviteLink(token: string) {
    const url = `${baseUrl}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
    });
  }

  function handleRevokeInvite(id: string, email: string) {
    if (!confirm(`¿Revocar la invitación de ${email}?`)) return;
    startTransition(async () => {
      const result = await revokeInvitationAction(id);
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

      {/* Org-level limits */}
      <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Límites de organización</h2>
          {!editingOrg && (
            <button
              type="button"
              onClick={() => setEditingOrg(true)}
              className="text-xs text-primary hover:underline"
            >
              Editar
            </button>
          )}
        </div>

        {!editingOrg ? (
          <div className="grid grid-cols-2 gap-4">
            <UsageStat label="Propiedades" used={usage.properties} max={organization.maxProperties} />
            <UsageStat label="Usuarios" used={usage.users} max={organization.maxUsers} />
          </div>
        ) : (
          <form onSubmit={handleSaveOrgLimits} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberField id="maxProperties" label="Máx. propiedades" value={maxProperties} onChange={setMaxProperties} />
              <NumberField id="maxUsers" label="Máx. usuarios" value={maxUsers} onChange={setMaxUsers} />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setEditingOrg(false);
                  setMaxProperties(organization.maxProperties);
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

      {/* Properties */}
      <PropertiesSection
        organizationId={organization.id}
        properties={properties}
        canCreate={usage.properties < organization.maxProperties}
        maxProperties={organization.maxProperties}
        onError={setError}
      />

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

function PropertiesSection({
  organizationId,
  properties,
  canCreate,
  maxProperties,
  onError,
}: {
  organizationId: string;
  properties: Property[];
  canCreate: boolean;
  maxProperties: number;
  onError: (msg: string | null) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newPlan, setNewPlan] = useState<OrgPlan>('starter');
  const [newMaxUnits, setNewMaxUnits] = useState(25);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPlan, setEditPlan] = useState<OrgPlan>('free');
  const [editMaxUnits, setEditMaxUnits] = useState(10);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onError(null);
    startTransition(async () => {
      const result = await createPropertyAsAdminAction({
        organizationId,
        name: newName.trim(),
        code: newCode.trim(),
        plan: newPlan,
        maxUnits: newMaxUnits,
      });
      if (!result.success) {
        onError(result.error);
        return;
      }
      setAdding(false);
      setNewName('');
      setNewCode('');
      setNewPlan('starter');
      setNewMaxUnits(25);
      router.refresh();
    });
  }

  function startEdit(p: Property) {
    setEditingId(p.id);
    setEditPlan(p.plan as OrgPlan);
    setEditMaxUnits(p.maxUnits);
  }

  function handleSaveEdit(propertyId: string) {
    onError(null);
    startTransition(async () => {
      const result = await updatePropertyLimitsAction({
        propertyId,
        plan: editPlan,
        maxUnits: editMaxUnits,
      });
      if (!result.success) {
        onError(result.error);
        return;
      }
      setEditingId(null);
      router.refresh();
    });
  }

  return (
    <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Propiedades ({properties.length} de {maxProperties})
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={!canCreate}
            className="text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
            title={!canCreate ? 'Has alcanzado el máximo de propiedades de esta org' : ''}
          >
            + Añadir propiedad
          </button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={handleCreate}
          className="px-6 py-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre</label>
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Hotel Atlántico"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Código (3-6 letras)</label>
              <input
                required
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="ATL"
                maxLength={10}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none uppercase"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SelectField id="newPlan" label="Plan" value={newPlan} onChange={(v) => setNewPlan(v as OrgPlan)} />
            <NumberField id="newMaxUnits" label="Máx. habitaciones" value={newMaxUnits} onChange={setNewMaxUnits} />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                onError(null);
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !newName.trim() || !newCode.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? 'Creando…' : 'Crear propiedad'}
            </button>
          </div>
        </form>
      )}

      {properties.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-slate-500">
          Esta organización aún no tiene propiedades. Añade la primera.
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Propiedad</th>
              <th className="px-6 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Plan</th>
              <th className="px-6 py-2.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Habitaciones</th>
              <th className="px-6 py-2.5 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {properties.map((p) => {
              const editing = editingId === p.id;
              const pct = p.maxUnits > 0 ? Math.min(100, Math.round((p.unitCount / p.maxUnits) * 100)) : 0;
              const overLimit = p.unitCount >= p.maxUnits;
              const nearLimit = !overLimit && pct >= 80;
              return (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{p.name}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider">{p.code}</p>
                  </td>
                  <td className="px-6 py-3">
                    {editing ? (
                      <select
                        value={editPlan}
                        onChange={(e) => setEditPlan(e.target.value as OrgPlan)}
                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                      >
                        {ORG_PLANS.map((pl) => (
                          <option key={pl} value={pl}>
                            {PLAN_LABELS[pl]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_BADGE[p.plan] ?? PLAN_BADGE.free}`}>
                        {PLAN_LABELS[p.plan] ?? p.plan}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {editing ? (
                      <input
                        type="number"
                        min={1}
                        value={editMaxUnits}
                        onChange={(e) => setEditMaxUnits(Number(e.target.value))}
                        className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                      />
                    ) : (
                      <div className="space-y-1">
                        <div className={`text-xs ${overLimit ? 'text-red-700 dark:text-red-400' : nearLimit ? 'text-amber-700 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          <strong>{p.unitCount}</strong> de {p.maxUnits}
                        </div>
                        <div className="h-1 w-24 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${overLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-primary'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {editing ? (
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(p.id)}
                          disabled={isPending}
                          className="text-xs text-primary hover:underline disabled:opacity-50"
                        >
                          Guardar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="text-xs text-primary hover:underline"
                      >
                        Editar plan
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function UsageStat({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const color = used >= max ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary';
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
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
        {ORG_PLANS.map((p) => (
          <option key={p} value={p}>
            {PLAN_LABELS[p]}
          </option>
        ))}
      </select>
    </div>
  );
}
