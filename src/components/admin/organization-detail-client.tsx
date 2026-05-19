'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateOrganizationLimitsAction,
  updateOrganizationProfileAction,
  updateBillingDataAction,
  inviteUserAsAdminAction,
  suspendOrganizationAction,
  reactivateOrganizationAction,
  createPropertyAsAdminAction,
  updatePropertyLimitsAction,
} from '@/server/actions/admin-organizations';
import { revokeInvitationAction } from '@/server/actions/invitations';
import {
  ORG_PLANS,
  ADMIN_INVITABLE_ROLES,
  type OrgPlan,
  type AdminInvitableRole,
} from '@/lib/validators/admin';

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

interface BillingData {
  legalName: string;
  taxId: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  state: string;
  country: string;
  billingEmail: string;
  stripeCustomerId: string | null;
}

interface Props {
  organization: Organization;
  usage: Usage;
  properties: Property[];
  pendingInvitations: PendingInvitation[];
  billing: BillingData;
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

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  front_desk: 'Recepción',
  housekeeping: 'Housekeeping',
};

export function OrganizationDetailClient({
  organization,
  usage,
  properties,
  pendingInvitations,
  billing,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(organization.name);

  // Org limits editing
  const [editingOrg, setEditingOrg] = useState(false);
  const [maxProperties, setMaxProperties] = useState(organization.maxProperties);
  const [maxUsers, setMaxUsers] = useState(organization.maxUsers);

  // Billing editing
  const [editingBilling, setEditingBilling] = useState(false);
  const [billingDraft, setBillingDraft] = useState<BillingData>(billing);

  // Invite flow
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminInvitableRole>('admin');
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

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

  function handleSaveName(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('El nombre debe tener al menos 2 caracteres');
      return;
    }
    startTransition(async () => {
      const result = await updateOrganizationProfileAction({
        organizationId: organization.id,
        name: trimmed,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditingName(false);
      router.refresh();
    });
  }

  function handleSaveBilling(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateBillingDataAction({
        organizationId: organization.id,
        legalName: billingDraft.legalName,
        taxId: billingDraft.taxId,
        addressLine1: billingDraft.addressLine1,
        addressLine2: billingDraft.addressLine2,
        postalCode: billingDraft.postalCode,
        city: billingDraft.city,
        state: billingDraft.state,
        country: billingDraft.country || 'ES',
        billingEmail: billingDraft.billingEmail,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditingBilling(false);
      router.refresh();
    });
  }

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLastInviteUrl(null);
    startTransition(async () => {
      const result = await inviteUserAsAdminAction({
        organizationId: organization.id,
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setLastInviteUrl(result.data.acceptUrl);
      setInviteEmail('');
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

      {/* General data (name) */}
      <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Datos generales</h2>
          {!editingName && (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="text-xs text-primary hover:underline"
            >
              Editar
            </button>
          )}
        </div>

        {!editingName ? (
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre</p>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{organization.name}</p>
          </div>
        ) : (
          <form onSubmit={handleSaveName} className="space-y-4">
            <div>
              <label htmlFor="orgName" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nombre de la organización
              </label>
              <input
                id="orgName"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={255}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setEditingName(false);
                  setName(organization.name);
                  setError(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || name.trim() === organization.name}
                className="px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </section>

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

      {/* Billing data */}
      <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Datos de facturación</h2>
          {!editingBilling && (
            <button
              type="button"
              onClick={() => {
                setBillingDraft(billing);
                setEditingBilling(true);
              }}
              className="text-xs text-primary hover:underline"
            >
              Editar
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Datos fiscales del cliente. Próximamente se integrarán con Stripe para facturación automática.
          {billing.stripeCustomerId && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              stripe: {billing.stripeCustomerId}
            </span>
          )}
        </p>

        {!editingBilling ? (
          <BillingReadView billing={billing} />
        ) : (
          <form onSubmit={handleSaveBilling} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                id="legalName"
                label="Razón social"
                value={billingDraft.legalName}
                onChange={(v) => setBillingDraft((d) => ({ ...d, legalName: v }))}
                placeholder="Hotelera Guardamar S.L."
              />
              <TextField
                id="taxId"
                label="NIF / CIF"
                value={billingDraft.taxId}
                onChange={(v) => setBillingDraft((d) => ({ ...d, taxId: v.toUpperCase() }))}
                placeholder="B12345678"
              />
            </div>
            <TextField
              id="addressLine1"
              label="Dirección"
              value={billingDraft.addressLine1}
              onChange={(v) => setBillingDraft((d) => ({ ...d, addressLine1: v }))}
              placeholder="Av. del Mar 12"
            />
            <TextField
              id="addressLine2"
              label="Dirección (línea 2)"
              value={billingDraft.addressLine2}
              onChange={(v) => setBillingDraft((d) => ({ ...d, addressLine2: v }))}
              placeholder="Esc. A, 3º B (opcional)"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <TextField
                id="postalCode"
                label="Código postal"
                value={billingDraft.postalCode}
                onChange={(v) => setBillingDraft((d) => ({ ...d, postalCode: v }))}
                placeholder="03140"
              />
              <TextField
                id="city"
                label="Ciudad"
                value={billingDraft.city}
                onChange={(v) => setBillingDraft((d) => ({ ...d, city: v }))}
                placeholder="Guardamar del Segura"
              />
              <TextField
                id="state"
                label="Provincia"
                value={billingDraft.state}
                onChange={(v) => setBillingDraft((d) => ({ ...d, state: v }))}
                placeholder="Alicante"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <TextField
                id="country"
                label="País (ISO 2)"
                value={billingDraft.country}
                onChange={(v) => setBillingDraft((d) => ({ ...d, country: v.toUpperCase().slice(0, 2) }))}
                placeholder="ES"
                maxLength={2}
              />
              <TextField
                id="billingEmail"
                label="Email de facturación"
                value={billingDraft.billingEmail}
                onChange={(v) => setBillingDraft((d) => ({ ...d, billingEmail: v }))}
                placeholder="facturacion@hotelguardamar.com"
                type="email"
              />
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingBilling(false);
                  setBillingDraft(billing);
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

      {/* Invite + pending invitations */}
      <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3">
          Invitar usuario
        </h2>
        <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end mb-4">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="inviteEmail" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              id="inviteEmail"
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="nuevo@ejemplo.com"
              className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="inviteRole" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Rol
            </label>
            <select
              id="inviteRole"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as AdminInvitableRole)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            >
              {ADMIN_INVITABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={isPending || !inviteEmail.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <span className="material-icons text-lg">send</span>
            Enviar invitación
          </button>
        </form>

        {lastInviteUrl && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200 mb-2">
              ✓ Invitación creada. Comparte este link:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 truncate">
                {lastInviteUrl}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(lastInviteUrl);
                  setCopiedToken('__last__');
                  setTimeout(() => setCopiedToken(null), 1500);
                }}
                className="text-xs text-primary hover:underline whitespace-nowrap"
              >
                {copiedToken === '__last__' ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        )}

        {pendingInvitations.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No hay invitaciones pendientes.
          </p>
        ) : (
          <>
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Invitaciones pendientes
            </h3>
            <ul className="space-y-3">
              {pendingInvitations.map((inv) => (
                <li
                  key={inv.id}
                  className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0 last:pb-0"
                >
                  <div>
                    <strong className="text-slate-900 dark:text-white">{inv.email}</strong>
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 capitalize">
                      {ROLE_LABELS[inv.role] ?? inv.role}
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
          </>
        )}
      </section>

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

function BillingReadView({ billing }: { billing: BillingData }) {
  const empty = !billing.legalName && !billing.taxId && !billing.addressLine1 && !billing.billingEmail;
  if (empty) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400 italic">
        Aún no se han registrado datos de facturación. Pulsa <strong>Editar</strong> para añadirlos.
      </p>
    );
  }
  const addressLines = [
    billing.addressLine1,
    billing.addressLine2,
    [billing.postalCode, billing.city].filter(Boolean).join(' '),
    [billing.state, billing.country].filter(Boolean).join(' · '),
  ].filter(Boolean);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      <ReadField label="Razón social" value={billing.legalName || '—'} />
      <ReadField label="NIF / CIF" value={billing.taxId || '—'} mono />
      <ReadField
        label="Dirección"
        value={
          addressLines.length === 0 ? (
            '—'
          ) : (
            <span className="block whitespace-pre-line">
              {addressLines.join('\n')}
            </span>
          )
        }
      />
      <ReadField label="Email de facturación" value={billing.billingEmail || '—'} />
    </div>
  );
}

function ReadField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      <div
        className={`mt-1 text-sm text-slate-900 dark:text-white ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </div>
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
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
