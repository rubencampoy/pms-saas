'use client';

import { useState, useTransition } from 'react';
import { updateProperty, deleteProperty } from '@/server/actions/properties';

interface Property {
  id: string;
  name: string;
  code: string;
  address: unknown;
  phone: string | null;
  email: string | null;
  checkInTime: string;
  checkOutTime: string;
  timezone: string;
  isActive: boolean;
}

interface RoomType {
  id: string;
  propertyId: string;
}

interface Unit {
  id: string;
  propertyId: string;
}

interface PropertiesClientProps {
  properties: Property[];
  roomTypes: RoomType[];
  units: Unit[];
}

/**
 * The property's UUID, which is what an integration (the guest-app, or any
 * other API consumer) has to be configured with. It appears nowhere else in
 * the app — not in a URL, not in the edit dialog — so without this row the
 * only way to get it was to read it out of another system's error message.
 */
function IntegrationId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS) el texto sigue ahí para
      // seleccionarlo a mano; no hay nada que avisar.
    }
  }

  return (
    <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800">
      <span className="material-icons text-base text-slate-400">vpn_key</span>
      <span
        className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0"
        title="Identificador de esta propiedad para las integraciones por API"
      >
        ID de integración
      </span>
      <code className="font-mono text-xs text-slate-700 dark:text-slate-200 truncate">{id}</code>
      <button
        type="button"
        onClick={copy}
        aria-label="Copiar el ID de integración"
        className="ml-auto shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
      >
        <span className="material-icons text-base">{copied ? 'check' : 'content_copy'}</span>
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

function asAddress(val: unknown): Record<string, string> | null {
  if (val && typeof val === 'object' && !Array.isArray(val)) return val as Record<string, string>;
  return null;
}

export function PropertiesClient({ properties, roomTypes, units }: PropertiesClientProps) {
  const [formDialog, setFormDialog] = useState<{ open: boolean; editData?: Property }>({ open: false });
  const [isPending, startTransition] = useTransition();

  function getRoomTypeCount(propertyId: string) {
    return roomTypes.filter((rt) => rt.propertyId === propertyId).length;
  }

  function getUnitCount(propertyId: string) {
    return units.filter((u) => u.propertyId === propertyId).length;
  }

  function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this property? All associated room types and units will also be deleted.')) return;
    startTransition(async () => {
      await deleteProperty(id);
    });
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Properties</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage your properties, addresses, and check-in/check-out times.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ¿Necesitas añadir otra propiedad?
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Contacta con Chamelio PMS.
          </p>
        </div>
      </div>

      {/* Properties grid */}
      {properties.length === 0 ? (
        <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center">
          <span className="material-icons text-4xl text-slate-300 dark:text-slate-600 mb-2 block">
            apartment
          </span>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Aún no tienes propiedades. Contacta con Chamelio PMS para añadir la primera.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {properties.map((property) => (
            <div
              key={property.id}
              className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden"
            >
              {/* Card header */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                      <span className="material-icons">apartment</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {property.name}
                        </h3>
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono font-semibold text-slate-600 dark:text-slate-300">
                          {property.code}
                        </span>
                      </div>
                      {asAddress(property.address) && (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                          {[asAddress(property.address)?.street, asAddress(property.address)?.city, asAddress(property.address)?.country]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {property.isActive ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mr-1.5"></span>
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="material-icons text-lg text-slate-400">bed</span>
                    <span className="font-medium">{getRoomTypeCount(property.id)}</span> room types
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="material-icons text-lg text-slate-400">bedroom_parent</span>
                    <span className="font-medium">{getUnitCount(property.id)}</span> units
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="material-icons text-lg text-slate-400">schedule</span>
                    {property.checkInTime}–{property.checkOutTime}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <span className="material-icons text-lg text-slate-400">public</span>
                    {property.timezone}
                  </div>
                </div>

                {/* Integration id — the value external products ask for */}
                <IntegrationId id={property.id} />

                {/* Contact info */}
                {(property.phone || property.email) && (
                  <div className="flex items-center gap-4 mt-3">
                    {property.phone && (
                      <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                        <span className="material-icons text-base">phone</span>
                        {property.phone}
                      </div>
                    )}
                    {property.email && (
                      <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                        <span className="material-icons text-base">email</span>
                        {property.email}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card actions */}
              <div className="flex items-center justify-end gap-1 px-5 py-3 bg-slate-50/50 dark:bg-white/5 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setFormDialog({ open: true, editData: property })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                >
                  <span className="material-icons text-lg">edit</span>
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(property.id)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  <span className="material-icons text-lg">delete_outline</span>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Property Form Dialog */}
      {formDialog.open && (
        <PropertyFormDialog
          editData={formDialog.editData}
          onClose={() => setFormDialog({ open: false })}
        />
      )}
    </div>
  );
}

/* ─── Property Form Dialog ─── */

interface PropertyFormDialogProps {
  editData?: Property;
  onClose: () => void;
}

const TIMEZONE_OPTIONS = [
  'Europe/Madrid',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Rome',
  'Europe/Lisbon',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/Bogota',
  'America/Buenos_Aires',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Dubai',
  'Pacific/Auckland',
];

function PropertyFormDialog({ editData, onClose }: PropertyFormDialogProps) {
  const isEdit = !!editData;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const editAddress = asAddress(editData?.address);
  const [name, setName] = useState(editData?.name ?? '');
  const [code, setCode] = useState(editData?.code ?? '');
  const [street, setStreet] = useState(editAddress?.street ?? '');
  const [city, setCity] = useState(editAddress?.city ?? '');
  const [state, setState] = useState(editAddress?.state ?? '');
  const [postalCode, setPostalCode] = useState(editAddress?.postalCode ?? '');
  const [country, setCountry] = useState(editAddress?.country ?? '');
  const [phone, setPhone] = useState(editData?.phone ?? '');
  const [email, setEmail] = useState(editData?.email ?? '');
  const [checkInTime, setCheckInTime] = useState(editData?.checkInTime ?? '14:00');
  const [checkOutTime, setCheckOutTime] = useState(editData?.checkOutTime ?? '11:00');
  const [timezone, setTimezone] = useState(editData?.timezone ?? 'Europe/Madrid');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const address = { street, city, state, postalCode, country };
      const input = {
        name,
        code,
        address,
        phone: phone || undefined,
        email: email || undefined,
        checkInTime,
        checkOutTime,
        timezone,
      };

      if (!isEdit) {
        setError('La creación de propiedades está gestionada por Chamelio PMS. Contacta para añadir una.');
        return;
      }
      const result = await updateProperty({ id: editData!.id, ...input });

      if (!result.success) {
        setError(result.error);
        return;
      }

      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#1a2632] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEdit ? 'Edit Property' : 'New Property'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-icons">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
              <span className="material-icons text-lg">error_outline</span>
              {error}
            </div>
          )}

          {/* Name & Code */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Koala Hostel Essentials"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                maxLength={10}
                placeholder="KHE"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Address */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Address
            </legend>
            <input
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Street"
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State / Province"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="Postal code"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>
          </fieldset>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Phone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 666 123 456"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@property.com"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Schedule & Timezone */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Check-in Time
              </label>
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Check-out Time
              </label>
              <input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none appearance-none cursor-pointer"
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <span className="material-icons animate-spin text-lg">progress_activity</span>
                  Saving...
                </>
              ) : (
                <>
                  <span className="material-icons text-lg">{isEdit ? 'save' : 'add'}</span>
                  {isEdit ? 'Save Changes' : 'Create Property'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
