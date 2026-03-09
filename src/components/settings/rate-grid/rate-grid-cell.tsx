'use client';

import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { type SubRowType, type CellKey, makeCellKey } from './types';

interface RateGridCellProps {
  roomTypeId: string;
  date: string;
  field: SubRowType;
  value: string | number | boolean | undefined;
  isDirty: boolean;
  isEditing: boolean;
  isFocused: boolean;
  isSelected: boolean;
  isWeekend: boolean;
  isToday: boolean;
  onStartEdit: (key: CellKey) => void;
  onCommitEdit: (key: CellKey, value: string | number | boolean) => void;
  onCancelEdit: () => void;
  onSelect: (key: CellKey, shiftHeld: boolean) => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right') => void;
}

export const RateGridCell = memo(function RateGridCell({
  roomTypeId,
  date,
  field,
  value,
  isDirty,
  isEditing,
  isFocused,
  isSelected,
  isWeekend,
  isToday,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onSelect,
  onNavigate,
}: RateGridCellProps) {
  const cellKey = makeCellKey(roomTypeId, date, field);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (field === 'cta' || field === 'ctd') {
        onCommitEdit(cellKey, !value);
        return;
      }
      onSelect(cellKey, e.shiftKey);
    },
    [cellKey, field, value, onCommitEdit, onSelect],
  );

  const handleDoubleClick = useCallback(() => {
    if (field === 'cta' || field === 'ctd') return;
    onStartEdit(cellKey);
  }, [cellKey, field, onStartEdit]);

  // Background classes
  const bgClass = isToday
    ? 'bg-primary/5 dark:bg-primary/10'
    : isWeekend
      ? 'bg-amber-50/40 dark:bg-amber-900/10'
      : '';

  const focusClass = isFocused
    ? 'ring-2 ring-primary ring-inset'
    : isSelected
      ? 'ring-1 ring-primary/40 ring-inset bg-primary/5'
      : '';

  // Checkbox cell (CTA/CTD)
  if (field === 'cta' || field === 'ctd') {
    const checked = value === true;
    return (
      <td
        className={`p-1 text-center border-r border-slate-100 dark:border-slate-700/30 cursor-pointer relative ${bgClass} ${focusClass}`}
        onClick={handleClick}
      >
        <div className="flex items-center justify-center">
          <span className={`material-icons text-base ${checked ? 'text-red-500' : 'text-slate-300 dark:text-slate-600'}`}>
            {checked ? 'block' : 'radio_button_unchecked'}
          </span>
        </div>
        {isDirty && <DirtyIndicator />}
      </td>
    );
  }

  // Editing mode — render inline input
  if (isEditing) {
    return (
      <td className={`p-0.5 border-r border-slate-100 dark:border-slate-700/30 ${bgClass}`}>
        <CellInput
          cellKey={cellKey}
          field={field}
          initialValue={value !== undefined ? String(value) : ''}
          onCommit={onCommitEdit}
          onCancel={onCancelEdit}
          onNavigate={onNavigate}
        />
      </td>
    );
  }

  // Display mode
  const displayText = formatDisplayValue(value, field);

  return (
    <td
      className={`p-1 text-center border-r border-slate-100 dark:border-slate-700/30 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors relative ${bgClass} ${focusClass}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {displayText ? (
        <span className={`text-sm tabular-nums ${field === 'price' ? 'font-semibold text-slate-800 dark:text-white' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
          {displayText}
        </span>
      ) : (
        <span className="text-xs text-slate-300 dark:text-slate-600">&mdash;</span>
      )}
      {isDirty && <DirtyIndicator />}
    </td>
  );
});

/** Inline editing input — rendered only when the cell is in edit mode */
function CellInput({
  cellKey,
  field,
  initialValue,
  onCommit,
  onCancel,
  onNavigate,
}: {
  cellKey: CellKey;
  field: SubRowType;
  initialValue: string;
  onCommit: (key: CellKey, value: string | number | boolean) => void;
  onCancel: () => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right') => void;
}) {
  const [editValue, setEditValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = parseInputValue(editValue, field);
        if (val !== null) {
          onCommit(cellKey, val);
          onNavigate('down');
        }
      } else if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const val = parseInputValue(editValue, field);
        if (val !== null) {
          onCommit(cellKey, val);
          onNavigate(e.shiftKey ? 'left' : 'right');
        }
      }
    },
    [cellKey, editValue, field, onCommit, onCancel, onNavigate],
  );

  const handleBlur = useCallback(() => {
    const val = parseInputValue(editValue, field);
    if (val !== null) {
      onCommit(cellKey, val);
    } else {
      onCancel();
    }
  }, [cellKey, editValue, field, onCommit, onCancel]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="w-full h-full text-center text-sm font-semibold tabular-nums bg-primary/10 dark:bg-primary/20 border border-primary rounded px-1 py-1 outline-none text-slate-900 dark:text-white"
    />
  );
}

function DirtyIndicator() {
  return (
    <div className="absolute top-0 right-0 w-0 h-0 border-t-[6px] border-t-primary border-l-[6px] border-l-transparent" />
  );
}

function formatDisplayValue(value: string | number | boolean | undefined, field: SubRowType): string {
  if (value === undefined || value === null) return '';
  switch (field) {
    case 'price': {
      const num = parseFloat(String(value));
      return isNaN(num) ? '' : `€${num.toFixed(0)}`;
    }
    case 'minStay':
    case 'maxStay': {
      const num = Number(value);
      return isNaN(num) || num <= 0 ? '' : String(num);
    }
    default:
      return '';
  }
}

function parseInputValue(raw: string, field: SubRowType): string | number | null {
  const trimmed = raw.trim().replace('€', '');
  if (!trimmed) return null;

  switch (field) {
    case 'price': {
      const match = trimmed.match(/^\d+(\.\d{0,2})?$/);
      if (!match) return null;
      return trimmed;
    }
    case 'minStay':
    case 'maxStay': {
      const num = parseInt(trimmed, 10);
      if (isNaN(num) || num < 1) return null;
      return num;
    }
    default:
      return null;
  }
}
