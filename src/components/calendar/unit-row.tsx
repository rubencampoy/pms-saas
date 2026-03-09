'use client';

import { useState, useCallback, type DragEvent } from 'react';
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

interface UnitRowProps {
  unit: Unit;
  reservations: Reservation[];
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
}

export function UnitRow({
  unit,
  reservations,
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

  return (
    <div
      className={`border-b border-slate-100 dark:border-slate-700/50 relative transition-shadow ${
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
    >
      {/* Day cells background */}
      <div className="flex">
        {days.map((day) => {
          const weekend = isWeekend(day);
          const dateStr = format(day, 'yyyy-MM-dd');
          return (
            <div
              key={day.toISOString()}
              className={`flex-shrink-0 border-r border-slate-100 dark:border-slate-700/30 cursor-pointer hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors ${
                weekend ? 'bg-amber-50/20 dark:bg-amber-900/5' : ''
              }`}
              style={{ width: colWidth, height: rowHeight }}
              onClick={(e) => {
                if (isQuickAssignHighlighted) return;
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
    </div>
  );
}
