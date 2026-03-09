'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, addDays, addMonths, subMonths, parseISO, isSameDay, getDay } from 'date-fns';
import { batchUpdateRates } from '@/server/actions/rates';
import { toast } from '@/lib/hooks/use-toast';
import {
  type SubRowType,
  type CellKey,
  type PendingChange,
  type DisplayOptions,
  type CellSelection,
  ALL_SUB_ROWS,
  DEFAULT_DISPLAY_OPTIONS,
  makeCellKey,
  parseCellKey,
} from './types';

interface Rate {
  id: string;
  ratePlanId: string;
  roomTypeId: string;
  date: string;
  amount: string;
  currency: string;
  minStay: number;
  maxStay: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
}

interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  color: string;
}

interface UseRateGridStateProps {
  rates: Rate[];
  roomTypes: RoomType[];
  seasons: Season[];
  startDate: string;
  endDate: string;
  selectedPlanId: string;
}

export function useRateGridState({
  rates,
  roomTypes,
  seasons,
  startDate,
  endDate,
  selectedPlanId,
}: UseRateGridStateProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Display options
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>(DEFAULT_DISPLAY_OPTIONS);

  // Pending changes (optimistic edits)
  const [pendingChanges, setPendingChanges] = useState<Map<CellKey, PendingChange>>(new Map());

  // Currently editing cell
  const [editingCell, setEditingCell] = useState<CellKey | null>(null);

  // Focused cell for keyboard navigation
  const [focusedCell, setFocusedCell] = useState<CellKey | null>(null);

  // Selection state
  const [selection, setSelection] = useState<CellSelection | null>(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);

  // Days array
  const days = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const result: Date[] = [];
    let current = start;
    while (current < end) {
      result.push(current);
      current = addDays(current, 1);
    }
    return result;
  }, [startDate, endDate]);

  // Sorted room types
  const sortedRoomTypes = useMemo(
    () => [...roomTypes].sort((a, b) => a.sortOrder - b.sortOrder),
    [roomTypes],
  );

  // Visible sub-rows based on display options
  const visibleSubRows = useMemo(
    () => ALL_SUB_ROWS.filter((sr) => displayOptions[sr]),
    [displayOptions],
  );

  // Rate lookup: ratePlanId → roomTypeId → date → Rate
  const rateMap = useMemo(() => {
    const map = new Map<string, Map<string, Rate>>();
    for (const r of rates) {
      if (r.ratePlanId !== selectedPlanId) continue;
      const roomMap = map.get(r.roomTypeId) ?? new Map<string, Rate>();
      roomMap.set(r.date, r);
      map.set(r.roomTypeId, roomMap);
    }
    return map;
  }, [rates, selectedPlanId]);

  // Get raw rate data for a cell
  const getRate = useCallback(
    (roomTypeId: string, date: string): Rate | undefined => {
      return rateMap.get(roomTypeId)?.get(date);
    },
    [rateMap],
  );

  // Get the display value (pending change or original)
  const getDisplayValue = useCallback(
    (roomTypeId: string, date: string, field: SubRowType): string | number | boolean | undefined => {
      const key = makeCellKey(roomTypeId, date, field);
      const pending = pendingChanges.get(key);
      if (pending) return pending.value;

      const rate = getRate(roomTypeId, date);
      if (!rate) return undefined;

      switch (field) {
        case 'price': return rate.amount;
        case 'minStay': return rate.minStay;
        case 'maxStay': return rate.maxStay ?? undefined;
        case 'cta': return rate.closedToArrival;
        case 'ctd': return rate.closedToDeparture;
      }
    },
    [pendingChanges, getRate],
  );

  // Check if a cell has a pending change
  const isDirty = useCallback(
    (key: CellKey): boolean => pendingChanges.has(key),
    [pendingChanges],
  );

  // Cell matrix for keyboard navigation
  const cellMatrix = useMemo(() => {
    const rows: CellKey[][] = [];
    for (const rt of sortedRoomTypes) {
      for (const subRow of visibleSubRows) {
        const row: CellKey[] = days.map((d) =>
          makeCellKey(rt.id, format(d, 'yyyy-MM-dd'), subRow),
        );
        rows.push(row);
      }
    }
    return rows;
  }, [sortedRoomTypes, visibleSubRows, days]);

  // Find cell position in matrix
  const findCellPosition = useCallback(
    (key: CellKey): [number, number] | null => {
      for (let r = 0; r < cellMatrix.length; r++) {
        const c = cellMatrix[r]!.indexOf(key);
        if (c !== -1) return [r, c];
      }
      return null;
    },
    [cellMatrix],
  );

  // Season lookup for a date
  const getSeasonForDate = useCallback(
    (date: string): Season | undefined => {
      return seasons.find((s) => date >= s.startDate && date <= s.endDate);
    },
    [seasons],
  );

  // ── Edit lifecycle ──

  const startEditing = useCallback((key: CellKey) => {
    setEditingCell(key);
    setFocusedCell(key);
  }, []);

  const commitEdit = useCallback(
    (key: CellKey, value: string | number | boolean) => {
      const { roomTypeId, date, field } = parseCellKey(key);
      const rate = getRate(roomTypeId, date);

      // Get original value
      let originalValue: string | number | boolean | undefined;
      if (rate) {
        switch (field) {
          case 'price': originalValue = rate.amount; break;
          case 'minStay': originalValue = rate.minStay; break;
          case 'maxStay': originalValue = rate.maxStay ?? undefined; break;
          case 'cta': originalValue = rate.closedToArrival; break;
          case 'ctd': originalValue = rate.closedToDeparture; break;
        }
      }

      // If value matches original, remove pending change
      if (originalValue !== undefined && String(value) === String(originalValue)) {
        setPendingChanges((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      } else {
        setPendingChanges((prev) => {
          const next = new Map(prev);
          next.set(key, {
            ratePlanId: selectedPlanId,
            roomTypeId,
            date,
            field,
            value,
            originalValue,
          });
          return next;
        });
      }

      setEditingCell(null);
    },
    [getRate, selectedPlanId],
  );

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  // ── Selection ──

  const selectCell = useCallback(
    (key: CellKey, isShiftHeld: boolean) => {
      setFocusedCell(key);

      if (!isShiftHeld) {
        setSelection({
          anchorKey: key,
          currentKey: key,
          selectedKeys: new Set([key]),
        });
        return;
      }

      // Shift+click: extend selection from anchor
      setSelection((prev) => {
        const anchor = prev?.anchorKey ?? key;
        const anchorPos = findCellPosition(anchor);
        const currentPos = findCellPosition(key);

        if (!anchorPos || !currentPos) {
          return { anchorKey: key, currentKey: key, selectedKeys: new Set([key]) };
        }

        const minRow = Math.min(anchorPos[0], currentPos[0]);
        const maxRow = Math.max(anchorPos[0], currentPos[0]);
        const minCol = Math.min(anchorPos[1], currentPos[1]);
        const maxCol = Math.max(anchorPos[1], currentPos[1]);

        const keys = new Set<CellKey>();
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const cellKey = cellMatrix[r]?.[c];
            if (cellKey) keys.add(cellKey);
          }
        }

        return { anchorKey: anchor, currentKey: key, selectedKeys: keys };
      });
    },
    [findCellPosition, cellMatrix],
  );

  const clearSelection = useCallback(() => {
    setSelection(null);
  }, []);

  const applyBulkValue = useCallback(
    (value: string | number | boolean) => {
      if (!selection || selection.selectedKeys.size === 0) return;

      setPendingChanges((prev) => {
        const next = new Map(prev);
        for (const key of selection.selectedKeys) {
          const { roomTypeId, date, field } = parseCellKey(key);
          const rate = getRate(roomTypeId, date);

          let originalValue: string | number | boolean | undefined;
          if (rate) {
            switch (field) {
              case 'price': originalValue = rate.amount; break;
              case 'minStay': originalValue = rate.minStay; break;
              case 'maxStay': originalValue = rate.maxStay ?? undefined; break;
              case 'cta': originalValue = rate.closedToArrival; break;
              case 'ctd': originalValue = rate.closedToDeparture; break;
            }
          }

          next.set(key, {
            ratePlanId: selectedPlanId,
            roomTypeId,
            date,
            field,
            value,
            originalValue,
          });
        }
        return next;
      });

      clearSelection();
    },
    [selection, getRate, selectedPlanId, clearSelection],
  );

  // ── Keyboard navigation ──

  const navigateTo = useCallback(
    (direction: 'up' | 'down' | 'left' | 'right') => {
      if (!focusedCell) return;

      const pos = findCellPosition(focusedCell);
      if (!pos) return;

      let [row, col] = pos;
      switch (direction) {
        case 'up': row = Math.max(0, row - 1); break;
        case 'down': row = Math.min(cellMatrix.length - 1, row + 1); break;
        case 'left': col = Math.max(0, col - 1); break;
        case 'right': col = Math.min((cellMatrix[0]?.length ?? 1) - 1, col + 1); break;
      }

      const nextKey = cellMatrix[row]?.[col];
      if (nextKey) {
        setFocusedCell(nextKey);
        setEditingCell(null);
        clearSelection();
      }
    },
    [focusedCell, findCellPosition, cellMatrix, clearSelection],
  );

  // ── Date navigation ──

  const navigateToDate = useCallback(
    (date: Date) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('start', format(date, 'yyyy-MM-dd'));
      if (selectedPlanId) params.set('planId', selectedPlanId);
      router.push(`/settings/rates?${params.toString()}`);
    },
    [router, searchParams, selectedPlanId],
  );

  const goToToday = useCallback(() => {
    navigateToDate(new Date());
  }, [navigateToDate]);

  const goToPrevMonth = useCallback(() => {
    navigateToDate(subMonths(parseISO(startDate), 1));
  }, [navigateToDate, startDate]);

  const goToNextMonth = useCallback(() => {
    navigateToDate(addMonths(parseISO(startDate), 1));
  }, [navigateToDate, startDate]);

  // ── Save / Discard ──

  const saveAllChanges = useCallback(async () => {
    if (pendingChanges.size === 0) return;
    setIsSaving(true);

    // Group field-level changes into per-rate objects
    const changeMap = new Map<string, {
      ratePlanId: string;
      roomTypeId: string;
      date: string;
      amount?: string;
      minStay?: number;
      maxStay?: number | null;
      closedToArrival?: boolean;
      closedToDeparture?: boolean;
    }>();

    for (const [, change] of pendingChanges) {
      const cellId = `${change.ratePlanId}:${change.roomTypeId}:${change.date}`;
      const existing = changeMap.get(cellId) ?? {
        ratePlanId: change.ratePlanId,
        roomTypeId: change.roomTypeId,
        date: change.date,
      };

      switch (change.field) {
        case 'price':
          existing.amount = String(change.value);
          break;
        case 'minStay':
          existing.minStay = Number(change.value);
          break;
        case 'maxStay':
          existing.maxStay = change.value ? Number(change.value) : null;
          break;
        case 'cta':
          existing.closedToArrival = Boolean(change.value);
          break;
        case 'ctd':
          existing.closedToDeparture = Boolean(change.value);
          break;
      }

      changeMap.set(cellId, existing);
    }

    const result = await batchUpdateRates({
      changes: Array.from(changeMap.values()),
    });

    if (result.success) {
      toast({ variant: 'success', title: `${result.data.count} rates updated` });
      setPendingChanges(new Map());
    } else {
      toast({ variant: 'error', title: 'Save failed', description: result.error });
    }

    setIsSaving(false);
  }, [pendingChanges]);

  const discardAllChanges = useCallback(() => {
    if (pendingChanges.size > 5) {
      if (!confirm(`Discard ${pendingChanges.size} unsaved changes?`)) return;
    }
    setPendingChanges(new Map());
    setEditingCell(null);
    clearSelection();
  }, [pendingChanges.size, clearSelection]);

  // ── beforeunload guard ──
  useEffect(() => {
    if (pendingChanges.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingChanges.size]);

  // ── Weekend / Today helpers ──

  const isWeekendDay = useCallback((date: Date): boolean => {
    const day = getDay(date);
    return day === 5 || day === 6; // Friday or Saturday
  }, []);

  const isToday = useCallback((date: Date): boolean => {
    return isSameDay(date, new Date());
  }, []);

  return {
    // Data
    days,
    sortedRoomTypes,
    visibleSubRows,
    seasons,

    // Display
    displayOptions,
    setDisplayOptions: (opts: Partial<DisplayOptions>) =>
      setDisplayOptions((prev) => ({ ...prev, ...opts })),

    // Values
    getDisplayValue,
    getRate,
    isDirty,
    getSeasonForDate,
    isWeekendDay,
    isToday,

    // Edit state
    editingCell,
    startEditing,
    commitEdit,
    cancelEdit,

    // Focus / keyboard
    focusedCell,
    setFocusedCell,
    navigateTo,

    // Selection
    selection,
    selectCell,
    clearSelection,
    applyBulkValue,

    // Pending changes
    pendingChanges,
    pendingCount: pendingChanges.size,

    // Save / Discard
    isSaving,
    saveAllChanges,
    discardAllChanges,

    // Date navigation
    goToToday,
    goToPrevMonth,
    goToNextMonth,
    startDate,

    // Plan
    selectedPlanId,
  };
}

export type RateGridState = ReturnType<typeof useRateGridState>;
