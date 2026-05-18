'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  loginStep1Action,
  verifyTotpAction,
  type LoginNext,
} from '@/server/actions/auth';

type Step =
  | { kind: 'credentials' }
  | { kind: 'totp'; pendingToken: string };

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: 'credentials' });

  function handleCredentials(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    startTransition(async () => {
      const result = await loginStep1Action({ email, password });
      if (!result.success) {
        setError(result.error);
        return;
      }
      handleNext(result.data);
    });
  }

  function handleNext(next: LoginNext) {
    if (next.next === 'done') {
      router.push('/');
      router.refresh();
      return;
    }
    if (next.next === 'setup') {
      router.push(`/setup-2fa?t=${encodeURIComponent(next.pendingToken)}`);
      return;
    }
    setStep({ kind: 'totp', pendingToken: next.pendingToken });
  }

  if (step.kind === 'totp') {
    return (
      <TotpStep
        pendingToken={step.pendingToken}
        onBack={() => {
          setStep({ kind: 'credentials' });
          setError(null);
        }}
      />
    );
  }

  return (
    <form onSubmit={handleCredentials} className="space-y-5">
      {error && <ErrorBanner message={error} />}

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Email
        </label>
        <div className="relative">
          <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
            mail
          </span>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="tu@email.com"
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Contraseña
        </label>
        <div className="relative">
          <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
            lock
          </span>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <SubmitButton pending={isPending} icon="login" label="Iniciar sesión" pendingLabel="Accediendo..." />
    </form>
  );
}

function TotpStep({ pendingToken, onBack }: { pendingToken: string; onBack: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp');
  const [trustDevice, setTrustDevice] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const value = String(formData.get('code') ?? '').trim();

    startTransition(async () => {
      const result = await verifyTotpAction({
        pendingToken,
        ...(mode === 'totp' ? { code: value } : { recoveryCode: value }),
        trustDevice,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push('/');
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <ErrorBanner message={error} />}

      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-4">
        <div className="flex items-start gap-3">
          <span className="material-icons text-primary text-xl mt-0.5">phonelink_lock</span>
          <div className="text-sm">
            <p className="font-medium text-slate-900 dark:text-white">
              Verificación en dos pasos
            </p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              {mode === 'totp'
                ? 'Abre tu app authenticator e introduce el código de 6 dígitos.'
                : 'Introduce uno de tus códigos de recuperación.'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="code"
          className="block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {mode === 'totp' ? 'Código de 6 dígitos' : 'Código de recuperación'}
        </label>
        <input
          id="code"
          name="code"
          key={mode}
          autoFocus
          required
          inputMode={mode === 'totp' ? 'numeric' : 'text'}
          autoComplete={mode === 'totp' ? 'one-time-code' : 'off'}
          pattern={mode === 'totp' ? '\\d{6}' : undefined}
          maxLength={mode === 'totp' ? 6 : 32}
          placeholder={mode === 'totp' ? '123456' : 'xxxxx-xxxxx'}
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

      <SubmitButton pending={isPending} icon="check_circle" label="Verificar" pendingLabel="Verificando..." />

      <div className="flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => {
            setMode(mode === 'totp' ? 'recovery' : 'totp');
            setError(null);
          }}
          className="text-primary hover:underline"
        >
          {mode === 'totp' ? 'Usar código de recuperación' : 'Usar app authenticator'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          ← Volver
        </button>
      </div>
    </form>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
      <span className="material-icons text-lg">error_outline</span>
      {message}
    </div>
  );
}

function SubmitButton({
  pending,
  icon,
  label,
  pendingLabel,
}: {
  pending: boolean;
  icon: string;
  label: string;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <span className="material-icons animate-spin text-lg">progress_activity</span>
          {pendingLabel}
        </>
      ) : (
        <>
          <span className="material-icons text-lg">{icon}</span>
          {label}
        </>
      )}
    </button>
  );
}
