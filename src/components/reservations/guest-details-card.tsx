'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { updateGuest } from '@/server/actions/guests';

// ── Types ──

interface GuestAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface GuestCardData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  vipStatus: string;
  nationality: string | null;
  documentType: string | null;
  documentNumber: string | null;
  dateOfBirth: string | null;
  address: GuestAddress | null;
  notes: string | null;
  totalStays: number;
  totalRevenue: string;
}

interface GuestDetailsCardProps {
  guest: GuestCardData;
  canEdit?: boolean;
}

// ── Config ──

const VIP_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  gold: {
    label: 'VIP Gold',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-200 dark:border-amber-800',
  },
  platinum: {
    label: 'VIP Platinum',
    color: 'text-purple-700 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    border: 'border-purple-200 dark:border-purple-800',
  },
  diamond: {
    label: 'VIP Diamond',
    color: 'text-cyan-700 dark:text-cyan-400',
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    border: 'border-cyan-200 dark:border-cyan-800',
  },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  passport: 'Pasaporte',
  national_id: 'DNI / NIF',
  id_card: 'DNI / NIF',
  driving_license: 'Permiso Conducir',
  drivers_license: 'Permiso Conducir',
  other: 'Otro',
};

const VIP_OPTIONS = [
  { value: 'none', label: 'Ninguno', icon: '' },
  { value: 'gold', label: 'Gold', icon: '⭐' },
  { value: 'platinum', label: 'Platinum', icon: '💎' },
  { value: 'diamond', label: 'Diamond', icon: '👑' },
] as const;

const DOC_OPTIONS = [
  { value: '', label: 'Seleccionar...' },
  { value: 'national_id', label: 'DNI / NIF' },
  { value: 'passport', label: 'Pasaporte' },
  { value: 'driving_license', label: 'Permiso de conducir' },
  { value: 'other', label: 'Otro' },
] as const;

// ── Helpers ──

