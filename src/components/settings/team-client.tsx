'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createInvitationAction,
  revokeInvitationAction,
} from '@/server/actions/invitations';
import { INVITABLE_ROLES, type InvitableRole } from '@/lib/validators/invitations';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

interface TeamClientProps {
  members: Member[];
  pendingInvitations: PendingInvitation[];
  currentUserId: string;
  canManage: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  front_desk: 'Recepción',
  housekeeping: 'Housekeeping',
};

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  admin: 'bg-primary/10 text-primary',
  manager: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  front_desk: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
  housekeeping: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
};

export function TeamClient({ members, pendingInvitations, currentUserId, canManage }: TeamClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('front_desk');

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setLastInviteUrl(null);

    startTransition(async () => {
      const result = await createInvitationAction({ email: email.trim(), role });
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      setLastInviteUrl(result.data.acceptUrl);
      setEmail('');
      router.refresh();
    });
  }

  function handleRevoke(id: string) {
    if (!confirm('¿Revocar esta invitación? El link dejará de ser válido.')) return;
    startTransition(async () => {
      await revokeInvitationAction(id);
      router.refresh();
    });
  }

  function copyLink(token: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 1500);
    });
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Equipo</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gestiona los miembros y las invitaciones de tu organización.
        </p>
      </div>

      {canManage && (
        <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
            Invitar a un nuevo miembro
          </h2>

          <form onSubmit={handleInvite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="invite-email" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nuevo@ejemplo.com"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="invite-role" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Rol
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as InvitableRole)}
                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              >
                {INVITABLE_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <span className="material-icons text-lg">send</span>
              Enviar invitación
            </button>
          </form>

          {formError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>
          )}

          {lastInviteUrl && (
            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200 mb-2">
                ✓ Invitación creada. Comparte este link con la persona invitada:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 truncate">
                  {lastInviteUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copyLink(lastInviteUrl, lastInviteUrl)}
                  className="text-xs text-primary hover:underline whitespace-nowrap"
                >
                  Copiar
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Miembros ({members.length})
          </h2>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rol</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="px-6 py-3 text-sm text-slate-900 dark:text-white">
                  {m.name} {m.id === currentUserId && <span className="text-xs text-slate-400">(tú)</span>}
                </td>
                <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">{m.email}</td>
                <td className="px-6 py-3 text-sm">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[m.role] ?? 'bg-slate-100 text-slate-700'}`}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {pendingInvitations.length > 0 && (
        <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Invitaciones pendientes ({pendingInvitations.length})
            </h2>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Expira</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {pendingInvitations.map((inv) => {
                const url = `${baseUrl}/accept-invite?token=${inv.token}`;
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-3 text-sm text-slate-900 dark:text-white">{inv.email}</td>
                    <td className="px-6 py-3 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[inv.role] ?? 'bg-slate-100 text-slate-700'}`}>
                        {ROLE_LABELS[inv.role] ?? inv.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {new Date(inv.expiresAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => copyLink(inv.token, url)}
                        className="text-xs text-primary hover:underline"
                      >
                        {copiedToken === inv.token ? '✓ Copiado' : 'Copiar link'}
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(inv.id)}
                          disabled={isPending}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          Revocar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
