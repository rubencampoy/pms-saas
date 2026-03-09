'use client';

import { useState, useCallback, useRef, type DragEvent, type MouseEvent } from 'react';
import { addDays, differenceInDays, format, isWeekend, parseISO } from 'date-fns';
import { ReservationBlock } from './reservation-block';
import type { DragState } from './use-calendar-dnd';

interface Reservation {
  id: string;
  guestId: string;
  roomTypeId: string;
  unitId: string | null;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  confirmationCode: string;
  nights: number;
  adults: number;
  children: number;
  totalAmount: string;
  source: string;
  specialRequests: string | null;
  internalNotes: string | null;
}

interface Unit {
  id: string;
  roomTypeId: string;
  name: string;
  floor: string | null;
  housekeepingStatus: string;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  vipStatus: string;
}

export interface DragCreateState {
  unitId: string;
  roomTypeId: string;
  startDate: string;
  endDate: string;
}

interface RoomBlock {
  id: string;
  unitId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string | null;
}

interface UnitRowProps {
  unit: Unit;
  reservations: Reservation[];
  roomBlocks: RoomBlock[];
  guestMap: Map<string, Guest>;
  days: Date[];
  startDate: Date;
  totalDays: number;
  colWidth: number;
  rowHeight: number;
  dragState: DragState | null;
  selectedReservationId: string | null;
  isQuickAssignHighlighted: boolean;
  onQuickAssignClick: ((unitId: string) => void) | null;
  onDragStart: (
    reservationId: string,
    sourceUnitId: string,
    roomTypeId: string,
    checkInDate: string,
    checkOutDate: string,
    nights: number,
    grabOffsetDays: number,
  ) => void;
  onDrop: (targetUnitId: string, e: DragEvent) => void;
  onReservationClick: (reservationId: string, x: number, y: number) => void;
  onContextMenu: (reservationId: string, x: number, y: number) => void;
  onCellClick: (unitId: string, roomTypeId: string, date: string, x: number, y: number) => void;
  onBlockClick: (blockId: string, x: number, y: number) => void;
  dragCreate: DragCreateState | null;
  cellSelection: DragCreateState | null;
  onDragCreateStart: (unitId: string, roomTypeId: string, date: string) => void;
  onDragCreateMove: (date: string) => void;
  onDragCreateEnd: (x: number, y: number) => void;
}

