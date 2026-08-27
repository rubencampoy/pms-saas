import type { Metadata } from 'next';
import Link from 'next/link';
import { ChamelioLogo } from '@/components/shared/chamelio-logo';
import { getInvitationStatus } from '@/server/actions/invitations';
import { AcceptInviteForm } from '@/components/auth/accept-invite-form';

export const metadata: Metadata = {
  title: 'Aceptar invitación',
};

interface AcceptInvitePageProps {
  searchParams: Promise<{ token?: string }>;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  front_desk: 'Recepción',
  housekeeping: 'Housekeeping',
};

export default async function AcceptInvitePage({ searchParams }: AcceptInvitePageProps) {
  const { token } = await searchParams;

  if (!token) {
    return <InvitationMessage title="Link inválido" body="Falta el token de invitación." />;
  }

  const status = await getInvitationStatus(token);

  if (status.kind === 'invalid') {
    const messages: Record<string, { title: string; body: string }> = {
      not_found: { title: 'Invitación no encontrada', body: 'Este link no corresponde a ninguna invitación.' },
      expired: { title: 'Invitación caducada', body: 'Esta invitación ha expirado. Pide a un admin que te envíe una nueva.' },
      revoked: { title: 'Invitación revocada', body: 'Esta invitación fue revocada por un administrador.' },
      already_accepted: { title: 'Ya aceptada', body: 'Esta invitación ya fue aceptada anteriormente.' },
    };
    const msg = messages[status.reason]!;
    return <InvitationMessage title={msg.title} body={msg.body} />;
  }

  return (
    <Shell>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Te han invitado a {(status as { organizationName: string }).organizationName}
        </h1>
        {'role' in status && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Rol asignado: <span className="font-medium text-slate-900 dark:text-white">{ROLE_LABELS[status.role] ?? status.role}</span>
          </p>
        )}
        {'email' in status && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Invitación para <span className="font-medium">{status.email}</span>
          </p>
        )}
      </div>

      {status.kind === 'needs_login' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Ya tienes una cuenta con este email. Inicia sesión para añadir esta organización a tu cuenta.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(`/accept-invite?token=${token}`)}`}
            className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <span className="material-icons text-lg">login</span>
            Iniciar sesión
          </Link>
        </div>
      )}

      {status.kind === 'wrong_account' && (
        <AcceptInviteForm
          mode="wrong_account"
          token={token}
          expected={status.expected}
          current={status.current}
        />
      )}

      {status.kind === 'ready_to_accept' && (
        <AcceptInviteForm mode="ready_to_accept" token={token} />
      )}

      {status.kind === 'needs_signup' && (
        <AcceptInviteForm mode="needs_signup" token={token} email={status.email} />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background-light dark:bg-background-dark p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center justify-center gap-3">
          <ChamelioLogo className="h-10 w-10" />
          <span className="text-xl font-bold text-slate-900 dark:text-white">Chamelio PMS</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function InvitationMessage({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2632] p-6 text-center space-y-3">
        <span className="material-icons text-4xl text-slate-400">link_off</span>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{body}</p>
        <Link href="/login" className="inline-block text-sm text-primary hover:underline pt-2">
          Volver a inicio de sesión
        </Link>
      </div>
    </Shell>
  );
}