function fmtCurrency(amount: string): string {
  return `${Number(amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function formatAddress(address: GuestAddress | null): string | null {
  if (!address) return null;
  const parts: string[] = [];
  if (address.street) parts.push(address.street);
  const cityLine = [address.postalCode, address.city, address.state].filter(Boolean).join(' ');
  if (cityLine) parts.push(cityLine);
  if (address.country) parts.push(address.country);
  return parts.length > 0 ? parts.join(', ') : null;
}

// ── Component ──

export function GuestDetailsCard({ guest, canEdit = true }: GuestDetailsCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  // Edit form state
  const [form, setForm] = useState({
    firstName: guest.firstName,
    lastName: guest.lastName,
    email: guest.email ?? '',
    phone: guest.phone ?? '',
    nationality: guest.nationality ?? '',
    dateOfBirth: guest.dateOfBirth ?? '',
    documentType: guest.documentType ?? '',
    documentNumber: guest.documentNumber ?? '',
    notes: guest.notes ?? '',
    vipStatus: guest.vipStatus,
    street: (guest.address as GuestAddress)?.street ?? '',
    city: (guest.address as GuestAddress)?.city ?? '',
    postalCode: (guest.address as GuestAddress)?.postalCode ?? '',
    country: (guest.address as GuestAddress)?.country ?? '',
  });

  // Live guest data (updated after save)
  const [liveGuest, setLiveGuest] = useState(guest);

  const vipConf = liveGuest.vipStatus !== 'none' ? VIP_CONFIG[liveGuest.vipStatus] : null;
  const initials = `${liveGuest.firstName.charAt(0)}${liveGuest.lastName.charAt(0)}`.toUpperCase();
  const addressStr = formatAddress(liveGuest.address);

  function handleStartEdit() {
    setForm({
      firstName: liveGuest.firstName,
      lastName: liveGuest.lastName,
      email: liveGuest.email ?? '',
      phone: liveGuest.phone ?? '',
      nationality: liveGuest.nationality ?? '',
      dateOfBirth: liveGuest.dateOfBirth ?? '',
      documentType: liveGuest.documentType ?? '',
      documentNumber: liveGuest.documentNumber ?? '',
      notes: liveGuest.notes ?? '',
      vipStatus: liveGuest.vipStatus,
      street: (liveGuest.address as GuestAddress)?.street ?? '',
      city: (liveGuest.address as GuestAddress)?.city ?? '',
      postalCode: (liveGuest.address as GuestAddress)?.postalCode ?? '',
      country: (liveGuest.address as GuestAddress)?.country ?? '',
    });
    setError(null);
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setError(null);
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateGuest({
        id: liveGuest.id,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        nationality: form.nationality || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        documentType: (form.documentType || undefined) as 'passport' | 'national_id' | 'driving_license' | 'other' | undefined,
        documentNumber: form.documentNumber || undefined,
        notes: form.notes || undefined,
        vipStatus: form.vipStatus as 'none' | 'gold' | 'platinum' | 'diamond',
        address: (form.street || form.city || form.postalCode || form.country)
          ? {
              street: form.street || undefined,
              city: form.city || undefined,
              postalCode: form.postalCode || undefined,
              country: form.country || undefined,
            }
          : undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Update live data
      setLiveGuest({
        ...liveGuest,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || null,
        phone: form.phone || null,
        nationality: form.nationality || null,
        dateOfBirth: form.dateOfBirth || null,
        documentType: form.documentType || null,
        documentNumber: form.documentNumber || null,
        notes: form.notes || null,
        vipStatus: form.vipStatus,
        address: (form.street || form.city || form.postalCode || form.country)
          ? { street: form.street, city: form.city, postalCode: form.postalCode, country: form.country }
          : null,
      });

      setIsEditing(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    });
  }

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const inputClass =
    'w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all';

  // ─── EDIT MODE ───
  if (isEditing) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border-2 border-primary/30 shadow-sm shadow-primary/5 overflow-hidden">
        {/* Header */}
        <div className="relative">
          <div className="h-16 bg-gradient-to-r from-primary/10 via-blue-50 to-indigo-50 dark:from-primary/20 dark:via-slate-800 dark:to-slate-800" />
          <div className="absolute -bottom-7 left-5">
            <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/20 ring-4 ring-white dark:ring-slate-900">
              {initials}
            </div>
          </div>
          <div className="absolute top-3 right-3">
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full flex items-center gap-1">
              <span className="material-icons text-sm">edit</span>
              Editando
            </span>
          </div>
        </div>

        <div className="pt-9 px-5 pb-5">
          {/* Error */}
          {error && (
            <div className="mb-4 flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
              <span className="material-icons text-lg">error</span>
              {error}
            </div>
          )}

          {/* Name */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Nombre</label>
              <input type="text" value={form.firstName} onChange={(e) => updateField('firstName', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Apellidos</label>
              <input type="text" value={form.lastName} onChange={(e) => updateField('lastName', e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Email</label>
              <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Teléfono</label>
              <input type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Nationality & DOB */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Nacionalidad</label>
              <input type="text" value={form.nationality} onChange={(e) => updateField('nationality', e.target.value)} placeholder="ES" maxLength={2} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Fecha nacimiento</label>
              <input type="date" value={form.dateOfBirth} onChange={(e) => updateField('dateOfBirth', e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Document */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Tipo documento</label>
              <select value={form.documentType} onChange={(e) => updateField('documentType', e.target.value)} className={`${inputClass} appearance-none cursor-pointer`}>
                {DOC_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Nº documento</label>
              <input type="text" value={form.documentNumber} onChange={(e) => updateField('documentNumber', e.target.value)} className={inputClass} />
            </div>
          </div>

          {/* Address */}
          <div className="mb-3">
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Dirección</label>
            <input type="text" value={form.street} onChange={(e) => updateField('street', e.target.value)} placeholder="Calle y número" className={`${inputClass} mb-2`} />
            <div className="grid grid-cols-3 gap-2">
              <input type="text" value={form.postalCode} onChange={(e) => updateField('postalCode', e.target.value)} placeholder="CP" className={inputClass} />
              <input type="text" value={form.city} onChange={(e) => updateField('city', e.target.value)} placeholder="Ciudad" className={inputClass} />
              <input type="text" value={form.country} onChange={(e) => updateField('country', e.target.value)} placeholder="País" className={inputClass} />
            </div>
          </div>

          {/* Notes */}
          <div className="mb-3">
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Notas del huésped</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Alergias, preferencias, observaciones..."
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* VIP */}
          <div className="mb-4">
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">Estado VIP</label>
            <div className="flex gap-2 flex-wrap">
              {VIP_OPTIONS.map((opt) => {
                const isActive = form.vipStatus === opt.value;
                const conf = opt.value !== 'none' ? VIP_CONFIG[opt.value] : null;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateField('vipStatus', opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      isActive
                        ? conf
                          ? `${conf.bg} ${conf.color} ${conf.border} ring-2 ring-offset-1 dark:ring-offset-slate-900`
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 ring-2 ring-slate-300 ring-offset-1 dark:ring-offset-slate-900'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    {opt.icon ? `${opt.icon} ` : ''}{opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <span className="material-icons animate-spin text-lg">progress_activity</span>
                  Guardando...
                </>
              ) : (
                <>
                  <span className="material-icons text-lg">save</span>
                  Guardar cambios
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── VIEW MODE ───
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header with gradient */}
      <div className="relative">
        <div className="h-16 bg-gradient-to-r from-primary/10 via-blue-50 to-indigo-50 dark:from-primary/20 dark:via-slate-800 dark:to-slate-800" />
        <div className="absolute -bottom-7 left-5">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/20 ring-4 ring-white dark:ring-slate-900">
            {initials}
          </div>
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1">
          {savedMsg && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full animate-pulse">
              <span className="material-icons text-sm">check_circle</span>
              Guardado
            </span>
          )}
          {canEdit && (
            <button
              onClick={handleStartEdit}
              className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-primary transition-colors shadow-sm"
              title="Editar huésped"
            >
              <span className="material-icons text-lg">edit</span>
            </button>
          )}
          <Link
            href={`/guests/${liveGuest.id}`}
            className="p-1.5 rounded-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-primary transition-colors shadow-sm"
            title="Ver perfil completo"
          >
            <span className="material-icons text-lg">open_in_new</span>
          </Link>
        </div>
      </div>

      {/* Guest info */}
      <div className="pt-9 px-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {liveGuest.firstName} {liveGuest.lastName}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {vipConf && (
                <span className={`inline-flex items-center gap-1 ${vipConf.bg} ${vipConf.color} px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider`}>
                  <span className="material-icons text-xs">star</span>
                  {vipConf.label}
                </span>
              )}
              {liveGuest.totalStays > 0 && (
                <>
                  {vipConf && <span className="text-xs text-slate-400">·</span>}
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {liveGuest.totalStays} estancia{liveGuest.totalStays !== 1 ? 's' : ''} anterior{liveGuest.totalStays !== 1 ? 'es' : ''}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Contact info */}
        <div className="mt-4 space-y-2">
          {liveGuest.email && (
            <a href={`mailto:${liveGuest.email}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-primary/5 dark:hover:bg-primary/10 group transition-colors">
              <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center group-hover:border-primary/20 group-hover:bg-primary/5 transition-colors">
                <span className="material-icons text-slate-400 group-hover:text-primary text-lg transition-colors">email</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">Email</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 truncate group-hover:text-primary transition-colors">{liveGuest.email}</p>
              </div>
              <span className="material-icons text-slate-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
            </a>
          )}
          {liveGuest.phone && (
            <a href={`tel:${liveGuest.phone}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-primary/5 dark:hover:bg-primary/10 group transition-colors">
              <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center group-hover:border-primary/20 group-hover:bg-primary/5 transition-colors">
                <span className="material-icons text-slate-400 group-hover:text-primary text-lg transition-colors">phone</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">Teléfono</p>
                <p className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">{liveGuest.phone}</p>
              </div>
              <span className="material-icons text-slate-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
            </a>
          )}
        </div>

        {/* Details grid */}
        {(liveGuest.nationality || liveGuest.dateOfBirth || liveGuest.documentType) && (
          <>
            <div className="my-4 border-t border-slate-100 dark:border-slate-800" />
            <div className="grid grid-cols-2 gap-2.5">
              {liveGuest.nationality && (
                <InfoTile icon="public" label="Nacionalidad" value={liveGuest.nationality} />
              )}
              {liveGuest.dateOfBirth && (
                <InfoTile icon="cake" label="Nacimiento" value={fmtDate(liveGuest.dateOfBirth)} />
              )}
              {liveGuest.documentType && liveGuest.documentNumber && (
                <InfoTile
                  icon="badge"
                  label="Documento"
                  value={`${DOC_TYPE_LABELS[liveGuest.documentType] ?? liveGuest.documentType} · ${liveGuest.documentNumber}`}
                />
              )}
            </div>
          </>
        )}

        {/* Address */}
        {addressStr && (
          <>
            <div className="my-4 border-t border-slate-100 dark:border-slate-800" />
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-icons text-slate-400 text-sm">location_on</span>
                <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">Dirección</p>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 pl-6 leading-relaxed">{addressStr}</p>
            </div>
          </>
        )}

        {/* Guest Notes */}
        {liveGuest.notes && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-icons text-amber-500 text-sm">sticky_note_2</span>
              <p className="text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">Notas del huésped</p>
            </div>
            <p className="text-sm text-amber-900 dark:text-amber-200 pl-6 leading-relaxed">{liveGuest.notes}</p>
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="material-icons text-slate-400 text-sm">hotel</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                <strong className="text-slate-700 dark:text-slate-300">{liveGuest.totalStays}</strong> estancias
              </span>
            </div>
            <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <span className="material-icons text-slate-400 text-sm">payments</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                <strong className="text-slate-700 dark:text-slate-300">{fmtCurrency(liveGuest.totalRevenue)}</strong> total
              </span>
            </div>
          </div>
          <Link
            href={`/guests/${liveGuest.id}`}
            className="text-xs text-primary font-semibold hover:text-primary/80 transition-colors flex items-center gap-0.5"
          >
            Historial
            <span className="material-icons text-sm">chevron_right</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function InfoTile({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-icons text-slate-400 dark:text-slate-500 text-sm">{icon}</span>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-semibold">{label}</p>
      </div>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 pl-6 truncate">{value}</p>
    </div>
  );
}
