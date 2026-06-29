'use client';

import { useState, useTransition } from 'react';
import { updatePropertyIpRestriction } from '@/server/actions/ip-restriction';
import { isValidIpOrCidr } from '@/lib/security/ip';

interface PropertyIpSettings {
  id: string;
  name: string;
  code: string;
  ipRestrictionEnabled: boolean;
  allowedIps: string[];
}

interface IpRestrictionClientProps {
  properties: PropertyIpSettings[];
  currentIp: string | null;
  canManage: boolean;
}

export function IpRestrictionClient({
  properties,
  currentIp,
  canManage,
}: IpRestrictionClientProps) {
  return (
    <div>
      {/* Toolbar */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Restricción de acceso por IP
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Limita el acceso al panel para que el personal solo pueda entrar desde
          las redes autorizadas de cada propiedad. El motor de reservas público
          y los canales no se ven afectados.
        </p>
      </div>

      {/* Current IP banner */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-900/20">
        <span className="material-icons text-blue-600 dark:text-blue-400">my_location</span>
        <div className="text-sm">
          <span className="text-slate-600 dark:text-slate-300">Tu IP pública actual: </span>
          <span className="font-mono font-semibold text-slate-900 dark:text-white">
            {currentIp ?? 'desconocida'}
          </span>
        </div>
      </div>

      {!canManage && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <span className="material-icons text-lg">info</span>
          Solo los propietarios y administradores pueden modificar estos ajustes.
        </div>
      )}

      {properties.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-[#1a2632]">
          <span className="material-icons mb-2 block text-4xl text-slate-300 dark:text-slate-600">
            apartment
          </span>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No hay propiedades para configurar todavía.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {properties.map((property) => (
            <PropertyIpCard
              key={property.id}
              property={property}
              currentIp={currentIp}
              canManage={canManage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Per-property card ─── */

function PropertyIpCard({
  property,
  currentIp,
  canManage,
}: {
  property: PropertyIpSettings;
  currentIp: string | null;
  canManage: boolean;
}) {
  const [enabled, setEnabled] = useState(property.ipRestrictionEnabled);
  const [ips, setIps] = useState<string[]>(property.allowedIps);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  function addIp(value: string) {
    const v = value.trim();
    setError(null);
    if (!v) return;
    if (!isValidIpOrCidr(v)) {
      setError(`"${v}" no es una IP o CIDR válido.`);
      return;
    }
    if (ips.includes(v)) {
      setDraft('');
      return;
    }
    setIps([...ips, v]);
    setDraft('');
  }

  function removeIp(value: string) {
    setIps(ips.filter((ip) => ip !== value));
  }

  function handleSave() {
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const result = await updatePropertyIpRestriction({
        propertyId: property.id,
        ipRestrictionEnabled: enabled,
        allowedIps: ips,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      // The server may have auto-added the admin's current IP on enable.
      setIps(result.data.allowedIps);
      setSavedAt(Date.now());
    });
  }

  const currentIpAlreadyListed = currentIp ? ips.includes(currentIp) : true;
  const dirty =
    enabled !== property.ipRestrictionEnabled ||
    ips.length !== property.allowedIps.length ||
    ips.some((ip) => !property.allowedIps.includes(ip));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#1a2632]">
      {/* Header with toggle */}
      <div className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-slate-100 p-3 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <span className="material-icons">apartment</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {property.name}
              </h3>
              <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {property.code}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {enabled
                ? 'Restricción activa — solo se permite el acceso desde las IPs de la lista.'
                : 'Acceso abierto — sin restricción de IP.'}
            </p>
          </div>
        </div>

        {/* Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!canManage}
          onClick={() => {
            setEnabled(!enabled);
            setError(null);
            setSavedAt(null);
          }}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            enabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Body */}
      {enabled && (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          {/* IP list */}
          {ips.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {ips.map((ip) => (
                <span
                  key={ip}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-sm font-mono text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {ip}
                  {currentIp === ip && (
                    <span className="rounded-full bg-blue-100 px-1.5 text-[10px] font-sans font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                      tú
                    </span>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => removeIp(ip)}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                      aria-label={`Quitar ${ip}`}
                    >
                      <span className="material-icons text-base">close</span>
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-sm text-slate-400">
              Aún no has añadido ninguna IP permitida.
            </p>
          )}

          {/* Add IP row */}
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addIp(draft);
                  }
                }}
                placeholder="203.0.113.10 o 203.0.113.0/24"
                className="min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono outline-none transition-shadow placeholder:font-sans placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900"
              />
              <button
                type="button"
                onClick={() => addIp(draft)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <span className="material-icons text-lg">add</span>
                Añadir
              </button>
              {currentIp && !currentIpAlreadyListed && (
                <button
                  type="button"
                  onClick={() => addIp(currentIp)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
                >
                  <span className="material-icons text-lg">my_location</span>
                  Añadir mi IP
                </button>
              )}
            </div>
          )}

          {enabled && !currentIpAlreadyListed && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <span className="material-icons text-sm">warning</span>
              Tu IP actual no está en la lista. Se añadirá automáticamente al
              guardar para que no pierdas el acceso.
            </p>
          )}
        </div>
      )}

      {/* Footer */}
      {canManage && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-slate-800 dark:bg-white/5">
          <div className="text-sm">
            {error && (
              <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <span className="material-icons text-base">error_outline</span>
                {error}
              </span>
            )}
            {savedAt && !error && (
              <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <span className="material-icons text-base">check_circle</span>
                Cambios guardados
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !dirty}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm shadow-primary/30 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <>
                <span className="material-icons animate-spin text-lg">progress_activity</span>
                Guardando...
              </>
            ) : (
              <>
                <span className="material-icons text-lg">save</span>
                Guardar
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
