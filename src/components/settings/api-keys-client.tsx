'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createApiKeyAction, revokeApiKeyAction } from '@/server/actions/api-keys';
import {
  API_SCOPES,
  ApiScope,
  RATE_LIMIT_DEFAULT_PER_MINUTE,
  RATE_LIMIT_LOOKUP_PER_MINUTE,
} from '@/lib/constants/api';

interface ApiKeyRow {
  id: string;
  name: string;
  propertyId: string | null;
  keyPrefix: string;
  scopes: ApiScope[];
  rateLimitPerMinute: number;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  /** Computed by Postgres — see `apiKeyRepo.findAll`. */
  isExpired: boolean;
  createdAt: string;
  requests: number;
  errors: number;
}

interface PropertyOption {
  id: string;
  name: string;
  code: string;
}

interface LogRow {
  id: string;
  keyName: string | null;
  method: string;
  path: string;
  status: number;
  errorCode: string | null;
  durationMs: number;
  createdAt: string;
}

interface ApiKeysClientProps {
  apiKeys: ApiKeyRow[];
  properties: PropertyOption[];
  recentLogs: LogRow[];
  canManage: boolean;
  usageWindowHours: number;
}

const SCOPE_LABELS: Record<ApiScope, string> = {
  [ApiScope.PROPERTIES_READ]: 'Propiedades',
  [ApiScope.ROOM_TYPES_READ]: 'Tipologías',
  [ApiScope.RESERVATIONS_READ]: 'Reservas',
  [ApiScope.GUESTS_READ]: 'Huéspedes',
  [ApiScope.FOLIOS_READ]: 'Facturación',
  [ApiScope.AVAILABILITY_READ]: 'Disponibilidad',
};

const SCOPE_HINTS: Partial<Record<ApiScope, string>> = {
  [ApiScope.GUESTS_READ]: 'Datos de contacto de todos los huéspedes',
  [ApiScope.FOLIOS_READ]: 'Cargos, pagos y saldos',
};

type KeyState = 'active' | 'revoked' | 'expired';

function keyState(key: ApiKeyRow): KeyState {
  if (key.revokedAt) return 'revoked';
  if (key.isExpired) return 'expired';
  return 'active';
}

const STATE_BADGE: Record<KeyState, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  revoked: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  expired: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const STATE_DOT: Record<KeyState, string> = {
  active: 'bg-emerald-500',
  revoked: 'bg-red-500',
  expired: 'bg-slate-400',
};

