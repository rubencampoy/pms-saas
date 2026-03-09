'use client';

import { useState, useTransition } from 'react';
import { createGuest, updateGuest, checkDuplicateGuests } from '@/server/actions/guests';

interface GuestData {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  documentType: string | null;
  documentNumber: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  vipStatus: string;
  notes: string | null;
  address: unknown;
}

interface GuestFormDialogProps {
  editData?: GuestData;
  onClose: () => void;
}

export function GuestFormDialog({ editData, onClose }: GuestFormDialogProps) {
  const isEdit = !!editData;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const [firstName, setFirstName] = useState(editData?.firstName ?? '');
  const [lastName, setLastName] = useState(editData?.lastName ?? '');
  const [email, setEmail] = useState(editData?.email ?? '');
  const [phone, setPhone] = useState(editData?.phone ?? '');
  const [documentType, setDocumentType] = useState(editData?.documentType ?? '');
  const [documentNumber, setDocumentNumber] = useState(editData?.documentNumber ?? '');
  const [nationality, setNationality] = useState(editData?.nationality ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(editData?.dateOfBirth ?? '');
  const [vipStatus, setVipStatus] = useState(editData?.vipStatus ?? 'none');
  const [notes, setNotes] = useState(editData?.notes ?? '');

  async function handleEmailBlur() {
    if (!email || isEdit) return;
    const duplicates = await checkDuplicateGuests(email);
    if (duplicates.length > 0) {
      const names = duplicates.map((d) => `${d.firstName} ${d.lastName}`).join(', ');
      setDuplicateWarning(`Possible duplicate: ${names}`);
    } else {
      setDuplicateWarning(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const input = {
        firstName,
        lastName,
        email: email || undefined,
        phone: phone || undefined,
        documentType: documentType
          ? (documentType as 'passport' | 'national_id' | 'driving_license' | 'other')
          : undefined,
        documentNumber: documentNumber || undefined,
        nationality: nationality || undefined,
        dateOfBirth: dateOfBirth || undefined,
        vipStatus: vipStatus as 'none' | 'silver' | 'gold' | 'platinum',
        notes: notes || undefined,
      };

      const result = isEdit
        ? await updateGuest({ id: editData.id, ...input })
        : await createGuest(input);

      if (!result.success) {
        setError(result.error);
        return;
      }

      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-[#1a2632] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEdit ? 'Edit Guest' : 'New Guest'}
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

          {duplicateWarning && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              <span className="material-icons text-lg">warning</span>
              {duplicateWarning}
            </div>
          )}

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                First Name *
              </label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                placeholder="John"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Last Name *
              </label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                placeholder="Doe"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleEmailBlur}
                placeholder="john@example.com"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Phone
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Document */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Document Type
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none appearance-none"
              >
                <option value="">None</option>
                <option value="passport">Passport</option>
                <option value="national_id">National ID</option>
                <option value="driving_license">Driving License</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Document Number
              </label>
              <input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="AB123456"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Nationality & DOB */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nationality
              </label>
              <input
                value={nationality}
                onChange={(e) => setNationality(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="ES"
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400"
              />
              <p className="text-[10px] text-slate-400">ISO 3166-1 alpha-2 code</p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Date of Birth
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none"
              />
            </div>
          </div>

          {/* VIP Status */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              VIP Status
            </label>
            <div className="flex items-center gap-2">
              {(['none', 'silver', 'gold', 'platinum'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setVipStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    vipStatus === status
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {status === 'none' ? 'None' : (
                    <>
                      <span className="material-icons text-[10px] mr-0.5 align-middle">star</span>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Internal notes about this guest..."
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow outline-none placeholder:text-slate-400 resize-none"
            />
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
                  <span className="material-icons text-lg">{isEdit ? 'save' : 'person_add'}</span>
                  {isEdit ? 'Save Changes' : 'Create Guest'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
