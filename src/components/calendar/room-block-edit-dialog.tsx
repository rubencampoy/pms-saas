'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';

interface RoomBlockEditDialogProps {
  block: {
    id: string;
    type: string;
    startDate: string;
    endDate: string;
    reason: string | null;
  };
  onSave: (data: { id: string; type: string; startDate: string; endDate: string; reason: string }) => Promise<void>;
  onClose: () => void;
}

export function RoomBlockEditDialog({ block, onSave, onClose }: RoomBlockEditDialogProps) {
  const t = useTranslations('roomBlockEdit');
  const backdropRef = useRef<HTMLDivElement>(null);

  const [type, setType] = useState(block.type);
  const [startDate, setStartDate] = useState(block.startDate);
  const [endDate, setEndDate] = useState(block.endDate);
  const [reason, setReason] = useState(block.reason ?? '');
  const [saving, setSaving] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving) return;
      setSaving(true);
      try {
        await onSave({
          id: block.id,
          type,
          startDate,
          endDate,
          reason,
        });
      } finally {
        setSaving(false);
      }
    },
    [block.id, type, startDate, endDate, reason, saving, onSave],
  );

  const isMaintenance = type === 'maintenance';

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-[#1a2632] rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 flex items-center gap-3 ${
          isMaintenance
            ? 'bg-amber-50 dark:bg-amber-900/20'
            : 'bg-red-50 dark:bg-red-900/20'
        }`}>
          <span className={`material-icons text-xl ${
            isMaintenance ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
          }`}>
            {isMaintenance ? 'build' : 'block'}
          </span>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('editTitle')}
          </h2>
          <button
            onClick={onClose}
            className="ml-auto text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
          >
            <span className="material-icons text-xl">close</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {t('type')}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('maintenance')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  type === 'maintenance'
                    ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <span className="material-icons text-lg">build</span>
                {t('typeMaintenance')}
              </button>
              <button
                type="button"
                onClick={() => setType('blocked')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  type === 'blocked'
                    ? 'bg-red-50 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <span className="material-icons text-lg">block</span>
                {t('typeBlocked')}
              </button>
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                {t('startDate')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                {t('endDate')}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              {t('reason')}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || !startDate || !endDate || endDate <= startDate}
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <span className="flex items-center gap-1.5">
                  <span className="material-icons text-sm animate-spin">refresh</span>
                  {t('save')}
                </span>
              ) : (
                t('save')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
