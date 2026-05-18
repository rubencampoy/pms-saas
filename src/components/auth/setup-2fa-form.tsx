'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setupTotpAction } from '@/server/actions/auth';

type View =
  | { kind: 'enroll' }
  | { kind: 'recovery'; codes: string[] };

export function SetupTotpForm({
  pendingToken,
  qrDataUrl,
  secretBase32,
  accountLabel,
}: {
  pendingToken: string;
  qrDataUrl: string;
  secretBase32: string;
  accountLabel: string;
}) {
  const [view, setView] = useState<View>({ kind: 'enroll' });

  if (view.kind === 'recovery') {
    return <RecoveryCodesView codes={view.codes} />;
  }

  return (
    <EnrollView
      pendingToken={pendingToken}
      qrDataUrl={qrDataUrl}
      secretBase32={secretBase32}
      accountLabel={accountLabel}
      onSuccess={(codes) => setView({ kind: 'recovery', codes })}
    />
  );
}

function EnrollView({
  pendingToken,
  qrDataUrl,
  secretBase32,
  accountLabel,
  onSuccess,
}: {
  pendingToken: string;
  qrDataUrl: string;
  secretBase32: string;
  accountLabel: string;
  onSuccess: (codes: string[]) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [trustDevice, setTrustDevice] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const code = String(formData.get('code') ?? '').trim();

    startTransition(async () => {
      const result = await setupTotpAction({ pendingToken, code, trustDevice });
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSuccess(result.data.recoveryCodes);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 items-center bg-white dark:bg-[#1a2632] rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200 mx-auto">
          <Image
            src={qrDataUrl}
            alt="Código QR para configurar la autenticación"
            width={200}
            height={200}
            unoptimized
          />
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-slate-700 dark:text-slate-300">
            <span className="font-medium">1.</span> Escanea el QR con tu app authenticator.
          </p>
          <p className="text-slate-700 dark:text-slate-300">
            <span className="font-medium">2.</span> Tu cuenta aparecerá como{' '}
            <span className="font-mono text-xs text-slate-500">HotelOS ({accountLabel})</span>.
          </p>
          <p className="text-slate-700 dark:text-slate-300">
            <span className="font-medium">3.</span> Introduce abajo el código de 6 dígitos.
          </p>
          <button
            type="button"
            onClick={() => setShowSecret((s) => !s)}
            className="text-xs text-primary hover:underline"
          >
            {showSecret ? 'Ocultar clave manual' : '¿No puedes escanear? Introduce la clave manualmente'}
          </button>
          {showSecret && (
            <code className="block break-all rounded bg-slate-100 dark:bg-slate-800 px-2 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300">
              {secretBase32}
            </code>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          <span className="material-icons text-lg">error_outline</span>
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="code"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Código de 6 dígitos
        </label>
        <input
          id="code"
          name="code"
          autoFocus
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
        />
      </div>

      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={trustDevice}
          onChange={(e) => setTrustDevice(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
        />
        <span className="text-sm text-slate-700 dark:text-slate-300">
          Confiar en este dispositivo durante 30 días
        </span>
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <span className="material-icons animate-spin text-lg">progress_activity</span>
            Activando...
          </>
        ) : (
          <>
            <span className="material-icons text-lg">verified_user</span>
            Activar verificación en dos pasos
          </>
        )}
      </button>
    </form>
  );
}

function RecoveryCodesView({ codes }: { codes: string[] }) {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState(false);

  function copy() {
    navigator.clipboard.writeText(codes.join('\n')).catch(() => {
      // ignore — clipboard may be unavailable
    });
  }

  function download() {
    const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hotelos-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4">
        <div className="flex gap-3">
          <span className="material-icons text-amber-600 dark:text-amber-400">warning_amber</span>
          <div className="text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Guarda estos códigos de recuperación
            </p>
            <p className="mt-1 text-amber-800 dark:text-amber-300">
              Cada código solo se puede usar una vez. Te servirán para entrar si pierdes
              acceso a tu app authenticator. <strong>No volverás a verlos.</strong>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a2632] p-4 font-mono text-sm">
        {codes.map((code) => (
          <code key={code} className="px-2 py-1 text-slate-800 dark:text-slate-200">
            {code}
          </code>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={copy}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <span className="material-icons text-lg">content_copy</span>
          Copiar
        </button>
        <button
          type="button"
          onClick={download}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <span className="material-icons text-lg">download</span>
          Descargar
        </button>
      </div>

      <label className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="h-4 w-4 mt-0.5 rounded border-slate-300 text-primary focus:ring-primary/30"
        />
        <span className="text-sm text-slate-700 dark:text-slate-300">
          He guardado los códigos en un lugar seguro
        </span>
      </label>

      <button
        type="button"
        disabled={!acknowledged}
        onClick={() => {
          router.push('/');
          router.refresh();
        }}
        className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="material-icons text-lg">arrow_forward</span>
        Continuar al panel
      </button>
    </div>
  );
}