const STATE_LABEL: Record<KeyState, string> = {
  active: 'Activa',
  revoked: 'Revocada',
  expired: 'Caducada',
};

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ApiKeysClient({
  apiKeys,
  properties,
  recentLogs,
  canManage,
  usageWindowHours,
}: ApiKeysClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [issuedKey, setIssuedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [scopes, setScopes] = useState<ApiScope[]>([ApiScope.RESERVATIONS_READ]);
  const [rateLimit, setRateLimit] = useState(String(RATE_LIMIT_DEFAULT_PER_MINUTE));
  const [expiresAt, setExpiresAt] = useState('');

  const propertyName = (id: string | null) =>
    id ? (properties.find((p) => p.id === id)?.code ?? '—') : 'Todas';

  function toggleScope(scope: ApiScope) {
    setScopes((current) =>
      current.includes(scope)
        ? current.filter((s) => s !== scope)
        : [...current, scope],
    );
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIssuedKey(null);
    setCopied(false);

    startTransition(async () => {
      const result = await createApiKeyAction({
        name,
        propertyId,
        scopes,
        rateLimitPerMinute: Number(rateLimit),
        expiresAt,
      });

      if (!result.success) {
        setFormError(result.error);
        return;
      }

      setIssuedKey(result.data.key);
      setName('');
      setExpiresAt('');
      router.refresh();
    });
  }

  function handleRevoke(key: ApiKeyRow) {
    const confirmed = confirm(
      `¿Revocar «${key.name}»?\n\nCualquier integración que la esté usando dejará de funcionar inmediatamente. Esto no se puede deshacer.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await revokeApiKeyAction(key.id);
      if (!result.success) setFormError(result.error);
      router.refresh();
    });
  }

  async function copyKey(key: string) {
    await navigator.clipboard.writeText(key);
    setCopied(true);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Claves de API
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Credenciales de solo lectura para conectar aplicaciones externas con el PMS.
        </p>
      </div>

      <div className="flex gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
        <span className="material-icons text-amber-600 dark:text-amber-400 text-xl">
          warning
        </span>
        <div className="text-sm text-amber-900 dark:text-amber-200">
          <p className="font-medium">Una clave lee los datos de toda la organización.</p>
          <p className="mt-1 text-amber-800 dark:text-amber-300">
            Guárdala en el servidor de la aplicación que la use.{' '}
            <strong>Nunca dentro de una app móvil</strong>: cualquiera que instale la
            app puede extraerla y acceder al listado completo de huéspedes.
          </p>
        </div>
      </div>

      {canManage && (
        <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">
            Crear una clave
          </h3>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="key-name"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Nombre
                </label>
                <input
                  id="key-name"
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Guest app"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="key-property"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Propiedad
                </label>
                <select
                  id="key-property"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                >
                  <option value="">Todas las propiedades</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name} ({property.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Permisos — concede solo los que la integración necesite
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {API_SCOPES.map((scope) => (
                  <label
                    key={scope}
                    className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-slate-900 dark:text-white">
                        {SCOPE_LABELS[scope]}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {SCOPE_HINTS[scope] ?? scope}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="key-rate"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Límite (peticiones/minuto)
                </label>
                <input
                  id="key-rate"
                  type="number"
                  min={1}
                  max={6000}
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  La búsqueda de reservas por código y apellido tiene su propio límite
                  fijo de {RATE_LIMIT_LOOKUP_PER_MINUTE}/min.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="key-expires"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Caducidad (opcional)
                </label>
                <input
                  id="key-expires"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || scopes.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <span className="material-icons text-lg">key</span>
              Crear clave
            </button>
          </form>

          {formError && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">{formError}</p>
          )}

          {issuedKey && (
            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200 mb-2">
                ✓ Clave creada. Cópiala ahora — no volverá a mostrarse.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 truncate">
                  {issuedKey}
                </code>
                <button
                  type="button"
                  onClick={() => copyKey(issuedKey)}
                  className="text-xs text-primary hover:underline whitespace-nowrap"
                >
                  {copied ? 'Copiada' : 'Copiar'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Claves ({apiKeys.length})
          </h3>
        </div>

        {apiKeys.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400 text-center">
            Todavía no hay ninguna clave.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Clave
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Permisos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Último uso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {usageWindowHours}h
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Estado
                  </th>
                  {canManage && <th className="px-6 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {apiKeys.map((key) => {
                  const state = keyState(key);
                  return (
                    <tr
                      key={key.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-6 py-3">
                        <div className="text-sm text-slate-900 dark:text-white">
                          {key.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {propertyName(key.propertyId)} · {key.rateLimitPerMinute}/min
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <code className="text-xs text-slate-600 dark:text-slate-300">
                          {key.keyPrefix}…
                        </code>
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            >
                              {SCOPE_LABELS[scope] ?? scope}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {formatDateTime(key.lastUsedAt)}
                      </td>
                      <td className="px-6 py-3 text-sm whitespace-nowrap">
                        <span className="text-slate-900 dark:text-white">
                          {key.requests}
                        </span>
                        {key.errors > 0 && (
                          <span className="ml-1 text-xs text-red-600 dark:text-red-400">
                            ({key.errors} err)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATE_BADGE[state]}`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[state]}`}
                          />
                          {STATE_LABEL[state]}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-6 py-3 text-right">
                          {state === 'active' && (
                            <button
                              type="button"
                              onClick={() => handleRevoke(key)}
                              disabled={isPending}
                              className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                            >
                              Revocar
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Últimas peticiones
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Sin parámetros de consulta: pueden contener datos del huésped.
          </p>
        </div>

        {recentLogs.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400 text-center">
            Todavía no ha llegado ninguna petición.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Cuándo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Clave
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Resultado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Tiempo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="px-6 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-6 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                      {log.keyName ?? '—'}
                    </td>
                    <td className="px-6 py-2.5">
                      <code className="text-xs text-slate-700 dark:text-slate-200">
                        {log.method} {log.path}
                      </code>
                    </td>
                    <td className="px-6 py-2.5 text-xs whitespace-nowrap">
                      <span
                        className={
                          log.status >= 400
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {log.status}
                      </span>
                      {log.errorCode && (
                        <span className="ml-1.5 text-slate-500 dark:text-slate-400">
                          {log.errorCode}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {log.durationMs} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