export function UnitRow({
  unit,
  reservations,
  roomBlocks,
  guestMap,
  days,
  startDate,
  totalDays,
  colWidth,
  rowHeight,
  dragState,
  selectedReservationId,
  isQuickAssignHighlighted,
  onQuickAssignClick,
  onDragStart,
  onDrop,
  onReservationClick,
  onContextMenu,
  onCellClick,
  onBlockClick,
  dragCreate,
  cellSelection,
  onDragCreateStart,
  onDragCreateMove,
  onDragCreateEnd,
}: UnitRowProps) {
  const [isDropTarget, setIsDropTarget] = useState(false);

  // Allow drops on any unit (cross-category moves supported)
  const isValidTarget = dragState !== null;

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!isValidTarget) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    [isValidTarget],
  );

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (isValidTarget) setIsDropTarget(true);
    },
    [isValidTarget],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDropTarget(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDropTarget(false);
      if (isValidTarget) {
        onDrop(unit.id, e);
      }
    },
    [isValidTarget, onDrop, unit.id],
  );

  const handleBlockDragStart = useCallback(
    (res: Reservation) => (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', res.id);

      // Compute which day within the block was grabbed
      const blockRect = e.currentTarget.getBoundingClientRect();
      const mouseOffsetPx = e.clientX - blockRect.left;
      const grabOffsetDays = Math.max(0, Math.floor(mouseOffsetPx / colWidth));

      // Delay state update so the browser captures the drag image first
      requestAnimationFrame(() => {
        onDragStart(res.id, unit.id, unit.roomTypeId, res.checkInDate, res.checkOutDate, res.nights, grabOffsetDays);
      });
    },
    [onDragStart, unit.id, unit.roomTypeId, colWidth],
  );

  const handleRowClick = useCallback(() => {
    if (isQuickAssignHighlighted && onQuickAssignClick) {
      onQuickAssignClick(unit.id);
    }
  }, [isQuickAssignHighlighted, onQuickAssignClick, unit.id]);

  // --- Drag-to-create handlers ---
  // Track whether the drag-create was consumed (user actually dragged) to suppress onClick
  const dragCreateConsumedRef = useRef(false);
  const mouseDownCellRef = useRef<string | null>(null);

  const handleCellMouseDown = useCallback(
    (dateStr: string, e: MouseEvent<HTMLDivElement>) => {
      if (isQuickAssignHighlighted) return;
      if (e.button !== 0) return; // Only left click
      // Check if the cell is occupied
      const occupied = reservations.some(
        (r) => r.checkInDate <= dateStr && r.checkOutDate > dateStr,
      );
      if (occupied) return;

      e.preventDefault(); // Prevent text selection
      dragCreateConsumedRef.current = false;
      mouseDownCellRef.current = dateStr;
      onDragCreateStart(unit.id, unit.roomTypeId, dateStr);
    },
    [isQuickAssignHighlighted, reservations, onDragCreateStart, unit.id, unit.roomTypeId],
  );

  const handleRowMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!dragCreate || dragCreate.unitId !== unit.id) return;

      // Find which day column the mouse is over using the row's bounding rect
      const rowRect = e.currentTarget.getBoundingClientRect();
      const relativeX = e.clientX - rowRect.left;
      const dayIndex = Math.floor(relativeX / colWidth);

      const hoveredDay = days[dayIndex];
      if (dayIndex >= 0 && dayIndex < days.length && hoveredDay) {
        const hoveredDate = format(hoveredDay, 'yyyy-MM-dd');
        // Only count as "consumed" drag if mouse moved to a different cell
        if (hoveredDate !== mouseDownCellRef.current) {
          dragCreateConsumedRef.current = true;
        }
        onDragCreateMove(hoveredDate);
      }
    },
    [dragCreate, unit.id, colWidth, days, onDragCreateMove],
  );

  const handleRowMouseUp = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!dragCreate || dragCreate.unitId !== unit.id) return;
      e.stopPropagation();
      onDragCreateEnd(e.clientX, e.clientY);
    },
    [dragCreate, unit.id, onDragCreateEnd],
  );

  // --- Compute drag-create preview block ---
  const isThisRowDragCreating = dragCreate !== null && dragCreate.unitId === unit.id;
  let previewLeft = 0;
  let previewWidth = 0;
  let previewNights = 0;

  if (isThisRowDragCreating && dragCreate) {
    const dcStart = parseISO(dragCreate.startDate);
    const dcEnd = parseISO(dragCreate.endDate);
    previewNights = differenceInDays(dcEnd, dcStart);

    const gridEnd = addDays(startDate, totalDays);
    const visStart = dcStart < startDate ? startDate : dcStart;
    const visEnd = dcEnd > gridEnd ? gridEnd : dcEnd;
    const offsetDays = differenceInDays(visStart, startDate);
    const spanDays = differenceInDays(visEnd, visStart);

    // Half-day positioning (same as reservations):
    // endDate is the checkout day itself, so blockRight = left edge of checkout cell.
    // Add colWidth/2 to reach the midpoint of the checkout cell.
    const isCheckInVisible = dcStart >= startDate;
    const isCheckOutVisible = dcEnd > startDate && dcEnd < gridEnd;

    let blockLeft = offsetDays * colWidth;
    let blockRight = (offsetDays + spanDays) * colWidth;

    if (isCheckInVisible) {
      blockLeft += colWidth / 2;
    }
    if (isCheckOutVisible) {
      blockRight += colWidth / 2;
    }

    const padding = 2;
    previewLeft = blockLeft + padding;
    previewWidth = blockRight - blockLeft - padding * 2;
  }

  // --- Compute persistent selection block (shown while popover is open) ---
  const isThisRowSelected = cellSelection !== null && cellSelection.unitId === unit.id && !isThisRowDragCreating;
  let selLeft = 0;
  let selWidth = 0;
  let selNights = 0;

  if (isThisRowSelected && cellSelection) {
    const csStart = parseISO(cellSelection.startDate);
    const csEnd = parseISO(cellSelection.endDate);
    selNights = differenceInDays(csEnd, csStart);

    const gridEnd = addDays(startDate, totalDays);
    const visStart = csStart < startDate ? startDate : csStart;
    const visEnd = csEnd > gridEnd ? gridEnd : csEnd;
    const offsetDays = differenceInDays(visStart, startDate);
    const spanDays = differenceInDays(visEnd, visStart);

    // Half-day positioning (matches reservations) — check-in midpoint to check-out midpoint
    const isCheckInVisible = csStart >= startDate;
    const isCheckOutVisible = csEnd > startDate && csEnd < gridEnd;

    let blockLeft = offsetDays * colWidth;
    let blockRight = (offsetDays + spanDays) * colWidth;

    if (isCheckInVisible) {
      blockLeft += colWidth / 2;
    }
    if (isCheckOutVisible) {
      blockRight += colWidth / 2;
    }

    const padding = 2;
    selLeft = blockLeft + padding;
    selWidth = blockRight - blockLeft - padding * 2;
  }

  return (
    <div
      className={`border-b border-slate-200 dark:border-slate-700 relative transition-shadow ${
        isDropTarget ? 'ring-2 ring-inset ring-primary bg-primary/5 dark:bg-primary/10' : ''
      } ${
        isQuickAssignHighlighted
          ? 'ring-2 ring-inset ring-green-500 bg-green-50/50 dark:bg-green-900/10 cursor-pointer'
          : ''
      }`}
      style={{ height: rowHeight }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleRowClick}
      onMouseMove={handleRowMouseMove}
      onMouseUp={handleRowMouseUp}
    >
      {/* Day cells background */}
      <div className="flex">
        {days.map((day) => {
          const weekend = isWeekend(day);
          const dateStr = format(day, 'yyyy-MM-dd');
          return (
            <div
              key={day.toISOString()}
              data-calendar-cell
              data-date={dateStr}
              className={`flex-shrink-0 border-r border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors ${
                weekend ? 'bg-amber-50/20 dark:bg-amber-900/5' : ''
              }`}
              style={{ width: colWidth, height: rowHeight }}
              onMouseDown={(e) => handleCellMouseDown(dateStr, e)}
              onClick={(e) => {
                if (isQuickAssignHighlighted) return;
                // Only fire click for popover if user didn't drag (just clicked)
                if (dragCreateConsumedRef.current) {
                  dragCreateConsumedRef.current = false;
                  return;
                }
                onCellClick(unit.id, unit.roomTypeId, dateStr, e.clientX, e.clientY);
              }}
            />
          );
        })}
      </div>

      {/* Reservation blocks overlay — half-day positioning */}
      {reservations.map((res) => {
        const resStart = parseISO(res.checkInDate);
        const resEnd = parseISO(res.checkOutDate);
        const gridEnd = addDays(startDate, totalDays);

        const visStart = resStart < startDate ? startDate : resStart;
        const visEnd = resEnd > gridEnd ? gridEnd : resEnd;
        const offsetDays = differenceInDays(visStart, startDate);
        const spanDays = differenceInDays(visEnd, visStart);

        // Check-in day visible: block starts at midpoint of that day
        const isCheckInVisible = resStart >= startDate;
        // Check-out day visible: block extends into that day's first half
        const isCheckOutVisible = resEnd > startDate && resEnd < gridEnd;

        // Block must have some visible span, or at least a checkout half
        if (spanDays <= 0 && !isCheckOutVisible) return null;

        // Pixel boundaries — no sidebarWidth offset since grid is separate
        let blockLeft = offsetDays * colWidth;
        let blockRight = (offsetDays + spanDays) * colWidth;

        if (isCheckInVisible) {
          blockLeft += colWidth / 2; // Start at midpoint of check-in day
        }
        if (isCheckOutVisible) {
          blockRight += colWidth / 2; // End at midpoint of check-out day
        }

        const padding = 2;
        const left = blockLeft + padding;
        const width = blockRight - blockLeft - padding * 2;

        if (width <= 0) return null;

        const guest = guestMap.get(res.guestId);
        const isDragging = dragState?.reservationId === res.id;
        const guestName = guest ? `${guest.firstName} ${guest.lastName}` : null;

        return (
          <ReservationBlock
            key={res.id}
            id={res.id}
            status={res.status}
            confirmationCode={res.confirmationCode}
            guestName={guestName}
            left={left}
            width={width}
            height={rowHeight - 6}
            isDragging={isDragging}
            isSelected={selectedReservationId === res.id}
            onDragStart={handleBlockDragStart(res)}
            onClick={(e) => onReservationClick(res.id, e.clientX, e.clientY)}
            onContextMenu={(e) => onContextMenu(res.id, e.clientX, e.clientY)}
          />
        );
      })}

      {/* Room block overlays (maintenance / blocked) — half-day positioning like reservations */}
      {roomBlocks.map((block) => {
        const bStart = parseISO(block.startDate);
        const bEnd = parseISO(block.endDate);
        const gridEnd = addDays(startDate, totalDays);

        const visStart = bStart < startDate ? startDate : bStart;
        const visEnd = bEnd > gridEnd ? gridEnd : bEnd;
        const offsetDays = differenceInDays(visStart, startDate);
        const spanDays = differenceInDays(visEnd, visStart);

        if (spanDays <= 0) return null;

        // Half-day positioning: start at midpoint of first day, end at midpoint of last day
        // This matches reservation positioning and prevents visual overlap
        const isStartVisible = bStart >= startDate;
        const isEndVisible = bEnd > startDate && bEnd < gridEnd;

        let blockLeft = offsetDays * colWidth;
        let blockRight = (offsetDays + spanDays) * colWidth;

        if (isStartVisible) {
          blockLeft += colWidth / 2;
        }
        if (isEndVisible) {
          blockRight += colWidth / 2;
        }

        const padding = 2;
        const left = blockLeft + padding;
        const width = blockRight - blockLeft - padding * 2;

        if (width <= 0) return null;

        const isMaintenance = block.type === 'maintenance';

        return (
          <div
            key={block.id}
            className={`absolute top-[3px] rounded-md z-10 flex items-center px-2 overflow-hidden cursor-pointer transition-shadow hover:shadow-md ${
              isMaintenance
                ? 'border border-amber-400 dark:border-amber-600 hover:border-amber-500'
                : 'bg-red-100/80 dark:bg-red-900/40 border border-red-300 dark:border-red-700 hover:border-red-400'
            }`}
            style={{
              left,
              width,
              height: rowHeight - 6,
              ...(isMaintenance
                ? {
                    backgroundImage:
                      'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(251,191,36,0.25) 4px, rgba(251,191,36,0.25) 8px)',
                    backgroundColor: 'rgba(251,191,36,0.08)',
                  }
                : {}),
            }}
            title={block.reason || (isMaintenance ? 'Mantenimiento' : 'Bloqueado')}
            onClick={(e) => {
              e.stopPropagation();
              onBlockClick(block.id, e.clientX, e.clientY);
            }}
          >
            <span className={`material-icons text-sm mr-1 ${isMaintenance ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
              {isMaintenance ? 'build' : 'block'}
            </span>
            <span className={`text-[10px] font-semibold truncate select-none ${isMaintenance ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'}`}>
              {isMaintenance ? 'Mantenimiento' : 'Bloqueado'}
            </span>
          </div>
        );
      })}

      {/* Drag-to-create preview block */}
      {isThisRowDragCreating && previewWidth > 0 && (
        <div
          className="absolute top-[3px] rounded-md bg-primary/25 border-2 border-primary border-dashed z-30 pointer-events-none flex items-center px-2"
          style={{
            left: previewLeft,
            width: previewWidth,
            height: rowHeight - 6,
          }}
        >
          <span className="text-[10px] font-semibold text-primary dark:text-blue-400 truncate select-none">
            {previewNights} {previewNights === 1 ? 'noche' : 'noches'}
          </span>
        </div>
      )}

      {/* Persistent selection block (while popover is open) */}
      {isThisRowSelected && selWidth > 0 && (
        <div
          className="absolute top-[3px] rounded-md bg-primary/20 border-2 border-primary z-20 pointer-events-none flex items-center px-2"
          style={{
            left: selLeft,
            width: selWidth,
            height: rowHeight - 6,
          }}
        >
          <span className="text-[10px] font-semibold text-primary dark:text-blue-400 truncate select-none">
            {selNights} {selNights === 1 ? 'noche' : 'noches'}
          </span>
        </div>
      )}
    </div>
  );
}
