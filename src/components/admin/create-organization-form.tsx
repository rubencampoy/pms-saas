'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createOrganizationAsAdminAction } from '@/server/actions/admin-organizations';

const PLANS = [
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'professional', label: 'Professional' },
  { value: 'enterprise', label: 'Enterprise' },
] as const;

export function CreateOrganizationForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [success, setSuccess] = useState<{ acceptUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSuccess(null);

    const fd = new FormData(e.currentTarget);
    const input = {
      organizationName: String(fd.get('organizationName') ?? '').trim(),
      ownerName: String(fd.get('ownerName') ?? '').trim(),
      ownerEmail: String(fd.get('ownerEmail') ?? '').trim(),
      plan: String(fd.get('plan') ?? 'free') as 'free' | 'starter' | 'professional' | 'enterprise',
    };

    startTransition(async () => {
      const result = await createOrganizationAsAdminAction(input);
      if (!result.success) {
        setError(result.error);
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }
      setSuccess({ acceptUrl: result.data.acceptUrl });
      router.refresh();
    });
  }

  function copyLink() {
    if (!success) return;
    navigator.clipboard.writeText(success.acceptUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (success) {
    return (
      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
          <span className="material-icons">check_circle</span>
          <h2 className="text-base font-semibold">Organización creada</h2>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">
          Envía este link al cliente. Caduca en 14 días. Al abrirlo, podrá definir su contraseña,
          configurar 2FA y entrar al PMS como owner.
        </p>

        <div className="flex items-stretch gap-2">
          <code className="flex-1 text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 break-all">
            {success.acceptUrl}
          </code>
          <button
            type="button"
            onClick={copyLink}
            className="px-3 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 whitespace-nowrap"
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
              setCopied(false);
            }}
            className="text-sm text-primary hover:underline"
          >
            Crear otra organización
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/organizations')}
            className="text-sm text-slate-500 hover:underline"
          >
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-5"
    >
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      <Field
        id="organizationName"
        name="organizationName"
        label="Nombre de la organización"
        placeholder="Hotel Atlántico SL"
        help="Razón social o nombre comercial del establecimiento."
        errors={fieldErrors.organizationName}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          id="ownerName"
          name="ownerName"
          label="Nombre del owner"
          placeholder="María García"
          errors={fieldErrors.ownerName}
        />
        <Field
          id="ownerEmail"
          name="ownerEmail"
          type="email"
          label="Email del owner"
          placeholder="maria@hotelatlantico.com"
          errors={fieldErrors.ownerEmail}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="plan" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Plan
        </label>
        <select
          id="plan"
          name="plan"
          defaultValue="free"
          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        >
          {PLANS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="pt-2 flex justify-end gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? (
            <>
              <span className="material-icons animate-spin text-lg">progress_activity</span>
              Creando...
            </>
          ) : (
            <>
              <span className="material-icons text-lg">add</span>
              Crear organización
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  type = 'text',
  placeholder,
  help,
  errors,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  help?: string;
  errors?: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none placeholder:text-slate-400"
      />
      {errors && errors.length > 0 && (
        <p className="text-xs text-red-600 dark:text-red-400">{errors[0]}</p>
      )}
      {help && !errors?.length && (
        <p className="text-xs text-slate-500 dark:text-slate-400">{help}</p>
      )}
    </div>
  );
}
