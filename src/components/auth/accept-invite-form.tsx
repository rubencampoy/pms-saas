'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptInvitationAction } from '@/server/actions/invitations';
import { logoutAction } from '@/server/actions/auth';

type Mode = 'ready_to_accept' | 'needs_signup' | 'wrong_account';

interface Props {
  mode: Mode;
  token: string;
  email?: string;
  expected?: string;
  current?: string;
}

export function AcceptInviteForm({ mode, token, email, expected, current }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleAccept(name?: string, password?: string, passwordConfirm?: string) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await acceptInvitationAction({ token, name, password, passwordConfirm });
      if (!result.success) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      if (result.data.kind === 'needs_2fa_setup') {
        router.push(`/setup-2fa?t=${encodeURIComponent(result.data.pendingToken)}`);
        return;
      }
      router.push('/');
      router.refresh();
    });
  }

  function handleSwitchAccount() {
    startTransition(async () => {
      await logoutAction();
      router.refresh();
    });
  }

  if (mode === 'wrong_account') {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
          <p>
            Esta invitación es para <strong>{expected}</strong>, pero estás conectado como <strong>{current}</strong>.
          </p>
          <p className="mt-2">Cierra sesión y vuelve a entrar con el email correcto para aceptar.</p>
        </div>
        <button
          type="button"
          onClick={handleSwitchAccount}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-700 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <span className="material-icons text-lg">logout</span>
          Cerrar sesión
        </button>
      </div>
    );
  }

  if (mode === 'ready_to_accept') {
    return (
      <div className="space-y-3">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={() => handleAccept()}
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <>
              <span className="material-icons animate-spin text-lg">progress_activity</span>
              Aceptando...
            </>
          ) : (
            <>
              <span className="material-icons text-lg">check_circle</span>
              Aceptar invitación
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const password = fd.get('password') as string;
        const passwordConfirm = fd.get('passwordConfirm') as string;
        if (password !== passwordConfirm) {
          setError(null);
          setFieldErrors({ passwordConfirm: ['Las contraseñas no coinciden'] });
          return;
        }
        handleAccept((fd.get('name') as string).trim(), password, passwordConfirm);
      }}
      className="space-y-4"
    >
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
        <p className="text-sm font-medium text-slate-900 dark:text-white">{email}</p>
      </div>

      <Field
        id="invite-name"
        name="name"
        label="Tu nombre"
        icon="person"
        autoComplete="name"
        placeholder="María García"
        errors={fieldErrors.name}
      />

      <Field
        id="invite-password"
        name="password"
        type="password"
        label="Contraseña"
        icon="lock"
        autoComplete="new-password"
        placeholder="••••••••"
        errors={fieldErrors.password}
        help="Mínimo 8 caracteres."
      />

      <Field
        id="invite-password-confirm"
        name="passwordConfirm"
        type="password"
        label="Repite la contraseña"
        icon="lock_reset"
        autoComplete="new-password"
        placeholder="••••••••"
        errors={fieldErrors.passwordConfirm}
      />

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isPending ? (
          <>
            <span className="material-icons animate-spin text-lg">progress_activity</span>
            Creando cuenta...
          </>
        ) : (
          <>
            <span className="material-icons text-lg">how_to_reg</span>
            Crear cuenta y unirme
          </>
        )}
      </button>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  icon,
  type = 'text',
  autoComplete,
  placeholder,
  errors,
  help,
}: {
  id: string;
  name: string;
  label: string;
  icon: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  errors?: string[];
  help?: string;
}) {
  const isPassword = type === 'password';
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
          {icon}
        </span>
        <input
          id={id}
          name={name}
          type={isPassword && revealed ? 'text' : type}
          autoComplete={autoComplete}
          required
          placeholder={placeholder}
          className={`w-full pl-10 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400 ${
            isPassword ? 'pr-11' : 'pr-4'
          }`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={revealed}
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <span className="material-icons text-xl">
              {revealed ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        )}
      </div>
      {errors && errors.length > 0 && (
        <p className="text-xs text-red-600 dark:text-red-400">{errors[0]}</p>
      )}
      {help && !errors?.length && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{help}</p>
      )}
    </div>
  );
}
