'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { registerOrganizationAction } from '@/server/actions/auth';

export function RegisterForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    const input = {
      ownerName: (formData.get('ownerName') as string)?.trim() ?? '',
      organizationName: (formData.get('organizationName') as string)?.trim() ?? '',
      email: (formData.get('email') as string)?.trim() ?? '',
      password: (formData.get('password') as string) ?? '',
    };

    startTransition(async () => {
      const result = await registerOrganizationAction(input);
      if (!result.success) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      router.push(`/setup-2fa?t=${encodeURIComponent(result.data.pendingToken)}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          <span className="material-icons text-lg">error_outline</span>
          {error}
        </div>
      )}

      <Field
        id="ownerName"
        name="ownerName"
        label="Tu nombre"
        icon="person"
        autoComplete="name"
        placeholder="Rubén Campoy"
        errors={fieldErrors.ownerName}
      />

      <Field
        id="organizationName"
        name="organizationName"
        label="Nombre del establecimiento o empresa"
        icon="apartment"
        autoComplete="organization"
        placeholder="Koala Hostel"
        errors={fieldErrors.organizationName}
        help="Podrás añadir varias propiedades (sucursales) dentro de esta organización."
      />

      <Field
        id="email"
        name="email"
        type="email"
        label="Email"
        icon="mail"
        autoComplete="email"
        placeholder="tu@email.com"
        errors={fieldErrors.email}
      />

      <Field
        id="password"
        name="password"
        type="password"
        label="Contraseña"
        icon="lock"
        autoComplete="new-password"
        placeholder="••••••••"
        errors={fieldErrors.password}
        help="Mínimo 8 caracteres."
      />

      <button
        type="submit"
        disabled={isPending}
        className="flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <span className="material-icons animate-spin text-lg">progress_activity</span>
            Creando cuenta...
          </>
        ) : (
          <>
            <span className="material-icons text-lg">rocket_launch</span>
            Crear cuenta gratis
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
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <div className="relative">
        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
          {icon}
        </span>
        <input
          id={id}
          name={name}
          type={type}
          autoComplete={autoComplete}
          required
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
        />
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
