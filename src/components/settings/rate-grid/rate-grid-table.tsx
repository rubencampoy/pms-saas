'use client';

import { useCallback, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { RateGridCell } from './rate-grid-cell';
import { type SubRowType, SUB_ROW_LABELS, makeCellKey } from './types';
import type { RateGridState } from './use-rate-grid-state';

const COL_WIDTH = 80;
const SIDEBAR_WIDTH = 200;

interface RateGridTableProps {
  state: RateGridState;
}

export function RateGridTable({ state }: RateGridTableProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  const {
    days,
    sortedRoomTypes,
    visibleSubRows,
    getSeasonForDate,
    isWeekendDay,
    isToday,
    editingCell,
    startEditing,
    cancelEdit,
    focusedCell,
    navigateTo,
    selection,
    clearSelection,
  } = state;

  const handleGridKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Don't handle if we're in an input
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          navigateTo('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          navigateTo('down');
          break;
        case 'ArrowLeft':
          e.preventDefault();
          navigateTo('left');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateTo('right');
          break;
        case 'Enter':
        case 'F2':
          e.preventDefault();
          if (focusedCell) startEditing(focusedCell);
          break;
        case 'Escape':
          e.preventDefault();
          if (editingCell) {
            cancelEdit();
          } else if (selection) {
            clearSelection();
          }
          break;
        case 'Tab':
          e.preventDefault();
          navigateTo(e.shiftKey ? 'left' : 'right');
          break;
      }
    },
    [navigateTo, focusedCell, startEditing, editingCell, cancelEdit, selection, clearSelection],
  );

  // --- Drag-to-pan (click + drag to scroll horizontally) ---
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartXRef = useRef(0);
  const panStartScrollLeftRef = useRef(0);

  const handlePanMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only left-click, ignore if clicking on interactive elements
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('select') || target.closest('input')) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    isPanningRef.current = true;
    panStartXRef.current = e.clientX;
    panStartScrollLeftRef.current = container.scrollLeft;
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
  }, []);

  const handlePanMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const dx = e.clientX - panStartXRef.current;
    container.scrollLeft = panStartScrollLeftRef.current - dx;
  }, []);

  const handlePanMouseUp = useCallback(() => {
    if (!isPanningRef.current) return;
    isPanningRef.current = false;
    const container = scrollContainerRef.current;
    if (container) {
      container.style.cursor = '';
      container.style.userSelect = '';
    }
  }, []);

  const handlePanMouseLeave = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      const container = scrollContainerRef.current;
      if (container) {
        container.style.cursor = '';
        container.style.userSelect = '';
      }
    }
  }, []);

  // Global mouseup to stop panning even if mouse leaves the grid
  useEffect(() => {
    const stopPan = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        const container = scrollContainerRef.current;
        if (container) {
          container.style.cursor = '';
          container.style.userSelect = '';
        }
      }
    };
    window.addEventListener('mouseup', stopPan);
    return () => window.removeEventListener('mouseup', stopPan);
  }, []);

  // Shift+Wheel → horizontal scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const tableMinWidth = SIDEBAR_WIDTH + days.length * COL_WIDTH;

  return (
    <div
      ref={gridRef}
      className="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
      style={{ maxHeight: 'calc(100vh - 340px)' }}
      onKeyDown={handleGridKeyDown}
      tabIndex={0}
    >
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto rate-grid-scroll relative cursor-grab"
        onMouseDown={handlePanMouseDown}
        onMouseMove={handlePanMouseMove}
        onMouseUp={handlePanMouseUp}
        onMouseLeave={handlePanMouseLeave}
      >
        <table
          className="w-full border-collapse text-sm text-left"
          style={{ minWidth: tableMinWidth }}
        >
          <thead className="sticky top-0 z-20">
            {/* Season overlay row */}
            <tr>
              <th
                className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700"
                style={{ minWidth: SIDEBAR_WIDTH }}
              >
                <div className="px-4 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Season
                </div>
              </th>
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const season = getSeasonForDate(dateStr);
                return (
                  <th
                    key={dateStr}
                    className="border-b border-slate-200 dark:border-slate-700 p-0"
                    style={{ minWidth: COL_WIDTH }}
                  >
                    <div
                      className="h-3 relative group"
                      style={{ backgroundColor: season?.color ?? 'transparent' }}
                      title={season?.name}
                    >
                      {season && (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          {season.name}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>

            {/* Date header row */}
            <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
              <th
                className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                style={{ minWidth: SIDEBAR_WIDTH }}
              >
                <div className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Room Type
                </div>
              </th>
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const weekend = isWeekendDay(day);
                const today = isToday(day);
                const season = getSeasonForDate(dateStr);

                // Demand color based on whether it's a season period
                const demandColor = weekend
                  ? 'bg-rose-500'
                  : season
                    ? 'bg-amber-500'
                    : 'bg-emerald-500';

                return (
                  <th
                    key={dateStr}
                    className={`border-b border-slate-200 dark:border-slate-700 relative ${today ? 'bg-primary/5 dark:bg-primary/20' : weekend ? 'bg-slate-50/50 dark:bg-slate-800/50' : ''}`}
                    style={{ minWidth: COL_WIDTH }}
                  >
                    <div className={`absolute top-0 left-0 right-0 h-[3px] ${demandColor}`} />
                    <div className="px-1 py-2 text-center">
                      <div className={`text-[10px] font-medium ${today ? 'text-primary font-bold' : 'text-slate-400'}`}>
                        {today ? 'Today' : format(day, 'EEE')}
                      </div>
                      <div className={`text-base font-bold ${today ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                        {format(day, 'dd')}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sortedRoomTypes.map((roomType) => (
              <RoomTypeSection
                key={roomType.id}
                roomType={roomType}
                days={days}
                visibleSubRows={visibleSubRows}
                state={state}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface RoomTypeSectionProps {
  roomType: { id: string; name: string; code: string };
  days: Date[];
  visibleSubRows: SubRowType[];
  state: RateGridState;
}

function RoomTypeSection({ roomType, days, visibleSubRows, state }: RoomTypeSectionProps) {
  return (
    <>
      {visibleSubRows.map((subRow, subIdx) => {
        const isFirst = subIdx === 0;
        const isLast = subIdx === visibleSubRows.length - 1;

        return (
          <tr
            key={`${roomType.id}-${subRow}`}
            className={`group ${isLast ? 'border-b-2 border-slate-200 dark:border-slate-700' : ''} hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors`}
          >
            {/* Sticky sidebar cell */}
            <td
              className="sticky left-0 z-10 bg-white dark:bg-[#1a2632] group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 border-r border-slate-100 dark:border-slate-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
              style={{ minWidth: 200 }}
            >
              {isFirst ? (
                <div className="px-4 py-2">
                  <div className="font-bold text-slate-800 dark:text-white text-sm">
                    {roomType.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {SUB_ROW_LABELS[subRow]}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-2 pl-8">
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    {SUB_ROW_LABELS[subRow]}
                  </span>
                </div>
              )}
            </td>

            {/* Rate cells */}
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const cellKey = makeCellKey(roomType.id, dateStr, subRow);

              return (
                <RateGridCell
                  key={cellKey}
                  roomTypeId={roomType.id}
                  date={dateStr}
                  field={subRow}
                  value={state.getDisplayValue(roomType.id, dateStr, subRow)}
                  isDirty={state.isDirty(cellKey)}
                  isEditing={state.editingCell === cellKey}
                  isFocused={state.focusedCell === cellKey}
                  isSelected={state.selection?.selectedKeys.has(cellKey) ?? false}
                  isWeekend={state.isWeekendDay(day)}
                  isToday={state.isToday(day)}
                  onStartEdit={state.startEditing}
                  onCommitEdit={state.commitEdit}
                  onCancelEdit={state.cancelEdit}
                  onSelect={state.selectCell}
                  onNavigate={state.navigateTo}
                />
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
