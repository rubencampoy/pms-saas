import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { Secret } from 'otpauth';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { verifyPendingToken } from '@/lib/auth/pending-token';
import { buildOtpauthUri, renderQrDataUrl } from '@/lib/auth/totp';
import { SetupTotpForm } from '@/components/auth/setup-2fa-form';

export const metadata: Metadata = {
  title: 'Configurar autenticación en dos pasos',
};

export default async function SetupTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  if (!t) redirect('/login');

  const payload = verifyPendingToken(t);
  if (!payload || payload.purpose !== 'setup' || !payload.setupSecret) {
    redirect('/login');
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId),
    columns: { email: true, totpEnabled: true },
  });
  if (!user) redirect('/login');
  if (user.totpEnabled) redirect('/login');

  const secret = Secret.fromBase32(payload.setupSecret);
  const uri = buildOtpauthUri(secret, user.email);
  const qrDataUrl = await renderQrDataUrl(uri);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-light dark:bg-background-dark p-6">
      <div className="w-full max-w-xl space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white font-bold text-xl">
            H
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white">Chamelio PMS</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Configura tu app authenticator
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Por seguridad, todos los usuarios deben usar verificación en dos pasos.
            Escanea el código QR con Google Authenticator, Authy, 1Password o similar.
          </p>
        </div>

        <SetupTotpForm
          pendingToken={t}
          qrDataUrl={qrDataUrl}
          secretBase32={secret.base32}
          accountLabel={user.email}
        />
      </div>
    </div>
  );
}
