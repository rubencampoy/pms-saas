'use client';

interface UnsavedChangesBarProps {
  count: number;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function UnsavedChangesBar({ count, isSaving, onSave, onDiscard }: UnsavedChangesBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 md:left-64 right-0 z-50 bg-white dark:bg-[#1a2632] border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.15)] px-6 py-3 flex items-center justify-between animate-in slide-in-from-bottom-2">
      <div className="flex items-center gap-3">
        <span className="material-icons text-amber-500 text-xl">edit_note</span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {count} unsaved change{count !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onDiscard}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
        >
          <span className="material-icons text-lg">undo</span>
          Discard
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-sm shadow-primary/30 disabled:opacity-50"
        >
          <span className="material-icons text-lg">save</span>
          {isSaving ? 'Saving...' : 'Save All'}
        </button>
      </div>
    </div>
  );
}
